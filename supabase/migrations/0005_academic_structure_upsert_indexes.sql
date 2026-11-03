-- Live-project correction for 0004: the initial unique indexes were partial,
-- which PostgREST cannot infer as an `ON CONFLICT` target because it does not
-- emit a matching WHERE clause. Recreate them as plain unique indexes.
-- NULL source keys remain distinct, so no legacy row is affected. Idempotent.
drop index if exists public.courses_semester_source_key_idx;
drop index if exists public.timetable_rules_semester_source_key_idx;
drop index if exists public.calendar_events_semester_source_key_idx;
drop index if exists public.academic_days_semester_source_key_idx;
drop index if exists public.document_uploads_owner_hash_idx;
create unique index if not exists courses_semester_source_key_idx on public.courses(semester_id, source_key);
create unique index if not exists timetable_rules_semester_source_key_idx on public.timetable_rules(semester_id, source_key);
create unique index if not exists calendar_events_semester_source_key_idx on public.calendar_events(semester_id, source_key);
create unique index if not exists academic_days_semester_source_key_idx on public.academic_days(semester_id, source_key);
create unique index if not exists document_uploads_owner_hash_idx on public.document_uploads(owner_id, document_kind, content_hash);
