-- Evita reevaluar auth.jwt() por cada fila en políticas administrativas.
alter policy "admins read own role" on public.user_roles
using (user_id = (select auth.uid()) or ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2'));
alter policy "super admins insert roles" on public.user_roles
with check ((select private.is_super_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
alter policy "super admins update roles" on public.user_roles
using ((select private.is_super_admin()) and ((select auth.jwt())->>'aal') = 'aal2')
with check ((select private.is_super_admin()) and ((select auth.jwt())->>'aal') = 'aal2');

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'categories','seasons','players','guardians','player_guardians','enrollments','player_documents',
    'consents','site_settings','site_pages','news','gallery_albums','gallery_images','staff','training_schedules'
  ] loop
    execute format('alter policy "admin insert %1$s" on public.%1$I with check ((select private.is_admin()) and ((select auth.jwt())->>''aal'') = ''aal2'')', table_name);
    execute format('alter policy "admin update %1$s" on public.%1$I using ((select private.is_admin()) and ((select auth.jwt())->>''aal'') = ''aal2'') with check ((select private.is_admin()) and ((select auth.jwt())->>''aal'') = ''aal2'')', table_name);
  end loop;
end $$;

alter policy "admins read seasons" on public.seasons using ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
alter policy "admins read players" on public.players using ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
alter policy "admins read guardians" on public.guardians using ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
alter policy "admins read player guardians" on public.player_guardians using ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
alter policy "admins read enrollments" on public.enrollments using ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
alter policy "admins read documents" on public.player_documents using ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
alter policy "admins read consents" on public.consents using ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
alter policy "admins read audit" on public.audit_logs using ((select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');

alter policy "admins read storage" on storage.objects
using ((bucket_id in ('player-private','site-public')) and (select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
alter policy "admins upload storage" on storage.objects
with check ((bucket_id in ('player-private','site-public')) and (select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
alter policy "admins update storage" on storage.objects
using ((bucket_id in ('player-private','site-public')) and (select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2')
with check ((bucket_id in ('player-private','site-public')) and (select private.is_admin()) and ((select auth.jwt())->>'aal') = 'aal2');
