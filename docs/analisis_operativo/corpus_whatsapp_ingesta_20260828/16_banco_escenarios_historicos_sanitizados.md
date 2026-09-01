# Banco de escenarios históricos sanitizados

## Propósito

Este banco transforma patrones del corpus de WhatsApp en casos de prueba
reproducibles. Los escenarios conservan la estructura del hecho observado, pero
deben ejecutarse únicamente con identidades, fechas, importes, unidades,
clientes, rutas y archivos sintéticos.

Las referencias opacas acreditan procedencia. No prueban aprobación, ejecución
física ni corrección contable. Tampoco son campos que deban copiarse al producto:
pertenecen al expediente de QA.

## Índice de escenarios

| ID | Escenario | Dominio principal | Riesgo que permite probar |
|---|---|---|---|
| `HIST-WA-001` | Declaración integral de viaje | Viajes | Pérdida de la plantilla operativa real. |
| `HIST-WA-002` | Declaración incompleta | Viajes / calidad | Dato inventado o bloqueo incomprensible. |
| `HIST-WA-003` | Continuación o reanudación multitramo | Ciclos / viajes | Duplicación o mezcla de tramos y costos. |
| `HIST-WA-004` | Fondo “para gastos” | Adelantos / rendición | Clasificación financiera no aprobada. |
| `HIST-WA-005` | Combustible declarado junto al viaje | Combustible | Registro incompleto o sin vínculo estable. |
| `HIST-WA-006` | Gasto o evidencia informado después | Gastos / archivos | Imposibilidad de regularizar sin alterar fechas. |
| `HIST-WA-007` | Saldo ambiguo | Rendición | Dirección de deuda interpretada libremente. |
| `HIST-WA-008` | Rendición conectada con planilla | Frontera laboral | Descuento automático sin autoridad. |
| `HIST-WA-009` | Mantenimiento con odómetro y próximo cambio | Flota | Orden incompleta o continuidad preventiva perdida. |
| `HIST-WA-010` | Foto de mantenimiento con poco contexto | Flota / archivos | Crear hechos técnicos a partir de una imagen. |
| `HIST-WA-011` | Paquetes documentales de unidades | Documentos | Confundir archivo existente con documento vigente. |
| `HIST-WA-012` | Factura, detracción y pago parcial | Cobranza | Saldo, viaje o emisor incorrectamente conciliados. |
| `HIST-WA-013` | Alias ambiguo | Maestros | Asociación automática a entidad equivocada. |
| `HIST-WA-014` | Adjunto sin contexto suficiente | Archivos | Evidencia huérfana usada como dato autoritativo. |
| `HIST-WA-015` | Multimedia omitido | Calidad / excepción | Inventar o esconder evidencia irrecuperable. |
| `HIST-WA-016` | Registro centralizado frente a captura directa | Roles / adopción | El actor real no puede registrar o se pierde la autoría original. |

## Escenarios

### HIST-WA-001 — Declaración integral de viaje

**Evidencia:** `WAM-00009`, `WAM-00114`, `WAM-00371`, `WAM-00544`.

**Precondiciones:** empresa de prueba, cliente, unidad y conductor disponibles;
catálogos sintéticos preparados.

**Secuencia:** crear el servicio, registrar origen/destino y carga, asignar
recursos, informar combustible y fondo operativo, aprobar y programar.

**Datos mínimos de prueba:** fecha del evento, origen, destino, cliente, unidad,
conductor, carga, combustible y fondo con valores ficticios.

**Invariante esperada:** una identidad de viaje permite reconstruir todos los
hechos; los estados operativo, administrativo y financiero permanecen
separados; los reintentos no duplican dinero ni actividad.

**Incertidumbre conservada:** la declaración histórica no prueba que el viaje
haya sido aprobado, iniciado o ejecutado físicamente.

### HIST-WA-002 — Declaración incompleta

**Evidencia:** `WAM-00046`, candidato `TRIP-CAND-011`.

**Precondiciones:** los maestros necesarios existen; la descripción de carga u
otro dato material se deja sin determinar deliberadamente.

**Secuencia:** intentar guardar y avanzar el caso incompleto.

**Datos mínimos de prueba:** campos conocidos, valor explícito “desconocido” en
el expediente de QA y ausencia real del campo en la operación probada.

**Invariante esperada:** el sistema no inventa el dato. Si una regla vigente lo
exige, bloquea únicamente la transición correspondiente y explica qué falta y
cómo resolverlo.

**Incertidumbre conservada:** el corpus no define qué campos deben ser
obligatorios para cada estado.

### HIST-WA-003 — Continuación o reanudación multitramo

**Evidencia:** `WAM-00450`–`WAM-00453`, `WAM-00512`, `WAM-00534`.

**Precondiciones:** existe un viaje o ciclo sintético anterior y permanece
disponible para relacionar el nuevo movimiento.

**Secuencia:** registrar una continuación con otro tramo, carga, combustible o
fondo; intentar clasificarla como tramo, retorno o servicio independiente.

**Datos mínimos de prueba:** relación candidata, origen/destino del tramo,
unidad, conductor, fecha, motivo y recursos entregados.

**Invariante esperada:** la clasificación es explícita y auditable; los costos
no se duplican ni se asignan silenciosamente a otro viaje.

**Incertidumbre conservada:** sólo el propietario puede definir cuándo se trata
del mismo viaje, un ciclo, un retorno o un nuevo servicio facturable.

### HIST-WA-004 — Fondo “para gastos” sin semántica definida

**Evidencia:** `WAM-00054`, `WAM-00114` y familia `OPR-003`.

**Precondiciones:** viaje sintético asignado a un conductor.

**Secuencia:** registrar una entrega antes o durante la operación; revisar su
aparición posterior en la rendición.

**Datos mínimos de prueba:** viaje, receptor, fecha, importe ficticio, medio de
entrega y concepto.

**Invariante esperada:** el desembolso no se convierte automáticamente en
sueldo, préstamo ni gasto consumido; conserva responsable, concepto y estado de
rendición.

**Incertidumbre conservada:** “para gastos” aún requiere definición formal de
negocio.

### HIST-WA-005 — Combustible declarado junto al viaje

**Evidencia:** `WAM-00371`, `WAM-00544`.

**Precondiciones:** viaje y unidad sintéticos existentes.

**Secuencia:** capturar cantidad y total; probar también la ausencia inicial de
proveedor, comprobante u odómetro.

**Datos mínimos de prueba:** viaje, unidad, cantidad, unidad de medida, total,
fecha y los campos deliberadamente ausentes.

**Invariante esperada:** el combustible queda ligado a la unidad y al viaje;
las validaciones no fabrican proveedor, odómetro o comprobante; cantidad,
precio y total mantienen coherencia.

**Incertidumbre conservada:** la evidencia no confirma proveedor, medio de
pago, comprobante ni odómetro para todos los casos.

### HIST-WA-006 — Gasto o evidencia informado después del viaje

**Evidencia:** `WAM-00025` con `WAM-00029` / `WA-MEDIA-006`;
`WAM-00208` / `WA-MEDIA-073`; `WAM-00550` / `WA-MEDIA-208`.

**Precondiciones:** existe más de un viaje sintético anterior potencialmente
relacionado y al menos uno ya terminó operativamente.

**Secuencia:** registrar una foto o gasto después, usando una fecha del hecho
distinta de la fecha de registro; probar asociación explícita y caso no
conciliado.

**Datos mínimos de prueba:** fecha del gasto, fecha de captura, fecha de
registro, categoría, importe ficticio, archivo y relación candidata.

**Invariante esperada:** las fechas permanecen distintas; el sistema no enlaza
por proximidad temporal ni reabre un cierre financiero silenciosamente.

**Incertidumbre conservada:** la relación entre fotografía, gasto y viaje no
siempre está demostrada en el corpus.

### HIST-WA-007 — Saldo ambiguo

**Evidencia:** `WAM-00008` y patrón `RUL-003`.

**Precondiciones:** rendición sintética con adelantos y gastos revisados.

**Secuencia:** producir una diferencia y tratar de cerrarla sin especificar
dirección ni evidencia de regularización.

**Datos mínimos de prueba:** rendición, totales ficticios, moneda, explicación,
revisor y referencia de resolución cuando corresponda.

**Invariante esperada:** el sistema calcula y nombra quién devuelve o quién
reembolsa; un saldo no nulo exige resolución antes del cierre.

**Incertidumbre conservada:** “debe” o “saldo” en el chat no acredita dirección,
aceptación ni exigibilidad.

### HIST-WA-008 — Rendición conectada con planilla, pero separada

**Evidencia:** `WAM-00232`–`WAM-00233`, `WAM-00366`, `WAM-00541`.

**Precondiciones:** existe una rendición sintética y un cálculo externo de
remuneración.

**Secuencia:** intentar trasladar la diferencia del viaje a un pago de personal.

**Datos mínimos de prueba:** referencia a rendición, concepto, importe ficticio,
estado de aprobación y referencia externa de planilla.

**Invariante esperada:** no existe descuento automático. Rendición y planilla
mantienen autoridades y auditorías independientes hasta que una política
laboral aprobada defina su relación.

**Incertidumbre conservada:** no existe una política laboral demostrada ni una
decisión sobre incluir planilla en el producto.

### HIST-WA-009 — Mantenimiento con odómetro y próximo cambio

**Evidencia:** `WAM-00056`, `WAM-00026`, `WAM-00503` / `WA-MEDIA-195`.

**Precondiciones:** unidad sintética y catálogo mínimo de mantenimiento.

**Secuencia:** registrar intervención, odómetro, costos y próximo umbral;
completar la orden y verificar continuidad preventiva.

**Datos mínimos de prueba:** unidad, componente, tipo, fecha, odómetro, próximo
umbral, costos ficticios, responsable y estado.

**Invariante esperada:** se distingue aviso, orden, ejecución y cierre; el
odómetro no se duplica; el siguiente mantenimiento permanece trazable.

**Incertidumbre conservada:** no todos los mensajes separan compra, instalación
y trabajo terminado.

### HIST-WA-010 — Foto de mantenimiento con contexto insuficiente

**Evidencia:** `WAM-00158` / `WA-MEDIA-054`, `WAM-00356` /
`WA-MEDIA-138`.

**Precondiciones:** archivo sintético válido sin orden identificada.

**Secuencia:** intentar usar la imagen como evidencia de flota sin completar
unidad, diagnóstico, costo o estado.

**Datos mínimos de prueba:** archivo, hash, fecha, entidad candidata y
observación de QA.

**Invariante esperada:** una fotografía no crea por sí sola diagnóstico,
repuesto instalado, costo aprobado ni orden finalizada.

**Incertidumbre conservada:** la fotografía no demuestra la unidad afectada ni
la culminación del trabajo.

### HIST-WA-011 — Paquetes documentales de unidades

**Evidencia:** `WAM-00075`–`WAM-00077`, `WA-MEDIA-025`–`WA-MEDIA-027`,
`WA-PDF-006`–`WA-PDF-008`.

**Precondiciones:** tres unidades y documentos completamente sintéticos.

**Secuencia:** adjuntar paquetes, clasificar documentos, registrar vigencias y
probar un documento bloqueante vencido o sin archivo.

**Datos mínimos de prueba:** entidad, unidad, tipo, fechas, archivo privado,
estado y condición bloqueante.

**Invariante esperada:** existencia de archivo no equivale a vigencia; cada
documento tiene entidad y tipo; el bloqueo se aplica y explica de manera
consistente.

**Incertidumbre conservada:** falta definir qué documentos y vigencias bloquean
realmente una salida.

### HIST-WA-012 — Factura, detracción y pago parcial

**Evidencia:** `WAM-00042`–`WAM-00053`, `WA-MEDIA-010`–`WA-MEDIA-016`,
`WAM-00172`, `WAM-00218`–`WAM-00219`.

**Precondiciones:** viaje, cliente y entidad emisora sintéticos.

**Secuencia:** crear factura, registrar un pago parcial, registrar otro
movimiento y verificar saldo; mantener la detracción como concepto explícito a
evaluar.

**Datos mínimos de prueba:** emisor, cliente, viaje, factura, fechas, total,
pagos ficticios, referencia y archivos sintéticos.

**Invariante esperada:** factura y pagos tienen identidades propias; el saldo se
calcula sin sobrepago o duplicación; no se confunden emisor, cliente y viaje.

**Incertidumbre conservada:** la lista histórica no acredita validez fiscal,
vencimiento, conciliación ni entidad emisora correcta.

### HIST-WA-013 — Alias de unidad o persona ambiguo

**Evidencia:** variantes transversales en `WAM-00009`, `WAM-00114`,
`WAM-00371`, `WAM-00544`.

**Precondiciones:** dos alias sintéticos parecidos y más de un candidato de
maestro.

**Secuencia:** intentar recrear un caso histórico y resolver el alias.

**Datos mínimos de prueba:** alias opaco, candidatos, nivel de confianza,
decisión y responsable de revisión.

**Invariante esperada:** no se fusionan ni asignan entidades por similitud sin
confirmación humana; una corrección no altera silenciosamente el histórico.

**Incertidumbre conservada:** el corpus no autoriza decidir identidades
canónicas.

### HIST-WA-014 — Adjunto sin contexto suficiente

**Evidencia:** `WAM-00039` / `WA-MEDIA-009` y patrón de adjuntos sin
explicación adicional.

**Precondiciones:** archivo sintético válido sin operación ni entidad segura.

**Secuencia:** intentar adjuntarlo y usarlo como evidencia de un registro.

**Datos mínimos de prueba:** archivo, hash, fecha y referencia de QA.

**Invariante esperada:** el archivo no adquiere significado por adivinación; el
sistema exige asociación explícita antes de usarlo en una decisión o cierre.

**Incertidumbre conservada:** la función operativa del adjunto no está
documentada.

### HIST-WA-015 — Multimedia omitido o evidencia irrecuperable

**Evidencia:** `WAM-00131`, `WAM-00139`, `WAM-00268`, `WAM-00481`,
`WAM-00537`.

**Precondiciones:** escenario que declara evidencia ausente y no posee archivo.

**Secuencia:** intentar continuar o cerrar un proceso que requiere esa
evidencia.

**Datos mínimos de prueba:** referencia de QA, fecha, contexto disponible y
motivo “evidencia ausente”.

**Invariante esperada:** no se crea un archivo ficticio ni se afirma revisión;
si la evidencia es obligatoria, el pendiente o la excepción permanecen
visibles.

**Incertidumbre conservada:** contenido, importe y correspondencia son
irrecuperables desde la exportación.

### HIST-WA-016 — Registro centralizado frente a captura directa

**Evidencia:** un participante emitió 486 de los 554 mensajes y consolidó
viajes, gastos, mantenimiento, pagos de personal y cobranza.

**Precondiciones:** cuentas sintéticas de Administración y Conductor; viaje
activo; un gasto y un abastecimiento de prueba comunicados fuera del
aplicativo.

**Secuencia:** intentar registrar los hechos desde Administración y, en una
segunda corrida, capturarlos directamente como Conductor; comparar autoría,
tiempo, claridad y recuperación.

**Datos mínimos de prueba:** actor que ocurrió o informó el hecho, actor que lo
registró, viaje, fecha del hecho, fecha de registro y valores sintéticos.

**Invariante esperada:** el sistema no atribuye al conductor una captura hecha
por Administración ni pierde la procedencia. Si la empresa adopta captura
directa, el cambio de responsabilidad debe validarse y probarse; si mantiene
consolidación central, debe existir un recorrido autorizado y auditable.

**Incertidumbre conservada:** el corpus no demuestra si el registrador recibió
la información de conductores por otro canal ni cuál actor debe ser responsable
en el proceso objetivo.

## Reglas comunes de ejecución

- Usar sólo datos y archivos sintéticos.
- Mantener las referencias `HIST-WA-*` y `WAM-*` en el expediente de QA, no en
  la operación productiva.
- Separar fecha del hecho, fecha de captura y fecha de registro.
- Probar sin conexión y después de sincronizar cuando el rol y la acción lo
  permitan.
- Repetir envíos idempotentes y confirmar que no producen duplicados.
- Verificar permisos con Administración, Gerencia y Conductor.
- Registrar `PASS`, `FAIL`, `BLOCKED` o `NOT_RUN` por escenario y dimensión.
- No convertir una expectativa de seguridad en política de negocio sin
  validación del propietario.
