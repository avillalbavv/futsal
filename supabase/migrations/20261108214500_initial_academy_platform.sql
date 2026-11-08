-- Academia de Futsal Piribebuy — esquema inicial seguro
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'admin', 'editor', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and active = true
  );
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'super_admin' and active = true
  );
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.is_super_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_super_admin() to authenticated;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  suggested_min_age smallint check (suggested_min_age between 3 and 25),
  suggested_max_age smallint check (suggested_max_age between 3 and 25),
  display_order integer not null default 0,
  active boolean not null default true,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (suggested_min_age is null or suggested_max_age is null or suggested_min_age <= suggested_max_age)
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_date date not null,
  end_date date not null,
  cutoff_date date not null,
  eligibility_rules jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date <= end_date)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  first_names text not null,
  last_names text not null,
  cedula_normalized text not null unique check (cedula_normalized ~ '^[0-9]{5,20}$'),
  birth_date date not null check (birth_date <= current_date),
  registration_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended', 'graduated')),
  notes text,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index players_name_search_idx on public.players using gin ((first_names || ' ' || last_names) extensions.gin_trgm_ops);
create index players_cedula_idx on public.players (cedula_normalized);
create index players_status_idx on public.players (status) where archived_at is null;

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  emergency_phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.player_guardians (
  player_id uuid not null references public.players(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  relationship text not null,
  primary_contact boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (player_id, guardian_id)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  season_id uuid not null references public.seasons(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'inactive', 'transferred', 'completed')),
  enrolled_at date not null default current_date,
  category_override_reason text,
  ended_at date,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, season_id, category_id)
);

create index enrollments_player_idx on public.enrollments (player_id);
create index enrollments_category_season_idx on public.enrollments (category_id, season_id, status);

create table public.player_documents (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  document_type text not null check (document_type in ('profile_photo', 'id_front', 'id_back', 'guardian_authorization', 'image_consent', 'other')),
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  verified boolean not null default false,
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index player_documents_player_idx on public.player_documents (player_id, document_type);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  consent_type text not null check (consent_type in ('enrollment_data', 'image_publication')),
  granted boolean not null,
  text_version text not null,
  granted_at timestamptz not null default now(),
  evidence_document_id uuid references public.player_documents(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  academy_name text not null,
  motto text not null,
  hero_text text not null,
  mission text not null default '',
  vision text not null default '',
  values_text text not null default '',
  phone text,
  whatsapp text,
  email text,
  address text,
  instagram_url text,
  facebook_url text,
  enrollment_open boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  display_order integer not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  excerpt text,
  content text not null,
  cover_path text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  pinned boolean not null default false,
  published_at timestamptz,
  author_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index news_public_idx on public.news (pinned desc, published_at desc) where status = 'published';

create table public.gallery_albums (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_path text,
  published boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.gallery_albums(id) on delete cascade,
  storage_path text not null unique,
  caption text,
  alt_text text not null,
  image_consent_verified boolean not null default false,
  published boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  position text not null,
  bio text,
  credentials text,
  photo_path text,
  published boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.training_schedules (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  location text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text,
  changed_fields text[],
  created_at timestamptz not null default now()
);

create index audit_logs_record_idx on public.audit_logs (table_name, record_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

create or replace function private.audit_sensitive_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_json jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  new_json jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  row_id text := coalesce(new_json->>'id', old_json->>'id', new_json->>'player_id', old_json->>'player_id');
  fields text[];
begin
  select coalesce(array_agg(key order by key), '{}'::text[])
  into fields
  from (
    select key from jsonb_object_keys(old_json || new_json) key
    where old_json->key is distinct from new_json->key
      and key not in ('notes', 'phone', 'email', 'emergency_phone', 'cedula_normalized')
  ) changed;

  insert into public.audit_logs (actor_id, action, table_name, record_id, changed_fields)
  values ((select auth.uid()), tg_op, tg_table_name, row_id, fields);
  return coalesce(new, old);
end;
$$;

revoke all on function private.audit_sensitive_change() from public;

create trigger players_audit after insert or update or delete on public.players
for each row execute function private.audit_sensitive_change();
create trigger enrollments_audit after insert or update or delete on public.enrollments
for each row execute function private.audit_sensitive_change();
create trigger player_documents_audit after insert or update or delete on public.player_documents
for each row execute function private.audit_sensitive_change();
create trigger consents_audit after insert or update or delete on public.consents
for each row execute function private.audit_sensitive_change();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_roles','categories','seasons','players','guardians','enrollments','player_documents',
    'site_settings','site_pages','news','gallery_albums','gallery_images','staff','training_schedules'
  ] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function private.set_updated_at()', table_name, table_name);
  end loop;
end $$;

-- RLS: toda tabla expuesta queda protegida.
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.seasons enable row level security;
alter table public.players enable row level security;
alter table public.guardians enable row level security;
alter table public.player_guardians enable row level security;
alter table public.enrollments enable row level security;
alter table public.player_documents enable row level security;
alter table public.consents enable row level security;
alter table public.site_settings enable row level security;
alter table public.site_pages enable row level security;
alter table public.news enable row level security;
alter table public.gallery_albums enable row level security;
alter table public.gallery_images enable row level security;
alter table public.staff enable row level security;
alter table public.training_schedules enable row level security;
alter table public.audit_logs enable row level security;

create policy "public read active categories" on public.categories for select to anon, authenticated
using (published = true and active = true or (select private.is_admin()));
create policy "public read settings" on public.site_settings for select to anon, authenticated using (true);
create policy "public read published pages" on public.site_pages for select to anon, authenticated
using (status = 'published' or (select private.is_admin()));
create policy "public read published news" on public.news for select to anon, authenticated
using (status = 'published' or (select private.is_admin()));
create policy "public read published albums" on public.gallery_albums for select to anon, authenticated
using (published = true or (select private.is_admin()));
create policy "public read consented gallery images" on public.gallery_images for select to anon, authenticated
using ((published = true and image_consent_verified = true) or (select private.is_admin()));
create policy "public read published staff" on public.staff for select to anon, authenticated
using (published = true or (select private.is_admin()));
create policy "public read published schedules" on public.training_schedules for select to anon, authenticated
using (published = true or (select private.is_admin()));

create policy "admins read own role" on public.user_roles for select to authenticated
using (user_id = (select auth.uid()) or ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2'));
create policy "super admins insert roles" on public.user_roles for insert to authenticated
with check ((select private.is_super_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
create policy "super admins update roles" on public.user_roles for update to authenticated
using ((select private.is_super_admin()) and ((select auth.jwt())->>'aal') = 'aal2')
with check ((select private.is_super_admin()) and ((select auth.jwt())->>'aal') = 'aal2');

-- Operaciones administrativas: rol activo + sesión MFA AAL2.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'categories','seasons','players','guardians','player_guardians','enrollments','player_documents',
    'consents','site_settings','site_pages','news','gallery_albums','gallery_images','staff','training_schedules'
  ] loop
    execute format('create policy "admin insert %1$s" on public.%1$I for insert to authenticated with check ((select private.is_admin()) and ((select auth.jwt())->>''aal'') = ''aal2'')', table_name);
    execute format('create policy "admin update %1$s" on public.%1$I for update to authenticated using ((select private.is_admin()) and ((select auth.jwt())->>''aal'') = ''aal2'') with check ((select private.is_admin()) and ((select auth.jwt())->>''aal'') = ''aal2'')', table_name);
  end loop;
end $$;

create policy "admins read seasons" on public.seasons for select to authenticated
using ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
create policy "admins read players" on public.players for select to authenticated
using ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
create policy "admins read guardians" on public.guardians for select to authenticated
using ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
create policy "admins read player guardians" on public.player_guardians for select to authenticated
using ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
create policy "admins read enrollments" on public.enrollments for select to authenticated
using ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
create policy "admins read documents" on public.player_documents for select to authenticated
using ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
create policy "admins read consents" on public.consents for select to authenticated
using ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
create policy "admins read audit" on public.audit_logs for select to authenticated
using ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');

-- Permisos Data API. RLS sigue siendo la barrera efectiva.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.categories, public.site_settings, public.site_pages, public.news,
  public.gallery_albums, public.gallery_images, public.staff, public.training_schedules to anon;
grant select, insert, update on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Storage: documentos personales privados y material institucional público.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('player-private', 'player-private', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('site-public', 'site-public', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "admins read storage" on storage.objects for select to authenticated
using ((bucket_id in ('player-private','site-public')) and (select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
create policy "admins upload storage" on storage.objects for insert to authenticated
with check ((bucket_id in ('player-private','site-public')) and (select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
create policy "admins update storage" on storage.objects for update to authenticated
using ((bucket_id in ('player-private','site-public')) and (select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2')
with check ((bucket_id in ('player-private','site-public')) and (select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');

-- Contenido inicial verificable. No se agregan logros, cifras ni personas ficticias.
insert into public.categories (code, name, suggested_min_age, suggested_max_age, display_order)
values
  ('SUB-07','Sub 7',5,7,10),
  ('SUB-09','Sub 9',8,9,20),
  ('SUB-11','Sub 11',10,11,30),
  ('SUB-13','Sub 13',12,13,40),
  ('SUB-15','Sub 15',14,15,50),
  ('SUB-17','Sub 17',16,17,60)
on conflict (code) do nothing;

insert into public.site_settings (
  id, academy_name, motto, hero_text, mission, vision, values_text, enrollment_open
) values (
  '00000000-0000-0000-0000-000000000001',
  'Academia de Futsal Piribebuy',
  'Formando talentos, construyendo futuro.',
  'Formación deportiva, disciplina, compañerismo y desarrollo integral.',
  'Brindar formación deportiva integral mediante el futsal.',
  'Consolidar una comunidad deportiva organizada y comprometida con el crecimiento de sus jugadores.',
  'Disciplina · Respeto · Compañerismo · Compromiso',
  false
) on conflict (id) do nothing;

insert into public.site_pages (slug, title, content, status, display_order)
values
  ('nuestra-academia','Nuestra Academia','{"body":"La información institucional será publicada por la administración."}'::jsonb,'published',10),
  ('inscripciones','Inscripciones','{"body":"Consultá los requisitos y canales oficiales habilitados."}'::jsonb,'published',20),
  ('preguntas-frecuentes','Preguntas Frecuentes','{"body":"Contactá a la Academia para recibir información actualizada."}'::jsonb,'published',30)
on conflict (slug) do nothing;

-- Índices de cobertura para relaciones y operaciones de mantenimiento.
create index consents_player_id_idx on public.consents (player_id);
create index consents_guardian_id_idx on public.consents (guardian_id);
create index consents_evidence_document_id_idx on public.consents (evidence_document_id);
create index enrollments_created_by_idx on public.enrollments (created_by);
create index enrollments_season_id_idx on public.enrollments (season_id);
create index gallery_images_album_id_idx on public.gallery_images (album_id);
create index news_author_id_idx on public.news (author_id);
create index player_documents_uploaded_by_idx on public.player_documents (uploaded_by);
create index player_guardians_guardian_id_idx on public.player_guardians (guardian_id);
create index players_created_by_idx on public.players (created_by);
create index site_pages_updated_by_idx on public.site_pages (updated_by);
create index site_settings_updated_by_idx on public.site_settings (updated_by);
create index training_schedules_category_id_idx on public.training_schedules (category_id);
