# Runbook — Operación productiva inicial

**Estado:** vigente para el arranque autorizado el 2026-09-03.
**Autoridad:** DEC-046; complementa DEC-006, DEC-018 a DEC-021, DEC-027,
DEC-037, DEC-041, DEC-044 y DEC-045.
**Propósito:** permitir el registro de operaciones reales en producción sin
depender de OCR ni GPS, preservando la integridad financiera, la trazabilidad y
la capacidad offline del Conductor.

## Alcance autorizado

El núcleo productivo permite:

- gestionar accesos, unidades, conductores, clientes, rutas y demás maestros
  reales necesarios;
- crear, programar, iniciar, avanzar y finalizar viajes, incluso si el peso o
  el flete todavía están pendientes;
- capturar kilometraje, carga/vacío, incidencias, combustible, gastos y
  evidencias desde la PWA del Conductor sin conexión, o desde oficina en línea;
- registrar adelantos, rendir fondos, revisar gastos y mantener la auditoría
  de reaperturas y regularizaciones;
- completar condiciones comerciales, facturar cuando el servidor lo permita y
  registrar cobranza y pagos parciales;
- registrar mantenimiento básico y documentos ya definidos, en línea.

No se usa este producto para planilla, descuentos laborales, facturación
electrónica, conciliación bancaria, OCR automático, GPS automático, detracción
ni conciliación de saldos iniciales. Esos procesos continúan en su procedimiento
vigente hasta una decisión y una implementación específicas.

## Confirmación antes del primer viaje real

Gerencia realiza y conserva una breve acta o registro de la comprobación:

1. Confirma que las cinco cuentas conservadas pertenecen a las personas
   autorizadas, que tienen el rol correcto y que no hay accesos de prueba.
2. Revisa que cada unidad, Conductor, cliente y ruta usados sean maestros reales
   y vigentes. No se crean sustitutos ficticios para desbloquear una operación.
3. Elige para cada viaje el canal de captura: `driver_app` si el Conductor usará
   la PWA; `staff_assisted` si oficina registrará los hechos. El segundo canal
   requiere conectividad durante cada captura.
4. En el teléfono del Conductor, abre la PWA productiva, inicia sesión y espera
   la sincronización inicial antes de salir a ruta. Comprueba que la pantalla
   indique el viaje asignado y el estado de sincronización.
5. Comprueba que el viaje de prueba no existe: producción empieza con hechos
   reales, no con una nueva carga sintética. Si hay una inconsistencia, se
   detiene y se registra antes de crear el primer viaje.

## Operación diaria

1. Administración o Gerencia crea y programa el viaje con el maestro real y
   selecciona el canal. Origen y destino son obligatorios; punto de carga,
   peso y flete pueden declararse después cuando aún no se conocen.
2. El Conductor registra sus hechos desde **Mi viaje**. Sin internet, conserva
   la aplicación abierta o la reabre desde el icono instalado; no debe borrar
   datos del sitio ni desinstalar la PWA mientras existan elementos pendientes
   de sincronización.
3. Al recuperar cobertura, el Conductor confirma que la cola se drenó antes de
   considerar el hecho recibido por oficina. Si un elemento falla, conserva el
   mensaje y la evidencia; no duplica manualmente el registro sin revisar el
   expediente del viaje.
4. Administración usa la captura representada sólo cuando fue seleccionado el
   modo de oficina. Cada registro requiere la fecha real y motivo; no se debe
   operar como si fuese la cuenta del Conductor.
5. Los adelantos, combustible y gastos se adjuntan al viaje real. La rendición
   se cierra sólo después de revisar el saldo y su resolución. Una corrección
   posterior usa el flujo auditado de reapertura, nunca edición directa.
6. Gerencia o Administración completa peso y flete cuando se confirmen. La
   factura sólo se emite cuando el sistema habilite la acción; una pantalla de
   bloqueo indica información comercial pendiente y no es un error a eludir.

## Tratamiento de incidencias

| Situación | Acción inmediata |
|---|---|
| Sin internet en ruta | Seguir capturando sólo por la PWA del Conductor y esperar la cola local; no migrar los hechos a WhatsApp como fuente oficial. |
| Cola que no se vacía tras recuperar conexión | Detener duplicaciones, guardar captura de la cola/errores, registrar el identificador de viaje y escalar a Gerencia. |
| Error de autorización o usuario equivocado | No compartir credenciales ni cambiar roles de forma informal; Gerencia revisa Accesos y conserva el motivo. |
| Dato financiero o rendición incorrecta | No borrar ni editar directamente; usar reapertura/regularización auditada o suspender el cierre afectado. |
| Pérdida, corrupción, acceso indebido o P0/P1 | Detener el flujo afectado, preservar la evidencia, informar a Gerencia y no continuar su expansión hasta resolverlo. |

## Estabilización del arranque

Durante las primeras operaciones, Gerencia registra para cada recorrido
representativo: fecha, rol, versión productiva, dispositivo, identificador de
viaje, conectividad, resultado y cualquier incidencia. Se cubren como mínimo
Administración/Gerencia, Contabilidad y Conductor con una reconexión real.

Una vez que esos recorridos no presenten P0/P1, se incorpora el resultado al
log de sesión y se continúa el uso normal. OCR y GPS pueden evaluarse después,
sin bloquear ni alterar los hechos registrados por el núcleo.
