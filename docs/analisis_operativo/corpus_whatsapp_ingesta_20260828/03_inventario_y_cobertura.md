# Inventario y cobertura

## Transcripción

| Métrica | Resultado |
|---|---:|
| Mensajes normalizados | 554 |
| Marcas temporales no interpretables | 0 |
| Mensajes de texto | 315 |
| Mensajes con adjunto | 210 |
| Mensajes eliminados | 26 |
| Mensajes de sistema | 3 |
| Participantes emisores | 4 |
| Mensajes con multimedia omitido | 5 |
| Adjuntos sin descripción adicional | 68 |

La extracción preserva el orden de la exportación; la mayor actividad mensual
se observa en el intervalo de mediados de 2025 a inicios de 2026. Esta cifra no
equivale a volumen operativo: varios mensajes describen un mismo viaje, gasto
o mantenimiento.

## Adjuntos

| Formato | Cantidad | Tratamiento aplicado |
|---|---:|---|
| JPG | 195 | Hash, enlace al mensaje y clasificación por contexto; sin OCR. |
| PDF | 14 | Hash, extracción de texto local y revisión visual de 43 páginas. |
| MP4 | 1 | Hash, enlace al mensaje y clasificación contextual; sin transcripción. |
| **Total** | **210** | Todos enlazados técnicamente a un mensaje de origen. |

La clasificación contextual de adjuntos identifica 108 candidatos a evidencia
de gasto, 14 de flota/mantenimiento, 14 documentales, 2 financieros y 72 aún
sin clasificar. Estas etiquetas surgen del texto acompañante y no sustituyen
una revisión humana de cada archivo.

## PDF

- 13 de 14 PDF contienen texto incrustado extraíble localmente; uno es visual
  sin texto utilizable.
- La revisión visual mostró grupos de documentos corporativos, constancias
  tributarias/de depósito, expedientes de unidades, comprobantes electrónicos y
  constancias regulatorias de pesos/medidas.
- Los PDFs aportan evidencia de documentación y facturación, pero no se
  convierten automáticamente en datos maestros, comprobantes validados ni
  estados vigentes.

## Candidatos derivados

| Derivado | Cantidad | Advertencia |
|---|---:|---|
| Mensajes que declaran viaje o continuidad | 134 | No son 134 viajes distintos. |
| Candidatos de gasto/saldo | 114 | Pueden solaparse con viaje, sueldo o adjunto. |
| Candidatos de mantenimiento/partes | 66 | Pueden ser compra, reparación o recordatorio. |
| Candidatos de liquidación de sueldo | 43 | No constituyen planilla autoritativa. |
| Candidatos de cobranza/facturación | 22 | No garantizan factura o pago conciliado. |

Los índices privados reproducibles están en `evidence/.../02-derived/`; los
documentos públicos de este corpus sólo resumen sus agregados.
