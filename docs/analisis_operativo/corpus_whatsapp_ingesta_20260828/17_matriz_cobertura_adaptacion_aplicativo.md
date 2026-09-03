# Matriz de cobertura y adaptación del aplicativo

## Veredicto ejecutivo

La adaptación actual es **parcial**.

El Centro de Control Digital R&T ya posee una base conceptual y técnica sólida
para sustituir el registro disperso en WhatsApp: identidad común de viaje,
estados separados, permisos por empresa y rol, comandos autoritativos,
idempotencia, almacenamiento privado, captura offline y rendición auditable.
No se encontró una necesidad de reemplazar esa arquitectura.

La principal brecha diagnóstica no era la ausencia general de tablas. Era la
diferencia entre **quién registra** y **cuándo registra**:

- en el corpus, una persona centralizó 486 de 554 mensajes y consolidó hechos
  de viajes, combustible, gastos, mantenimiento, personal y cobranza;
- el Conductor conserva su recorrido offline-first y la fecha real del hecho;
- DEC-037 acepta además la transcripción administrativa en línea para gastos y
  combustible, con actor autenticado, motivo e auditoría;
- la regularización se permite hasta el cierre de rendición y, después, exige
  reapertura auditada; combustible tardío no altera el saldo del Conductor;
- los viajes relacionados pueden reunirse en un ciclo operativo por unidad sin
  fusionar su facturación, rendición ni cierre financiero.

El P0 de integridad financiera y los cortes P1/P2 están implementados en
contratos, migraciones y UI. Las migraciones se aplicaron al remoto autorizado;
las 12 suites pgTAP pasaron allí dentro de transacciones revertidas, y también
pasaron `db lint`, el verificador de ACL, PowerSync y el humo autenticado de
las rutas principales. Formato, lint, TypeScript, 410 pruebas Vitest y build
pasaron localmente. El UAT histórico sintético sigue pendiente.

Por eso, el aplicativo cubre mejor el **flujo objetivo estructurado** que la
forma histórica de registrar por chat. Eso es deseable, siempre que R&T valide
el cambio de responsabilidades y que el producto resuelva las excepciones
reales sin obligar a volver a WhatsApp.

## Alcance del veredicto

Esta evaluación nació como diagnóstico de contratos, código, pruebas y
evidencia histórica sanitizada. Posteriormente, el propietario aceptó DEC-037
y DEC-038, se implementaron los cortes P1 y P2, se validaron y promovieron
técnicamente a producción. No se importaron mensajes, adjuntos, saldos ni
alias históricos; las pruebas remotas se ejecutaron con fixtures transitorios
y reversión explícita.

La cobertura se midió con el
[marco de uso de evidencia](15_marco_uso_evidencia_para_evaluar_aplicativo.md)
y los 16 casos del
[banco histórico sanitizado](16_banco_escenarios_historicos_sanitizados.md).

## Resumen de resultados

| Resultado provisional | Casos | Lectura |
|---|---:|---|
| Cubierto en contrato/UI; UAT pendiente | 6 | Los cortes P1/P2 y sus contratos superaron validación técnica; falta la corrida histórica sintética representativa. |
| Parcial | 6 | Persisten brechas de cobertura o claridad por decisión de producto. |
| No cubierto; límite de alcance aceptado | 1 | Planilla queda fuera del producto por DEC-037. |
| No debe trasladarse automáticamente | 3 | La práctica histórica ambigua debe conservarse como excepción o revisión humana, no convertirse en dato autoritativo. |
| **Total** | **16** | El veredicto global permanece **parcial** hasta completar UAT y atender las brechas de producto pendientes. |

Ningún caso fue clasificado como “cubierto y adecuado” porque aún falta un UAT
representativo de los escenarios históricos sintéticos por los roles de R&T.

## Leyenda dimensional

| Marca | Significado |
|---|---|
| `C` | Capacidad verificable en contrato o interfaz; el UAT histórico puede seguir pendiente. |
| `P` | Cobertura parcial, condicional o sin superficie completa. |
| `N` | Capacidad no encontrada. |
| `X` | El comportamiento histórico no debe trasladarse automáticamente. |
| `—` | No aplica a la naturaleza del caso. |

Dimensiones: `DAT` datos y relaciones; `FLU` flujo y reglas; `ROL` actor y
permisos; `OFF` operación offline; `UX` comprensión; `AUD` evidencia y
auditoría.

## Matriz de escenarios

| Caso | Patrón probado | DAT | FLU | ROL | OFF | UX | AUD | Resultado provisional | Brecha o condición principal |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|---|---|
| `HIST-WA-001` | Viaje integral: ruta, carga, unidad, conductor, combustible y fondo | C | P | P | P | P | C | **Parcial · P2** | Viaje/carga, programación, adelanto y combustible existen, pero están repartidos; no hay una vista única de preparación/traspaso ni una superficie confirmada para corregir, reprogramar o cancelar el servicio. |
| `HIST-WA-002` | Declaración incompleta | C | C | C | C | C | C | **Cubierto técnicamente; UAT pendiente · DEC-045** | El viaje puede salir, avanzar y finalizar sin peso ni flete; el punto de carga es opcional, los términos se completan por etapas y sólo la facturación espera peso y flete válidos. La ruta completa llega al conductor offline; falta UAT representativo. |
| `HIST-WA-003` | Continuación, tramo, retorno o reanudación | C | C | C | — | C | C | **Cubierto en contrato/UI; UAT pendiente · P1** | DEC-037 preserva cada servicio facturable como viaje y permite agrupar continuidad/retorno por unidad en ciclos operativos. El ciclo no fusiona dinero, facturación ni rendiciones; falta UAT. |
| `HIST-WA-004` | Fondo “para gastos” | C | C | C | — | C | C | **Cubierto en contrato/UI; UAT pendiente · P1** | DEC-037 define el adelanto como fondo operativo por rendir. El cierre marca los fondos no cancelados como rendidos y deja auditoría; no crea planilla ni préstamo. |
| `HIST-WA-005` | Combustible asociado al viaje | C | C | C | C | C | C | **Cubierto en contrato/UI; UAT pendiente · P1** | Conductor conserva captura offline; Administración/Gerencia registra en línea en representación, con motivo/auditoría. El combustible tardío es costo del viaje y no modifica el saldo de rendición del Conductor. |
| `HIST-WA-006` | Gasto o evidencia informado después del viaje | C | C | C | C | C | C | **Cubierto en contrato/UI; UAT pendiente · P0/P1** | El guard bloquea nuevos gastos y combustible después del cierre; una regularización conserva la fecha real, exige motivo y sólo procede tras reapertura auditada. La consulta privada de evidencia está implementada. |
| `HIST-WA-007` | Saldo ambiguo de rendición | C | C | C | — | C | C | **Cubierto en contrato/UI; UAT pendiente · P1** | El sistema recalcula y nombra “Conductor devuelve” o “Empresa reembolsa”, exige resolución y audita cierres/reaperturas. Falta validar comprensión y operación con R&T. |
| `HIST-WA-008` | Diferencia de viaje llevada a planilla | N | N | N | — | N | — | **No cubierto; límite de alcance aceptado · P1** | DEC-037 mantiene planilla fuera del producto. La ausencia evita automatizar descuentos; una futura relación exige decisión laboral y contable independiente. |
| `HIST-WA-009` | Mantenimiento, odómetro, pieza y próximo cambio | C | C | C | — | C | C | **Validación técnica remota completada; UAT pendiente · P2** | DEC-038 incorpora creación y avance de órdenes, proveedor, diagnóstico, trabajo, líneas de repuesto auditadas y cierre con total conciliado. Mantenimiento sigue online-only hasta diseñar su sincronización. |
| `HIST-WA-010` | Foto de mantenimiento con poco contexto | C | C | C | — | C | C | **Validación técnica remota completada; UAT pendiente · P2** | La evidencia privada, opcional y múltiple se vincula explícitamente a una orden y nunca crea una intervención ni infiere hechos técnicos. No existe ni se requiere una bandeja automática de archivos sin contexto. |
| `HIST-WA-011` | Paquetes documentales por unidad | C | P | C | — | C | C | **Parcial · P2** | La consulta segura de evidencia privada está implementada. Falta aprobar catálogo, vigencias y documentos bloqueantes; un alta nueva parte como `valid`. |
| `HIST-WA-012` | Factura, detracción, cobranza y pago parcial | P | P | C | — | P | P | **Parcial · P2** | Facturas, pagos parciales y saldo están cubiertos; faltan detracción, entidad emisora, conciliación de saldos iniciales, evidencia visible del cobro y una transición operativa a cierre financiero. |
| `HIST-WA-013` | Alias histórico ambiguo | P | X | X | — | P | P | **No debe trasladarse automáticamente · P1** | DEC-037 conserva maestros canónicos y prohíbe importación, inferencia o correspondencia automática. Una revisión futura sólo puede ser humana y privada. |
| `HIST-WA-014` | Adjunto sin contexto | P | X | X | — | P | C | **No debe trasladarse automáticamente · P2** | El producto exige asociación para usar evidencias, lo cual es seguro; no hay bandeja de archivos sin conciliar. No debe adivinarse viaje, unidad ni propósito. |
| `HIST-WA-015` | Multimedia omitido o irrecuperable | N | X | — | — | P | P | **No debe trasladarse automáticamente · P2** | Debe registrarse la excepción durante una migración o UAT, nunca fabricar un archivo ni afirmar que fue revisado. |
| `HIST-WA-016` | Registro centralizado frente a captura directa | C | C | C | C | C | C | **Cubierto en contrato/UI; UAT pendiente · P1** | DEC-037 acepta captura dual: Conductor offline y Administración/Gerencia en línea con actor, fecha real, motivo y auditoría. Falta UAT de comprensión y operación. |

## Qué debe mantenerse

Los siguientes elementos se adaptan bien al conocimiento obtenido y no deben
debilitarse para imitar el chat:

1. **Identidad y relaciones estructuradas.** Viajes, cargas, gastos,
   combustible, adelantos, rendiciones, facturas y pagos poseen identificadores
   propios y relaciones explícitas.
2. **Separación de estados.** Operación, aprobación administrativa y cierre
   financiero no se reducen a una sola etiqueta informal.
3. **Autoridad del backend.** Programación, actividad sensible, revisión,
   cierre, reapertura y movimientos de dinero usan comandos y controles del
   servidor.
4. **Aislamiento y trazabilidad.** RLS por empresa, roles, auditoría e
   idempotencia reducen cruces, duplicados y cambios silenciosos.
5. **Offline de primer nivel.** La captura del conductor conserva fecha real,
   cola local, evidencia y reintentos antes de confirmar con el servidor.
6. **Rendición explícita.** La dirección del saldo y su resolución reemplazan
   expresiones ambiguas como “debe” o “saldo”.
7. **Archivos privados y bloqueos documentales.** Una evidencia no debe volver
   a circular como secreto o adjunto sin custodia.

## Brechas prioritarias para decidir y probar

### P0 — Integridad financiera implementada y validada técnicamente

1. **Gasto nuevo después de una rendición cerrada:** el guard de inserción está
   implementado y el contrato conserva el replay exacto. La migración se aplicó
   y la suite pgTAP correspondiente pasó contra el remoto autorizado con
   reversión de fixtures; falta validarlo en el UAT representativo.

### P1 — DEC-037 implementada y validada técnicamente

1. **Actor de registro:** Conductor conserva captura offline y
   Administración/Gerencia puede transcribir en línea con actor, motivo y
   auditoría.
2. **Registro tardío:** se acepta hasta el cierre, conserva fecha real y exige
   reapertura auditada para un hecho nuevo posterior al cierre.
3. **Consulta de evidencia:** el revisor puede abrir evidencia privada bajo
   RLS; la UAT debe comprobar comprensión y permisos en un entorno aislado.
4. **Ciclo y continuidad:** ciclos operativos agrupan viajes por unidad sin
   convertirlos en un único servicio facturable ni fusionar dinero.
5. **Dinero operativo:** “para gastos” es fondo operativo por rendir y se marca
   rendido al cierre; no representa remuneración ni préstamo.
6. **Frontera laboral:** planilla queda fuera del producto. No se descuentan
   saldos automáticamente.
7. **Maestros y alias:** no se permite importación, inferencia ni
   correspondencia automática; cualquier trabajo futuro requiere revisión humana
   privada.

La validación técnica P1/P2 no sustituye el UAT histórico sintético de
Administración, Gerencia y Conductor.

### P2 — Cobertura funcional y claridad

- realizar UAT autenticado de órdenes, costos conciliados y evidencia;
- establecer revisión, vigencia y documentos que bloquean programación;
- definir entidad emisora, detracción y saldos iniciales de cobranza;
- completar o simplificar conscientemente los ciclos de estado de adelantos y
  cierre financiero, evitando estados que nunca se alcanzan desde el producto;
- decidir cómo corregir, reprogramar y cancelar un viaje sin perder auditoría;
- definir cuándo una actividad necesita más de un adjunto: el modelo actual
  conserva una sola referencia de archivo por gasto, combustible o incidente;
- evaluar una vista de preparación/cierre que muestre faltantes sin fusionar
  estados ni autoridades;
- decidir si se necesita una bandeja de evidencia pendiente de clasificación.

### P3 — Mejoras posteriores

- lenguaje y ayudas surgidos del UAT;
- métricas de adopción y reducción del uso paralelo de WhatsApp;
- automatización de escenarios estables después de aprobar sus reglas.

## Evidencia técnica inspeccionada

La evaluación se apoyó principalmente en:

- `implementation/supabase/migrations/20260813180000_create_business_mvp_schema.sql`;
- migraciones de comandos, seguridad, almacenamiento, actividad offline,
  rendición e idempotencia `20260813200000` a `20260813370000`;
- `implementation/supabase/migrations/20260829113558_enforce_closed_settlement_expense_inserts.sql`,
  `20260829130000_p1_finance_controls.sql` y
  `20260829131000_create_operational_cycle_commands.sql`,
  `20260829140000_p2_maintenance_work_orders.sql`,
  `20260829141000_p2_maintenance_parts_evidence.sql`,
  `20260829150000_fix_operational_cycle_company_scope.sql` y
  `20260829151000_fix_work_order_part_lint.sql`;
- `implementation/apps/web/src/features/admin-ui/AdminRoutePage.tsx`;
- `implementation/apps/web/src/features/driver-ui/CapturePages.tsx`;
- `implementation/apps/web/src/features/driver-ui/driver-data.ts`;
- `implementation/apps/web/src/features/trip-money/money.ts`;
- streams de PowerSync y suites de dominio, integración, web y pgTAP.

La validación local final pasó formato, lint, TypeScript, las cinco suites
Vitest (410 pruebas) y build. Las siete migraciones P0/P1/P2 se aplicaron al
remoto autorizado; sus 12 suites pgTAP pasaron con `begin`/`rollback`, y
también pasaron `db lint`, el verificador de ACL y la comprobación de PowerSync
sin rezago. El UAT sigue pendiente.

## Condiciones para cambiar el veredicto

La adaptación puede elevarse a “adecuada” cuando:

1. Administración, Gerencia y Conductor ejecuten los escenarios críticos con datos
   sintéticos en el entorno aislado;
2. no queden P0/P1 de ejecución o validación abiertos;
3. las brechas de producto y los límites aceptados queden registrados explícitamente;
4. los escenarios estables se conviertan en regresión automatizada o UAT
   repetible.

Antes de certificar el uso formal, el artefacto desplegado debe asociarse a un
commit y una etiqueta Git reproducibles. El árbol de trabajo de esta sesión aún
contiene cambios sin versionar, por lo que ese cierre requiere una revisión
explícita de alcance antes de crear el commit.

El procedimiento se encuentra en el
[plan de pruebas de adaptación](18_plan_pruebas_adaptacion_aplicativo.md).
