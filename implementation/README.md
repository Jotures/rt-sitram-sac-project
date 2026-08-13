# Implementación — Technical Spike

`implementation/` contiene todos los artefactos ejecutables del Centro de Control Digital R&T. La raíz del repositorio se reserva para gobierno y documentación.

## Requisitos

- Node.js 24 LTS (`>=24.0.0 <25`) y pnpm 11 (`>=11.19.0 <12`).
- Docker Desktop (o runtime Docker-compatible) iniciado y con su daemon accesible. El stack local requiere memoria disponible de forma razonable; Docker recomienda al menos 4 GB para el conjunto de servicios.

Desde `implementation/`:

```powershell
corepack enable
pnpm install --frozen-lockfile
```

Las validaciones del workspace son `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test` y `pnpm build`.

## Supabase local

La infraestructura versionable está en `supabase/`: `config.toml`, migraciones, scripts técnicos y pruebas futuras. El CLI oficial se fija como `supabase@2.114.0` en las dependencias de desarrollo, por lo que debe ejecutarse mediante los scripts de pnpm, nunca como una instalación global.

Supabase local es exclusivamente para desarrollo. No está endurecido para producción, no debe exponerse a redes externas y no contiene datos reales. Storage permanece deshabilitado; PowerSync aún no está configurado.

Inicie, consulte o detenga el stack:

```powershell
pnpm supabase:start
pnpm supabase:status
pnpm supabase:stop
```

El primer inicio descarga las imágenes requeridas. Para reconstruir exclusivamente la base local desde cero —operación destructiva solo sobre datos locales— use:

```powershell
pnpm supabase:reset
```

`supabase:reset` aplica las migraciones versionadas en orden. No hay seed de dominio ni credenciales versionadas.

## Cliente web y Auth local

Después de iniciar el stack, copie el ejemplo y complete solo los valores públicos que muestra `pnpm supabase:status`:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
```

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY local>
```

Si el CLI muestra `ANON_KEY` en vez de `PUBLISHABLE_KEY`, úsela temporalmente como valor compatible de `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca use `SERVICE_ROLE_KEY`, secretos de JWT ni una contraseña en una variable `VITE_*`.

Auth por email/contraseña está activo, pero el registro público está deshabilitado. Cree usuarios técnicos ficticios solo después de arrancar el stack. El script solicita correo y contraseña segura; no deja la contraseña en archivos ni la imprime:

```powershell
pnpm supabase:create-test-user
```

Para una comprobación de aislamiento, cree dos usuarios ficticios distintos y ejecute el script, que solicita sus credenciales de forma segura:

```powershell
pnpm supabase:verify-spike-rls
```

Inicie la web con `pnpm dev`. Debe mostrar `Supabase: Configured`. Con un usuario técnico creado, compruebe login válido, `AUTHENTICATED`, recarga con sesión persistente, error con contraseña incorrecta y logout local que vuelve a `UNAUTHENTICATED`.

La sesión de Auth puede persistir en el almacenamiento local del navegador, pero no equivale por sí misma a autorización RLS cuando no hay conectividad. No hay signup público, OAuth ni roles empresariales.

## Datos experimentales

La migración `supabase/migrations/20260813094000_create_technical_spike_records.sql` crea únicamente `public.spike_records` para el Technical Spike.

**THIS IS TECHNICAL SPIKE DATA. NOT A PRODUCTION DOMAIN CONTRACT.**

La tabla tiene UUID `id`, `owner_id`, `value`, `created_at` y `updated_at`; sus políticas RLS permiten a cada usuario autenticado operar solamente sus propios registros. No representa viajes, gastos ni ninguna entidad de R&T. El UUID `id` y el aislamiento por propietario no presentan un impedimento evidente para el siguiente spike de PowerSync, que se configurará por separado.

No se generaron tipos TypeScript de base de datos en esta sesión: todavía no existe un consumidor de consultas ni un contrato de dominio que los use. Cuando PowerSync o una capa técnica empiece a consultar el esquema, deben generarse automáticamente con `supabase gen types --lang typescript --local`; no se escribirán a mano.

## PWA mínima

El cliente `apps/web` incluye manifest, iconos PNG y un service worker estándar. Cache Storage contiene únicamente el shell y archivos estáticos; no contiene respuestas de Supabase ni datos empresariales.

Para probar el artefacto de producción:

```powershell
pnpm build
pnpm --filter @rt-sitram/web preview --host 127.0.0.1 --port 4173
```

Abra `http://127.0.0.1:4173/`, espere `PWA: Ready` y recargue una vez para que el service worker controle la página. `Network: ONLINE/OFFLINE` es solo una señal UX; no autoriza ni bloquea operaciones empresariales.

## Siguiente paso

Cuando Docker permita validar el stack local y Auth real, el siguiente alcance será **PowerSync + SQLite — sincronización experimental mínima**. No se configuraron PowerSync Cloud, Sync Streams, publicación, usuario de replicación, Storage ni dominio de negocio.
