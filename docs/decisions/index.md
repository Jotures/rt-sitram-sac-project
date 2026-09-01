# Índice de decisiones

Registro canónico de decisiones duraderas. Los logs rotan en bloques deterministas de cinco IDs; las decisiones reemplazadas permanecen en el historial.

| ID | Decisión | Estado | Fecha | Sesión | Archivo | Ámbito |
|---|---|---|---|---|---|---|
| DEC-001 | PWA como cliente principal | Accepted | 2026-08-12 | SESSION-20260812-001 | [DEC-001-005.md](DEC-001-005.md) | Cliente |
| DEC-002 | Arquitectura offline-first | Accepted | 2026-08-12 | SESSION-20260812-001 | [DEC-001-005.md](DEC-001-005.md) | Persistencia |
| DEC-003 | PowerSync para sincronización | Accepted | 2026-08-12 | SESSION-20260812-001 | [DEC-001-005.md](DEC-001-005.md) | Sincronización |
| DEC-004 | Supabase/PostgreSQL como backend | Accepted | 2026-08-12 | SESSION-20260812-001 | [DEC-001-005.md](DEC-001-005.md) | Backend |
| DEC-005 | UUID como identificadores | Accepted | 2026-08-12 | SESSION-20260812-001 | [DEC-001-005.md](DEC-001-005.md) | Datos |
| DEC-006 | Registros financieros cerrados inmutables | Accepted | 2026-08-12 | SESSION-20260812-001 | [DEC-006-010.md](DEC-006-010.md) | Finanzas |
| DEC-007 | Monolito modular | Accepted | 2026-08-12 | SESSION-20260812-001 | [DEC-006-010.md](DEC-006-010.md) | Aplicación |
| DEC-008 | Storage privado | Accepted | 2026-08-12 | SESSION-20260812-001 | [DEC-006-010.md](DEC-006-010.md) | Archivos |
| DEC-009 | Estados operativo, administrativo y financiero separados | Accepted | 2026-08-12 | SESSION-20260812-001 | [DEC-006-010.md](DEC-006-010.md) | Dominio |
| DEC-010 | Gobierno de repositorio y memoria persistente | Accepted | 2026-08-12 | SESSION-20260812-001 | [DEC-006-010.md](DEC-006-010.md) | Gobierno |
| DEC-011 | Raíz Git independiente del proyecto | Accepted | 2026-08-12 | SESSION-20260812-003 | [DEC-011-015.md](DEC-011-015.md) | Gobierno |
| DEC-012 | Validación Just-in-Time en lugar de auditoría documental exhaustiva previa | Accepted | 2026-08-12 | SESSION-20260812-005 | [DEC-011-015.md](DEC-011-015.md) | Gobierno de desarrollo |
| DEC-013 | Toolchain base del workspace frontend | Accepted | 2026-08-12 | SESSION-20260812-006 | [DEC-011-015.md](DEC-011-015.md) | Tooling de implementación |
| DEC-014 | Shell PWA estándar sin integración Vite adicional | Accepted | 2026-08-13 | SESSION-20260813-007 | [DEC-011-015.md](DEC-011-015.md) | Cliente PWA |
| DEC-015 | Cliente Supabase SPA encapsulado y Auth local por dispositivo | Accepted | 2026-08-13 | SESSION-20260813-007 | [DEC-011-015.md](DEC-011-015.md) | Identidad de cliente |
| DEC-016 | Supabase CLI local versionado y migrations-first | Accepted | 2026-08-13 | SESSION-20260813-008 | [DEC-016-020.md](DEC-016-020.md) | Backend local y persistencia |
| DEC-017 | PowerSync Web con SQLite administrado y limpieza por identidad | Accepted | 2026-08-13 | SESSION-20260813-009 | [DEC-016-020.md](DEC-016-020.md) | Persistencia y sincronización web |
| DEC-018 | Perfil único con rol inicial y resolución segura de empresa | Accepted | 2026-08-13 | SESSION-20260813-010 | [DEC-016-020.md](DEC-016-020.md) | Identidad, autorización y aislamiento empresarial |
| DEC-019 | Sincronización de producto y recuperación explícita de colas | Accepted | 2026-08-16 | SESSION-20260813-010 | [DEC-016-020.md](DEC-016-020.md) | Sincronización y operación offline |
| DEC-020 | Comandos autoritativos e inmutabilidad financiera | Accepted | 2026-08-16 | SESSION-20260813-010 | [DEC-016-020.md](DEC-016-020.md) | Operación, finanzas y auditoría |
| DEC-021 | Vercel como hosting del cliente PWA | Accepted | 2026-08-16 | SESSION-20260813-010 | [DEC-021-025.md](DEC-021-025.md) | Despliegue web |
| DEC-022 | Identidad visual Andes Operativos y movimiento productivo | Accepted | 2026-08-19 | SESSION-20260813-010 | [DEC-021-025.md](DEC-021-025.md) | UX/UI e identidad de producto |
| DEC-023 | Piloto funcional aislado y flujo de viaje como prioridad de producto | Accepted | 2026-08-20 | SESSION-20260813-010 | [DEC-021-025.md](DEC-021-025.md) | Estrategia de implementación, QA y despliegue |
| DEC-024 | Perfil de conductor operativo requerido al programar | Superseded by DEC-044 | 2026-08-20 | SESSION-20260813-010 | [DEC-021-025.md](DEC-021-025.md) | Programación, identidad y operación del conductor |
| DEC-025 | Evaluador de Viajes como siguiente vertical de producto | Accepted | 2026-08-20 | SESSION-20260813-010 | [DEC-021-025.md](DEC-021-025.md) | Estrategia de producto, rentabilidad estimada y decisión comercial |
| DEC-026 | Política económica configurable y versionada para el Evaluador | Accepted | 2026-08-20 | SESSION-20260813-010 | [DEC-026-030.md](DEC-026-030.md) | Configuración económica, rentabilidad estimada y auditoría |
| DEC-027 | Corte controlado del piloto a uso real | Accepted | 2026-08-20 | SESSION-20260813-010 | [DEC-026-030.md](DEC-026-030.md) | Despliegue, ciclo de vida de datos piloto y puesta en servicio |
| DEC-028 | Goldcar/Wialon como siguiente vertical de Control Tower | Accepted | 2026-08-20 | SESSION-20260813-010 | [DEC-026-030.md](DEC-026-030.md) | Integración GPS, telemetría, geoespacial y estrategia de producto |
| DEC-029 | Puente RPA temporal y read-only para Goldcar | Accepted | 2026-08-20 | SESSION-20260813-010 | [DEC-026-030.md](DEC-026-030.md) | Integración GPS, automatización de portal, credenciales y runtime |
| DEC-030 | Persistencia GPS con vínculo aprobado, evidencia inmutable y proyección monotónica | Accepted | 2026-08-20 | SESSION-20260813-010 | [DEC-026-030.md](DEC-026-030.md) | Telemetría GPS, persistencia, autorización, retención y auditoría |
| DEC-031 | Sincronización Goldcar manual por snapshot con lease durable | Accepted | 2026-08-20 | SESSION-20260813-010 | [DEC-031-035.md](DEC-031-035.md) | Sincronización GPS, observabilidad, autorización server-side y operación del worker |
| DEC-032 | Odómetro Goldcar validado como fuente oficial y gobernada | Accepted | 2026-08-22 | SESSION-20260813-010 | [DEC-031-035.md](DEC-031-035.md) | Kilometraje maestro, evidencia GPS, auditoría y comandos operativos |
| DEC-033 | Bootstrap dinámico Goldcar limitado para alcanzar el detalle visible | Accepted | 2026-08-22 | SESSION-20260813-010 | [DEC-031-035.md](DEC-031-035.md) | Puente RPA temporal, descubrimiento read-only y minimización de datos |
| DEC-034 | Idempotencia estricta de la política de plausibilidad del odómetro GPS | Accepted | 2026-08-22 | SESSION-20260813-010 | [DEC-031-035.md](DEC-031-035.md) | Comandos de Gerencia, auditoría, idempotencia y ACL del odómetro GPS |
| DEC-035 | OCR y bandeja documental como siguiente vertical de producto | Inactive — en pausa por el propietario | 2026-08-22 | SESSION-20260813-010 | [DEC-031-035.md](DEC-031-035.md) | Estrategia de producto, captura documental, OCR, extracción y revisión humana |
| DEC-036 | Patrón de comprensión operativa y español directo | Accepted | 2026-08-22 | SESSION-20260813-010 | [DEC-036-040.md](DEC-036-040.md) | UX/UI, lenguaje y accesibilidad |
| DEC-037 | Captura dual, fondo operativo y ciclos P1 | Accepted | 2026-08-29 | SESSION-20260828-011 | [DEC-036-040.md](DEC-036-040.md) | Registro operativo, rendición y ciclos |
| DEC-038 | Repuestos conciliados y evidencia opcional de órdenes de trabajo P2 | Accepted | 2026-08-29 | SESSION-20260828-011 | [DEC-036-040.md](DEC-036-040.md) | Mantenimiento, costos de repuestos, evidencia privada y trazabilidad |
| DEC-039 | La suspensión GPS oculta la telemetría operativa | Accepted | 2026-08-29 | SESSION-20260828-011 | [DEC-036-040.md](DEC-036-040.md) | Telemetría GPS, visibilidad operativa y auditoría |
| DEC-040 | Jerarquía humana, captura flexible y maestros auditados | Accepted | 2026-08-30 | SESSION-20260828-011 | [DEC-036-040.md](DEC-036-040.md) | UX administrativa, maestros, flete, documentos y acciones |
| DEC-041 | Analítica trazable desde el despliegue | Accepted | 2026-08-30 | SESSION-20260828-011 | [DEC-041-045.md](DEC-041-045.md) | Reportes, margen directo, cobertura, carga/vacío y exportación |
| DEC-042 | Rediseño móvil premium del Centro de Control | Accepted | 2026-08-31 | SESSION-20260828-011 | [DEC-041-045.md](DEC-041-045.md) | UX/UI, shell, rutas, accesibilidad y movimiento |
| DEC-043 | Administración reversible y auditada de accesos | Accepted | 2026-09-01 | SESSION-20260828-011 | [DEC-041-045.md](DEC-041-045.md) | Identidad, roles, acceso, vínculo Conductor y auditoría |
| DEC-044 | Operación asistida por oficina sin cuenta de conductor | Accepted — aplicación remota pendiente de la sesión autorizada de Supabase | 2026-09-01 | SESSION-20260828-011 | [DEC-041-045.md](DEC-041-045.md) | Programación, operación, identidad, sincronización y auditoría |
