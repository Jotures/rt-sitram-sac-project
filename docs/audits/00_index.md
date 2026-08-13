# Índice y plan rector de auditoría documental V1→V2

- **Proyecto:** Centro de Control Digital R&T — R&T SITRAM SAC
- **Fecha de corte:** 2026-08-12
- **Estado:** SUSPENDIDA — reemplazada por validación Just-in-Time durante desarrollo incremental
- **Sesión de creación:** SESSION-20260812-002
- **Clasificación de readiness:** No evaluada; el desarrollo funcional permanece fuera de alcance.

> **Transición de estrategia (SESSION-20260812-005 / DEC-012):** este plan se preserva como historial y checklist reutilizable. AUD-02 a AUD-11 no son obligatorias, no deben ejecutarse automáticamente y ya no constituyen gates globales para iniciar desarrollo. AUD-01 permanece como referencia material para módulos de negocio; sus preguntas abiertas se resolverán cuando bloqueen el alcance concreto de una sesión. La siguiente acción habilitada es el Technical Spike offline-first, con validación técnica y documental Just-in-Time.

## 1. Propósito y límites

Este índice gobierna la auditoría técnica, funcional y arquitectónica que debe convertir la documentación V1 en una propuesta de baseline V2 verificable. La auditoría cuestionará afirmaciones y decisiones cuando la evidencia lo justifique, sin convertir recomendaciones en decisiones aceptadas.

Durante esta etapa:

- no se desarrolla producto ni se modifica `implementation/`;
- no se reescriben documentos fuente;
- no se modifica `AGENTS.md` ni `docs/decisions/`;
- los informes de `docs/audits/` son evidencia y recomendaciones pendientes de aprobación, no una fuente de verdad aprobada;
- toda capacidad tecnológica variable se contrasta con fuentes primarias vigentes y fecha de consulta;
- toda corrección de baseline requiere aprobación explícita del propietario.

## 2. Estado encontrado

- La raíz contiene gobierno (`AGENTS.md`, `README.md`, decisiones y sesiones), documentación y un límite vacío de implementación.
- `implementation/` solo contiene diez archivos `.gitkeep`; no existe funcionalidad del producto.
- `docs/00_MANIFIESTO.md` registra nueve artefactos V1 y sus hashes SHA-256; los nueve coinciden con el estado de corte.
- Existe una propuesta comercial adicional que no forma parte del manifiesto de nueve artefactos.
- Existen DEC-001 a DEC-010, todas en estado `Accepted`; ningún estado cambia por abrir esta auditoría.
- El proyecto no tiene un repositorio Git propio: su raíz Git efectiva es `C:/Users/Ruben J`. Esto limita la revisión aislada de diffs y debe resolverse mediante una decisión futura, no dentro de esta preparación.

## 3. Baseline documental y autoridad

| Ruta | Rol en la auditoría | Manifestada | Responsable primario | Estado de autoridad durante la auditoría |
|---|---|---:|---|---|
| `docs/00_MANIFIESTO.md` | Integridad y procedencia de los nueve artefactos | No aplica | Gobernador | Control de baseline |
| `docs/01_informe_contextual_negocio.md` | Contexto observado, estimaciones y campos pendientes | Sí | Negocio/dominio | Fuente V1; cada afirmación debe conservar su nivel de evidencia |
| `docs/02_diagnostico_operativo_completo.md` | Diagnóstico y recomendaciones operativas | Sí | Negocio/dominio | Fuente V1 bajo auditoría |
| `docs/03_modelo_operativo_objetivo_to_be.md` | Modelo operativo propuesto | Sí | Negocio/dominio | Fuente V1 bajo auditoría |
| `docs/04_blueprint_funcional_sistema_digital.md` | Alcance, módulos, permisos y flujos | Sí | Negocio + UX | Fuente V1 bajo auditoría |
| `docs/05_arquitectura_informacion_modelo_datos.md` | Entidades, relaciones, invariantes y sincronización conceptual | Sí | Datos | Fuente V1 bajo auditoría |
| `docs/06_especificacion_ux_ui.md` | Workflows y estados de interfaz | Sí | UX/UI | Fuente V1 bajo auditoría |
| `docs/07_arquitectura_tecnica_sistema.md` | Stack, límites y estrategia técnica | Sí | Arquitectura técnica | Fuente V1 bajo auditoría; capacidades variables requieren revalidación externa |
| `docs/08_plan_maestro_implementacion.md` | Orden, pruebas, gates y releases | Sí | Planificación | Fuente V1 bajo auditoría; no ejecutar literalmente |
| `docs/09_sintesis_comprension_negocio.md` | Síntesis interpretativa del negocio | Sí | Negocio/dominio | Contexto de contraste; no sustituye evidencia primaria |
| `docs/Propuesta de Digitalización y Desarrollo del Sistema de Gestión.md` | Síntesis comercial y propuesta | No | Gobernador + negocio | Contexto comercial; autoridad pendiente de confirmar con el propietario |
| `AGENTS.md` | Constitución del agente | No aplica | Gobernador | Vigente; auditable por instrucción actual, no modificable sin aprobación |
| `docs/decisions/` | Decisiones aceptadas | No aplica | Gobernador | Vigentes; pueden ser cuestionadas, no cambiadas por un hallazgo |
| `docs/sessions/` | Memoria operativa | No aplica | Gobernador | Registro de ejecución, no evidencia arquitectónica |

Los hashes de los nueve artefactos se toman de `docs/00_MANIFIESTO.md`. Hashes adicionales de corte:

| Archivo | SHA-256 |
|---|---|
| `docs/00_MANIFIESTO.md` | `e024a34f3a98d699bbe8530e3377bdaf6406cbd78a0f3994674723bda8eed840` |
| `docs/Propuesta de Digitalización y Desarrollo del Sistema de Gestión.md` | `e89259693e92817df6787d8a2ac7539867e1bf1cede3e6bfd93dc0108fd06f3c` |

## 4. Reglas epistemológicas y de hallazgos

Cada afirmación relevante debe clasificarse exactamente como una de estas categorías:

1. `HECHO DOCUMENTADO`: evidencia trazable a una fuente identificada; puede seguir requiriendo confirmación del propietario.
2. `DECISIÓN ARQUITECTÓNICA`: elección vigente o propuesta, con referencia a su DEC cuando exista.
3. `SUPUESTO`: afirmación utilizada sin evidencia suficiente.
4. `HIPÓTESIS A VALIDAR`: capacidad o comportamiento que requiere prueba o evidencia externa.
5. `RECOMENDACIÓN`: cambio sugerido, todavía no aprobado.
6. `ERROR / CONTRADICCIÓN`: incompatibilidad demostrable entre fuentes, reglas o capacidades.
7. `DECISIÓN PENDIENTE`: elección material que necesita al propietario.

Severidad:

| Severidad | Criterio |
|---|---|
| `CRITICAL` | Bloquea cualquier avance seguro o implica riesgo inmediato de pérdida/corrupción de datos, exposición grave, incorrección financiera o inviabilidad fundamental. |
| `HIGH` | Bloquea una parte o gate, o puede producir rediseño costoso, incumplimiento material o fallo operativo relevante. |
| `MEDIUM` | Debe corregirse antes de la fase afectada, pero existe una ruta de contención razonable. |
| `LOW` | Deficiencia localizada con impacto limitado y corrección reversible. |
| `INFO` | Observación, aclaración o oportunidad sin defecto demostrado. |

Convención de IDs: `AUD-NN-COD-NNN`, donde `NN` es el informe, `COD` es `ND`, `DAT`, `UX`, `ARC`, `OFF`, `SEC`, `OCR`, `GPS`, `OSS`, `PLN` o `X`, y el último bloque es monotónico dentro del informe.

Estados de informe: `Pendiente → Evidencia mapeada → Borrador → Revisión cruzada → Finalizada`. `Bloqueada` es una excepción documentada. No se usa `Accepted`, para no confundir informes con decisiones.

Cada hallazgo deberá contener:

- alcance;
- ID, severidad, estado y clasificación epistemológica;
- hallazgo;
- evidencia y fuente precisa;
- impacto;
- recomendación;
- documento afectado;
- cambio propuesto;
- `Requiere decisión: Sí/No`;
- DEC relacionada, si existe;
- dependencia y gate bloqueado;
- responsable y revisor.

## 5. Gobierno de decisiones durante la auditoría

1. DEC-001–DEC-010 permanecen `Accepted`.
2. Un hallazgo puede recomendar `Mantener`, `Aclarar`, `Modificar` o `Sustituir`, pero no cambia el estado de la DEC.
3. Si cuestiona una DEC, debe marcar `Requiere decisión: Sí` y referenciarla.
4. Solo el propietario aprueba cambios. Una sustitución futura conservará el historial y seguirá la rotación de decisiones vigente.
5. Solo después de esa aprobación se actualizan fuentes, decisiones, `AGENTS.md` o Plan Maestro.

| DEC | Auditorías responsables | Disposición | Decisión del propietario |
|---|---|---|---|
| DEC-001 | 03, 04, 05 | No evaluada | Pendiente |
| DEC-002 | 03, 04, 05 | No evaluada | Pendiente |
| DEC-003 | 04, 05, 09 | No evaluada | Pendiente |
| DEC-004 | 02, 04, 06 | No evaluada | Pendiente |
| DEC-005 | 02, 05 | No evaluada | Pendiente |
| DEC-006 | 01, 02, 06, 10 | No evaluada | Pendiente |
| DEC-007 | 04, 09, 10 | No evaluada | Pendiente |
| DEC-008 | 04, 05, 06, 07 | No evaluada | Pendiente |
| DEC-009 | 01, 02, 03, 05 | No evaluada | Pendiente |
| DEC-010 | 10, 11 y gobernador | No evaluada | Pendiente |

## 6. Especialistas y revisión obligatoria

| Código | Especialidad | Responsabilidad |
|---|---|---|
| A | Negocio, logística y dominio | Operación real, reglas, viajes, flota, conductores, dinero, mantenimiento y cobranza. |
| B | Arquitectura de datos/PostgreSQL | Entidades, cardinalidades, invariantes, temporalidad, historial, integridad y derivados. |
| C | UX/UI mobile y desktop | Workflows, estados, accesibilidad, prevención de errores y consistencia con dominio/permisos. |
| D | Arquitectura PWA/backend | Stack, límites, modularidad, viabilidad y alternativas justificadas. |
| E | Offline-first y sistemas distribuidos | Persistencia, sync, conflictos, idempotencia, archivos, reintentos y reconciliación. |
| F | AppSec, Auth y RLS | Activos, amenazas, roles, RLS, Storage, secretos, auditoría y exposición local. |
| G | OCR/document intelligence | Captura, preprocesamiento, OCR, extracción, confidence, revisión humana y benchmark. |
| H | Telemática/GPS | Goldcar/Wialon, APIs, datos, adapter, frecuencia, histórico y spike de acceso. |
| I | Open source, licencias y supply chain | Repositorios, licencias, mantenimiento, seguridad y clasificación de adopción. |
| J | Planificación, QA y entrega | Dependencias, sesiones verificables, pruebas, gates y releases. |
| K | Integración y gobierno | Auditoría cruzada, canonización de hallazgos, matriz maestra y readiness. |

Ningún informe puede finalizarse únicamente por su autor.

## 7. Registro de auditorías

| Nº | Archivo previsto | Responsable | Revisores obligatorios | Entradas principales | Dependencias | Estado |
|---:|---|---|---|---|---|---|
| 00 | `docs/audits/00_index.md` | K | A–J | Gobierno, manifiesto y corpus | Ninguna | Finalizada |
| 01 | `docs/audits/01_negocio_dominio.md` | A | B, C, J | 01, 02, 03, 04, 09 y propuesta | G0 | Pendiente |
| 02 | `docs/audits/02_modelo_datos.md` | B | A, E, F | 03, 04, 05, 07 | 01 | Pendiente |
| 03 | `docs/audits/03_ux_ui.md` | C | A, B, E, F | 04, 05, 06, 07 | 01, 02 | Pendiente |
| 04 | `docs/audits/04_arquitectura_tecnica.md` | D | B, E, F, I | 05, 07, 08 y DEC técnicas | 01, 02 | Pendiente |
| 05 | `docs/audits/05_offline_sync.md` | E | B, C, D, F | 05 §§103–108; 06 §§75–78; 07; 08 Fase 1 | 02, 04 | Pendiente |
| 06 | `docs/audits/06_seguridad.md` | F | B, C, D, E | Permisos de 04; seguridad de 05–08 | 02, 04, 05 | Pendiente |
| 07 | `docs/audits/07_ocr.md` | G | B, C, D, E, F | Nuevo requisito; gastos/combustible/archivos; 06 §138 | 01–06 | Pendiente |
| 08 | `docs/audits/08_gps_goldcar.md` | H | A, B, D, E, F | Nuevo requisito; 01/09 GPS; 07 §§102–105 | 01, 02, 04–06 | Pendiente |
| 09 | `docs/audits/09_open_source_research.md` | I | D, F, G, H | Requisitos y gaps de 04, 05, 07 y 08 | 04, 05, 07, 08 | Pendiente |
| 10 | `docs/audits/10_plan_implementacion.md` | J | A–I | `docs/08_plan_maestro_implementacion.md` y auditorías 01–09 | 01–09 | Pendiente |
| 11 | `docs/audits/11_auditoria_cruzada.md` | K | A–J | Corpus, auditorías 01–10 y DEC | 01–10 | Pendiente |

La matriz maestra y la clasificación final vivirán en `11_auditoria_cruzada.md`; este índice solo mantendrá su estado y enlace para evitar copias divergentes.

## 8. Dependencias y orden

```text
G0 Baseline y gobierno
  ↓
01 Negocio/dominio
  ↓
02 Modelo de datos
  ↓
03 UX/UI ───────────────┐
04 Arquitectura técnica ┘
  ↓
05 Offline/sync
  ↓
06 Seguridad
  ↓
07 OCR ────────────────┐
08 GPS Goldcar ────────┤
  └────────────────────┘
  ↓
09 Open source
  ↓
10 Plan de implementación
  ↓
11 Auditoría cruzada + matriz + readiness
```

UX y arquitectura pueden preparar evidencia en paralelo después de G1, pero no cerrarse ignorando las reglas de negocio y datos. OCR y GPS pueden ejecutarse en paralelo después de G2. La evaluación open source comienza cuando existen requisitos y gaps estables.

## 9. Gates

| Gate | Condiciones de salida |
|---|---|
| G0 — Baseline | Corpus inventariado y congelado por hash; autoridad de cada entrada clasificada; taxonomía, responsables, revisores y dependencias publicados; fuentes, DEC y aplicación sin cambios. |
| G1 — Dominio y datos | Auditorías 01–02 finalizadas y revisadas; hechos, supuestos, reglas e invariantes trazados; contradicciones y decisiones pendientes identificadas. |
| G2 — Experiencia y plataforma | Auditorías 03–06 finalizadas; stack contrastado con fuentes primarias; modelo de amenazas y estados UX alineados; Technical Spike definido con pruebas reproducibles. |
| G3 — Capacidades externas | Auditorías 07–09 finalizadas; OCR y GPS separan capacidad posible/confirmada; fuentes fechadas; licencias verificadas; ningún código ni credencial incorporados. |
| G4 — Plan ejecutable | Auditoría 10 finalizada; cada sesión propuesta tiene objetivo, contexto, trabajo, rutas, dependencias, pruebas, aceptación, gate, entregable y siguiente sesión. |
| G5 — Readiness | Auditoría 11 finalizada; matriz completa, duplicados canonizados, conflictos elevados, decisiones propuestas separadas y clasificación con alcance habilitado. |

## 10. Plan de ejecución por fases, partes y sesiones

Los identificadores `SESIÓN N.M.K` son unidades planificadas de auditoría. Cuando se ejecuten, se asociarán a un log real `SESSION-YYYYMMDD-NNN`; este índice no crea por adelantado esos logs.

### FASE 0 — Preparación

| Sesión | Objetivo y contexto | Trabajo | Archivo/entregable | Prueba y aceptación | Gate / siguiente |
|---|---|---|---|---|---|
| 0.1.1 | Inventariar corpus, gobierno e implementación. | Verificar rutas, hashes, procedencia y Git efectivo. | `00_index.md`, baseline. | Nueve hashes coinciden; no hay código funcional. | 0.1.2 |
| 0.1.2 | Uniformar el método. | Definir categorías, severidades, IDs, estados y formato de hallazgo. | Protocolo en `00_index.md`. | Todas las categorías exigidas y campos obligatorios están presentes. | 0.1.3 |
| 0.1.3 | Asignar responsabilidades y secuencia. | Definir propietarios, revisores, dependencias, gates y sesiones. | Plan rector validado. | Cada informe tiene entradas, responsable, revisión y gate; fuentes/DEC intactas. | G0 → 1.1.1 |

### FASE 1 — Fundamento de dominio y datos

#### PARTE 1.1 — Auditoría 01: negocio y dominio

| Sesión | Objetivo y contexto | Trabajo | Archivo/entregable | Prueba y aceptación | Gate / siguiente |
|---|---|---|---|---|---|
| 1.1.1 | Separar evidencia de interpretación en 01, 02, 03, 04, 09 y propuesta. | Crear mapa fuente→hecho/supuesto/pregunta y catálogo de términos. | Borrador de `01_negocio_dominio.md`. | Cada afirmación material cita fuente; estimaciones y campos pendientes no aparecen como hechos confirmados. | 1.1.2 |
| 1.1.2 | Auditar ciclo, reglas y excepciones. | Revisar viaje, unidad, conductor, gasto, combustible, rendición, mantenimiento, factura, pago y cobranza. | Hallazgos A con IDs estables. | Cada regla indica actor, precondición, transición, excepción, autoridad y evidencia. | 1.1.3 |
| 1.1.3 | Contrastar dominio con datos, UX y alcance. | Revisión B/C/J, resolver duplicados y elevar preguntas al propietario. | `01_negocio_dominio.md` finalizado. | Revisión independiente completa; decisiones pendientes separadas de recomendaciones. | 1.2.1 |

#### PARTE 1.2 — Auditoría 02: modelo de datos

| Sesión | Objetivo y contexto | Trabajo | Archivo/entregable | Prueba y aceptación | Gate / siguiente |
|---|---|---|---|---|---|
| 1.2.1 | Trazar reglas de 01 a entidades de 03–05. | Construir matriz regla→entidad→campo→relación→fuente. | Borrador de `02_modelo_datos.md`. | Toda entidad MVP tiene propósito y fuente; entidades sin respaldo quedan marcadas. | 1.2.2 |
| 1.2.2 | Auditar integridad y temporalidad. | Revisar cardinalidades, estados, claves, dinero, unidades, historial, auditoría, derivados, borrado, local/central y migración. | Hallazgos B con IDs estables. | Cada invariante asigna enforcement; no se confunden fuente, snapshot y dato derivado. | 1.2.3 |
| 1.2.3 | Contrastar con dominio, offline y seguridad. | Revisión A/E/F y matriz de migraciones costosas. | `02_modelo_datos.md` finalizado. | Inconsistencias y decisiones pendientes trazadas; no se propone SQL todavía. | G1 → 2.1.1 y 2.2.1 |

### FASE 2 — Experiencia, arquitectura, offline y seguridad

#### PARTE 2.1 — Auditoría 03: UX/UI

| Sesión | Objetivo y contexto | Trabajo | Archivo/entregable | Prueba y aceptación | Gate / siguiente |
|---|---|---|---|---|---|
| 2.1.1 | Inventariar workflows de 04 y 06 contra 01–02. | Mapear pantalla→actor→acción→dato→permiso→estado. | Borrador de `03_ux_ui.md`. | Toda acción primaria tiene regla, dato y resultado; faltantes quedan identificados. | 2.1.2 |
| 2.1.2 | Auditar mobile/desktop y fallos. | Revisar offline, sync, cámara, errores, vacíos, accesibilidad, prevención, conflicto y reautenticación. | Hallazgos C con IDs estables. | Flujos críticos incluyen éxito, pendiente, rechazo, reintento y recuperación. | 2.1.3 |
| 2.1.3 | Contrastar con dominio, datos, offline y permisos. | Revisión A/B/E/F y priorización por flujo. | `03_ux_ui.md` finalizado. | Ninguna acción UX contradice deliberadamente reglas o seguridad sin decisión pendiente. | 2.3.1 |

#### PARTE 2.2 — Auditoría 04: arquitectura técnica

| Sesión | Objetivo y contexto | Trabajo | Archivo/entregable | Prueba y aceptación | Gate / siguiente |
|---|---|---|---|---|---|
| 2.2.1 | Inventariar afirmaciones del stack en 07–08 y DEC-001–007. | Crear matriz afirmación→versión/entorno→evidencia requerida. | Borrador de `04_arquitectura_tecnica.md`. | Propuesta, decisión y capacidad demostrada están separadas. | 2.2.2 |
| 2.2.2 | Verificar stack y alternativas solo cuando exista motivo técnico. | Consultar documentación oficial de React, TypeScript, Vite, PWA, PowerSync, Supabase y PostgreSQL; comparar compatibilidad, límites, costos y lock-in. | Evidencia externa fechada y hallazgos D. | Toda afirmación variable cita fuente primaria; no se cambia tecnología por novedad. | 2.2.3 |
| 2.2.3 | Auditar límites y DEC técnicas. | Revisar frontend/backend, domain, SQL, RPC/Functions, repositorio, pruebas y monolito modular con B/E/F/I. | `04_arquitectura_tecnica.md` finalizado. | Cada recomendación de stack indica impacto, alternativa y decisión requerida. | 2.3.1 |

#### PARTE 2.3 — Auditoría 05: offline y sincronización

| Sesión | Objetivo y contexto | Trabajo | Archivo/entregable | Prueba y aceptación | Gate / siguiente |
|---|---|---|---|---|---|
| 2.3.1 | Definir modelo local/central y autoridad. | Trazar datasets, streams, UUID, cola, dependencias de operaciones, estados y ciclo de vida PWA. | Borrador de `05_offline_sync.md`. | Cada operación crítica declara fuente local, autoridad final, disponibilidad y retención. | 2.3.2 |
| 2.3.2 | Auditar fallos y especificar el Technical Spike. | Cubrir conflictos, idempotencia, deletes/tombstones, reintentos, rechazo, migraciones, varias pestañas/dispositivos, cuotas, archivos y reconciliación. | Matriz de fallos + pruebas del spike. | El escenario obligatorio de 12 pasos y sus variantes tienen resultados observables y criterios binarios. | 2.3.3 |
| 2.3.3 | Revisar con datos, UX, arquitectura y seguridad. | Revisión B/C/D/F y consolidación de incertidumbres empíricas. | `05_offline_sync.md` finalizado. | Ninguna garantía offline se declara confirmada sin prueba o fuente primaria. | 2.4.1 |

#### PARTE 2.4 — Auditoría 06: seguridad

| Sesión | Objetivo y contexto | Trabajo | Archivo/entregable | Prueba y aceptación | Gate / siguiente |
|---|---|---|---|---|---|
| 2.4.1 | Modelar activos, actores y fronteras. | Identificar amenazas en navegador, SQLite, PowerSync, Supabase, Storage, Functions, OCR y GPS. | Borrador de `06_seguridad.md`. | Cada activo sensible tiene actor, frontera, amenaza y control esperado. | 2.4.2 |
| 2.4.2 | Auditar Auth, RLS, Storage y operaciones sensibles. | Crear matriz tabla/recurso×rol×operación×estado; revisar RPC, secretos, sesión offline, dispositivo perdido y auditoría. | Hallazgos F + matriz de pruebas. | Denegación por defecto y casos negativos cubren DB, Storage, sync y server-side. | 2.4.3 |
| 2.4.3 | Contrastar privacidad, retención y trazabilidad. | Revisión B/C/D/E; elevar materias legales a validación especializada. | `06_seguridad.md` finalizado. | No se presentan inferencias legales como hechos; credenciales externas permanecen server-side. | G2 → 3.1.1 y 3.2.1 |

### FASE 3 — OCR, GPS y open source

#### PARTE 3.1 — Auditoría 07: OCR

| Sesión | Objetivo y contexto | Trabajo | Archivo/entregable | Prueba y aceptación | Gate / siguiente |
|---|---|---|---|---|---|
| 3.1.1 | Definir requisitos sin elegir implementación. | Trazar foto→Storage→OCR→extracción→validación→prellenado→confirmación→registro y campos objetivo. | Borrador de `07_ocr.md`. | Ningún campo OCR se acepta automáticamente; estados, provenance y revisión humana están modelados. | 3.1.2 |
| 3.1.2 | Evaluar alternativas y benchmark. | Comparar local/browser/Tesseract/servicios/multimodal/híbrida en precisión, privacidad, costo, latencia, offline y mantenimiento. | Matriz de opciones + spike de benchmark. | Fuentes oficiales y corpus autorizado; métricas por campo, confidence, tasa de corrección y costo definidas. | 3.1.3 |
| 3.1.3 | Determinar encaje y revisar transversalmente. | Revisar con B/C/D/E/F; recomendar fase y decisiones pendientes. | `07_ocr.md` finalizado. | Recomendación reversible, trazable y sin convertir OCR en fuente de verdad. | 3.3.1 cuando 08 finalice |

#### PARTE 3.2 — Auditoría 08: GPS Goldcar

| Sesión | Objetivo y contexto | Trabajo | Archivo/entregable | Prueba y aceptación | Gate / siguiente |
|---|---|---|---|---|---|
| 3.2.1 | Identificar plataforma y acceso real. | Obtener evidencia oficial/contractual sobre Goldcar, posible Wialon, cuenta, permisos, API, costos y límites. | Borrador de `08_gps_goldcar.md`. | Cada capacidad se marca `Posible`, `Confirmada` o `No confirmada`; no se inventan endpoints. | 3.2.2 |
| 3.2.2 | Auditar datos y diseñar spike. | Verificar posiciones, velocidad, ignición, odómetro, sensores, eventos, geocercas, CANBUS, histórico, polling/webhooks, frecuencia y unidad-dispositivo. | Matriz de capacidad + Technical Spike GPS. | Payloads anonimizados, pruebas de permisos/límites y credenciales solo en backend. | 3.2.3 |
| 3.2.3 | Definir límite conceptual del provider. | Revisar `ExternalTelematicsProvider ← GoldcarAdapter`, normalización, retención, errores y sustitución con A/B/D/E/F. | `08_gps_goldcar.md` finalizado. | El dominio no depende de Goldcar; carencia de acceso queda como bloqueo explícito, no como supuesto. | 3.3.1 cuando 07 finalice |

#### PARTE 3.3 — Auditoría 09: open source

| Sesión | Objetivo y contexto | Trabajo | Archivo/entregable | Prueba y aceptación | Gate / siguiente |
|---|---|---|---|---|---|
| 3.3.1 | Crear lista larga guiada por gaps confirmados. | Investigar proyectos oficiales/relevantes de fleet, telematics, maps, OCR, receipts, PWA/offline, PowerSync, Supabase, capture y expenses. | Borrador de `09_open_source_research.md`. | Cada candidato tiene URL y propósito; no se descarga ni incorpora código. | 3.3.2 |
| 3.3.2 | Evaluar calidad y compatibilidad. | Revisar licencia, actividad, mantenimiento, issues, dependencias, seguridad, tests, arquitectura, extracción y lock-in. | Fichas comparables y lista corta. | Licencia comprobada en repositorio; ausencia o incompatibilidad impide adopción. | 3.3.3 |
| 3.3.3 | Clasificar y revisar. | Asignar `ADOPT`, `ADAPT`, `REFERENCE` o `REJECT`, con razón y alcance reutilizable; revisión D/F/G/H. | `09_open_source_research.md` finalizado. | Toda clasificación cubre los 12 criterios requeridos y fecha de actividad. | G3 → 4.1.1 |

### FASE 4 — Plan ejecutable

#### PARTE 4.1 — Auditoría 10: Plan Maestro

| Sesión | Objetivo y contexto | Trabajo | Archivo/entregable | Prueba y aceptación | Gate / siguiente |
|---|---|---|---|---|---|
| 4.1.1 | Auditar dependencias y orden de 08 con hallazgos 01–09. | Construir grafo, identificar prerrequisitos circulares, infraestructura ausente y alcance mal ubicado. | Borrador de `10_plan_implementacion.md`. | Grafo sin ciclos ocultos; cada cambio cita hallazgo fuente. | 4.1.2 |
| 4.1.2 | Convertir fases grandes en partes y sesiones. | Diseñar incrementos verificables, incluyendo Foundation→Offline Spike→Persistencia→Sync→Seguridad→Dominio. | Plan V2 propuesto dentro del informe. | Ninguna sesión es un cambio trivial ni una épica sin entregable verificable. | 4.1.3 |
| 4.1.3 | Completar contratos de sesión y revisión total. | Añadir objetivo, contexto, trabajo, rutas, dependencias, pruebas, aceptación, gate, entregable y siguiente sesión. | `10_plan_implementacion.md` finalizado. | Todos los campos completos; ningún gate consume infraestructura posterior. | G4 → 5.1.1 |

### FASE 5 — Auditoría cruzada y readiness

#### PARTE 5.1 — Auditoría 11: cruce multidisciplinario

| Sesión | Objetivo y contexto | Trabajo | Archivo/entregable | Prueba y aceptación | Gate / siguiente |
|---|---|---|---|---|---|
| 5.1.1 | Cruzar negocio↔datos↔UX↔arquitectura↔seguridad↔plan. | Construir matrices regla/dato/pantalla/permiso/offline/fase e indicador/dato fuente. | Borrador de `11_auditoria_cruzada.md`. | Toda regla y workflow crítico tiene cobertura o gap explícito. | 5.1.2 |
| 5.1.2 | Resolver contradicciones y recomendaciones incompatibles. | Canonizar duplicados, conservar aliases y elevar conflictos al propietario. | Hallazgos X y lista de decisiones pendientes. | No se ocultan desacuerdos; severidad y evidencia pasan revisión independiente. | 5.1.3 |
| 5.1.3 | Cerrar auditoría cruzada. | Revisar panel A–J y preparar matriz maestra. | Sección cruzada finalizada. | Todas las auditorías fuente están finalizadas o bloqueadas con impacto explícito. | 5.2.1 |

#### PARTE 5.2 — Matriz maestra y clasificación

| Sesión | Objetivo y contexto | Trabajo | Archivo/entregable | Prueba y aceptación | Gate / siguiente |
|---|---|---|---|---|---|
| 5.2.1 | Consolidar hallazgos sin duplicación. | Crear matriz `ID | Severidad | Dominio | Hallazgo | Documento | Acción | Decisión necesaria`. | Matriz maestra en `11_auditoria_cruzada.md`. | Cada fila enlaza evidencia, propietario, gate y estado; conteos cuadran con informes. | 5.2.2 |
| 5.2.2 | Preparar paquete de correcciones y decisiones. | Agrupar cambios propuestos por fuente/DEC, dependencia y orden de aprobación. | Paquete para propietario. | Recomendaciones no aparecen como aprobadas; incompatibilidades quedan visibles. | 5.2.3 |
| 5.2.3 | Emitir readiness y handoff. | Clasificar `READY`, `READY WITH CORRECTIONS` o `NOT READY` e indicar alcance habilitado. | `11_auditoria_cruzada.md` finalizado + actualización de este índice. | Criterios de clasificación reproducibles; propietario recibe siguiente acción única. | G5 → revisión del propietario |

## 11. Requisitos obligatorios del Technical Spike auditado

La auditoría 05 deberá convertir este escenario en pruebas reproducibles:

1. usuario inicia sesión;
2. datos necesarios llegan al dispositivo;
3. se pierde completamente Internet;
4. se registra un gasto;
5. se adjunta una fotografía;
6. se cierra la PWA;
7. se vuelve a abrir;
8. datos y fotografía continúan;
9. vuelve Internet;
10. se sincroniza;
11. no aparecen duplicados;
12. el backend recibe información válida.

También deberá especificar variantes de force-stop, reinicio, almacenamiento bajo presión, actualización con cola pendiente, red intermitente, token vencido, rechazo server-side, subida parcial, varias pestañas/dispositivos y recuperación manual.

## 12. Protocolo de evidencia externa

- Usar fuentes oficiales y primarias para stack, APIs, seguridad, licencias, costos y límites; registrar URL, fecha de consulta, versión y alcance.
- Para GPS, obtener confirmación contractual, del soporte o del tenant real. Si se confirma Wialon, usar su documentación oficial; nunca inferir endpoints por semejanza.
- Para OCR, validar contra un corpus real autorizado y anonimizado de comprobantes R&T; medir exactitud por campo, totales monetarios, corrección humana, latencia y costo.
- Para open source, comprobar el archivo de licencia, releases/commits, issues, advisories, dependencias y tests en el repositorio original.
- Normativa peruana, datos personales, geolocalización y comprobantes requieren fuentes oficiales y revisión jurídica/contable; la auditoría técnica no las declara resueltas por inferencia.

## 13. Riesgos iniciales a validar

Estos elementos son indicios de planificación, no hallazgos concluyentes, y no ingresan a la matriz maestra hasta ser auditados.

| ID preliminar | Severidad preliminar | Indicio | Evidencia inicial | Auditoría responsable |
|---|---|---|---|---|
| PRE-001 | HIGH | El proyecto carece de una raíz Git propia y comparte un repositorio superior con cambios ajenos. | `git rev-parse --show-toplevel` devuelve `C:/Users/Ruben J`. | 10/11 |
| PRE-002 | HIGH | DEC técnicas están `Accepted`, mientras la arquitectura también exige validar empíricamente capacidades del stack. | DEC-001–004; 07 §215. | 04/05/11 |
| PRE-003 | HIGH | Datos financieros y reglas del negocio contienen estimaciones, campos pendientes y necesidad de validación contable/legal. | 01 §§9–10.5. | 01/02 |
| PRE-004 | HIGH | El modelo de estados evoluciona de un estado principal único a dimensiones separadas; requiere reconciliación transversal. | 03 §5; 05/07 estados; DEC-009. | 01/02/03/11 |
| PRE-005 | HIGH | Fase 1 consume Auth, Storage, PowerSync y RLS antes de que Fase 2 cree la fundación permanente. | 08 Fases 1–2. | 10 |
| PRE-006 | HIGH | La persistencia de fotos y operaciones tras cerrar navegador no cubre aún cuotas, eviction, force-stop, migración con pendientes ni subidas parciales. | 07 §§37–38, 113–117, 215; 08 §§14–17. | 05 |
| PRE-007 | HIGH | No está demostrado el perímetro exacto entre Sync Streams, upload, identidad, RLS y validaciones server-side. | 07 §§27–35, 53–75. | 05/06 |
| PRE-008 | HIGH | RLS, sesión offline, revocación y protección de datos locales están descritas conceptualmente, sin matriz ni amenaza cerrada. | 07 §§66–78; 08 seguridad. | 06 |
| PRE-009 | MEDIUM | El modelo de datos y el plan abarcan muchas entidades y releases antes de confirmar el mínimo necesario del MVP. | 05 §§1–134; 08 fases y backlog. | 01/02/10 |
| PRE-010 | HIGH | OCR pasa de “futuro” a requisito deseado sin contrato de datos, confidence, benchmark, privacidad ni fase validada. | 06 §138; nuevo requisito. | 07 |
| PRE-011 | HIGH | Goldcar/Wialon, API, permisos, límites, costos y datos disponibles no están confirmados. | 07 §§102–105, 215; nuevo requisito. | 08 |
| PRE-012 | MEDIUM | La propuesta comercial adicional no está incluida en el manifiesto y su autoridad no está explicitada. | Manifiesto y árbol de `docs/`. | 01/10/11 |
| PRE-013 | MEDIUM | Afirmaciones temporales del stack y enlaces incorporados requieren revalidación con documentación primaria vigente. | 07 y 08. | 04/05/06/09 |
| PRE-014 | HIGH | `viaje` y `ciclo operativo` compiten como unidad de cierre y rentabilidad; debe fijarse qué agrega ida, espera y retorno. | 03 §§2.6 y 23–24; 05 §§22–26. | 01/02/11 |

Resolución de preparación: PRE-001 fue resuelto en `SESSION-20260812-003` mediante DEC-011. La raíz Git propia quedó inicializada y el repositorio padre no fue modificado. Los demás riesgos preliminares permanecen pendientes de sus auditorías asignadas.

## 14. Criterio de readiness final

- `NOT READY`: existe un `CRITICAL` abierto, un `HIGH` que bloquea el alcance, una decisión fundacional sin resolver o evidencia insuficiente para especificar los gates básicos.
- `READY WITH CORRECTIONS`: no hay bloqueadores para el alcance autorizado inmediato, pero quedan correcciones trazadas a gates posteriores.
- `READY`: no hay `CRITICAL/HIGH` abiertos ni decisiones bloqueantes y el plan completo tiene trazabilidad verificable.

La clasificación siempre indicará el alcance habilitado. Estar listo para un Technical Spike controlado no equivale a estar listo para desarrollar todo el dominio.

## 15. Archivos previstos

En esta sesión solo se crea este índice. Las siguientes rutas se crearán una por una al ejecutar su auditoría:

- `docs/audits/01_negocio_dominio.md`
- `docs/audits/02_modelo_datos.md`
- `docs/audits/03_ux_ui.md`
- `docs/audits/04_arquitectura_tecnica.md`
- `docs/audits/05_offline_sync.md`
- `docs/audits/06_seguridad.md`
- `docs/audits/07_ocr.md`
- `docs/audits/08_gps_goldcar.md`
- `docs/audits/09_open_source_research.md`
- `docs/audits/10_plan_implementacion.md`
- `docs/audits/11_auditoria_cruzada.md`

## 16. Siguiente auditoría recomendada

Ejecutar `01_negocio_dominio.md`. Las reglas y excepciones confirmadas allí son la entrada necesaria para auditar correctamente datos, UX, seguridad y planificación.
