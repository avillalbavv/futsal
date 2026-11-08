# Academia de Futsal Piribebuy

Plataforma institucional y sistema privado de gestión deportiva para la Academia de Futsal Piribebuy.

## Funcionalidades incluidas

- Sitio institucional responsive con identidad visual oficial.
- Categorías, cuerpo técnico, horarios, noticias y canales de contacto alimentados desde Supabase.
- Autenticación administrativa sin registro público.
- MFA TOTP obligatorio para acceder a información privada.
- Registro, consulta, filtrado, archivado e importación/exportación CSV de jugadores.
- Tutores, consentimientos, temporadas, categorías e historial de inscripciones.
- Documentación privada en Supabase Storage con enlaces temporales.
- Ficha A4 en PDF.
- CMS para noticias, cuerpo técnico, horarios y configuración institucional.
- Auditoría de movimientos sensibles.
- RLS en todas las tablas expuestas y acceso privado condicionado a rol + `aal2`.

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Variables requeridas:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

La clave publicable puede usarse en el navegador. Nunca se debe agregar una clave `service_role` al frontend.

## Base de datos

La migración está en [`supabase/migrations/20261108214500_initial_academy_platform.sql`](supabase/migrations/20261108214500_initial_academy_platform.sql). Crea las tablas, índices, políticas RLS, funciones de auditoría y buckets.

El procedimiento seguro para habilitar el primer administrador está documentado en [`supabase/README.md`](supabase/README.md).

## Compilación y despliegue

```bash
npm run build
```

Cloudflare Pages debe usar:

- Comando de compilación: `npm run build`
- Directorio de salida: `dist`
- Versión de Node: 22 o superior
- Variables: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`

El archivo `public/_redirects` preserva el enrutamiento SPA en `/admin`.

## Privacidad

La aplicación trata datos de menores. Las copias de cédula, autorizaciones y fotos administrativas permanecen en el bucket privado `player-private`; nunca deben copiarse al bucket público ni exponerse mediante enlaces permanentes.
