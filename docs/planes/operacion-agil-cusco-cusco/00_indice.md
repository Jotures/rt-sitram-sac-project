# Operación ágil Cusco–Cusco

Expediente único de SESSION-20260828-011. Autoridad: DEC-047 y DEC-048.
El propietario autorizó implementación y despliegue, y aclaró que el interruptor debe cambiar la experiencia general.

1. [Reglas y evidencia](01_reglas_y_evidencia.md).
2. [Contrato de datos](02_contrato_de_datos.md).
3. [Experiencia, manual y sincronización](03_experiencia_y_sincronizacion.md).
4. [Validación, publicación y recuperación](04_validacion_y_despliegue.md).

## Seguimiento

La entrega anterior, limitada a Salidas y comprobaciones HTTP, fue parcial. Este expediente sustituye sus afirmaciones de cierre.

- Implementado: modo personal global, navegación diaria, formularios esenciales y vista completa.
- Implementado: salidas sin cliente, servicios posteriores, reserva por salida y regreso separado del cierre financiero.
- Implementado: fondo inicial y ampliaciones, combustible por origen de pago, hojas conciliadas y devolución/reembolso parcial.
- Implementado: comandos SQLite/PowerSync con dependencias e idempotencia, diario local visible y archivos OPFS recuperables.
- Implementado: correcciones auditadas de dinero, facturas y pagos; categorías administrables; kilometraje opcional.
- Base, streams y cliente general publicados. Versión 0.2.0, commit 8cdaffb, verificada con autenticación en https://rt-sitram-centro-control.vercel.app. El cierre y los límites se registran en el documento de validación.
- Verificado en servidor: 77 casos pgTAP revertidos. Interfaz QA: salida sin cliente, dos servicios con clientes diferentes, depósitos, ambos combustibles, entrega de servicios y regreso; actualización de PWA con comandos y archivo conservados.
- Verificado desde UI: recuperación del envío de hoja, aprobación (S/750 por devolver), devoluciones S/300 + S/450 y cierre con saldo cero. Se conservaron archivo y movimientos originales.

GPS y OCR permanecen archivados. El tratamiento de RT-2026-0001 y S/800 es una exclusión auditada de prueba; no se inventan devoluciones. Los registros antiguos conservan su contrato.

Los criterios de aceptación y sus límites se mantienen en [validación](04_validacion_y_despliegue.md); no se declara resuelta la auditoría completa.
