# Ficha del corpus y custodia

## Alcance autorizado

- **Origen:** exportación ZIP local de un chat empresarial de WhatsApp entregada
  por el propietario el 2026-08-28.
- **Finalidad:** análisis interno, documentación de prácticas AS-IS y
  comparación con el aplicativo actual.
- **Periodo visible:** 2025-02-04 13:59 a 2026-08-28 14:07, hora local
  expresada por la exportación.
- **Fuera de alcance:** carga al backend, publicación de adjuntos, uso de
  credenciales, envío a terceros y extracción OCR integrada al producto.

## Integridad y aislamiento

| Control | Resultado |
|---|---|
| SHA-256 de la fuente | `4fd934ab4dcd43b32cfd7a91b9c4918ef260fe79b1e9e56b8670298f874199c6` |
| Copia local | Coincide exactamente con la fuente por SHA-256 |
| Entradas ZIP | 211 archivos; no se detectaron rutas de extracción inseguras |
| Extracción | 211 archivos, 27,575,000 bytes en un árbol aislado |
| Versionado | Todo el árbol `evidence/` está excluido de Git |

La copia original, la extracción inmutable, los hashes, el texto normalizado y
los mapas privados de IDs permanecen bajo
`evidence/whatsapp-trans-sitram-20260828/`. Ese árbol no es una fuente de
datos del producto ni debe compartirse mediante Git, tickets o servicios
externos.

## Custodia práctica

1. No editar el ZIP, el TXT ni los adjuntos extraídos.
2. Crear nuevos derivados sólo en `02-derived/` de la evidencia local.
3. Referenciar mensajes como `WAM-xxxxx` y medios como `WA-MEDIA-xxx` en los
   documentos sanitizados.
4. Mantener la correspondencia con nombres, identidades y archivos reales sólo
   en los mapas privados locales.
5. Revisar con el propietario la retención y los accesos antes de reutilizar el
   corpus para otra finalidad.

## Límite de autoridad

La exportación demuestra que alguien declaró información en un momento dado;
no certifica por sí misma que un viaje, un gasto, un pago o una corrección se
haya aprobado o ejecutado. Esto preserva el principio de comandos autoritativos
e inmutabilidad financiera de [DEC-020](../../decisions/DEC-016-020.md).
