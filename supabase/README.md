# Supabase

La migración de este directorio crea el esquema, índices, políticas RLS, auditoría y buckets.

## Primer administrador (procedimiento seguro)

1. Crear el usuario desde **Authentication > Users** en el panel de Supabase. No existe registro público en la aplicación.
2. Iniciar sesión en `/admin` y completar el enrolamiento MFA con una app TOTP.
3. Desde el SQL Editor del proyecto, asignar el rol usando el correo real del usuario:

```sql
insert into public.user_roles (user_id, role, active)
select id, 'super_admin', true
from auth.users
where email = 'correo-del-administrador@example.com'
on conflict (user_id) do update set role = excluded.role, active = true;
```

Los datos privados requieren simultáneamente un rol activo y una sesión MFA con nivel `aal2`.
