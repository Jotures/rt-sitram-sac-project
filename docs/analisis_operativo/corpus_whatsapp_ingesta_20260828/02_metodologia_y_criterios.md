# Metodología y criterios

## Método aplicado

1. Se verificó la existencia, tamaño, hash y seguridad de rutas del ZIP.
2. Se copió y extrajo la evidencia sin modificar su fuente.
3. Se normalizaron 554 mensajes con ID estable, fecha, hora, emisor, tipo,
   líneas de origen y nombre de adjunto cuando existía.
4. Se enlazaron los 210 adjuntos por nombre de archivo a su mensaje de origen y
   se calcularon sus hashes locales.
5. Se extrajo texto local de PDF y se revisaron visualmente sus 43 páginas.
6. Se generaron candidatos de eventos y viajes mediante reglas heurísticas.
7. Se compararon patrones con contratos, esquema y superficies conocidas del
   aplicativo; no sólo con documentos de intención.

## Clasificación epistemológica

| Etiqueta | Uso |
|---|---|
| **HECHO DOCUMENTADO** | El texto o adjunto afirma directamente algo verificable en la evidencia. |
| **PATRÓN OBSERVADO** | Dos o más evidencias muestran una práctica recurrente. |
| **INFERENCIA A VALIDAR** | Explicación razonable que no queda confirmada por el corpus. |
| **CONTRADICCIÓN / CALIDAD** | Datos ambiguos, variantes, faltantes o incompatibles. |
| **RECOMENDACIÓN** | Acción propuesta; no representa una regla aprobada. |

## Reglas de reconstrucción

- Los candidatos `TRIP-CAND` representan mensajes que declaran o continúan un
  viaje; no equivalen a viajes distintos ni se cargan a `trips`.
- Los candidatos de evento pueden solaparse. Un mismo mensaje puede señalar un
  viaje, combustible y fondo operativo.
- Un adjunto se considera **vinculado técnicamente** cuando su nombre coincide
  con el exportado por WhatsApp; ello no valida su contenido ni su relación
  financiera.
- Los alias de personas y unidades se mapean a IDs privados. Variantes de texto
  no se corrigen ni se fusionan sin evidencia adicional.
- Los importes, documentos y credenciales reales permanecen fuera de `docs/`.

## Límites

- Cinco mensajes indican multimedia omitido y 26 mensajes fueron eliminados
  antes de la exportación.
- No se ejecutó OCR sobre imágenes ni comprobantes. Esto cumple DEC-035 y el
  runbook OCR: faltan aún una autorización de custodia específica y una verdad
  de campo revisada.
- La secuencia temporal de mensajes no prueba la secuencia física de los
  eventos. Algunos gastos se declaran después del viaje al que parecen aludir.
