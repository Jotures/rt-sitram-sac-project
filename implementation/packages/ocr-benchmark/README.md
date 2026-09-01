# Benchmark OCR aislado

Este paquete prepara la Etapa 0 de OCR. Evalúa un `manifest` con verdad de
campo contra un conjunto de resultados normalizados ya producido por un
adaptador. No llama a un motor OCR, no abre imágenes, no instala PaddleOCR,
Tesseract.js, OpenCV ni modifica la PWA.

## Límites de datos

- Sólo `fixtures/synthetic/` se versiona. Sus valores son inventados.
- Un corpus autorizado real, su verdad de campo y sus resultados deben vivir
  exclusivamente bajo `implementation/.local/ocr-benchmark/`, que Git ignora.
- No adjuntar comprobantes reales, texto OCR, RUC, nombres, placas, rutas
  firmadas ni valores del benchmark a documentación, issues, commits o logs.
- El informe generado contiene métricas agregadas, condiciones y metadatos
  seguros del candidato; no incluye identificadores de caso ni valores de
  campos del documento.

La operación y la autorización del corpus se describen en
[`docs/runbooks/ocr-corpus-benchmark.md`](../../../docs/runbooks/ocr-corpus-benchmark.md).

## Contrato de entrada

El manifest declara campos canónicos, casos, presencia por campo, verdad
manual en forma `raw` y `normalized`, condiciones, variante de imagen y un
perfil de normalización canónico. El resultado debe declarar exactamente una
ejecución por caso, usar el mismo perfil de normalización y sólo campos ya
declarados. También declara un identificador seguro de runtime/hardware. Las
ejecuciones fallidas llevan un código sanitizado y no campos.

Para un caso `REAL_AUTHORIZED`, el manifest además exige una referencia local
opaca y la huella SHA-256 del activo. Al ejecutar un corpus real se debe pasar
`--asset-root`; el harness verifica la huella antes de calcular métricas. Un
par `ORIGINAL`/`CORRECTED` sólo es válido si ambos casos comparten exactamente
la misma verdad de campo.

Los ejemplos de contrato están en:

- `fixtures/synthetic/fuel-receipts-manifest.v1.json`
- `fixtures/synthetic/synthetic-baseline-results.v1.json`

Las métricas incluyen exactitud bruta y normalizada por campo, campos ausentes,
falsos positivos, documentos completamente utilizables, latencia p50/p95 para
todas las ejecuciones, éxitos y fallos por separado, bandas diagnósticas de
confianza y comparación pareada original/corregida cuando exista el par. Las
bandas de confianza no son umbrales de producto ni autorización automática.

## Uso

Desde `implementation/`, el ejemplo sintético se ejecuta así:

```powershell
pnpm ocr:benchmark -- --manifest packages/ocr-benchmark/fixtures/synthetic/fuel-receipts-manifest.v1.json --results packages/ocr-benchmark/fixtures/synthetic/synthetic-baseline-results.v1.json
```

Cuando exista un corpus autorizado, use rutas locales ignoradas y guarde el
reporte también allí:

```powershell
pnpm ocr:benchmark -- --manifest .local/ocr-benchmark/manifests/rt-fuel-v1.json --results .local/ocr-benchmark/runs/candidate-a-v1.json --asset-root .local/ocr-benchmark --output .local/ocr-benchmark/reports/candidate-a-v1.json
```

El reporte se crea de forma exclusiva y nunca puede reemplazar el manifest ni
los resultados de entrada. Sólo `--overwrite` permite reemplazar un reporte
existente y debe usarse tras autorización explícita.

Un resultado válido no acredita la adopción de un motor. La selección exige el
gate de la Etapa 0 definido en `docs/10_plan_ocr_documentos.md`.
