# Runbook — Corpus y benchmark OCR de comprobantes

## Propósito

Este runbook ejecuta la Etapa 0 del plan OCR sin exponer comprobantes reales ni
adoptar todavía un motor. Sirve para preparar y evaluar un corpus de combustible
cuando R&T disponga de muestras autorizadas. El uso del resultado es comparar
candidatos; nunca confirmar automáticamente un dato financiero o documental.

## Límites no negociables

- No subir, versionar, adjuntar a tickets ni pegar en logs un comprobante real,
  su imagen, su texto OCR, RUC, nombre, placa, URL firmada o valores extraídos.
- No enviar el corpus a un servicio externo, LLM, SaaS o repositorio público
  durante esta etapa. Una excepción requiere una decisión explícita de
  privacidad, retención, costo y contrato.
- No instalar ni adoptar un motor, OpenCV, runtime Python/GPU o worker como
  consecuencia de una demo sintética.
- No convertir confianza, coincidencia o una sugerencia OCR en aprobación de
  combustible, gasto, rendición o corrección automática.

## Autorización previa

Antes de recibir una muestra, dejar constancia local de:

1. propietario que autoriza el uso interno de los comprobantes y el periodo;
2. tipo documental y propósito del benchmark;
3. custodio del corpus, anotador primario y revisor independiente;
4. entorno local controlado donde se conservarán originales y resultados;
5. fecha de revisión/eliminación del corpus conforme a la política que el
   propietario apruebe.

La autorización no se infiere de que el archivo esté disponible. Si el alcance
o la retención no están claros, no incorporar la muestra.

## Preparar el corpus real

Mantener todo lo real fuera de Git, bajo este árbol local ignorado:

```text
implementation/.local/ocr-benchmark/
  corpus/       # originales y derivados, sólo custodia local
  manifests/    # verdad de campo y metadatos pseudónimos
  runs/         # salida normalizada por candidato
  reports/      # métricas agregadas
```

No usar nombres de archivo con RUC, proveedor, placa, conductor o número de
comprobante. Asignar un identificador opaco, por ejemplo
`RT-FUEL-2026Q3-001`, y guardar cualquier tabla de correspondencia sólo con el
custodio, fuera del repositorio.

El primer corpus objetivo sigue siendo 50–100 capturas autorizadas y debe
incluir boletas térmicas, comprobantes impresos/electrónicos y facturas de
combustible, con variedad de dispositivo, iluminación, sombra, reflejo,
inclinación, pliegues, fondos, resolución, desgaste y comprobantes largos. La
muestra de evaluación se congela antes de comparar candidatos; las nuevas
muestras se versionan como un nuevo manifest local, no se mezclan en silencio.

## Verdad de campo

Crear un manifest local a partir del ejemplo sintético de
`implementation/packages/ocr-benchmark/fixtures/synthetic/`. Declarar:

- `dataset.classification: "CONTROLLED_REAL"` y
  `containsRealDocuments: true`;
- un `normalizationProfile` canónico de `id` y versión; cada candidato debe
  declarar exactamente el mismo perfil, no una variante propia;
- campos presentes y ausentes por comprobante, sin inventar un valor para un
  campo no visible;
- `raw` como lectura humana exacta y `normalized` mediante una regla documentada;
- condiciones observables e `imageVariant` (`ORIGINAL`, `CORRECTED` o
  `NOT_APPLICABLE`);
- un `comparisonGroupId` común para un original y su derivado corregido.

Cada caso real lleva además `input.localReference`, una ruta opaca relativa al
asset root (por ejemplo `corpus/RT-FUEL-2026Q3-001.jpg`), y su `input.sha256`.
La referencia no contiene RUC, proveedor, placa, conductor ni número de
comprobante. Antes de anotarla, calcular la huella localmente:

```powershell
(Get-FileHash .local/ocr-benchmark/corpus/RT-FUEL-2026Q3-001.jpg -Algorithm SHA256).Hash.ToLowerInvariant()
```

Un caso `CORRECTED` exige exactamente un `ORIGINAL` en el mismo grupo y ambos
deben llevar idéntica verdad de campo. El harness lo rechaza si se mezclan
fuentes, se repiten variantes o se pretende comparar documentos distintos.

La persona anotadora registra cada campo. Un segundo revisor confirma al menos
RUC, fecha, tipo, serie/número, combustible, cantidad, unidad, precio unitario,
total e IGV cuando estén presentes. Las discrepancias quedan como caso abierto
hasta resolución manual; no se cambia la verdad de campo para que un motor
parezca correcto.

La normalización debe ser explícita y repetible. Por ejemplo, puede retirar el
guion de una serie/número o convertir una fecha visible a ISO, pero no completar
dígitos ilegibles, inferir impuestos ni redondear importes sin una regla aprobada.

## Ejecutar una comparación

Un adaptador temporal de cada candidato puede leer el corpus local y producir
un archivo de resultados local. Debe conservar `engine`, versión del motor,
el perfil de normalización común, duración y confianza cuando exista. Debe
declarar identificadores opacos de runtime, versión y hardware; no usar
hostname, usuario, ruta ni otro dato sensible. Debe declarar una ejecución
`FAILED` sin campos para un documento ilegible, timeout o falla.

Desde `implementation/`:

```powershell
pnpm ocr:benchmark -- --manifest .local/ocr-benchmark/manifests/rt-fuel-v1.json --results .local/ocr-benchmark/runs/<candidate>.json --asset-root .local/ocr-benchmark --output .local/ocr-benchmark/reports/<candidate>.json
```

El harness valida que cada caso tenga una sola ejecución, que los campos sean
canónicos y que los fallos no tengan valores. Para corpus real verifica antes
la huella de cada activo bajo `--asset-root`. El reporte sólo incluye
agregados: exactitud bruta/normalizada, cobertura, ausencias, falsos positivos,
documentos completos, latencia de todas las ejecuciones/éxitos/fallos, bandas
diagnósticas de confianza, condiciones y delta pareado
original/corregido. Las bandas no son umbrales de aceptación; el propietario
aprueba cualquier política posterior. El informe no debe publicarse si sus
metadatos permiten reidentificar comprobantes.

Un `--output` nuevo se crea de forma exclusiva. El comando rechaza que el
reporte reemplace manifest/resultados de entrada o un reporte existente. Usar
`--overwrite` sólo con autorización explícita para reemplazar un reporte ya
existente.

Además del harness, registrar por candidato y hardware: versión fijada,
licencia/origen, hash o imagen de runtime, tamaño de assets, CPU, memoria,
latencia, calentamiento, fallas y cualquier transferencia de red. El harness
no mide por sí solo memoria, CPU ni transferencia.

## Gate de decisión

La Etapa 0 sólo está lista para abrir la Etapa 1 cuando exista un informe
reproducible para el corpus congelado con: autorización/custodia, versión de
verdad de campo y perfil de normalización, huellas verificadas de los activos,
hardware/runtime, candidatos/versiones, métricas por campo y condición,
comparación original/corregida, fallas y recomendación. El
propietario aprueba por separado los umbrales o tolerancias antes de que se
codifiquen como política de producto.

Después del gate, el siguiente trabajo es la Etapa 1 del plan: contratos y
fakes de dominio. No se salta directamente a integrar un motor en la PWA.
