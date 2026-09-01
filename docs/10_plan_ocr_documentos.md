# Plan de implementación — OCR y Bandeja Documental Inteligente R&T

**Estado:** En pausa — conservado para reanudación; no es referencia operativa obligatoria ni activa una vertical por sí mismo.

**Fecha:** 2026-08-22

**Alcance:** incorporar captura asistida, OCR, extracción estructurada, validación y revisión humana al flujo documental existente, comenzando por comprobantes de combustible y evolucionando después hacia una bandeja transversal.

## Propósito y autoridad

Este plan se conserva como material de reanudación de OCR y ya no reemplaza como referencia activa a ningún otro plan. No elimina ni revierte la integración GPS: su código, decisiones, evidencia y pendientes permanecen vigentes. La ejecución de OCR solo se retoma por instrucción explícita del propietario y con el corpus autorizado que exige su Etapa 0.

El plan concreta las secciones 15–22 y los hitos 21–24 del [Documento Maestro V2](../R&T_SITRAM_Documento_Maestro_Analisis_y_Vision_V2.md), además de las reglas de documentos, operación offline, seguridad, finanzas y auditoría ya aceptadas. Ante conflicto prevalecen las decisiones registradas y los contratos comprobados del producto. No se inferirán reglas tributarias, contables, documentales ni umbrales de confianza a partir de una librería o de un modelo.

Este archivo debe permitir continuar la ejecución sin depender de la memoria de una sesión. Al cerrar o cambiar el estado de una etapa se actualizarán su tabla de seguimiento, la sesión vigente y, cuando cambie un contrato duradero, el índice de decisiones.

## Resultado buscado

R&T podrá transformar una fotografía o PDF en datos revisables sin entregar autoridad financiera al OCR:

- el conductor captura o adjunta un comprobante y puede continuar trabajando aun sin conexión;
- el original queda preservado como evidencia privada y la imagen corregida se conserva como derivado trazable;
- un motor reemplazable obtiene texto, regiones y confianza con su versión identificada;
- un extractor propone proveedor, RUC, fecha, tipo, serie/número, combustible, cantidad, unidad, precio unitario, total e IGV cuando estén presentes;
- las validaciones R&T detectan inconsistencias sin inventar valores faltantes;
- una persona ve el original junto a cada propuesta, corrige o confirma y deja auditoría;
- la confirmación explícita crea o corrige el registro mediante un comando autoritativo e idempotente;
- el mismo pipeline puede ampliarse después a peajes, gastos, facturas, SOAT, ITV/CITV, SCTR, mantenimiento y documentos del conductor.

```text
captura o archivo
  → original privado + huella
  → corrección opcional y reversible
  → cola offline existente
  → trabajo OCR server-side
  → texto/regiones con procedencia
  → extracción por plantilla o regla
  → propuestas por campo
  → validaciones R&T
  → revisión humana
  → comando confirmado
  → combustible/gasto/documento + auditoría
```

## Línea base confirmada

- La PWA React/TypeScript/Vite, Supabase/PostgreSQL, Auth, RLS, Storage privado y PowerSync están desplegados.
- El conductor ya registra combustible, gastos e incidencias offline y puede adjuntar JPEG, PNG, WebP o PDF.
- La evidencia se guarda primero en OPFS, se enlaza a la cola local y se sube solo después de que la mutación estructurada haya drenado; existen reintento, revisión y descarte explícitos para fallas.
- El bucket `private-documents` es privado, limita MIME/tamaño, segmenta rutas por empresa y no concede borrado directo a usuarios autenticados.
- Existen `files`, `documents`, `fuel_entries`, `expenses` y vínculos de evidencia con aislamiento por `company_id`.
- El dominio documental actual ya representa propietarios `COMPANY`, `VEHICLE`, `DRIVER`, `TRIP` y `CLIENT`, además de emisión y vencimiento.
- No existe todavía escáner de perspectiva, contrato `OcrEngine`, corpus evaluado, worker OCR, estado de procesamiento, propuesta por campo ni revisión humana de OCR.
- No se ha aceptado ninguna dependencia OCR, runtime Python/GPU, proveedor externo, política de retención de salidas OCR ni umbral de aceptación.

## Primera salida operativa

La primera salida se limita a **comprobantes de combustible** porque ya existe el flujo de captura, sus campos son verificables y el Documento Maestro lo prioriza. Debe funcionar con fotografía JPEG/PNG/WebP; PDF puede conservarse como evidencia, pero su procesamiento no forma parte del primer gate salvo que el benchmark lo justifique sin ampliar el runtime.

No se construirá en las primeras etapas:

- un motor OCR propio ni entrenamiento desde cero;
- contabilización, pago, rendición, cierre o aprobación automática;
- corrección silenciosa de un registro ya confirmado;
- clasificación universal de todos los documentos desde el primer corte;
- envío de documentos reales a un LLM o SaaS externo sin decisión expresa de privacidad, costo, retención y contrato;
- descarga del modelo, WASM u OpenCV desde CDN en tiempo de ejecución;
- incorporación de OpenCV/OCR al bundle inicial o al service worker sin presupuesto medido;
- obligación de estar en línea para registrar combustible o continuar un viaje;
- almacenamiento de documentos, texto reconocido o datos fiscales en logs;
- despliegue de un worker pesado en Vercel por conveniencia, sin evidencia de compatibilidad y límites.

## Invariantes de documentos y OCR

1. **El OCR propone; una persona confirma.** Ningún campo reconocido modifica por sí solo combustible, gasto, rendición, cobranza, mantenimiento ni un documento maestro.
2. **El original es evidencia.** La imagen original se preserva privada e identificada por huella; recortes y mejoras son derivados, nunca sustitutos silenciosos.
3. **Offline sigue siendo funcional.** Captura manual, persistencia local, cola y recuperación existentes continúan funcionando si el escáner, OCR o red fallan.
4. **Motores reemplazables.** Dominio y UI dependen de `DocumentScanner`, `OcrEngine` y `DocumentExtractor`, no de PaddleOCR, Tesseract, docTR o una plantilla concreta.
5. **Procesamiento sensible server-side.** Credenciales, modelos remotos y accesos privilegiados no aparecen en variables `VITE_*`, bundle, PowerSync, respuestas de cliente ni logs.
6. **Aislamiento empresarial.** Trabajo, original, derivado, OCR, propuesta y revisión llevan `company_id`, RLS/FORCE RLS y permisos mínimos.
7. **Procedencia completa.** Cada ejecución conserva motor, versión del paquete/modelo, configuración permitida, timestamps, huella de entrada y estado; nunca se presenta una propuesta sin origen.
8. **Confianza por campo.** La UI y el contrato conservan confianza y región/evidencia por campo cuando el motor las entregue; no se reduce todo el documento a un porcentaje engañoso.
9. **Idempotencia.** La misma huella, propósito, motor, versión y configuración no crean trabajos ni confirmaciones duplicados.
10. **Validación determinista.** RUC, fechas, serie/número, moneda, cantidad, unidad, precio, subtotal/IGV/total y consistencia aritmética se validan con reglas explícitas; una regla no rellena datos ausentes.
11. **Corrección auditable.** Se conserva lo propuesto, lo confirmado, quién corrigió, cuándo y el motivo requerido cuando la diferencia sea material según una regla aprobada.
12. **Minimización.** No se conservan payloads de modelos, imágenes temporales o texto bruto más allá de la necesidad y retención aprobadas.
13. **Errores sanitizados.** Observabilidad registra códigos, tiempos y conteos, no imágenes, texto, RUC, placas, nombres, cookies, URLs firmadas ni contenido del comprobante.
14. **Fallback explícito.** Baja confianza, documento desconocido, ilegibilidad o falla técnica llevan a revisión/manual; nunca a una suposición silenciosa.
15. **Sin autoridad por proveedor.** Una plantilla conocida o un modelo más preciso no elimina la confirmación humana ni los comandos autoritativos del backend.

## Componentes externos candidatos

La siguiente lista es un punto de partida investigado el 2026-08-22, no una aprobación de dependencias. Cada componente debe fijarse por versión, licencia, hash/origen, SBOM, compatibilidad, tamaño, actividad, seguridad y benchmark antes de entrar al producto.

| Pieza | Candidato | Uso posible | Condición de adopción |
|---|---|---|---|
| Captura/corrección | [puffinsoft/jscanify](https://github.com/puffinsoft/jscanify) | detección de papel, recorte, perspectiva y mejora en navegador | comparar contra captura sin procesar y recorte manual; medir OpenCV.js, memoria, latencia y calidad en Android; carga diferida y assets locales |
| OCR principal | [PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | OCR multilingüe y regiones en un worker server-side | benchmark CPU primero, licencia/modelos verificados, imagen de runtime reproducible y presupuesto de operación aprobado |
| OCR local/comparador | [naptha/tesseract.js](https://github.com/naptha/tesseract.js) | baseline en navegador/Node y eventual asistencia offline | no incluir en shell ni precache hasta medir peso, memoria, descarga, latencia y precisión; no asumir soporte PDF |
| OCR alternativo | [mindee/doctr](https://github.com/mindee/doctr) | segundo motor server-side si PaddleOCR no satisface el corpus R&T | benchmark dirigido; justificar PyTorch y su costo operativo antes de adoptar |
| Extracción por plantilla | [invoice-x/invoice2data](https://github.com/invoice-x/invoice2data) | patrón o librería para emisores frecuentes y reglas YAML/JSON | decidir si se usa directamente dentro de un runtime Python o si solo inspira un contrato propio pequeño; no copiar código sin respetar licencia |

No se clonará una aplicación OCR completa dentro del producto. Se reutilizarán motores o librerías estrechas detrás de los contratos R&T; autenticación, RLS, Storage, offline, auditoría y UX continúan perteneciendo a R&T.

## Contratos objetivo

Los nombres son guía de arquitectura; los tipos definitivos se cerrarán en la Etapa 1 con pruebas de contrato.

### `DocumentScanner`

- Entrada: imagen local, orientación declarada y límites de tamaño.
- Salida: derivado corregido, dimensiones, transformación aplicada, esquinas cuando existan y advertencias.
- Debe permitir omitir la corrección, ajustar esquinas manualmente y volver al original.
- No clasifica documentos ni conoce combustible, gastos o finanzas.

### `OcrEngine`

- Entrada: referencia server-side a una imagen autorizada, idioma/configuración permitidos e identificador idempotente.
- Salida: bloques/líneas/palabras, texto, cajas o polígonos cuando existan, confianza, orientación, versión de motor/modelo y advertencias.
- Los errores se clasifican como entrada inválida, formato no soportado, ilegible, timeout, recurso insuficiente, transitorio o permanente.
- No escribe directamente tablas de negocio ni recibe una clave de usuario final.

### `DocumentExtractor`

- Entrada: resultado OCR normalizado, tipo sugerido y contexto mínimo permitido.
- Salida: tipo propuesto, plantilla/regla aplicada y propuestas por campo con valor bruto, valor normalizado, confianza, evidencia y advertencias.
- Una plantilla conocida debe ser versionada, comprobable con fixtures y seleccionada por señales explícitas; una coincidencia ambigua falla a revisión.
- Un extractor desconocido no invoca LLM/visión mientras esa capacidad no tenga decisión separada.

### `DocumentValidation`

- Entrada: propuestas y contexto de negocio aprobado.
- Salida: errores, advertencias y comprobaciones reproducibles.
- Distingue campo ausente, ilegible, inválido e inconsistente.
- No transforma una advertencia en aprobación ni inventa reglas tributarias.

## Estados de procesamiento

El modelo definitivo debe representar al menos:

```text
CAPTURED_LOCAL
  → UPLOAD_PENDING
  → UPLOADED
  → OCR_QUEUED
  → OCR_PROCESSING
  → REVIEW_REQUIRED
  → CONFIRMED | REJECTED

OCR_QUEUED | OCR_PROCESSING
  → FAILED_RETRYABLE | FAILED_FINAL
  → MANUAL_ONLY
```

- El estado de adjunto existente sigue siendo la verdad sobre la subida; el procesamiento OCR no debe falsificarlo ni duplicarlo.
- `CONFIRMED` identifica una revisión humana y su comando; no significa que el modelo tuvo confianza alta.
- Un reintento conserva el historial de intentos y no borra un resultado anterior.
- `MANUAL_ONLY` permite completar la operación sin OCR y conserva la causa sanitizada.

## Modelo de datos a diseñar migrations-first

La Etapa 3 debe concretar nombres y columnas, pero cubrir estas responsabilidades sin duplicar el archivo empresarial:

- **trabajo de procesamiento:** empresa, archivo, propósito/tipo esperado, estado, lease, intento, timestamps, solicitante y clave idempotente;
- **ejecución OCR:** trabajo, huella de entrada, motor/modelo/configuración versionados, inicio/fin, métricas y resultado sanitizado;
- **propuestas:** ejecución, campo canónico, valor bruto/normalizado, tipo, confianza, evidencia geométrica opcional y advertencias;
- **plantilla/regla:** identificador, tipo documental, emisor cuando aplique, versión, estado, fixtures y vigencia;
- **revisión:** revisor, valores confirmados/corregidos, decisión, timestamps, motivo cuando aplique y referencia al comando empresarial;
- **derivado de imagen:** archivo original, archivo derivado, huella, transformación y relación de procedencia, sin sobrescribir el original;
- **bitácora:** eventos técnicos y empresariales separados, ambos sin contenido sensible innecesario.

Las tablas técnicas de OCR no se replicarán completas con PowerSync. El dispositivo solo recibirá el estado y las propuestas estrictamente necesarias para la revisión autorizada. Originales y derivados permanecen en Storage privado.

## Flujo inicial de combustible

### Con conexión y OCR disponible

1. El conductor toma o elige una foto.
2. Puede aceptar el recorte detectado, ajustar esquinas o conservar el original sin corrección.
3. El original se almacena localmente; el derivado se identifica por separado.
4. La evidencia se sube al bucket privado mediante el flujo autorizado.
5. El backend crea un trabajo OCR idempotente y el worker procesa una sola versión de la imagen.
6. La UI presenta original/derivado y propuestas por campo; no preselecciona una confirmación.
7. El conductor confirma o corrige los campos requeridos.
8. Un comando autoritativo crea el abastecimiento y vincula la evidencia y revisión de manera idempotente.

### Sin conexión, OCR lento o falla

1. El conductor conserva el flujo manual ya validado y la evidencia en OPFS.
2. El registro y el adjunto drenan con las colas existentes al recuperar conexión.
3. El OCR puede ejecutarse después como control/revisión, pero no cambia el registro confirmado.
4. Cualquier diferencia aparece en una bandeja de revisión para un rol aprobado o para el propio conductor mientras el viaje y permisos lo permitan.
5. Una corrección posterior usa un comando explícito y respeta cierres financieros e inmutabilidad; si el registro ya no puede cambiar, se conserva como discrepancia para revisión.

La Etapa 1 debe cerrar con pruebas el contrato exacto entre ambos caminos antes de modificar la pantalla de combustible.

## Seguimiento de ejecución

| Etapa | Estado | Evidencia / pendiente |
|---|---|---|
| 0. Corpus y benchmark gobernado | Preparación completada; gate pendiente | Protocolo, fixture sintético y harness aislado listos. Falta corpus real autorizado, verdad de campo y comparación de candidatos. |
| 1. Contratos y flujo de revisión | Pendiente | Definir contratos, estados, idempotencia, camino online/offline y fake engine sin dependencia real. |
| 2. Captura y corrección | Pendiente | Comparar jscanify, original y recorte manual en Android real; adoptar solo con presupuesto y mejora demostrados. |
| 3. Worker OCR y persistencia segura | Pendiente | Benchmark PaddleOCR/Tesseract.js/docTR, decidir runtime, aplicar migrations/RLS/RPC y observabilidad. |
| 4. Extracción de combustible | Pendiente | Esquema canónico, validaciones, plantillas de emisores frecuentes y fixtures. |
| 5. Vertical combustible end-to-end | Pendiente | Captura → OCR → revisión → comando confirmado, con fallback offline intacto. |
| 6. Bandeja de revisión documental | Pendiente | Priorizar fallas, baja confianza y discrepancias para roles aprobados. |
| 7. Bandeja universal y vencimientos | Pendiente | Reutilizar pipeline para otros tipos solo después del UAT de combustible. |
| 8. Hardening, UAT y operación | Pendiente | Seguridad, privacidad, carga, recuperación, costos, métricas y runbook. |

## Etapa 0 — Corpus y benchmark gobernado

**Objetivo:** elegir componentes con evidencia de documentos R&T, no por popularidad o demos.

- Inventariar tipos reales del primer corte: comprobante electrónico/impreso, boleta térmica y factura de combustible; registrar emisores frecuentes sin convertirlos aún en reglas.
- Reunir un corpus inicial objetivo de 50–100 capturas autorizadas que cubra dispositivos, iluminación, sombra, reflejo, inclinación, pliegues, fondos, resolución, desgaste y comprobantes largos.
- Separar corpus de evaluación retenido y fixtures sintéticos/sanitizados aptos para el repositorio. Ningún comprobante real se versiona.
- Crear verdad manual por campo con doble revisión para RUC, fecha, tipo, serie/número, combustible, cantidad, unidad, precio unitario, total e IGV cuando existan.
- Registrar presencia/ausencia por campo; no penalizar al motor por un dato que el documento no contiene.
- Medir exactitud exacta y normalizada por campo, tasa de documento utilizable, cobertura, falsos positivos, latencia p50/p95, memoria, CPU, tamaño de assets, calentamiento y fallas.
- Evaluar original frente a imagen corregida; la corrección solo se adopta si mejora el resultado o la legibilidad humana de forma reproducible.
- Ejecutar el benchmark sin enviar el corpus a servicios externos y sin conservar texto sensible en logs.
- Proponer umbrales por campo y tolerancias aritméticas a partir de resultados; el propietario aprueba su efecto operativo antes de codificarlos como política.

**Gate:** existe un informe reproducible con corpus gobernado, verdad de campo, hardware/runtime, versiones, resultados y recomendación. No se incorpora ningún motor al producto antes de este gate.

### Preparación implementada — 2026-08-22

Sin comprobantes reales disponibles, se completó la parte reproducible y no
sensible de la etapa:

- el [runbook de corpus y benchmark](runbooks/ocr-corpus-benchmark.md) fija
  autorización, custodia local, doble revisión de verdad de campo,
  normalización, métricas, comparación original/corregida y el gate;
- `implementation/packages/ocr-benchmark/` contiene el contrato validado de
  manifest/resultados, perfil de normalización común, huellas SHA-256
  verificables para activos reales, comparación pareada y métricas agregadas;
  su CLI protege entradas/reportes contra sobreescritura y no contiene motor
  OCR, imágenes ni dependencia de producción;
- los fixtures versionados son exclusivamente sintéticos y cubren campos
  presentes/ausentes, falsos positivos, fallo, condiciones y un par
  original/corregido;
- `implementation/.local/ocr-benchmark/` queda ignorado por Git para el
  corpus real, verdad de campo, resultados y reportes futuros.

**Estado del gate:** pendiente de insumo autorizado. No se seleccionó motor,
runtime, umbral, tolerancia ni proveedor; no se modificó la PWA ni se desplegó
un worker. Cuando el propietario entregue muestras autorizadas, se seguirá el
runbook, se ejecutarán comparaciones reproducibles y se actualizará esta etapa
con la evidencia antes de abrir la Etapa 1.

## Etapa 1 — Contratos y flujo de revisión

**Objetivo:** fijar el comportamiento R&T antes de integrar una librería.

- Implementar contratos TypeScript de dominio independiente del framework y fakes deterministas para escaneo, OCR, extracción y validación.
- Definir estados, errores canónicos, procedencia, confianza por campo, corrección, confirmación e idempotencia.
- Resolver el flujo online asistido y el fallback offline sin romper la cola actual ni requerir OCR para guardar.
- Definir quién puede solicitar, ver, revisar, corregir, rechazar y reintentar por tipo documental y vínculo al viaje.
- Definir cómo se comporta una propuesta posterior sobre un registro ya sincronizado, rendido o cerrado; no inventar mutabilidad financiera.
- Diseñar casos de abuso: empresa A/B, conductor fuera del viaje, archivo ajeno, resultado manipulado, doble confirmación y modelo/versiones falsas.
- Probar contratos con fake engine, incluyendo documento ilegible, campo ausente, ambigüedad, timeout, reintento y resultado tardío.

**Gate:** UI, backend y worker pueden depender de contratos estables y probados; las reglas de autoridad y revisión están documentadas.

## Etapa 2 — Captura y corrección

**Objetivo:** mejorar la imagen sin degradar la PWA ni ocultar el original.

- Crear un spike aislado y cargado bajo demanda para jscanify/OpenCV.js; no incorporarlo al shell inicial.
- Permitir selección desde cámara/archivo, orientación, vista previa, detección de contorno, ajuste manual de esquinas y opción “Usar original”.
- Validar resolución máxima, compresión, color y metadatos; remover metadatos innecesarios solo mediante una transformación documentada y conservar procedencia.
- No ejecutar procesamiento continuo de video si el dispositivo no cumple el presupuesto; priorizar captura única.
- Probar Android físico objetivo, móvil de gama baja y escritorio: memoria, tiempo, temperatura, cierres, permisos y accesibilidad.
- Medir peso de OpenCV.js/WASM y política de caché. Assets propios, versionados, con integridad verificable; nunca CDN dinámico.
- Incorporar fallback sin escáner cuando no haya soporte, falle la detección o la persona lo prefiera.

**Gate:** la corrección mejora el corpus y funciona en dispositivos objetivo dentro de un presupuesto aprobado; si no, se conserva captura original/manual y se descarta la dependencia.

## Etapa 3 — Worker OCR y persistencia segura

**Objetivo:** ejecutar OCR observable e idempotente sin exponer documentos ni privilegiar al cliente.

- Benchmarkear PaddleOCR como candidato principal, Tesseract.js como baseline local/Node y docTR solo si aporta una comparación necesaria.
- Decidir y registrar runtime, lenguaje, CPU/GPU, empaquetado, despliegue y costo. Un nuevo runtime Python o servicio separado requiere decisión arquitectónica aceptada.
- Mantener el worker dentro de `implementation/`, con imagen/lockfiles reproducibles, modelos fijados y verificación de licencia/origen.
- Crear migrations-first para trabajos, ejecuciones, propuestas, revisiones, derivados y auditoría; aplicar restricciones, índices, RLS/FORCE RLS y ACL explícitas.
- Reservar leasing/claim de trabajos y escritura de resultados al backend; clientes autenticados no eligen motor, versión, confianza ni estado técnico.
- Descargar originales mediante acceso server-side acotado; las URLs firmadas no se persisten ni se imprimen.
- Limitar MIME, bytes, píxeles, páginas, duración, intentos y concurrencia; fallar cerrado ante decompression bombs o formato discordante.
- Registrar heartbeat, inicio/fin, intento, latencia, código sanitizado y versión sin contenido documental.
- Evitar duplicados por huella/purpose/configuración y aceptar resultados tardíos sin sobrescribir una revisión más nueva.
- Definir retención y purga verificable de temporales, texto bruto, regiones, derivados y bitácoras antes de producción.

**Gate:** una ejecución autorizada procesa fixtures y una muestra controlada, respeta RLS/ACL, no filtra contenido, es idempotente y se recupera de fallas transitorias.

## Etapa 4 — Extracción de comprobantes de combustible

**Objetivo:** convertir OCR en propuestas explicables y validadas.

- Definir esquema canónico versionado para proveedor, RUC, fecha/hora, tipo, serie/número, combustible, cantidad, unidad, precio unitario, subtotal, IGV, total y moneda.
- Mantener valor bruto y normalizado; normalización de números/fechas/unidades debe ser explícita y probada con configuración peruana.
- Implementar validaciones deterministas de RUC/formato, fechas plausibles, cantidades positivas y consistencia `cantidad × precio ≈ total`, sin fijar tolerancias económicas no aprobadas.
- Crear plantillas solo para emisores suficientemente frecuentes y estables; cada plantilla incluye fixtures positivos, negativos y versión.
- Inspirarse en el patrón de `invoice2data` y decidir formalmente uso directo versus extractor propio acotado después de conocer el runtime.
- Los emisores desconocidos usan reglas generales conservadoras y pasan a revisión; no se agrega LLM como fallback en esta etapa.
- Medir precisión por campo y tasa de corrección humana por emisor/plantilla/modelo.

**Gate:** el extractor produce propuestas reproducibles con evidencia por campo y ninguna incoherencia se confirma automáticamente.

## Etapa 5 — Vertical combustible end-to-end

**Objetivo:** entregar valor al conductor sin degradar el flujo ya aprobado.

- Integrar captura/corrección bajo demanda en la pantalla de combustible, con los controles de accesibilidad y estados operativos aplicables.
- Mostrar progreso real: guardado local, pendiente de subida, procesando, listo para revisar, manual y error; conectividad no equivale a OCR completado.
- Presentar imagen y campos editables con origen/advertencias comprensibles; evitar porcentajes de confianza sin contexto.
- Incluir acciones claras para aceptar propuesta, corregir, continuar manualmente y reintentar procesamiento.
- Confirmar mediante comando backend idempotente que vuelve a validar campos, actor, viaje, unidad, archivo y estado.
- Conservar evidencia y revisión ligadas al abastecimiento; el OCR nunca modifica el odómetro maestro ni suplanta la autoridad GPS de DEC-032.
- No permitir que la espera de OCR bloquee inicio, llegada, entrega, gasto, combustible manual ni sincronización del viaje.
- Cubrir móvil offline, reconexión, reapertura, duplicados, archivos fallidos, resultado tardío y conflictos con cierre/rendición.

**Gate:** el conductor completa casos online asistido y offline manual; la evidencia no se pierde, las propuestas requieren confirmación y no hay duplicados ni cambios financieros silenciosos.

## Etapa 6 — Bandeja de revisión documental

**Objetivo:** resolver excepciones sin obligar a revisar todo manualmente ni ocultar incertidumbre.

- Crear bandeja online para roles aprobados con filtros por estado, viaje, conductor, tipo, fecha, emisor y causa.
- Priorizar ilegible, baja confianza aprobada, inconsistencia aritmética, plantilla ambigua, duplicado probable, falla final y discrepancia con registro.
- Mostrar original/derivado, OCR, propuestas, valores confirmados e historial; no exponer documentos fuera del viaje/empresa autorizados.
- Permitir reintento con versión nueva sin borrar la ejecución anterior, rechazo con motivo y corrección mediante comando empresarial permitido.
- Mantener contadores y SLA operativos configurables sin inventar obligación legal o contable.
- No sincronizar el corpus ni la bandeja completa con PowerSync.

**Gate:** Administración/Gerencia pueden explicar y resolver cada excepción; Contabilidad y Conductor solo ven lo autorizado por reglas explícitas.

## Etapa 7 — Bandeja universal y vencimientos

**Objetivo:** reutilizar el pipeline probado sin generalizar prematuramente.

- Seleccionar el siguiente tipo por volumen, costo manual y calidad del corpus, no por facilidad de demo.
- Incorporar de uno en uno peajes/gastos, facturas, SOAT, ITV/CITV, SCTR, mantenimiento y documentos del conductor.
- Definir esquema, roles, autoridad, retención, revisión y fixtures específicos antes de activar cada tipo.
- Vincular documentos a viaje, combustible, gasto, unidad, conductor, cliente o mantenimiento sin duplicar archivos.
- Generar vencimientos y alertas solo desde datos humanos confirmados o fuentes autoritativas aprobadas.
- Evaluar LLM/visión para documentos desconocidos únicamente mediante decisión separada que cubra proveedor, residencia de datos, entrenamiento, retención, DPA, costo, prompts, esquema, evaluación y fallback.

**Gate:** cada nuevo tipo pasa su propio contrato y UAT; la bandeja sigue siendo un pipeline común y no una colección de implementaciones aisladas.

## Etapa 8 — Hardening, UAT y operación

**Objetivo:** demostrar que el OCR ahorra trabajo sin debilitar evidencia, seguridad ni operación offline.

### Escenarios mínimos

1. Comprobante nítido de emisor conocido con todos los campos.
2. Comprobante térmico tenue, inclinado, con sombra o reflejo.
3. Documento desconocido y documento que no es de combustible.
4. Campo ausente, dos totales posibles, RUC ilegible y unidad ambigua.
5. Captura offline, cierre/reapertura, reconexión y drenaje de ambas colas.
6. Reintento del mismo trabajo, resultado tardío y doble confirmación.
7. Archivo mayor al límite, MIME falso, imagen dañada y decompression bomb simulada.
8. Intento de empresa A/B, conductor sin viaje, rol no aprobado y acceso directo a tablas/Storage.
9. Timeout, proceso caído, memoria insuficiente, modelo ausente y recuperación del lease.
10. Registro ya rendido/cerrado con discrepancia OCR posterior, sin mutación prohibida.
11. Verificación de que bundle, logs, errores, PowerSync y respuestas no contienen documentos ni secretos.
12. Comparación de tiempo y tasa de corrección frente al registro manual.

- Ejecutar dominio, contrato, unitarias, integración, RLS/ACL/pgTAP, typecheck, lint, build, PWA, carga acotada y revisión visual autenticada.
- Probar Android físico objetivo y modo offline real, no solo emulación.
- Crear runbook para despliegue, rollback de modelo, cola atascada, reproceso, purga, incidente de privacidad y desactivación del OCR sin detener la operación.
- Medir costo por documento, latencia p50/p95, fallas, campos aceptados/corregidos, tiempo ahorrado y precisión por campo/modelo/plantilla.
- No habilitar producción con P0/P1, acceso cruzado, originales públicos, dependencia dinámica de CDN, retención indefinida no aprobada o confirmación automática.

**Gate final:** el propietario confirma que el flujo reduce digitación y conserva control humano; soporte puede explicar cada resultado y desactivar OCR sin interrumpir el registro manual/offline.

## Definition of Done

La primera vertical OCR estará lista cuando:

- exista un corpus R&T gobernado y un benchmark reproducible;
- cada dependencia y modelo tenga versión, licencia, origen y costo operativo conocidos;
- captura y corrección funcionen bajo demanda con original preservado y fallback;
- el motor OCR se ejecute server-side de forma idempotente, observable y aislada;
- las propuestas conserven procedencia, confianza y evidencia por campo;
- las validaciones sean deterministas, probadas y no inventen valores;
- una persona confirme o corrija antes del comando empresarial;
- el flujo manual/offline continúe completo cuando OCR no esté disponible;
- Storage, RLS, ACL, retención, auditoría y aislamiento empresarial pasen pruebas;
- Android real, web, recuperación y fallas pasen UAT sin P0/P1;
- exista un runbook de operación, desactivación, reproceso y privacidad;
- métricas de precisión, corrección, tiempo y costo permitan decidir la expansión.

La bandeja universal completa no forma parte de esta Definition of Done; comienza solo después del UAT de combustible y se gobierna tipo por tipo.

## Dependencias y decisiones pendientes del propietario

| Tema | Decisión o insumo requerido |
|---|---|
| Corpus | Autorizar un conjunto inicial de comprobantes reales y quién construirá/verificará la verdad de campo. |
| Roles | Aprobar quién revisa discrepancias posteriores: Conductor, Administración, Gerencia y/o Contabilidad según el estado del viaje. |
| Umbrales | Aprobar el efecto operativo de confianza y tolerancias después del benchmark; no se fijan por intuición. |
| Retención | Definir conservación de texto bruto, regiones, derivados, trabajos y revisiones, además del original empresarial. |
| Runtime | Aprobar el runtime/contenedor y presupuesto tras medir CPU, memoria, latencia y volumen. |
| Privacidad externa | Autorizar expresamente cualquier SaaS/LLM futuro con condiciones de tratamiento; el primer spike será local/self-hosted. |
| Mutabilidad | Confirmar el proceso de corrección cuando un registro ya esté rendido, cerrado o financieramente bloqueado. |
| Alcance posterior | Elegir el siguiente tipo documental solo con métricas del vertical combustible. |

## Próxima tarea única

Preparar la **Etapa 0** sin modificar todavía la PWA productiva: crear el protocolo de corpus y benchmark, el esquema de verdad de campo, fixtures sintéticos iniciales y un harness aislado que compare original/corrección y motores candidatos. No instalar dependencias en la aplicación, no desplegar un worker, no subir documentos reales al repositorio ni a servicios externos y no fijar umbrales hasta disponer de resultados reproducibles.
