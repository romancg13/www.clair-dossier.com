create extension if not exists pgcrypto;

alter table public.profiles add column if not exists account_type text;

alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles
set role = case role
  when 'client' then 'client_particulier'
  when 'lawyer' then 'avocat'
  when 'cabinet_admin' then 'admin_cabinet'
  when 'admin' then 'super_admin'
  else role
end
where role in ('client', 'lawyer', 'cabinet_admin', 'admin');
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('client_particulier', 'client_entreprise', 'avocat', 'collaborateur', 'admin_cabinet', 'super_admin'));

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin();
$$;

create or replace function public.is_case_participant(case_row public.cases)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case_row.created_by = auth.uid()
    or case_row.assigned_lawyer_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.cabinet_id is not null
        and p.cabinet_id = case_row.cabinet_id
        and p.role in ('avocat', 'admin_cabinet')
    );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_account_type text := nullif(new.raw_user_meta_data ->> 'account_type', '');
  safe_role text := 'client_particulier';
begin
  if requested_account_type in ('client_entreprise', 'entreprise', 'cabinet') then
    safe_role := 'client_entreprise';
  end if;

  insert into public.profiles (id, email, full_name, account_type, role)
  values (
    new.id,
    new.email,
    left(nullif(new.raw_user_meta_data ->> 'full_name', ''), 120),
    requested_account_type,
    safe_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    account_type = excluded.account_type,
    updated_at = now();
  return new;
end;
$$;

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_super_admin() then
    if old.role is distinct from new.role or old.cabinet_id is distinct from new.cabinet_id then
      raise exception 'Accès refusé.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_fields on public.profiles;
create trigger protect_profile_privileged_fields
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_fields();

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_select_own_or_super_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_super_admin());
create policy "profiles_update_own_basic" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
create policy "profiles_super_admin_all" on public.profiles
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "public_insert_cases" on public.cases;
drop policy if exists "authenticated_insert_cases" on public.cases;
drop policy if exists "cases_select_owner_or_admin" on public.cases;
drop policy if exists "cases_update_owner_lawyer_or_admin" on public.cases;
create policy "cases_insert_owner" on public.cases
  for insert to authenticated
  with check (terms_accepted = true and created_by = auth.uid());
create policy "cases_select_participant" on public.cases
  for select to authenticated
  using (public.is_case_participant(cases));
create policy "cases_update_participant" on public.cases
  for update to authenticated
  using (public.is_case_participant(cases))
  with check (public.is_case_participant(cases));

drop policy if exists "public_insert_case_answers" on public.case_intake_answers;
drop policy if exists "authenticated_insert_case_answers" on public.case_intake_answers;
drop policy if exists "case_answers_select_related" on public.case_intake_answers;
create policy "case_answers_insert_owner" on public.case_intake_answers
  for insert to authenticated
  with check (
    consent_given = true
    and exists (select 1 from public.cases c where c.id = case_id and c.created_by = auth.uid())
  );
create policy "case_answers_select_participant" on public.case_intake_answers
  for select to authenticated
  using (exists (select 1 from public.cases c where c.id = case_id and public.is_case_participant(c)));

drop policy if exists "documents_select_related" on public.documents;
drop policy if exists "documents_insert_owner" on public.documents;
drop policy if exists "documents_update_related" on public.documents;
create policy "documents_select_participant" on public.documents
  for select to authenticated
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.cases c where c.id = case_id and public.is_case_participant(c))
  );
create policy "documents_insert_owner" on public.documents
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and confidentiality = 'private'
    and exists (select 1 from public.cases c where c.id = case_id and public.is_case_participant(c))
  );
create policy "documents_update_participant" on public.documents
  for update to authenticated
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.cases c where c.id = case_id and public.is_case_participant(c))
  )
  with check (
    owner_id = auth.uid()
    or exists (select 1 from public.cases c where c.id = case_id and public.is_case_participant(c))
  );
create policy "documents_delete_participant" on public.documents
  for delete to authenticated
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.cases c where c.id = case_id and public.is_case_participant(c))
  );

drop policy if exists "messages_select_related" on public.messages;
drop policy if exists "messages_insert_sender" on public.messages;
drop policy if exists "messages_update_recipient" on public.messages;
create policy "messages_select_participant" on public.messages
  for select to authenticated
  using (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or exists (select 1 from public.cases c where c.id = case_id and public.is_case_participant(c))
  );
create policy "messages_insert_sender_participant" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and length(body) <= 5000
    and exists (select 1 from public.cases c where c.id = case_id and public.is_case_participant(c))
  );
create policy "messages_update_recipient" on public.messages
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists "payments_select_owner_or_admin" on public.payments;
drop policy if exists "subscriptions_select_owner_or_admin" on public.subscriptions;
create policy "payments_select_owner" on public.payments
  for select to authenticated
  using (user_id = auth.uid());
create policy "subscriptions_select_owner" on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid());

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_stripe_checkout_session_unique') then
    alter table public.payments add constraint payments_stripe_checkout_session_unique unique (stripe_checkout_session_id);
  end if;
end $$;

drop policy if exists "admin_select_contact_requests" on public.contact_requests;
drop policy if exists "admin_update_contact_requests" on public.contact_requests;
drop policy if exists "admin_select_newsletter" on public.newsletter_subscribers;
drop policy if exists "admin_select_demo_requests" on public.demo_requests;
create policy "super_admin_select_contact_requests" on public.contact_requests for select to authenticated using (public.is_super_admin());
create policy "super_admin_update_contact_requests" on public.contact_requests for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "super_admin_select_newsletter" on public.newsletter_subscribers for select to authenticated using (public.is_super_admin());
create policy "super_admin_select_demo_requests" on public.demo_requests for select to authenticated using (public.is_super_admin());

drop policy if exists "public_insert_contact_requests" on public.contact_requests;
drop policy if exists "public_insert_newsletter" on public.newsletter_subscribers;
drop policy if exists "public_insert_demo_requests" on public.demo_requests;
create policy "public_insert_contact_requests" on public.contact_requests
  for insert to anon, authenticated
  with check (
    consent_given = true
    and status = 'new'
    and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    and length(name) between 1 and 160
    and length(message) between 1 and 2000
  );
create policy "public_insert_newsletter" on public.newsletter_subscribers
  for insert to anon, authenticated
  with check (
    consent_given = true
    and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    and (source is null or length(source) <= 80)
  );
create policy "public_insert_demo_requests" on public.demo_requests
  for insert to anon, authenticated
  with check (
    consent_given = true
    and status = 'new'
    and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    and length(name) between 1 and 160
    and length(organization) between 1 and 180
    and (message is null or length(message) <= 2000)
  );

drop policy if exists "admin_manage_blog_categories" on public.blog_categories;
drop policy if exists "admin_manage_blog_posts" on public.blog_posts;
drop policy if exists "admin_select_audit_logs" on public.audit_logs;
drop policy if exists "admin_insert_audit_logs" on public.audit_logs;
create policy "super_admin_manage_blog_categories" on public.blog_categories for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "super_admin_manage_blog_posts" on public.blog_posts for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "super_admin_select_audit_logs" on public.audit_logs for select to authenticated using (public.is_super_admin());
create policy "super_admin_insert_audit_logs" on public.audit_logs for insert to authenticated with check (public.is_super_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-documents',
  'case-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "case_documents_select_private" on storage.objects;
drop policy if exists "case_documents_insert_private" on storage.objects;
drop policy if exists "case_documents_update_private" on storage.objects;
drop policy if exists "case_documents_delete_private" on storage.objects;
create policy "case_documents_select_private" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'case-documents'
    and exists (
      select 1 from public.documents d
      where d.file_path = storage.objects.name
        and (
          d.owner_id = auth.uid()
          or exists (select 1 from public.cases c where c.id = d.case_id and public.is_case_participant(c))
        )
    )
  );
create policy "case_documents_insert_private" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'case-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "case_documents_update_private" on storage.objects
  for update to authenticated
  using (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "case_documents_delete_private" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'case-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.documents d
        join public.cases c on c.id = d.case_id
        where d.file_path = storage.objects.name
          and public.is_case_participant(c)
      )
    )
  );
