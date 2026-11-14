create table public.studybrain_workspace (
 user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 revision uuid not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 4000000)
);
alter table public.studybrain_workspace enable row level security;
revoke all on public.studybrain_workspace from public, anon, authenticated;
grant select, insert, update on public.studybrain_workspace to authenticated;
create policy studybrain_read on public.studybrain_workspace for select to authenticated using ((select auth.uid()) = user_id);
create policy studybrain_insert on public.studybrain_workspace for insert to authenticated with check ((select auth.uid()) = user_id);
create policy studybrain_update on public.studybrain_workspace for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('studybrain-pdfs','studybrain-pdfs',false,26214400,array['application/pdf']);
create policy studybrain_pdf_read on storage.objects for select to authenticated using (bucket_id = 'studybrain-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy studybrain_pdf_write on storage.objects for insert to authenticated with check (bucket_id = 'studybrain-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy studybrain_pdf_update on storage.objects for update to authenticated using (bucket_id = 'studybrain-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'studybrain-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);
