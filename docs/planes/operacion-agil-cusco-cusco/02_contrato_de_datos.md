# Contrato de datos

## Salida y servicios

`operational_cycles` representa Cusco–Cusco: unidad, conductor responsable, programación o partida real, regreso, estado y canal de captura. `trips` conserva servicios por cliente. Crear una salida no crea un servicio ficticio; el retorno vacío solo requiere registrar el regreso.

La reserva pertenece a la salida. Un segundo servicio suyo no compite por recursos; una salida incompatible sí se rechaza. El conductor queda fijado al iniciar. Regreso y servicios resueltos finalizan la operación; una rendición pendiente no bloquea una salida posterior.

`cycle_id` relaciona entregas, gastos, abastecimientos y rendición. `trip_id` es opcional para nuevos movimientos comunes y sigue válido en históricos. No se agrupan registros antiguos por inferencia.

## Cuenta del conductor

Fondo = entregas vigentes iniciales y adicionales. Saldo = fondo menos gastos reconocidos y combustible reconocido con `payment_source=driver_fund`. El combustible `company` suma costo operativo, sin reducir dinero del conductor. Los cobros a clientes permanecen separados.

`cycle_balance_payments` registra devoluciones y reembolsos reales, también parciales. El servidor calcula el remanente, dirección y cierre. No hay compensación automática entre salidas ni descuentos de planilla.

`cycle_rendition_summaries` mantiene declarado, reconocido, versión y base de conciliación. Las categorías contienen vínculos a registros existentes y solo adicionales identificados. No se vuelve a sumar la hoja completa. El combustible se reconoce por abastecimiento. Observar requiere comentario por categoría; presentar requiere hojas; cerrar exige hojas sincronizadas, servicios resueltos, movimientos revisados y saldo autoritativo cero.

`settlement_evidence` vincula varias fotos/PDF en Storage privado. Se conserva el original sin OCR. Las correcciones, anulaciones y reaperturas mantienen historial, actor y motivo. Una factura con pagos vigentes no se anula sin resolverlos; anular un pago erróneo restaura la deuda, y anular la factura conserva la obligación comercial de facturar.

## Comandos, permisos y compatibilidad

`operation_commands`: UUID local, versión 1, tipo, contenido completo, dependencia, dispositivo, actor y confirmación. La creación con fondo/combustible/primer servicio es una transacción. Repetir el UUID con contenido distinto se rechaza; los movimientos mantienen identificadores derivados estables.

El cliente no asigna permisos mediante preferencias. Perfil activo, rol y empresa se validan nuevamente en servidor. RLS y streams limitan datos a empresa y conductor responsable. La captura de campo usa un único canal/dispositivo; el cambio exige confirmación reciente de cola y archivos vacíos del origen, con motivo. Administración conserva entregas y revisión.

Las tablas de comandos de inserción exclusiva se complementan con `operation_command_journal` local: la cola upload permanece en PowerSync. Las dependencias rechazadas se conservan para resolver primero el origen. Reintentar mantiene el comando original; nunca se fabrica una confirmación local.

Kilometraje nulo no crea lectura. Una lectura presente se valida y conserva; distancia/rendimiento requieren cobertura real. Se mantienen los RPC anteriores para colas históricas.

Las categorías iniciales son Viáticos, Peajes, Cocheras, Carga y descarga, Balanza, Urea y Otros gastos. Otros exige descripción; combustible no se duplica como gasto ordinario. No se introducen tarifas diarias.
