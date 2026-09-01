# Reglas, excepciones y controles observados

| ID | Hallazgo | Clasificación | Evidencia | Consecuencia |
|---|---|---|---|---|
| `RUL-001` | La declaración de viaje funciona como plantilla informal con campos repetidos. | PATRÓN OBSERVADO | `WAM-00009`, `WAM-00114`, `WAM-00371`, `WAM-00544` | Diseñar captura guiada, no copiar texto libre. |
| `RUL-002` | El fondo para gastos puede variar y se anota junto al viaje. | PATRÓN OBSERVADO | Familia `OPR-003` | No asumir monto fijo ni que sea siempre un adelanto salarial. |
| `RUL-003` | El saldo de gasto puede trasladarse a la liquidación de sueldo. | PATRÓN OBSERVADO | `WAM-00008`, `WAM-00232`, `WAM-00541` | Separar rendición y planilla; exigir aprobación antes de descontar. |
| `RUL-004` | Algunos viajes se declaran como continuación o se reanudan. | HECHO DOCUMENTADO | `WAM-00450`–`WAM-00453`, `WAM-00512` | Validar uso del ciclo/retorno del sistema. |
| `RUL-005` | Mantenimiento puede incluir kilometraje y próximo cambio, pero no siempre. | PATRÓN OBSERVADO | `WAM-00056`, `WAM-00158`, `WAM-00503` | La planificación preventiva requiere completar campos y evidencia. |
| `RUL-006` | La cobranza usa listas de nombres/carga/factura libres. | PATRÓN OBSERVADO | `WAM-00060`, `WAM-00172`, `WAM-00218` | Exigir cliente, factura y pago referenciables. |
| `EXC-001` | Hay mensajes eliminados, multimedia omitido y adjuntos sin contexto. | HECHO DOCUMENTADO | Inventario | No rellenar ni migrar datos faltantes. |
| `EXC-002` | Los tokens de unidad muestran variantes tipográficas o numéricas. | CONTRADICCIÓN / CALIDAD | Mensajes de viaje y flota | No normalizar automáticamente al maestro. |
| `EXC-003` | Se comunicó históricamente una credencial GPS por chat. | HECHO DOCUMENTADO / RIESGO MITIGADO | `WAM-00510` | El propietario informó que ya fue rotada; conservar secretos sólo server-side. |

## Control que falta en el canal

WhatsApp no impone unicidad, identidad de operación, estados, revisión,
idempotencia, retención selectiva ni separación de funciones. El aplicativo
debe absorber el registro definitivo mediante comandos y estados auditables,
no replicar el chat como base de datos.
