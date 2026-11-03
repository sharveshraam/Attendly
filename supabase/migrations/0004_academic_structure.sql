-- Attendly automatic academic structure detection (2026-11-03).
--
-- STRICTLY ADDITIVE. Every existing table, column, RLS policy, table grant,
-- bucket, Auth setting, API key and production row is preserved. No DROP,
-- TRUNCATE, DELETE, policy rewrite or enum change. The only REVOKE below is on
-- the NEW function created by this file (deny anon/public EXECUTE on a brand
-- new RPC); no existing grant or policy is touched.
--
-- Reuses the existing data model:
--   semesters            -> semester start/end
--   courses              -> detected courses (+ faculty, source_key)
--   timetable_rules      -> weekly template (+ session type, faculty, revision, source_key)
--   academic_days        -> dated calendar exceptions (+ replacement day, partial scope, source_key)
--   calendar_events      -> individual dated sessions (+ source_key, session_date, origin)
--   attendance_records   -> confirmed marks (unchanged, still owner-private)
--   document_uploads     -> import history / idempotency (+ content_hash, confirmation)
--   semester_snapshots   -> cached generated projections
--   schedule_change_log  -> audit trail
--
-- All new columns are nullable or have a safe default, so existing rows are
-- unchanged. Ownership continues to be enforced by the 42 existing policies;
-- no new policy is required because "FOR ALL" policies cover added columns.

-- ---------------------------------------------------------------- courses --
alter table public.courses add column if not exists faculty text;
alter table public.courses add column if not exists source_key text;
alter table public.courses add column if not exists detection_source text;
alter table public.courses add column if not exists confirmed_at timestamptz;

-- -------------------------------------------------------- timetable_rules --
alter table public.timetable_rules add column if not exists session_type text not null default 'lecture'
  check (session_type in ('lecture','tutorial','lab','practical','seminar','unknown'));
alter table public.timetable_rules add column if not exists faculty text;
alter table public.timetable_rules add column if not exists source_key text;
alter table public.timetable_rules add column if not exists revision text not null default 'base';

-- --------------------------------------------------------- academic_days --
alter table public.academic_days add column if not exists follows_weekday smallint
  check (follows_weekday is null or follows_weekday between 0 and 6);
alter table public.academic_days add column if not exists closure_scope text not null default 'full_day'
  check (closure_scope in ('full_day','partial','unknown'));
alter table public.academic_days add column if not exists start_time time;
alter table public.academic_days add column if not exists end_time time;
alter table public.academic_days add column if not exists exception_type text;
alter table public.academic_days add column if not exists source_key text;
alter table public.academic_days add column if not exists confirmed boolean not null default true;

-- -------------------------------------------------------- calendar_events --
alter table public.calendar_events add column if not exists source_key text;
alter table public.calendar_events add column if not exists session_date date;
alter table public.calendar_events add column if not exists session_type text;
alter table public.calendar_events add column if not exists origin text;
alter table public.calendar_events add column if not exists import_id uuid
  references public.document_uploads(id) on delete set null;

-- ------------------------------------------------------- document_uploads --
alter table public.document_uploads add column if not exists content_hash text;
alter table public.document_uploads add column if not exists confirmed_at timestamptz;
alter table public.document_uploads add column if not exists import_batch_id uuid;
alter table public.document_uploads add column if not exists sheet_index integer;

-- ------------------------------------------------------------------ indexes --
-- Unique indexes make repeated imports of the SAME document idempotent and are
-- inferred by PostgREST `ON CONFLICT` upserts. NULL source keys stay distinct,
-- so legacy rows are unaffected. (Migration 0005 reapplies these without a
-- partial predicate on the already-live project.)
create unique index if not exists courses_semester_source_key_idx
  on public.courses(semester_id, source_key);
create unique index if not exists timetable_rules_semester_source_key_idx
  on public.timetable_rules(semester_id, source_key);
create unique index if not exists calendar_events_semester_source_key_idx
  on public.calendar_events(semester_id, source_key);
create unique index if not exists academic_days_semester_source_key_idx
  on public.academic_days(semester_id, source_key);
create unique index if not exists document_uploads_owner_hash_idx
  on public.document_uploads(owner_id, document_kind, content_hash);

create index if not exists timetable_rules_semester_weekday_idx
  on public.timetable_rules(semester_id, weekday);
create index if not exists calendar_events_semester_course_start_idx
  on public.calendar_events(semester_id, course_id, starts_at);
create index if not exists calendar_events_semester_date_idx
  on public.calendar_events(semester_id, session_date);
create index if not exists document_uploads_owner_created_idx
  on public.document_uploads(owner_id, created_at desc);

-- ------------------------------------------- shared, RLS-safe count RPC --
-- Both the website and the Android app may call this read-only function. It is
-- SECURITY INVOKER: the caller's own RLS applies to calendar_events, semesters
-- and attendance_records, so one user can never see another user's marks.
-- Percentages use the same rule as the canonical attendance engine:
-- denominator = present + absent; excused is conducted but excluded;
-- unmarked is never an absence; cancelled/rescheduled originals are excluded.
create or replace function public.expected_class_counts(
  p_semester uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  course_id uuid,
  scheduled bigint,
  cancelled bigint,
  rescheduled bigint,
  attended bigint,
  absent bigint,
  excused bigint,
  pending bigint,
  attended_percent numeric
)
language sql stable security invoker set search_path = ''
as $$
  with bounds as (
    select
      coalesce(p_from, s.start_date) as lo,
      coalesce(p_to, s.end_date, (s.start_date + interval '4 months')::date) as hi
    from public.semesters s
    where s.id = p_semester
      and (
        s.owner_id = (select auth.uid())
        or (s.group_id is not null and public.is_group_member(s.group_id))
      )
  ),
  events as (
    select e.id, e.course_id, e.status, r.status as mark
    from public.calendar_events e
    cross join bounds b
    left join public.attendance_records r
      on r.event_id = e.id and r.user_id = (select auth.uid())
    where e.semester_id = p_semester
      and e.kind = 'class'
      and coalesce(e.session_date, (e.starts_at at time zone 'UTC')::date) between b.lo and b.hi
  )
  select
    e.course_id,
    count(*) filter (where e.status = 'scheduled') as scheduled,
    count(*) filter (where e.status = 'cancelled') as cancelled,
    count(*) filter (where e.status = 'rescheduled') as rescheduled,
    count(*) filter (where e.status = 'scheduled' and e.mark = 'present') as attended,
    count(*) filter (where e.status = 'scheduled' and e.mark = 'absent') as absent,
    count(*) filter (where e.status = 'scheduled' and e.mark = 'excused') as excused,
    count(*) filter (where e.status = 'scheduled' and (e.mark is null or e.mark = 'unmarked')) as pending,
    case
      when count(*) filter (where e.status = 'scheduled' and e.mark in ('present','absent')) = 0 then null
      else round(
        100.0 * count(*) filter (where e.status = 'scheduled' and e.mark = 'present')
        / count(*) filter (where e.status = 'scheduled' and e.mark in ('present','absent')),
        1
      )
    end as attended_percent
  from events e
  where e.course_id is not null
  group by e.course_id
$$;

revoke all on function public.expected_class_counts(uuid, date, date) from public, anon;
grant execute on function public.expected_class_counts(uuid, date, date) to authenticated, service_role;
