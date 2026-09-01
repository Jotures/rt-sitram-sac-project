# Catálogo de referencias

## Esquema de identificadores

| Prefijo | Significado | Alcance |
|---|---|---|
| `WAM-xxxxx` | Mensaje normalizado de WhatsApp | Estable dentro de este corpus. |
| `WA-MEDIA-xxx` | Adjunto vinculado a un mensaje | Mapa de nombre y hash sólo local. |
| `WA-PDF-xxx` | PDF del corpus | Mapa de nombre, hash y texto sólo local. |
| `ACT-xxx` | Participante/anotación de rol | Alias privado; rol inferido. |
| `VEH-xxx` | Unidad candidata | No sustituye el maestro de flota. |
| `TRIP-CAND-xxx` | Declaración heurística de viaje | No es un viaje del sistema. |
| `EVT-xxxx` | Etiqueta heurística de evento | Puede solaparse con otros eventos. |

## Familias de evidencia representativas

| Dominio | Referencias representativas | Tipo de evidencia |
|---|---|---|
| Declaración de viaje, combustible y fondo operativo | `WAM-00009`, `WAM-00054`, `WAM-00371`, `WAM-00544` | Texto explícito; campos libres. |
| Continuación o reanudación de viaje | `WAM-00450`–`WAM-00453`, `WAM-00512`, `WAM-00534` | Texto explícito; ciclo no normalizado. |
| Gastos y saldos asociados | `WAM-00006`, `WAM-00029`, `WAM-00208`, `WAM-00550` y medios vinculados | Texto/captión y fotografía. |
| Adelantos y sueldo | `WAM-00232`–`WAM-00233`, `WAM-00366`, `WAM-00541` | Cálculos libres de texto. |
| Mantenimiento y odómetro | `WAM-00026`, `WAM-00056`, `WAM-00356`, `WAM-00503` | Texto/captión; algunos odómetros. |
| Cobranza, factura y detracción | `WAM-00042`–`WAM-00053`, `WAM-00172`, `WAM-00218`–`WAM-00219` | Texto, PDF y listas libres. |
| Paquetes documentales de unidades | `WAM-00075`–`WAM-00077`, `WA-PDF-006`–`WA-PDF-008` | PDF de documentación. |
| Riesgo de credenciales GPS | `WAM-00510`–`WAM-00511` | Texto sensible; secreto no reproducido. |
| Conversación de marca no operativa | `WAM-00391`–`WAM-00417` | Texto, imágenes y un video. |

## Trazabilidad privada

Los archivos locales `messages.csv`, `media-evidence-index.csv`,
`private-media-id-map.csv`, `pdf-inventory.csv`, `event-candidates.csv` y
`trip-candidates.csv` permiten reproducir las referencias. No se deben mover
fuera de `evidence/` ni incluir en commits.
