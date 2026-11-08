# Supabase

La migración de este directorio crea el esquema, índices, políticas RLS, auditoría y buckets.

## Primer administrador (procedimiento seguro)

1. Crear el usuario desde **Authentication > Users** en el panel de Supabase. No existe registro público en la aplicación.
2. Desde el SQL Editor del proyecto, asignar el rol usando el correo real del usuario:

```sql
insert into public.user_roles (user_id, role, active)
select id, 'super_admin', true
from auth.users
where email = 'correo-del-administrador@example.com'
on conflict (user_id) do update set role = excluded.role, active = true;
```

Los datos privados requieren un usuario autenticado con un rol administrativo activo.
