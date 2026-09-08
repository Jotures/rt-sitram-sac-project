# Validación y despliegue

## Entorno y respaldo

Mismo proyecto Supabase `zpjoqmuhuwkjzrxypyux`, sin ramas ni proyectos adicionales. Respaldo protegido de esquema, funciones y datos afectados en `implementation/.local/operation-agile/backup-20260907.dpapi`, con suplemento y configuración PowerSync protegida. Se comprobó recuperación por el usuario de Windows; los archivos no se publican en Git.

Empresa sintética QA AISLADO en el proyecto actual; cuenta creada sin invitación por correo. Los fixtures SQL son propios y se revierten con ROLLBACK. No se reutilizan usuarios ni dinero reales para pruebas de UI. Los accesos QA se desactivan al finalizar, conservando evidencia.

## Evidencia comprobada

- 77 casos pgTAP en `implementation/supabase/tests/general_quick_operation.test.sql`, todos correctos y revertidos. Cubren salida sin servicio, recursos, depósitos, ambos combustibles, hoja conciliada, pagos parciales, cierre/reapertura, correcciones comerciales, permisos revocados, canal, odómetro y aislamiento.
- UI → SQLite → RPC → PowerSync: salida QA sin cliente, servicios de ida/retorno con clientes distintos, fondo S/800 y depósito S/200, gasto S/100 y combustibles S/100 por cada origen.
- Desconexión y cierre completo del navegador: se conservaron salida y depósito. Actualización del shell con escritura remota bloqueada mantuvo la cola; reconexión confirmó sin duplicados.
- Medición de depósito con datos preparados: 213 ms de guardado local; 4350 ms hasta confirmación después de reconectar. No equivale a medir digitación del dueño.
- Escritorio y viewport móvil 390 px: sin desbordamiento horizontal en la operación probada. Android físico permanece sin validar.
- Hoja y preparación offline sobreviven a cierre y actualización. Se detectaron y corrigieron montaje del worker de oficina, MIME de archivos OPFS y recuperación de versiones sin rendición previa.
- Compilación, typecheck y lint correctos. Suites: 48 dominio + 14 integraciones + 74 worker histórico + 9 benchmark histórico + 302 web = 447 pruebas. Ejecutar pruebas del código archivado no reactiva GPS/OCR.
- UI autenticada: recuperación explícita del archivo original, subida privada, conciliación aprobada por S/150 frente a S/100 existente (solo S/50 adicional), saldo S/750, devoluciones parciales S/300 + S/450 y cierre autoritativo cero. La recuperación también corrigió la comprobación de cambios sobre vistas SQLite con triggers: se verifica el estado dentro de la transacción.
- Los cinco perfiles reales se compararon campo a campo con el respaldo protegido: ningún cambio. Las pruebas persistentes pertenecen exclusivamente a QA AISLADO.
- Advisors: RPC SECURITY DEFINER intencionados y restringidos por actor/empresa; pruebas de ACL/RLS correctas. Persisten avisos ajenos a este corte: tabla GPS interna sin política de lectura y protección contra contraseñas filtradas. [Referencia del advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Migraciones compatibles aplicadas

- 20260907035248 operation_fast_cusco_cusco
- 20260907035856 cycle_settlement_closure
- 20260907044433 settlement_evidence
- 20260907045434 settlement_evidence_policy_cleanup
- 20260907201401 general_quick_operation
- 20260907201404 cycle_rendition_reconciliation
- 20260907201407 test_operation_quarantine
- 20260907201411 cycle_money_corrections
- 20260907201908 complete_cycle_sync_and_channel
- 20260907205940 agile_validation_and_commercial_corrections
- 20260908005951 agile_contract_edge_cases
- 20260908010718 cycle_capture_integrity

Los streams `powersync/streams/product-mvp.yaml` se validaron y publicaron antes del cliente. Se rotó la credencial de replicación y se comprobó la conexión; ningún secreto se incorpora al repositorio.

RT-2026-0001 y su adelanto S/800 permanecen identificados, cancelados como prueba y excluidos del circuito real mediante auditoría. Se conserva historial, sin devolución o regreso ficticios.

## Publicación y recuperación

Versión 0.2.0 publicada por Git master, commit 8cdaffb8bd6154b5f1d502c05882b19a9d2c3fa3, con Root Directory = implementation. Deployment dpl_6CJS55Yg6RQk6fvJot39x9iw8LwS, estado Ready, alias https://rt-sitram-centro-control.vercel.app, creado el 2026-09-07 a las 20:50:45 (UTC-5). GitHub confirmó éxito de Vercel. Se verificó el shell productivo rt-sitram-pwa-shell-7631e74783fc8bf2 y el activo app-DqbO7Gwk.js.

Ante un fallo del circuito, detener la creación nueva desde el control de acceso existente, conservar filas/colas/archivos y publicar un cliente compatible. Corregir hacia delante cuando existan operaciones nuevas; no revertir destructivamente esquema ni borrar SQLite.

## Límites de aceptación

Faltan las mediciones humanas de salida recurrente ≤30 s y rendición de hoja ≤2 min, además de Android físico. No se da por completada la auditoría pendiente, ni planilla, banca, detracción, guías integrales, mantenimiento preventivo, GPS u OCR. WhatsApp sigue disponible para procesos fuera del alcance.

## Cierre verificado en producción

- Autenticación QA correcta. Perfil muestra el interruptor general; funciona con teclado. Desactivarlo recupera Nuevo viaje completo y activarlo muestra Registrar salida desde esa misma entrada.
- Inicio, Salidas, Adelantos, Gastos, Combustible y Cobranza cargan con el modo rápido. Rendición cerrada y archivo privado accesibles con permisos; viewport 390 px sin desbordamiento. No hubo errores JavaScript en el humo de producción.
- Salida sintética e065b915-5c1d-4058-8270-4114884593cf: estado completed, rendición closed, saldo previo a pagos750, pagos reales QA750 y remanente0, una hoja privada. Se conservaron los registros originales tras reintentos.
- QA desactivado al terminar: perfil inactivo, autenticación bloqueada y cero sesiones. Auditoría QA_ACCESS_DISABLED; la misma identidad ya no ve salidas por RLS. Cinco perfiles reales nuevamente comparados con el respaldo: ningún campo alterado.
- Formato/mapa, typecheck, lint, 447 pruebas de código, 77 pgTAP revertidos y build correctos. El aviso de tamaño de chunks sigue como optimización fuera de este corte.
- Evidencia local sintética: implementation/.local/operation-agile/release-profile.png, release-mobile.png, rendition-closed.png, offline-pending.png y offline-reopened.png. Respaldos y credenciales permanecen protegidos e ignorados por Git.

No se afirma prueba en Android físico ni los tiempos humanos de digitación. La primera preparación del dispositivo/rendición requiere conexión para cargar sus datos; después conserva la hoja y fotos offline. La aceptación del dueño sobre operaciones reales y los procesos fuera del corte continúan según el manual.