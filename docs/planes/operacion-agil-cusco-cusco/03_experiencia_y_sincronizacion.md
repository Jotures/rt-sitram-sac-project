# Experiencia, manual y sincronización

La distribución de Inicio, Salidas y Finanzas y las ayudas de captura se actualizan
mediante [DEC-049: navegación y contexto](06_navegacion_y_contexto.md). Inicio resume
la operación; su acceso de registro abre Salidas. Finanzas mantiene los registros
visibles y ofrece únicamente la captura correspondiente a la sección.

## Interruptor general

En **Mi perfil → Forma de trabajar → Registro rápido** se cambia la preferencia personal. También se llega a Perfil desde el indicador de modo de la cabecera. Gerencia y Administración comienzan en rápido.

El interruptor cambia Inicio, navegación, entrada de operaciones y exposición del detalle en formularios. **Más herramientas** conserva funciones complementarias; **Ver más detalles** abre campos adicionales. Desactivarlo muestra la vista completa sobre los mismos datos y permisos. No modifica roles ni elimina capacidades.

## Trabajo diario

1. En Inicio o Salidas, pulsa **Registrar salida**. Elige unidad, conductor y fecha/estado. Recorrido, dinero inicial, combustible y primer servicio son opcionales. No se pide cliente si todavía no se conoce.
2. Desde la salida agrega servicios y depósitos cuando ocurran. El flete y peso pueden quedar pendientes; la facturación exigirá confirmarlos.
3. Registra gastos y combustible distinguiendo quién pagó. El kilometraje es opcional.
4. Confirma las entregas de los servicios y registra el regreso físico a Cusco.
5. En **Rendir gastos**, revisa lo ya registrado, agrega las hojas y transcribe totales por categoría. Identifica solo los importes adicionales; confirma que no duplicaste combustible ni gastos.
6. Revisa o devuelve categorías observadas. Registra dinero realmente devuelto al dueño o reembolsado al conductor, también en partes. Cierra cuando el servidor confirme la cuenta saldada.

**Repetir salida** sugiere unidad, conductor y recorrido. Hay que confirmar la nueva fecha y los hechos de esta salida; no se copian importes ni fechas anteriores.

En Perfil se administran categorías. En Cobranza se consultan saldos netos y se corrigen/anulan facturas y pagos con motivo. La rendición ofrece correcciones de entregas, gastos y combustible, y reapertura auditada.

## Sin conexión y recuperación

La primera entrada requiere autenticarse y sincronizar los maestros. Después los formularios, comandos y fotografías se conservan en el dispositivo. El cierre y revisión definitiva se hacen con conexión.

Estados: **Guardado en este dispositivo**, **Pendiente de confirmación**, **Confirmado**, **Requiere atención**. Una salida offline no reserva recursos definitivamente. Al reconectar se revalidan disponibilidad, permisos y canal.

PowerSync procesa la salida antes que sus movimientos mediante `uploadData`. Un rechazo del origen conserva sus dependientes. La recuperación muestra la causa y permite reintentar el original después de resolverla; no borres almacenamiento del navegador para intentar solucionarlo.

El diario local presenta comandos pendientes que las tablas insert-only no muestran. Al actualizar clientes antiguos se reconstruye ese diario desde la cola existente, sin completarla ni borrarla. Los formularios tienen claves por usuario y operación.

Las fotos/PDF se guardan en OPFS y su cola en SQLite. El worker de oficina y conductor los envía a Storage privado después de los registros estructurados. Restaurar un archivo recupera su tipo MIME original. Tras cinco fallos se muestra un reintento explícito; se conserva el archivo hasta confirmar el vínculo remoto.

Cambiar de canal requiere vaciar y confirmar el dispositivo de origen, incluidas evidencias y rechazos. Si un registro necesita corrección, se conserva el original y su trazabilidad. No se transfieren automáticamente fondos ni responsabilidad entre conductores durante el recorrido.

Referencia: [integración oficial PowerSync](https://docs.powersync.com/configuration/app-backend/client-side-integration).
