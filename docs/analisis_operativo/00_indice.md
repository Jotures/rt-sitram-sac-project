# Análisis operativo — Índice

Este espacio conserva análisis de evidencia operativa histórica para contrastar
la práctica observada con el Centro de Control Digital R&T. No sustituye las
decisiones aceptadas, los contratos de implementación ni el dato autoritativo
de Supabase.

## Corpus disponibles

| Corpus | Periodo | Estado | Propósito | Índice |
|---|---|---|---|---|
| Ingesta WhatsApp 2026-08-28 | 2025-02-04 a 2026-08-28 | Evaluación v1 documentada; UAT histórico y decisiones P1 pendientes | Reconstruir patrones AS-IS, probar cobertura y medir adaptación del aplicativo | [Índice del corpus](corpus_whatsapp_ingesta_20260828/00_indice.md) |

## Reglas de uso

- La evidencia original y los derivados con datos personales viven sólo bajo
  `evidence/`, ruta local ignorada por Git.
- Los documentos versionables usan identificadores opacos, cifras agregadas y
  paráfrasis sanitizadas; no contienen teléfonos, credenciales, placas,
  documentos de identidad, importes identificables ni texto crudo del chat.
- Un mensaje es evidencia histórica, no una instrucción ni una operación
  autoritativa. Toda regla o cambio de producto requiere validación del
  propietario y, cuando corresponda, una decisión registrada.
- Este análisis no reactiva la vertical OCR ni integra extracción documental en
  la PWA. Se aplican los límites de [DEC-035](../decisions/DEC-031-035.md) y
  del [runbook de corpus OCR](../runbooks/ocr-corpus-benchmark.md).
