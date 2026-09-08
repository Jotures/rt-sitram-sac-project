# Resumen y descargas por registro

## Uso

En el detalle de **Viaje**, **Salida** y **Rendición** se ofrecen `Ver resumen`, `Descargar PDF` y `Descargar Excel`. No es necesario abrir Reportes ni pasar por la vista previa para descargar. Inicio conserva también las descargas de la salida seleccionada.

- Viaje: cliente, recorrido, fechas, carga, cuenta comercial, facturas, cobros y movimientos directamente vinculados al servicio.
- Salida: recorrido Cusco–Cusco, unidad/conductor, cuenta conjunta, entregas, gastos, combustible, hoja, devoluciones/reembolsos y servicios comerciales.
- Rendición por salida: el mismo cálculo autoritativo, sin incluir las tablas comerciales de los clientes.
- Rendición histórica: conserva el contrato por servicio y distingue diferencia histórica de obligación actual.

Cada descarga consulta nuevamente los datos con conexión. El documento incluye fecha de generación y advertencia de que no incorpora operaciones locales pendientes. Un error de permisos, de consulta o de auditoría impide la descarga. La rendición abierta se rotula como preliquidación; descargar no la cierra ni la aprueba.

El PDF se puede imprimir o compartir manualmente. El Excel es `.xlsx`, con pestañas, filtros, encabezados fijos e importes numéricos; es una copia del estado consultado, no una herramienta para modificar los saldos del sistema. Las fechas se presentan en hora de Perú. Las hojas originales privadas se consultan en Rendición; esta entrega no las incorpora como anexos al PDF.

## Contrato y límites

`get_cycle_rendition` conserva autoridad sobre entregas, gastos reconocidos, adicionales de hoja, combustible de conductor y remanente tras pagos parciales. No se suma la hoja completa de nuevo ni se resta combustible de empresa del fondo. No se distribuyen costos comunes ni se presenta rentabilidad definitiva por servicio. Los importes no reconocidos se muestran pendientes, no como cero.

`record_entity_export` valida rol, empresa, tipo de registro y formato; registra `REPORT_EXPORTED` con identificador, generación y SHA-256 de la estructura exportada. Anónimos y conductores no pueden registrar estas exportaciones financieras; las operaciones anuladas o viajes marcados de prueba quedan excluidos. No se reemplaza el registro de exportación analítica de DEC-041.

La pantalla, PDF y Excel comparten la misma estructura de presentación. Se reutiliza `@react-pdf/renderer`; se añade `exceljs` 4.4.0 fijado para generar XLSX en el navegador, cargado al exportar. No se introducen servicios externos ni se envían archivos a terceros.

## Verificación

- 309 pruebas web correctas, incluyendo cuentas positivas/negativas/cero, pagos parciales, rechazo de cuenta diferente/prueba/NaN, pendientes y libro XLSX reabierto con números y textos literales.
- Ocho casos pgTAP con datos sintéticos y ROLLBACK: auditoría PDF/XLSX, aislamiento empresarial, rol conductor, anónimo, entidad inexistente, formato y digest inválidos.
- Build, TypeScript, lint, formato y mapa comprobados. PDF sintético renderizado con Poppler para inspección de paginación.
- Migración aditiva `20260908160246_record_entity_exports.sql` aplicada. Inventario antes/después: 6 perfiles, 3 viajes y 2 salidas; huella de perfiles idéntica. No se modificaron las identidades reales ni se reactivó QA.
- No se afirma verificada la descarga mediante la sesión autenticada del propietario: la herramienta de navegador falló al inicializar. Queda pendiente esa comprobación de extremo a extremo y Android físico.
