# Implementación — Centro de Control Digital R&T

Aplicación productiva: <https://rt-sitram-centro-control.vercel.app>

El workspace contiene la PWA React/TypeScript, dominio independiente, Supabase/PostgreSQL con RLS y Storage privado, y sincronización PowerSync/SQLite.

## Desarrollo

Requisitos: Node.js 24, pnpm 11 y Docker Desktop únicamente para el stack Supabase local.

```powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item apps/web/.env.example apps/web/.env.local
pnpm dev
```

Las variables `VITE_*` son públicas y forman parte del bundle. Nunca coloque en ellas `service_role`, contraseñas, PAT ni secretos JWT.

## Validación

```powershell
pnpm repo-map:check
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

El mapa operativo está en `docs/mapa_repositorio.md`. `pnpm repo-map:update` actualiza su inventario estructural cuando cambian aplicaciones, paquetes, features o superficies de backend; `format:check` confirma que siga vigente.

El build genera un service worker con el shell completo, workers y WASM de SQLite. La prueba automatizada no sustituye la comprobación física en Android: cortar la red, operar, cerrar/reabrir la PWA, reconectar y confirmar las colas en cero.

## Supabase

Todo cambio SQL pertenece a `supabase/migrations/`. El acceso persistente usa el perfil local del CLI y el wrapper `pnpm supabase:rt`; ningún token se guarda en Git.

```powershell
pnpm supabase:rt -- migration list --linked
pnpm supabase:rt -- db lint --linked --schema public,private --level warning --fail-on warning
pnpm supabase:rt -- db query --linked --file supabase/tests/identity_company_rls.test.sql
```

Auth no permite signup público. La Edge Function `invite-company-user` crea usuarios solo desde una sesión `management` y deriva empresa/redirect del servidor. El bootstrap del primer administrador requiere una clave administrativa solo en memoria del proceso:

```powershell
pnpm supabase:bootstrap-management -- --email=gerencia@empresa.com --display-name=Nombre --redirect-to=https://dominio/auth/establecer-clave?intent=invite
```

Antes de invitar al equipo configure SMTP productivo en Supabase. No almacene contraseñas en seeds, scripts ni documentación.

## PowerSync

`powersync/streams/product-mvp.yaml` contiene los Sync Streams por perfil, empresa, rol y asignación activos. El wrapper `pnpm powersync:rt` lee el PAT cifrado con DPAPI desde el perfil del sistema y lo elimina del entorno al finalizar.

```powershell
pnpm powersync:rt -- validate --instance-id <INSTANCE_ID> --sync-config-file-path powersync/streams/product-mvp.yaml --validate-only sync-config --output json
pnpm powersync:rt -- status --instance-id <INSTANCE_ID> --output json
```

El conductor escribe primero en SQLite. Fallos terminales y evidencias agotadas requieren una decisión local auditada de reintento o descarte; el logout se bloquea mientras exista trabajo sin resolver. La UI administrativa tiene lectura local parcial, pero sus comandos siguen siendo online-only.

## Vercel

`vercel.json` define instalación, build, fallback SPA, cache de assets y headers. Un cambio de dominio debe actualizar también `supabase/config.toml` y el secreto remoto `APP_ORIGIN`, y luego redesplegar `invite-company-user`.
