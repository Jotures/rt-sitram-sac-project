# Mapa operativo del repositorio

Guía de navegación para localizar rápidamente el código y el contexto correctos. Describe responsabilidades estables; no pretende enumerar cada archivo. El inventario estructural del final se genera desde el sistema de archivos y excluye dependencias, builds y temporales.

## Punto de entrada según la tarea

| Si la tarea afecta… | Empezar en… | Verificar también… |
|---|---|---|
| Rutas, navegación o shell | `implementation/apps/web/src/app/` | `App.tsx`, guardias, modelo de navegación y pruebas del shell |
| Administración y gestión empresarial | `implementation/apps/web/src/features/admin-ui/` | gateway de datos, permisos/RLS, RPC y pruebas administrativas |
| Operación del conductor | `implementation/apps/web/src/features/driver-ui/` | ciclo de viaje, validación, cola offline, adjuntos y pruebas móviles |
| Autenticación, empresa o roles | `implementation/apps/web/src/features/auth/`, `features/identity/` | `lib/supabase/`, RLS, invitaciones y DEC-018 |
| Viajes, dinero o rentabilidad | `features/trips/`, `features/trip-money/`, `features/trip-evaluator/` | `packages/domain/`, comandos autoritativos y pgTAP |
| Flota, GPS u odómetro | `features/fleet/`, `features/gps-context/`, `features/gps-odometer-management/` | `packages/domain/src/gps.ts`, `packages/integrations/src/gps/` y worker Goldcar |
| Reglas de negocio reutilizables | `implementation/packages/domain/src/` | pruebas unitarias y consumidores web/worker; no depender de React |
| Contratos con sistemas externos | `implementation/packages/integrations/src/` | adaptador/runtime consumidor y pruebas de contrato |
| Base de datos, RLS, RPC o Storage | `implementation/supabase/migrations/` | `supabase/tests/`, tipos del cliente y sync streams |
| Offline, SQLite o sincronización | `implementation/apps/web/src/lib/powersync/` | `implementation/powersync/`, comandos autoritativos y recuperación de colas |
| PWA, caché o conectividad | `implementation/apps/web/src/lib/pwa/`, `lib/network/`, `public/` | build del service worker y prueba física sin conexión |
| Integración Goldcar | `implementation/apps/goldcar-worker/` | paquete de integraciones GPS, migraciones GPS y plan Goldcar |
| OCR documental | `implementation/packages/ocr-benchmark/` | plan y runbook OCR; vertical pausada según DEC-035 |
| UI, componentes o estilos | `implementation/apps/web/src/components/`, `src/styles/` | pruebas de componentes y contratos de accesibilidad relacionados |
| Build, validación o despliegue | `implementation/package.json`, `implementation/scripts/`, `implementation/vercel.json` | `implementation/README.md` y runbooks aplicables |
| Negocio y evidencia operativa | `docs/09_sintesis_comprension_negocio.md`, `docs/analisis_operativo/` | decisiones aceptadas; el corpus WhatsApp es evidencia, no regla autoritativa |
| Gobierno y continuidad | `docs/decisions/`, `docs/sessions/` | `AGENTS.md` y estado de sesión actual |

## Fronteras que orientan las búsquedas

- `docs/` contiene conocimiento y gobierno; `evidence/` conserva evidencia local; `skills/` contiene procedimientos especializados.
- Todo ejecutable vive en `implementation/`. El workspace pnpm incluye aplicaciones desplegables y paquetes reutilizables.
- `apps/web` compone UI y adaptadores del cliente. Las reglas de dominio independientes viven en `packages/domain`.
- `apps/goldcar-worker` es el runtime aislado de la integración GPS; el contrato reutilizable vive en `packages/integrations`.
- Supabase/PostgreSQL es autoritativo. Los cambios de esquema se agregan como migraciones nuevas y se acompañan con pgTAP cuando afectan invariantes, RLS o RPC.
- PowerSync/SQLite sostiene lectura y escritura offline permitida. La UI administrativa no debe inventar disponibilidad local de datos no sincronizados.
- Los tests cercanos al código cubren unidades y componentes; `supabase/tests/` cubre contratos de backend. Buscar primero el test hermano del archivo afectado.

## Entradas técnicas rápidas

- Cliente web: `implementation/apps/web/src/main.tsx` → `App.tsx` → router y shells.
- Enrutamiento: `implementation/apps/web/src/app/routing/router.tsx`.
- Administración: `implementation/apps/web/src/features/admin-ui/AdminRoutePage.tsx` y `admin-data.ts`.
- Conductor: `implementation/apps/web/src/features/driver-ui/DriverHomePage.tsx`, `DriverTripLifecycle.tsx` y `driver-data.ts`.
- Supabase web: `implementation/apps/web/src/lib/supabase/client.ts`; tipos generados en `database.types.ts`.
- PowerSync web: `implementation/apps/web/src/lib/powersync/database.ts`, `connector.ts` y `schema.ts`.
- Backend: migraciones cronológicas en `implementation/supabase/migrations/`; Edge Functions en `supabase/functions/`.
- GPS: `implementation/apps/goldcar-worker/src/sync.ts` y `manual-sync-service.ts`.

## Comandos base

Ejecutar desde `implementation/`:

```powershell
pnpm repo-map:check
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Usar `pnpm repo-map:update` cuando se agregue o elimine una aplicación, paquete, feature o directorio estructural. Revisar después la tabla “Punto de entrada según la tarea” si cambió una responsabilidad, no solo una ruta.

## Inventario estructural generado

No editar manualmente el bloque siguiente.

<!-- repo-map:start -->
- `docs/`
- `docs/analisis_operativo/`
- `docs/archive/`
- `docs/audits/`
- `docs/decisions/`
- `docs/runbooks/`
- `docs/sessions/`
- `evidence/`
- `implementation/`
- `implementation/apps/goldcar-worker/`
- `implementation/apps/web/`
- `implementation/apps/web/src/features/admin-ui/`
- `implementation/apps/web/src/features/alerts/`
- `implementation/apps/web/src/features/auth/`
- `implementation/apps/web/src/features/clients/`
- `implementation/apps/web/src/features/collections/`
- `implementation/apps/web/src/features/dashboard/`
- `implementation/apps/web/src/features/documents/`
- `implementation/apps/web/src/features/driver-ui/`
- `implementation/apps/web/src/features/drivers/`
- `implementation/apps/web/src/features/fleet/`
- `implementation/apps/web/src/features/gps-context/`
- `implementation/apps/web/src/features/gps-odometer-management/`
- `implementation/apps/web/src/features/identity/`
- `implementation/apps/web/src/features/powersync/`
- `implementation/apps/web/src/features/reports/`
- `implementation/apps/web/src/features/shared/`
- `implementation/apps/web/src/features/trip-evaluator/`
- `implementation/apps/web/src/features/trip-money/`
- `implementation/apps/web/src/features/trips/`
- `implementation/apps/web/src/lib/network/`
- `implementation/apps/web/src/lib/powersync/`
- `implementation/apps/web/src/lib/pwa/`
- `implementation/apps/web/src/lib/supabase/`
- `implementation/packages/domain/`
- `implementation/packages/integrations/`
- `implementation/packages/ocr-benchmark/`
- `implementation/packages/shared/`
- `implementation/powersync/`
- `implementation/scripts/`
- `implementation/supabase/`
- `implementation/supabase/functions/`
- `implementation/supabase/migrations/`
- `implementation/supabase/scripts/`
- `implementation/supabase/tests/`
- `skills/`
<!-- repo-map:end -->
