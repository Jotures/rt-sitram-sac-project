# Plan de implementación — Integración Goldcar/Wialon y GPS Operativo R&T

**Estado:** Reemplazado como referencia activa el 2026-08-22 por el [Plan de implementación — OCR y Bandeja Documental Inteligente R&T](10_plan_ocr_documentos.md). Se conserva como contrato e historial de la integración GPS y de sus pendientes.

**Fecha:** 2026-08-20

**Alcance:** incorporar la telemetría de la plataforma GPS utilizada por R&T al modelo de unidades y viajes, y convertirla progresivamente en una superficie operativa de la Control Tower.

## Propósito y autoridad

Este plan reemplazó como referencia activa al [Plan de implementación — Evaluador de Viajes R&T](10_plan_evaluador_viajes.md), después de que su simulador administrativo fuera implementado y desplegado. El 2026-08-22 fue sustituido como siguiente vertical por el [Plan de implementación — OCR y Bandeja Documental Inteligente R&T](10_plan_ocr_documentos.md). No declara terminado el Evaluador ni GPS: sus pendientes y decisiones continúan vigentes, pero este archivo ya no gobierna el siguiente trabajo de producto.

El plan concreta las secciones 10–14, 21, 58–76 y 78 del [Documento Maestro V2](../R&T_SITRAM_Documento_Maestro_Analisis_y_Vision_V2.md), la arquitectura GPS de [Arquitectura Técnica](07_arquitectura_tecnica_sistema.md) y DEC-001–DEC-028. Ante conflicto prevalecen las decisiones aceptadas y la evidencia obtenida de la cuenta y API autorizadas de R&T; no se inferirán capacidades del proveedor a partir de la interfaz web.

## Resultado buscado

Gerencia y Administración podrán responder desde R&T, sin convertir la PWA en una réplica de Goldcar:

- dónde se encuentra cada unidad vinculada y cuándo emitió su última señal;
- qué viaje y conductor están asociados a esa unidad;
- si la posición es reciente, atrasada, desconocida o si el proveedor está indisponible;
- cuál fue el recorrido de una unidad o viaje dentro de un período autorizado;
- cuánto tiempo y distancia se observan, diferenciando evidencia GPS de hechos confirmados;
- qué paradas, entradas a zonas o desviaciones merecen revisión cuando esas capacidades sean habilitadas.

```text
Goldcar o Wialon autorizado
  → adaptador GPS server-side
  → normalización e idempotencia
  → última posición + histórico acotado en PostgreSQL
  → unidad + viaje + conductor
  → mapa / expediente / alertas explicables
  → revisión y decisión humana
```

## Línea base confirmada

- La PWA, Supabase/PostgreSQL, RLS, Auth, Storage privado y PowerSync están desplegados.
- Ya existen unidades, conductores, viajes, timeline, incidencias, mantenimiento y alertas con aislamiento por `company_id`.
- El Evaluador de Viajes está desplegado; la integración GPS no debe cambiar el significado de sus estimaciones ni de los resultados reales.
- R&T utiliza una plataforma identificada como Goldcar y el análisis previo señala una posible base Wialon. La API definitiva, versión, permisos y modalidad de acceso aún deben verificarse con evidencia actual.
- No existe todavía un adaptador GPS, vínculo autoritativo proveedor → unidad, almacenamiento de posiciones, política de retención ni mapa productivo.
- PowerSync sirve a la operación offline; no se utilizará para replicar el histórico completo de telemetría a los dispositivos.

## Límites de la primera salida operativa

No se construirá durante las primeras etapas:

- una copia funcional de Goldcar/Wialon ni un sistema GPS propio;
- rastreo segundo a segundo por efecto visual;
- cierre automático de viajes, rendiciones, pagos o mantenimientos por una señal GPS;
- navegación profesional para vehículos pesados sin un proveedor y contrato específicos;
- predicción, scoring de conductor, sanciones o decisiones laborales automáticas;
- sincronización del histórico GPS completo mediante PowerSync;
- PostGIS, geocercas poligonales o infraestructura cartográfica propia antes de demostrar su necesidad;
- exposición de credenciales, respuestas crudas o identificadores sensibles del proveedor al frontend.

## Invariantes de la integración

1. **GPS es evidencia por defecto, no autoridad empresarial.** Una llegada detectada puede sugerir una transición, pero no cerrar ni aprobar operaciones críticas. La única excepción vigente es el odómetro de detalle Goldcar validado, bajo la autoridad explícita y auditada de Gerencia definida por DEC-032; tampoco modifica por sí solo viajes, estados ni finanzas.
2. **Secretos exclusivamente server-side.** Tokens, usuarios, contraseñas y claves nunca se incluyen en variables `VITE_*`, bundles, tablas legibles por cliente, logs ni mensajes de error.
3. **Proveedor desacoplado.** El dominio consume un contrato `GpsProvider`; Goldcar/Wialon se encapsula en un adaptador reemplazable.
4. **Identidad interna estable.** `vehicle_id` continúa siendo el UUID interno; placa e identificador externo son atributos de vinculación, no claves primarias.
5. **Procedencia y tiempo explícitos.** Toda observación conserva proveedor, identificador idempotente o huella equivalente, `recorded_at`, `received_at` y estado de frescura.
6. **Aislamiento empresarial.** Toda vinculación, lectura y resultado derivado respeta `company_id`, rol y RLS. El proceso de ingesta no amplía los permisos del usuario final.
7. **Idempotencia y orden temporal.** Reintentos no duplican posiciones ni hacen retroceder la última posición con una señal tardía.
8. **Telemetría separada de operación offline.** El histórico permanece server-side; solo el resumen estrictamente necesario puede sincronizarse o cachearse.
9. **Mapa desacoplado del dominio.** El proveedor GPS produce telemetría y el proveedor cartográfico la representa; ninguno posee las reglas del viaje.
10. **Degradación honesta.** La ausencia de señal o una falla del proveedor se muestra como desconocida/atrasada, nunca como unidad detenida ni como confirmación de ubicación.
11. **Privacidad y minimización.** Solo se ingieren datos necesarios para preguntas operativas aprobadas, con retención y acceso definidos antes de producción.
12. **Observabilidad sin secretos.** Cada sincronización registra estado, conteos, latencia y error sanitizado, sin conservar credenciales ni payloads innecesarios.

## Seguimiento de ejecución

| Etapa | Estado | Evidencia / pendiente |
|---|---|---|
| 0. Acceso y descubrimiento | PoC RPA y lectura manual de detalle completados; gobierno externo pendiente | Login, exportación CSV read-only y lectura acotada de `Odómetro` confirmados para 3 activos. Faltan condiciones de uso, límites y cuenta técnica/API formal antes de operación continua. |
| 1. Contrato y adaptador | PoC completado | `GoldcarPortalProvider` y el worker Node/Chromium pasaron pruebas locales y una lectura live autorizada; el kill switch volvió a quedar apagado. |
| 2. Persistencia y seguridad | Completada | DEC-030 y las migrations GPS están aplicadas; pgTAP (30), contrato RPC (51), ACL remoto y lint `public, private` pasan. No hay cron ni UI; Etapa 3 ya cuenta con evidencia piloto real. |
| 3. Sincronización controlada | Completada para piloto manual | Las tres unidades R&T confirmadas tienen vínculo auditado; la última corrida procesó los 3 activos, persistió 2 evidencias y deduplicó 1, sin activos sin vínculo. No hay cron ni cursor/histórico RPA. |
| 4. GPS dentro de la operación | Contexto y gobierno de odómetro implementados; UAT/frescura pendientes | Inicio solo muestra excepciones accionables; unidad/viaje conservan evidencia contextual para Gerencia/Administración. Las 3 autoridades y líneas base de odómetro están activas con evidencia de detalle validada. Sin mapa, coordenadas, histórico ni clasificación de frescura hasta aprobar las etapas correspondientes. |
| 5. Mapa e histórico | Pendiente | Seleccionar `MapProvider`, representar flota y reconstruir recorridos acotados. |
| 6. Eventos geoespaciales | Pendiente | Paradas, geocercas, ruta prevista vs. real, desviaciones y ETA bajo reglas aprobadas. |
| 7. UAT, hardening y salida | Pendiente | Validación funcional, seguridad, carga, fallas del proveedor, privacidad y operación. |

## Etapa 0 — Acceso y descubrimiento del proveedor

**Objetivo:** sustituir las suposiciones por evidencia reproducible antes de diseñar el adaptador o las tablas.

### Insumos autorizados requeridos

- URL exacta del portal usado por R&T y nombre comercial/contractual del servicio.
- Cuenta técnica o mecanismo de token autorizado para integración, distinto de credenciales personales cuando el proveedor lo permita.
- Confirmación de que la prueba puede consultar las unidades reales de R&T sin ejecutar comandos sobre dispositivos.
- Inventario inicial unidad interna ↔ placa ↔ identificador externo, aprobado por el propietario.
- Contacto o canal de soporte del proveedor cuando la API no sea visible desde la cuenta.

### Descubrimiento técnico

- Identificar si el acceso soportado es API propia de Goldcar, Wialon Remote API/SDK, webhook, exportación u otro contrato oficial.
- Confirmar autenticación, renovación/revocación, scopes y separación entre lectura y acciones remotas.
- Ejecutar únicamente consultas de lectura para listar unidades, última posición y un histórico corto autorizado.
- Documentar timestamps y zona horaria, coordenadas, velocidad, rumbo, ignición, odómetro disponible y significado de ausencia de datos.
- Medir paginación, límites, frecuencia permitida, ventana histórica, latencia, identificadores de evento y comportamiento ante datos tardíos.
- Revisar términos de uso, conservación permitida, costo, restricciones de visualización y tratamiento de datos de ubicación.
- Guardar fixtures mínimos anonimizados/sanitizados para pruebas; nunca respuestas reales con tokens o datos innecesarios.
- Elaborar una matriz `capacidad → fuente → confiabilidad → limitación → etapa habilitada`.

**Gate:** existe una lectura reproducible en un entorno autorizado que obtiene, como mínimo, la lista de unidades y la última posición de una unidad; están documentados el mecanismo, permisos, límites, reloj, campos y condiciones de uso. DEC-029 permite que el PoC use login y exportación CSV visible del portal, con navegador efímero, guardas read-only y sin persistencia ni despliegue continuo.

### Evidencia registrada — 2026-08-20

- Una sesión autorizada del portal confirmó visualmente que la cuenta dispone de listado de unidades, detalle de última posición y consulta de histórico. Esto demuestra capacidad operativa del portal, no un contrato técnico reutilizable.
- La revisión autorizada de los menús **Mi cuenta** y **Herramientas** no expuso ninguna opción de token, clave API o configuración de acceso técnico. Solo aparecen funciones operativas, suscripción, cambio de contraseña y salida.
- El listado visible de vehículos ofrece una exportación CSV mediante una acción GET de la propia interfaz. Esta será la fuente del PoC para activos y última posición, en lugar de raspar tarjetas o mapas.
- No se ejecutaron comandos sobre dispositivos, cambios de configuración ni creación de credenciales. La automatización autorizada se limitó al login y a la exportación CSV visible, en un contexto efímero.
- La investigación pública permite considerar Wialon como una posibilidad técnica, pero no confirma que la cuenta R&T ni su portal expongan Wialon Remote API, GPSWOX u otra API concreta.
- El gate técnico mínimo del PoC RPA quedó satisfecho: una lectura programática reproducible obtuvo inventario y última posición. El gate de operación continua sigue abierto hasta contar con condiciones de uso, límites, retención, alcance autorizado y una cuenta técnica dedicada o API formal.

### Evidencia adicional de sensores de detalle — 2026-08-22

- El propietario mostró la vista autorizada de detalle de una unidad R&T. La interfaz expone, además de la posición y la hora, velocidad, ignición, odómetro, distancia, voltaje, cobertura, satélites y un indicador de movimiento.
- Esta es evidencia visual de capacidad del portal, no evidencia todavía de una ruta técnica aprobada, un identificador interno estable ni la semántica de cada contador. La exportación CSV vigente sigue limitada a nombre, estado de conexión, última conexión y posición.
- El modelo de evidencia GPS ya puede conservar velocidad, ignición y odómetro cuando una lectura de detalle validada los entregue. Distancia, voltaje, cobertura, satélites y movimiento requerirán un contrato tipado y, si se justifica, una ampliación explícita del esquema.
- `Distancia` y `Odómetro` se conservarán separados: su diferencia visible impide asumir que cualquiera representa kilometraje oficial, kilómetros de viaje o un contador autoritativo de flota. Ningún sensor GPS actualiza por sí solo `current_status`, viajes, rendiciones ni mantenimiento. El maestro solo puede cambiar mediante el flujo de DEC-032: lectura de detalle `Odómetro` técnicamente validada, evidencia actual, acción explícita de Gerencia y controles server-side.

### Diagnóstico seguro de disponibilidad del detalle — 2026-08-22

- El worker incorpora `pnpm goldcar:inspect-target-availability` para distinguir, sin extraer sensores, entre un objetivo único visible, ausente al terminar la ventana, presente pero no visible o múltiples coincidencias visibles.
- Requiere un switch propio de lectura y conserva los límites de bootstrap dinámico ya aprobados. No navega al detalle, no hace clic, no usa solicitudes arbitrarias, no lee valores/respuestas y no persiste URL, texto, identificadores, sensores ni coordenadas.
- Este diagnóstico aún no se ejecutó contra datos reales en este corte. Su resultado solo decidirá el siguiente paso de descubrimiento; la extracción y persistencia de un campo de detalle siguen requiriendo contrato, pruebas y RPC server-only separados.

## Etapa 1 — Contrato `GpsProvider` y adaptador

**Objetivo:** aislar el protocolo del proveedor y normalizar solo los datos que el dominio necesita.

### Avance registrado — 2026-08-20

El núcleo reutilizable está en `implementation/packages/domain/src/gps.ts` y `implementation/packages/integrations/src/gps/`. Define evidencia GPS validada, frescura, deduplicación, orden de última posición, `GpsProvider`, errores sanitizados, registro explícito y `FakeGpsProvider` para pruebas. No contiene secreto, URL, sesión, DTO real ni adaptador de red especulativo.

- Definir tipos estrictos para unidad externa, posición, página histórica, cursor, frescura, error transitorio/permanente y salud del proveedor.
- Diseñar operaciones mínimas equivalentes a listar activos, obtener última posición y consultar histórico por unidad/período.
- Mantener autenticación, sesiones y renovación dentro del adaptador server-side.
- Separar DTOs crudos del proveedor de los modelos normalizados de R&T.
- Validar coordenadas, timestamps, rangos físicos y campos opcionales; no completar ignición, odómetro o velocidad ausentes.
- Crear fixtures sanitizados y pruebas de contrato para respuestas válidas, parciales, duplicadas, tardías, paginadas, limitadas y no autorizadas.
- Implementar un adaptador simulado determinista para desarrollo y UAT sin depender continuamente del proveedor real.
- Registrar una decisión si la integración exige una dependencia o servicio con impacto arquitectónico.

### Variante temporal aprobada por DEC-029

- Ejecutar un worker Node/Chromium separado de la PWA y de Supabase Edge Functions.
- Iniciar sesión con credenciales obtenidas únicamente desde secretos de entorno y crear un contexto efímero por ejecución.
- Bloquear solicitudes de escritura distintas del formulario de login y permitir solo las rutas de lectura aprobadas.
- Descargar la exportación CSV visible del listado, validar encabezados y formatos y normalizarla mediante `GpsProvider`.
- Mantener la ejecución live deshabilitada salvo un kill switch explícito; no guardar cookies, contraseña, CSV crudo, capturas ni coordenadas en logs.
- Limitar el PoC a inventario y última posición. Histórico, cron, persistencia y UI permanecen fuera hasta cerrar este gate.

### Implementación del PoC — 2026-08-20

- `implementation/packages/integrations/src/gps/goldcar-portal.ts` valida CSV con delimitador coma o punto y coma, encabezados acentuados/HTML, timestamps con zona, coordenadas directas/etiquetadas/enlaces, ambigüedad, duplicados, límite de filas y activos sin posición.
- `implementation/apps/goldcar-worker/` inicia Chromium en contexto efímero, fija el host exacto, bloquea solicitudes externas y toda escritura salvo el login, y permite únicamente la exportación CSV exacta aprobada.
- El probe live exige `GOLDCAR_PORTAL_ALLOW_LIVE_READ=true`; el archivo `.env.local` está ignorado por Git y la salida no incluye nombres, placas ni coordenadas.
- Chrome headless fue iniciado y cerrado localmente. La guarda de kill switch fue verificada y falla cerrado.
- La lectura live autorizada autenticó correctamente y produjo un resumen sanitizado de 3 activos y 3 posiciones, con observaciones entre `2026-08-19T15:32:16.000Z` y `2026-08-20T21:41:50.000Z`. No se imprimieron nombres, placas, direcciones, coordenadas ni credenciales.
- Tras la lectura, `GOLDCAR_PORTAL_ALLOW_LIVE_READ` volvió a `false`; no se conservaron cookies, CSV crudo ni capturas.
- Validación final: formato, lint, typecheck, build y **261 pruebas PASS** (48 dominio, 13 integraciones, 5 worker y 195 web). El probe posterior volvió a fallar cerrado por el kill switch.

**Gate:** el mismo contrato de dominio funciona con el adaptador simulado y con una consulta read-only autorizada, sin filtrar DTOs, sesiones ni secretos a React.

## Etapa 2 — Persistencia, retención y seguridad

**Objetivo:** guardar telemetría trazable sin mezclarla con maestros ni multiplicar datos en clientes offline.

### Implementación registrada — 2026-08-20

- `gps_provider_vehicle_links` conserva únicamente vínculos aprobados entre proveedor/activo externo y `vehicle_id`; Gerencia los crea o desactiva mediante comandos auditados. Ningún nombre provisional del portal genera un vínculo automático.
- `gps_positions` mantiene evidencia normalizada e inmutable con proveedor, activo, clave idempotente, tiempos de observación/recepción y campos opcionales. No tiene CSV crudo, cookies, credenciales ni payload completo.
- `vehicle_latest_positions` es una proyección aparte y solo avanza si `(recorded_at, received_at)` es más reciente; una muestra tardía permanece en el histórico sin retroceder la última señal.
- Todas las tablas GPS usan RLS y `FORCE ROW LEVEL SECURITY`. Solo Gerencia y Administración pueden leer sus filas por empresa; no existen permisos directos de escritura para clientes y el histórico no fue añadido a PowerSync.
- `ingest_gps_position` y `purge_expired_gps_positions` son `SECURITY INVOKER`, sin permisos para `authenticated` y exclusivos de `service_role`. La ingesta deriva empresa y unidad desde el vínculo activo, por lo que un activo desconocido falla cerrado.
- La retención se configura explícitamente por empresa y no hay valor inicial ni purga programada. `gps_telemetry.test.sql` cubre RLS, ACL, auditoría, aislamiento empresarial, idempotencia, datos tardíos, desvinculación y purga que conserva la evidencia de última posición.

**Estado de validación:** las migrations `20260820120000` y `20260820121000` están aplicadas en la base Supabase enlazada. `gps_telemetry.test.sql` pasó sus 30 casos y `rpc_contract.test.sql` sus 51; la verificación ACL remota y el lint de `public, private` no reportaron errores. Formato, lint, typecheck, build y 261 pruebas TypeScript existentes también pasan. No se activó el worker ni se persistió telemetría real.

- Diseñar migrations-first para vínculos proveedor/unidad, última posición, posiciones históricas y ejecuciones de sincronización.
- Garantizar unicidad por empresa, proveedor e identificador externo, además de una sola vinculación activa compatible por unidad.
- Mantener `vehicle_latest_position` separado del histórico; una observación tardía puede entrar al histórico sin reemplazar una posición más reciente.
- Elegir una clave idempotente del proveedor o una huella documentada y estable cuando no exista identificador de evento.
- Definir antes de producción la retención de datos crudos, agregados y bitácoras, junto con el procedimiento de purga verificable.
- Definir qué roles pueden ver posición actual e histórico. Hasta esa aprobación, la UI de GPS se limita a Gerencia y Administración.
- Aplicar `company_id`, restricciones, índices temporales, RLS/FORCE RLS, ACL explícita y escritura reservada al backend de integración.
- Evitar almacenar payloads completos salvo evidencia técnica temporal, sanitizada y con caducidad aprobada.
- Evaluar PostGIS únicamente si consultas geográficas concretas de etapas posteriores lo justifican; su adopción requiere decisión registrada.
- Cubrir pgTAP/RLS/ACL: empresa A/B, conductor, identificador externo duplicado, posición tardía, reintento y escritura directa no autorizada.

**Gate:** ninguna cuenta cliente puede ingerir o alterar telemetría, ninguna empresa accede a otra y los reintentos/timestamps mantienen una última posición correcta y un histórico sin duplicación lógica.

## Etapa 3 — Sincronización controlada y observabilidad

**Objetivo:** mantener posiciones suficientemente frescas sin exceder el contrato del proveedor ni ocultar fallas.

### Implementación registrada — 2026-08-20

- DEC-031 limita el puente RPA a un comando manual de snapshot. La exportación
  disponible no acredita cursor, paginación, histórico ni webhook, por lo que
  `provider_checkpoint_at` es diagnóstico y la huella de evidencia conserva la
  idempotencia; no se anuncia una ingesta incremental inexistente.
- `goldcar:sync` exige dos kill switches, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, empresa y perfil activo de Gerencia. Antes de
  abrir Chromium, `begin_gps_sync_run` verifica empresa activa, retención y al
  menos un vínculo aprobado. Ninguna configuración se expone a Vite.
- `gps_sync_runs` conserva UUID de solicitud, perfil autorizador, lease,
  heartbeat, deadline, checkpoint, intento de fuente y contadores. Un índice
  parcial evita solapes por empresa/proveedor; un lease vencido se cierra de
  forma canónica antes de que una solicitud nueva pueda empezar.
- `ingest_gps_position_for_sync` es `SECURITY INVOKER`, exclusivo de
  `service_role`, comprueba que el lease sigue vivo y devuelve
  `persisted`/`deduplicated`/`unlinked`. La evidencia nueva referencia la
  ejecución; un activo no enlazado no escribe datos ni se crea automáticamente.
- La fuente Goldcar se lee una sola vez por comando y cada posición toma
  `received_at` del instante posterior a la recepción completa del CSV. No se
  reintenta login ni CSV; solo las operaciones de persistencia transitorias
  usan backoff exponencial con jitter. Errores 401/403, 429, 5xx, timeout,
  respuesta malformada o activo sin vínculo terminan con código y mensaje
  canónicos.
- Las migrations `20260820122000`, `20260820123000` y `20260820124000` están
  aplicadas en la base enlazada. La última impide marcar como exitosa una
  ejecución con activos sin vínculo. `gps_sync_control.test.sql` pasó 37
  casos; GPS previo (30), contrato RPC (55), ACL remoto y lint `public,
  private` pasan. Las pruebas de worker e integración pasan sin leer Goldcar
  live. La corrección `23000` sustituye internamente una colisión de nombre de
  tiempo detectada durante la primera prueba remota, sin escribir telemetría
  real.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm
  build` pasan: 48 pruebas de dominio, 14 de integraciones, 15 del worker y
  195 web (**272** en total). El build mantiene solo el aviso conocido de
  bundles superiores a 500 kB, ajeno a Goldcar.
- En la ventana autorizada del 2026-08-22, la exportación read-only confirmó
  tres activos y tres posiciones. La única unidad activa en R&T, `VDR-768`,
  tuvo una coincidencia exacta con un activo Goldcar; mediante los comandos
  auditados de Gerencia se configuró retención de 30 días y ese vínculo. Los
  otros dos activos externos quedaron pendientes de confirmación y no se
  infirieron. Tras
  corregir el parseo de la fila única que PostgREST devuelve para la RPC de
  ingesta, una corrida manual persistió una evidencia de `VDR-768` y actualizó
  su última señal; las dos evidencias sin vínculo no se escribieron y cerraron
  la bitácora con `UNLINKED_ASSET`. El propietario después confirmó que ambos
  son de R&T y que sus identificadores son placas reales; se crearon sus
  fichas mínimas y sus vínculos auditados. La siguiente corrida manual cerró
  correctamente con 3 activos, 2 evidencias nuevas y 1 deduplicada.

### Límites vigentes de esta variante

- No se activa cron, agenda recurrente, polling continuo, webhook ni
  circuit-breaker entre ejecuciones: faltan frecuencia aprobada y límites del
  proveedor. El estado de ejecución y el código de salida son la observabilidad
  disponible hasta definir un canal de alertas.
- La bitácora de ejecuciones es visible solo para Gerencia; la telemetría
  seguirá con los permisos de Etapa 2 cuando exista una superficie aprobada.
- El worker Node/Chromium no se publica en Vercel. Una operación continua exige
  runtime separado, cuenta técnica/API formal y condiciones de uso confirmadas.

- Implementar un proceso server-side invocable y programable con exclusión de ejecuciones solapadas.
- Empezar con polling; utilizar webhook solo si la evidencia de la etapa 0 demuestra un contrato autenticable y confiable.
- Aplicar cursor/checkpoint, ventanas solapadas acotadas, idempotencia, paginación y límite de duración por ejecución.
- Derivar la frecuencia de actualización desde la necesidad operativa y los límites reales, no desde una animación del mapa.
- Implementar timeout, reintento con backoff/jitter, manejo de rate limit, circuito de degradación y recuperación observable.
- Registrar inicio/fin, proveedor, unidades intentadas, posiciones aceptadas/descartadas, latencia, cursor y error sanitizado.
- Alertar sobre token inválido, sincronización vencida, unidad sin vínculo, reloj anómalo y fallas consecutivas sin confundirlas con incidentes del viaje.
- Mantener un comando manual seguro de sincronización para diagnóstico, con autorización, idempotencia y auditoría.
- Probar pérdida de red, 401/403, 429, 5xx, respuesta parcial, timeout, duplicados, datos fuera de orden y reanudación.

**Gate:** durante una ventana de prueba aprobada la ingesta se recupera de fallas transitorias, respeta límites, no duplica datos y permite explicar la frescura o ausencia de cada posición. El piloto manual cumplió el gate: hay 3 vínculos aprobados, una corrida exitosa, lease liberado y última señal para las 3 unidades. Antes de operación continua siguen pendientes cuenta técnica/API formal, condiciones de uso, límites/frecuencia aprobados y runtime separado.

## Etapa 4 — GPS contextualizado en la operación

**Objetivo:** responder preguntas de negocio antes de construir capacidades cartográficas avanzadas.

### Corte inicial implementado — 2026-08-22

- La migration `20260822100000_create_vehicle_gps_context_view.sql`, ya aplicada en la base enlazada, publica `vehicle_gps_context` como vista estrecha con `security_invoker = true`. Solo une un vínculo Goldcar activo y su última evidencia compatible; no expone coordenadas, identificador/nombre externo, payload crudo ni histórico.
- La PWA consulta esa vista directamente y solo en línea mediante un gateway aislado de PowerSync. No se añadieron relaciones GPS al esquema SQLite ni a los streams offline; las pruebas impiden regresiones de ese límite.
- Inicio ya no usa un resumen GPS grande y genérico: solo presenta a Gerencia y Administración excepciones accionables de vínculo o señal. El detalle de unidad y el expediente de viaje muestran hora exacta, antigüedad, velocidad, ignición y odómetro reportados solo cuando existen; el GPS no modifica estados operativos y el maestro solo puede seguir el flujo gobernado de DEC-032.
- Contabilidad y Conductor no reciben tarjeta ni consulta GPS. La UI también aplica la guarda de rol, mientras la vista conserva el RLS de las tablas subyacentes y limita empresa/rol en el servidor.
- La interfaz no inventa un umbral durable: mientras no se aprueben `staleAfterMs` y `futureToleranceMs`, presenta la hora y antigüedad con el estado `FRESHNESS_UNCONFIGURED`, sin declarar la señal reciente ni atrasada. La velocidad `0` tampoco equivale a una detención confirmada.
- El CSV actual de Goldcar solo entrega última posición y hora. Por ello, las señales reales ya visibles pueden no incluir velocidad, ignición u odómetro; esos campos permanecen como “No reportado” hasta validar una lectura read-only de detalle.
- Gerencia dispone de `/configuracion/odometro-gps`, una superficie online separada de PowerSync. Solo consulta candidatos estrechos sin coordenadas, fuentes activas, política y revisiones; permite enrolar/suspender/revisar únicamente mediante RPC auditadas. La política se publica con idempotencia estricta y una confirmación visible porque aplica a futuras promociones de todas las fuentes activas de la empresa.
- El 22/08/2026 la pantalla mostró tres candidatos de detalle validados y Gerencia enroló las tres autoridades. La línea base quedó en `VDR-768` 98,584 km, `X2Y-756` 135,276 km y `X3N-719` 12,900 km. `VDR-768` reemplazó el marcador de prueba 141,601 km mediante la única corrección excepcional autorizada; no se usó `Distancia`.

**Estado de validación:** las migrations `20260822110000_enable_goldcar_authoritative_odometer.sql`, `20260822182449_harden_gps_odometer_policy_idempotency.sql` y `20260822182500_fix_gps_odometer_policy_lint.sql` están aplicadas en la base enlazada. `gps_telemetry.test.sql` pasó **39/39**, `gps_sync_control.test.sql` **37/37**, `gps_odometer_authority.test.sql` **155/155** y `rpc_contract.test.sql` **64/64**, siempre en transacciones remotas revertidas. El lint remoto de `public, private` y el verificador ACL pasaron. `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` pasan: 48 pruebas de dominio, 14 de integraciones, 74 del worker y 231 web (**367**). La revisión visual autenticada de Gerencia confirmó la nueva ruta, menú, estados vacíos y formulario sin errores de consola. La PWA se publicó en producción y respondió HTTP 200/redirección a acceso sin errores de consola. El build mantiene solo el aviso conocido de bundles grandes. No se activó una sincronización adicional, cron ni despliegue del worker.

- Mostrar por unidad: estado operativo, viaje/conductor asociados, posición textual o coordenadas, velocidad/ignición si existen, `recorded_at` y frescura.
- Incorporar en el expediente del viaje la última señal de la unidad asignada y un enlace al contexto GPS, sin convertirla en estado del viaje.
- Añadir al Centro de Control conteos y excepciones accionables: en tránsito, disponible, señal atrasada, sin vínculo y proveedor indisponible.
- Distinguir visual y semánticamente `en movimiento`, `velocidad 0`, `sin señal reciente` y `estado desconocido`.
- No exponer coordenadas a roles no aprobados ni afirmar presencia actual a partir de una observación antigua.
- Mantener la experiencia administrativa online-first; si se cachea la última posición, mostrar su antigüedad y origen.
- Cubrir escritorio, móvil administrativo, foco, contraste, lector de pantalla, estados vacíos y degradados.

**Gate:** Gerencia puede identificar unidad, viaje, conductor, última señal y frescura desde R&T, y puede reconocer sin ambigüedad cuando la información es antigua o no está disponible.

**Pendiente para completar el gate:** UAT de Inicio, Flota y expediente de viaje como Gerencia/Administración, y aprobación explícita del umbral de frescura. Las autoridades ya están enroladas con evidencia de detalle validada; mapa, coordenadas, histórico, excepciones por señal atrasada y cualquier automatismo operativo continúan fuera de esta etapa.

## Etapa 5 — Mapa de flota y recorrido histórico

**Objetivo:** convertir la telemetría normalizada en una superficie geográfica útil y acotada.

- Seleccionar un `MapProvider` mediante decisión separada, considerando costo, términos, tiles, geocodificación, disponibilidad y volumen previsto.
- Mantener `MapProvider`, `GpsProvider` y un futuro `RoutingProvider` como contratos independientes.
- Mostrar solo unidades autorizadas con marcador, frescura, viaje, conductor y acción para abrir el expediente.
- Ajustar automáticamente el encuadre a las unidades visibles, con alternativa tabular equivalente.
- Consultar histórico por unidad/viaje y rango limitado; simplificar el trazado para visualización sin alterar la evidencia original.
- Diferenciar huecos de señal y segmentos de baja confiabilidad; no unirlos como recorrido confirmado sin indicación.
- Aplicar límites de rango, paginación/streaming y presupuestos de respuesta para evitar descargar históricos excesivos.
- Medir uso, costo, latencia y peso del mapa; no sincronizar tiles ni histórico completo con PowerSync.

**Gate:** el mapa responde quién/dónde/cuándo con contexto de negocio, y un recorrido acotado puede reconstruirse sin degradar la PWA ni ocultar huecos de telemetría.

## Etapa 6 — Eventos y análisis geoespacial

**Objetivo:** derivar señales operativas explicables sin automatizar decisiones críticas.

- Definir geocercas significativas —base, origen, destino, taller u otras aprobadas— con fuente, vigencia y tolerancia.
- Detectar paradas con umbral configurable y permitir clasificación humana: descanso, combustible, carga, descarga, avería, tráfico, bloqueo, taller u otro.
- Separar ruta planificada, ruta real observada y corredor tolerado; una desviación es una señal para revisar, no una infracción.
- Producir eventos derivados versionados con regla, entradas, ventana temporal, confianza y capacidad de revisión/supresión.
- Sugerir llegada, salida o reanudación cuando corresponda, manteniendo las transiciones autoritativas del viaje.
- Incorporar ETA solo después de seleccionar un `RoutingProvider` y explicar fuente, hora de cálculo y limitaciones; no presentar una ruta de automóvil como ruteo pesado.
- Calcular kilómetros y tiempos observados con método versionado antes de alimentar mantenimiento o comparación del Evaluador.
- Añadir PostGIS solo si simplifica consultas ya aprobadas y con pruebas de precisión, índices y carga.

**Gate:** cada evento puede reproducirse desde observaciones concretas, las falsas señales pueden revisarse y ninguna regla GPS ejecuta cierres, pagos, sanciones o cambios críticos por sí sola.

## Etapa 7 — UAT, hardening y salida

**Objetivo:** demostrar que la integración informa la operación sin crear una falsa certeza de ubicación ni un riesgo de seguridad/privacidad.

### Escenarios mínimos

1. Vincular una unidad real autorizada y comparar su última posición con el portal del proveedor.
2. Relacionar esa unidad con un viaje activo y verificar unidad, conductor, ruta, estado y frescura.
3. Consultar un recorrido corto y validar timestamps, orden, huecos, distancia y límites del rango.
4. Recibir posiciones duplicadas y tardías sin duplicar el histórico ni hacer retroceder la última posición.
5. Simular token inválido, rate limit, timeout y proveedor caído; la UI debe degradar con honestidad y el proceso recuperarse.
6. Intentar leer telemetría desde otra empresa, un rol no autorizado y el cliente directo.
7. Verificar que una llegada GPS no cierra el viaje ni altera rendición, cobranza o resultado financiero.
8. Confirmar que logs, errores, bundle, PowerSync y respuestas al navegador no contienen secretos.
9. Medir carga con el histórico y frecuencia esperados, además del costo real del proveedor cartográfico cuando aplique.
10. Revisar privacidad, retención, revocación de acceso, procedimiento de soporte y recuperación.

La validación incluye pruebas de contrato, dominio, typecheck, lint, build, web, RLS/ACL/pgTAP, integración read-only, carga acotada y revisión visual autenticada. No se habilita producción con P0/P1, credenciales personales embebidas, acceso cruzado, telemetría sin retención aprobada o campos cuya interpretación no esté documentada.

**Gate final:** el propietario confirma que la posición y recorrido observados son suficientemente correctos para las preguntas operativas aprobadas; soporte puede diagnosticar frescura/fallas y la integración no asume autoridad sobre el viaje.

## Definition of Done

La vertical Goldcar/Wialon estará lista cuando:

- use un mecanismo de API autorizado, documentado y revocable;
- mantenga secretos y sesiones exclusivamente server-side;
- vincule activos externos con unidades UUID sin depender de la placa como identidad;
- ingiera última posición e histórico de forma idempotente, ordenada y observable;
- aplique aislamiento empresarial, roles, RLS, ACL, retención y minimización;
- muestre frescura, procedencia, campos ausentes y degradación sin falsas certezas;
- conecte posición con unidad, viaje y conductor desde el Centro de Control;
- permita visualizar un mapa y recorrido acotado mediante proveedores desacoplados;
- derive eventos explicables sin ejecutar automáticamente operaciones críticas;
- pase validaciones automáticas, manuales, de seguridad, privacidad, carga y UX sin P0/P1.

## Dependencias y decisiones pendientes del propietario

| Tema | Decisión o insumo requerido |
|---|---|
| Acceso | Portal exacto, mecanismo de API autorizado y credenciales/token técnico. |
| Activos | Correspondencia inicial entre unidades R&T e identificadores externos. |
| Permisos | Roles que pueden consultar posición actual e histórico. |
| Retención | Tiempo de conservación del histórico crudo, agregados y logs. |
| Frescura | Antigüedad aceptable para considerar una posición reciente. |
| Frecuencia | Necesidad operativa de actualización compatible con límites/costo de API. |
| Cartografía | Selección posterior de `MapProvider` con costo y términos conocidos. |
| Geografía | Zonas, paradas y preguntas operativas que justifican eventos derivados. |

## Handoff al quedar reemplazado

Las tres líneas base oficiales de odómetro están enroladas con evidencia manual
de detalle validada. GPS conserva como pendientes el UAT de Inicio/Flota/
expediente, el umbral de frescura, los datos maestros incompletos y una cuenta
técnica/API formal con límites y condiciones de uso antes de operación
continua. No se configura cron, histórico RPA, mapa ni despliegue del worker.
La siguiente tarea activa se rige por
[OCR y Bandeja Documental Inteligente R&T](10_plan_ocr_documentos.md).
