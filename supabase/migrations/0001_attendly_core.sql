-- Attendly core schema. Apply in Supabase SQL Editor or via Supabase CLI.
-- Every exposed table has RLS enabled. Attendance is private to its owner.
create extension if not exists pgcrypto;

create type public.group_role as enum ('owner','admin','member');
create type public.calendar_event_kind as enum ('class','exam','holiday','deadline','other');
create type public.class_status as enum ('scheduled','cancelled','rescheduled','completed');
create type public.attendance_status as enum ('present','absent','excused','unmarked');
create type public.academic_day_kind as enum ('instructional','non_instructional','holiday','exam','closure','special_working');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(8),'hex'),1,10)),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.group_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key(group_id,user_id)
);

create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  name text not null,
  institution text,
  start_date date not null,
  end_date date,
  attendance_target numeric(5,2) not null default 75 check(attendance_target between 0 and 100),
  prediction_mode text not null default 'rolling' check(prediction_mode in ('fixed','rolling')),
  created_at timestamptz not null default now(),
  check(end_date is null or end_date >= start_date)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  code text,
  name text not null,
  category text not null default 'theory',
  attendance_target numeric(5,2) check(attendance_target between 0 and 100),
  calculation_mode text not null default 'class_count' check(calculation_mode in ('class_count','hours')),
  color text not null default '#8798ff',
  created_at timestamptz not null default now()
);

-- Repeating weekly timetable: weekday 0=Sunday through 6=Saturday.
create table public.timetable_rules (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  weekday smallint not null check(weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  location text,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(),
  check(ends_at > starts_at)
);

create table public.academic_days (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  day date not null,
  kind public.academic_day_kind not null,
  title text,
  notes text,
  unique(semester_id,day)
);

-- Shared schedule objects. These never store a student's attendance.
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  kind public.calendar_event_kind not null default 'class',
  status public.class_status not null default 'scheduled',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  description text,
  source text not null default 'manual',
  verification_status text not null default 'confirmed' check(verification_status in ('unverified','proposed','confirmed','rejected')),
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at > starts_at)
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  status public.attendance_status not null default 'unmarked',
  attended_minutes integer check(attended_minutes is null or attended_minutes >= 0),
  note text,
  marked_at timestamptz,
  unique(user_id,event_id)
);

create table public.document_uploads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid references public.semesters(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  document_kind text not null check(document_kind in ('timetable','academic_calendar','exam_schedule','other')),
  extraction_status text not null default 'uploaded' check(extraction_status in ('uploaded','processing','review_required','approved','failed')),
  extracted_data jsonb,
  created_at timestamptz not null default now()
);

create table public.schedule_change_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.calendar_events(id) on delete set null,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz,
  status text not null default 'pending' check(status in ('pending','in_progress','submitted')),
  created_at timestamptz not null default now()
);

create table public.course_resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  resource_url text,
  storage_path text,
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_reminder boolean not null default true,
  schedule_changes boolean not null default true,
  attendance_warnings boolean not null default true,
  assignment_reminders boolean not null default true,
  reminder_time time not null default '07:00',
  timezone text not null default 'Asia/Kolkata'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.calendar_polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  options jsonb not null,
  closes_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.calendar_poll_votes (
  poll_id uuid not null references public.calendar_polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_index integer not null,
  created_at timestamptz not null default now(),
  primary key(poll_id,user_id)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  unique(user_id,endpoint)
);

create table public.semester_snapshots (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  snapshot_name text not null,
  snapshot_data jsonb not null,
  created_at timestamptz not null default now()
);

-- These narrow boolean helpers bypass group_members RLS to avoid recursive
-- policy evaluation. They expose no membership rows and use a fixed search path.
create or replace function public.is_group_member(target_group uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group and gm.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_manage_group(target_group uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group and gm.user_id = (select auth.uid())
      and gm.role in ('owner','admin')
  );
$$;

-- Group creators become owners atomically with the group insert.
create or replace function public.add_group_creator_as_owner()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.group_members(group_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger group_creator_membership
after insert on public.groups
for each row execute function public.add_group_creator_as_owner();

-- Joining by invite code is the only member self-enrollment path. The caller
-- never receives another user's records or elevated membership privileges.
create or replace function public.join_group_by_invite(invite text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  target_group uuid;
  joining_user uuid := (select auth.uid());
begin
  if joining_user is null then
    raise exception 'Authentication required';
  end if;
  select g.id into target_group
  from public.groups g
  where g.invite_code = upper(trim(invite));
  if target_group is null then
    raise exception 'Invite code not found';
  end if;
  insert into public.group_members(group_id, user_id, role)
  values (target_group, joining_user, 'member')
  on conflict (group_id, user_id) do nothing;
  return target_group;
end;
$$;

revoke all on function public.join_group_by_invite(text) from public;
grant execute on function public.join_group_by_invite(text) to authenticated;

-- Only a current group owner may promote or demote an existing member.
-- Ownership itself cannot be reassigned through this function.
create or replace function public.set_group_member_role(
  target_group uuid,
  target_user uuid,
  target_role public.group_role
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group
      and gm.user_id = (select auth.uid())
      and gm.role = 'owner'
  ) then
    raise exception 'Only a group owner can change member roles';
  end if;
  if target_role not in ('admin', 'member') then
    raise exception 'The owner role cannot be assigned through this function';
  end if;
  update public.group_members
  set role = target_role
  where group_id = target_group and user_id = target_user and role <> 'owner';
  if not found then
    raise exception 'Member not found or is the group owner';
  end if;
end;
$$;

revoke all on function public.set_group_member_role(uuid, uuid, public.group_role) from public;
grant execute on function public.set_group_member_role(uuid, uuid, public.group_role) to authenticated;

-- Enable RLS on every exposed table.
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.semesters enable row level security;
alter table public.courses enable row level security;
alter table public.timetable_rules enable row level security;
alter table public.academic_days enable row level security;
alter table public.calendar_events enable row level security;
alter table public.attendance_records enable row level security;
alter table public.document_uploads enable row level security;
alter table public.schedule_change_log enable row level security;
alter table public.assignments enable row level security;
alter table public.course_resources enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.calendar_polls enable row level security;
alter table public.calendar_poll_votes enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.semester_snapshots enable row level security;

-- Profiles: private by default; group members may see basic profile rows.
create policy "profile self select" on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy "profile self insert" on public.profiles for insert to authenticated with check(id=(select auth.uid()));
create policy "profile self update" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));

create policy "group members can view group" on public.groups for select to authenticated using(public.is_group_member(id) or created_by=(select auth.uid()));
create policy "authenticated can create group" on public.groups for insert to authenticated with check(created_by=(select auth.uid()));
create policy "group admins update" on public.groups for update to authenticated using(public.can_manage_group(id)) with check(public.can_manage_group(id));
create policy "group owner delete" on public.groups for delete to authenticated using(created_by=(select auth.uid()));

create policy "members view memberships" on public.group_members for select to authenticated using(public.is_group_member(group_id) or user_id=(select auth.uid()));
create policy "group admins add members" on public.group_members for insert to authenticated with check(public.can_manage_group(group_id) and role='member');
create policy "admins remove members or self-leave" on public.group_members for delete to authenticated
using((public.can_manage_group(group_id) and role <> 'owner') or (user_id=(select auth.uid()) and role <> 'owner'));

create policy "semester owner or group member read" on public.semesters for select to authenticated using(owner_id=(select auth.uid()) or (group_id is not null and public.is_group_member(group_id)));
create policy "semester owner create" on public.semesters for insert to authenticated
with check(owner_id=(select auth.uid()) and (group_id is null or (public.is_group_member(group_id) and public.can_manage_group(group_id))));
create policy "semester owner update" on public.semesters for update to authenticated
using(owner_id=(select auth.uid()))
with check(owner_id=(select auth.uid()) and (group_id is null or (public.is_group_member(group_id) and public.can_manage_group(group_id))));
create policy "semester owner delete" on public.semesters for delete to authenticated using(owner_id=(select auth.uid()));

-- Courses and schedule configuration inherit semester ownership/group visibility.
create policy "course read" on public.courses for select to authenticated using(exists(select 1 from public.semesters s where s.id=semester_id and (s.owner_id=(select auth.uid()) or (s.group_id is not null and public.is_group_member(s.group_id)))));
create policy "course owner write" on public.courses for all to authenticated using(exists(select 1 from public.semesters s where s.id=semester_id and s.owner_id=(select auth.uid()))) with check(exists(select 1 from public.semesters s where s.id=semester_id and s.owner_id=(select auth.uid())));
create policy "rules read" on public.timetable_rules for select to authenticated using(exists(select 1 from public.semesters s where s.id=semester_id and (s.owner_id=(select auth.uid()) or (s.group_id is not null and public.is_group_member(s.group_id)))));
create policy "rules owner write" on public.timetable_rules for all to authenticated using(exists(select 1 from public.semesters s where s.id=semester_id and s.owner_id=(select auth.uid()))) with check(exists(select 1 from public.semesters s where s.id=semester_id and s.owner_id=(select auth.uid())));
create policy "academic days read" on public.academic_days for select to authenticated using(exists(select 1 from public.semesters s where s.id=semester_id and (s.owner_id=(select auth.uid()) or (s.group_id is not null and public.is_group_member(s.group_id)))));
create policy "academic days owner write" on public.academic_days for all to authenticated using(exists(select 1 from public.semesters s where s.id=semester_id and s.owner_id=(select auth.uid()))) with check(exists(select 1 from public.semesters s where s.id=semester_id and s.owner_id=(select auth.uid())));

-- Group events must belong to that group's semester. Members can propose
-- changes, while owners/admins can confirm and edit shared schedule events.
create policy "events visible to owner or group" on public.calendar_events for select to authenticated using(
  exists(select 1 from public.semesters s where s.id=calendar_events.semester_id and s.owner_id=(select auth.uid()))
  or (calendar_events.group_id is not null
      and public.is_group_member(calendar_events.group_id)
      and exists(select 1 from public.semesters s where s.id=calendar_events.semester_id and s.group_id=calendar_events.group_id))
);
create policy "event creator or group admin can add" on public.calendar_events for insert to authenticated with check(
  created_by=(select auth.uid()) and exists(
    select 1 from public.semesters s where s.id=calendar_events.semester_id and (
      (calendar_events.group_id is null and s.owner_id=(select auth.uid()))
      or (calendar_events.group_id is not null and s.group_id=calendar_events.group_id
          and public.is_group_member(calendar_events.group_id)
          and (public.can_manage_group(calendar_events.group_id) or verification_status='proposed'))
    )
    and (calendar_events.course_id is null or exists(select 1 from public.courses c where c.id=calendar_events.course_id and c.semester_id=calendar_events.semester_id))
  )
);
create policy "group members propose event updates" on public.calendar_events for update to authenticated
using(
  (group_id is null and created_by=(select auth.uid())
   and exists(select 1 from public.semesters s where s.id=calendar_events.semester_id and s.owner_id=(select auth.uid())))
  or (group_id is not null and public.is_group_member(group_id)
      and exists(select 1 from public.semesters s where s.id=calendar_events.semester_id and s.group_id=calendar_events.group_id)
      and (public.can_manage_group(group_id) or (created_by=(select auth.uid()) and verification_status in ('unverified','proposed'))))
)
with check(
  (
  (group_id is null and created_by=(select auth.uid())
   and exists(select 1 from public.semesters s where s.id=calendar_events.semester_id and s.owner_id=(select auth.uid())))
  or (group_id is not null and public.is_group_member(group_id)
      and exists(select 1 from public.semesters s where s.id=calendar_events.semester_id and s.group_id=calendar_events.group_id)
      and ((public.can_manage_group(group_id) and verification_status in ('unverified','proposed','confirmed','rejected'))
           or (created_by=(select auth.uid()) and verification_status in ('unverified','proposed'))))
  )
  and (calendar_events.course_id is null or exists(select 1 from public.courses c where c.id=calendar_events.course_id and c.semester_id=calendar_events.semester_id))
);
create policy "event creator or group admin delete" on public.calendar_events for delete to authenticated using(
  (group_id is null and created_by=(select auth.uid())
   and exists(select 1 from public.semesters s where s.id=calendar_events.semester_id and s.owner_id=(select auth.uid())))
  or (group_id is not null and public.can_manage_group(group_id)
      and exists(select 1 from public.semesters s where s.id=calendar_events.semester_id and s.group_id=calendar_events.group_id))
);

create policy "attendance private select" on public.attendance_records for select to authenticated using(user_id=(select auth.uid()));
create policy "attendance private insert" on public.attendance_records for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.calendar_events e where e.id=event_id));
create policy "attendance private update" on public.attendance_records for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "attendance private delete" on public.attendance_records for delete to authenticated using(user_id=(select auth.uid()));

create policy "uploads private all" on public.document_uploads for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "change log group read" on public.schedule_change_log for select to authenticated using(exists(select 1 from public.semesters s where s.id=semester_id and (s.owner_id=(select auth.uid()) or (s.group_id is not null and public.is_group_member(s.group_id)))));
create policy "change log actor insert" on public.schedule_change_log for insert to authenticated
with check(actor_id=(select auth.uid()) and exists(
  select 1 from public.semesters s where s.id=schedule_change_log.semester_id and
    (s.owner_id=(select auth.uid()) or (s.group_id is not null and public.is_group_member(s.group_id)))
) and (event_id is null or exists(select 1 from public.calendar_events e where e.id=event_id and e.semester_id=schedule_change_log.semester_id)));
create policy "assignments owner all" on public.assignments for all to authenticated
using(owner_id=(select auth.uid()))
with check(owner_id=(select auth.uid()) and exists(select 1 from public.semesters s where s.id=semester_id and s.owner_id=(select auth.uid())) and (course_id is null or exists(select 1 from public.courses c where c.id=course_id and c.semester_id=assignments.semester_id)));
create policy "resources owner all" on public.course_resources for all to authenticated
using(owner_id=(select auth.uid()))
with check(owner_id=(select auth.uid()) and exists(select 1 from public.courses c join public.semesters s on s.id=c.semester_id where c.id=course_id and s.owner_id=(select auth.uid())));
create policy "notification preferences self" on public.notification_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "notifications self" on public.notifications for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "poll members read" on public.calendar_polls for select to authenticated using(public.is_group_member(group_id));
create policy "poll members create" on public.calendar_polls for insert to authenticated with check(created_by=(select auth.uid()) and public.is_group_member(group_id));
create policy "poll creator manage" on public.calendar_polls for update to authenticated using(created_by=(select auth.uid())) with check(created_by=(select auth.uid()));
create policy "poll vote private" on public.calendar_poll_votes for all to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.calendar_polls p where p.id=poll_id and public.is_group_member(p.group_id))) with check(user_id=(select auth.uid()) and exists(select 1 from public.calendar_polls p where p.id=poll_id and public.is_group_member(p.group_id)));
create policy "push subscriptions private" on public.push_subscriptions for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "snapshots owner read" on public.semester_snapshots for select to authenticated using(created_by=(select auth.uid()));
create policy "snapshots owner write" on public.semester_snapshots for all to authenticated
using(created_by=(select auth.uid()))
with check(created_by=(select auth.uid()) and exists(select 1 from public.semesters s where s.id=semester_id and s.owner_id=(select auth.uid())));

-- Documents are stored in a private bucket under a first-level folder equal to
-- the owning auth UID: <uid>/<generated-object-name>.
insert into storage.buckets(id, name, public)
values ('academic-documents', 'academic-documents', false)
on conflict (id) do update set public = false;

create policy "academic docs owner select" on storage.objects for select to authenticated
using(bucket_id='academic-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "academic docs owner insert" on storage.objects for insert to authenticated
with check(bucket_id='academic-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "academic docs owner update" on storage.objects for update to authenticated
using(bucket_id='academic-documents' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='academic-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "academic docs owner delete" on storage.objects for delete to authenticated
using(bucket_id='academic-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Publish only tables that the app subscribes to. Realtime evaluates their
-- SELECT RLS policies for each user's subscription.
do $$
declare table_name text;
begin
  if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
    raise exception 'Supabase Realtime publication is missing';
  end if;
  foreach table_name in array array['calendar_events','attendance_records','group_members','calendar_polls','calendar_poll_votes','notifications'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

-- Create a profile automatically when an auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id,display_name)
  values(new.id, coalesce(new.raw_user_meta_data->>'display_name',''));
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Indexes for common calendar and attendance queries.
create index calendar_events_semester_start_idx on public.calendar_events(semester_id,starts_at);
create index calendar_events_group_start_idx on public.calendar_events(group_id,starts_at);
create index attendance_user_idx on public.attendance_records(user_id,event_id);
create index courses_semester_idx on public.courses(semester_id);
create index assignments_owner_due_idx on public.assignments(owner_id,due_at);

