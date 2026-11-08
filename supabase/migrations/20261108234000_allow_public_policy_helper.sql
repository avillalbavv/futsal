-- Las políticas públicas consultan private.is_admin() para que un administrador
-- también pueda previsualizar borradores. Para anon la función siempre devuelve
-- false porque auth.uid() es null; solo necesita permiso de ejecución.
grant usage on schema private to anon;
grant execute on function private.is_admin() to anon;
