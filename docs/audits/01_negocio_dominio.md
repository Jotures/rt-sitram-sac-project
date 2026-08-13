# AUD-01 — Auditoría de Negocio y Dominio

## 1. Alcance

Auditoría adversarial del modelo conceptual de R&T SITRAM SAC. No se implementan funcionalidades, SQL ni cambios en documentos V1.

## 2. Documentos revisados

- `AGENTS.md`, `docs/audits/00_index.md`, `docs/decisions/index.md`, `docs/decisions/DEC-006-010.md`, `docs/sessions/current.md`.
- `docs/01_informe_contextual_negocio.md`, `02_diagnostico_operativo_completo.md`, `03_modelo_operativo_objetivo_to_be.md`, `04_blueprint_funcional_sistema_digital.md`, `05_arquitectura_informacion_modelo_datos.md`, `09_sintesis_comprension_negocio.md`.
- `docs/Propuesta de Digitalización y Desarrollo del Sistema de Gestión.md` (solo contraste).

## 3. Metodología

Se separó evidencia, interpretación y recomendación; se probaron A–J; se extrajeron invariantes; y se revisó adversarialmente cada CRITICAL/HIGH. La revisión independiente confirmó el hallazgo nuclear, mantuvo los HIGH y rebajó temporalidad y documentación a MEDIUM por existir historial y distinción parcial.

## 4. Modelo del negocio observado

R&T SITRAM convierte unidades, conductores, carga, combustible y tiempo en servicios de transporte. La economía puede incluir espera, varias cargas, varios destinos y retorno vacío. La información se produce entre administración, conductores, GPS, comprobantes, WhatsApp y contabilidad. El saldo directo no equivale necesariamente a utilidad integral.

## 5. Hallazgos

### AUD01-ND-001 — Viaje, ciclo, tramo y movimiento vacío no tienen semántica canónica

- Severidad: CRITICAL
- Categoría: Ontología / dominio
- Documentos afectados: 02, 03, 04, 05, 09
- Decisiones relacionadas: ninguna resuelve la ontología
- Tipo epistemológico: ERROR / CONTRADICCIÓN

#### Evidencia

03 hace existir el viaje desde oportunidad hasta cobro y define ciclo como ida + espera + retorno. 04 relaciona varios viajes dentro de un ciclo y los llama tramos. 05 propone Viaje=servicio origen→destino, Ciclo 1:N Viaje y Tramo físico. El retorno vacío carece de cliente, carga y flete.

#### Problema

Una misma palabra agrega servicio contratado, ejecución física, continuidad económica, expediente administrativo y cuenta abierta.

#### Impacto

Impide fijar cardinalidades, cierres, pertenencia de gastos/combustible, conteo y rentabilidad; bloquea AUD-02.

#### Recomendación

Aprobar glosario vinculante con identidad, inicio, fin, pertenencia, cierre y modificación de Oportunidad, Cotización, Viaje/Servicio, Ciclo, Tramo, Carga y Movimiento vacío.

#### Requiere decisión

Sí.

#### Requiere pregunta al propietario

Sí.

### AUD01-ND-002 — El cierre financiero prolongado puede bloquear la unidad

- Severidad: HIGH
- Categoría: Ciclo de vida / disponibilidad
- Documentos afectados: 01, 03, 04, 09
- Decisiones relacionadas: DEC-009
- Tipo epistemológico: ERROR / CONTRADICCIÓN

#### Evidencia

03 mantiene viaje hasta cobro; 01 permite iniciar otro ciclo tras rendición; 04 deriva disponibilidad de no tener viaje activo.

#### Problema

Una cuenta por cobrar pendiente puede dejar activo un viaje que ya liberó físicamente unidad y conductor.

#### Impacto

El escenario E puede impedir nueva asignación y contaminar utilización.

#### Recomendación

Separar liberación operativa de cierre administrativo, costeo y cobranza.

#### Requiere decisión

Sí.

#### Requiere pregunta al propietario

Sí.

### AUD01-ND-003 — La máquina de estados mezcla dimensiones

- Severidad: HIGH
- Categoría: Estados
- Documentos afectados: 03, 04, 05
- Decisiones relacionadas: DEC-009
- Tipo epistemológico: ERROR / CONTRADICCIÓN

#### Evidencia

La secuencia única contiene Oportunidad, Evaluación, ejecución, Rendición, Cobranza y Cerrado; 05 y DEC-009 exigen dimensiones separadas.

#### Problema

No expresa simultáneamente entrega realizada, rendición observada, factura vencida y cobro parcial.

#### Impacto

Transiciones, permisos, UX, reportes y cierres no son deterministas.

#### Recomendación

Mantener DEC-009 y separar ciclo comercial, estados operativo, administrativo y financiero, con historial.

#### Requiere decisión

No para separar dimensiones; sí para catálogos y transiciones.

#### Requiere pregunta al propietario

Sí.

### AUD01-ND-004 — El estado único de unidad mezcla hechos simultáneos

- Severidad: HIGH
- Categoría: Flota / disponibilidad
- Documentos afectados: 03, 04, 05, 09
- Decisiones relacionadas: ninguna
- Tipo epistemológico: ERROR / CONTRADICCIÓN

#### Evidencia

El catálogo combina EN_VIAJE, REPARACIÓN, SIN_CONDUCTOR, BLOQUEADA, ESPERANDO_TALLER y DISPONIBLE; 05 exige un solo estado activo.

#### Problema

Una unidad puede estar en viaje, averiada, esperando taller y sin relevo a la vez.

#### Impacto

Disponibilidad, improductividad, programación y utilización resultan falsos.

#### Recomendación

Separar actividad/asignación, condición técnica, restricción/dotación y aptitud derivada.

#### Requiere decisión

Sí.

#### Requiere pregunta al propietario

Sí.

### AUD01-ND-005 — La rentabilidad no es reproducible ni integral

- Severidad: HIGH
- Categoría: Economía / rentabilidad
- Documentos afectados: 01, 02, 03, 04, 05, 09
- Decisiones relacionadas: ninguna
- Tipo epistemológico: ERROR / CONTRADICCIÓN

#### Evidencia

El ejemplo produce S/3,518 antes de mantenimiento, neumáticos, conductor, seguros y administración; S/2,500 es estimativo. 03 enumera niveles sin método completo y 05 posterga asignaciones. El blueprint adelanta rentabilidad básica respecto de mantenimiento y finanzas.

#### Problema

Margen, utilidad y resultado pueden mostrar coberturas distintas.

#### Impacto

Falsa rentabilidad, tarifas erróneas y decisiones equivocadas por unidad, cliente, ruta o ciclo.

#### Recomendación

Separar ingreso estimado/contratado/facturado/cobrado y margen directo/operativo/utilidad económica; declarar costos faltantes y versión del cálculo.

#### Requiere decisión

Sí.

#### Requiere pregunta al propietario

Sí.

### AUD01-ND-006 — Gastos y abastecimientos compartidos carecen de atribución única

- Severidad: HIGH
- Categoría: Costeo / fondos
- Documentos afectados: 01, 03, 04, 05
- Decisiones relacionadas: DEC-006
- Tipo epistemológico: ERROR / CONTRADICCIÓN

#### Evidencia

Gasto y abastecimiento se asocian principalmente a un viaje aunque existen ciclos multitramos y abastecimiento entre cargas. Combustible aparece como módulo y categoría de gasto; puede pagarlo empresa o conductor.

#### Problema

H e I fuerzan duplicar, asignar arbitrariamente o contar dos veces el desembolso; compra no equivale a consumo.

#### Impacto

Distorsiona rendición, costo y rentabilidad.

#### Recomendación

Conservar un hecho fuente por desembolso y atribución económica separada, con reparto auditable y distinción de pagador.

#### Requiere decisión

Sí.

#### Requiere pregunta al propietario

Sí.

### AUD01-ND-007 — Rendición y adelantos no soportan ciclos encadenados

- Severidad: HIGH
- Categoría: Fondos / rendición
- Documentos afectados: 01, 03, 04, 05, 09
- Decisiones relacionadas: DEC-006
- Tipo epistemológico: DECISIÓN PENDIENTE

#### Evidencia

El flujo rinde al regresar a Cusco y el adelanto se define por viaje; también permite ampliaciones y cargas antes de volver.

#### Problema

E puede necesitar nuevo dinero antes de cerrar la rendición anterior y H puede compartir gastos.

#### Impacto

Saldos ambiguos, doble aplicación de adelantos o bloqueo operativo.

#### Recomendación

Definir alcance de rendición, múltiples adelantos, gasto validado, saldo calculado y devolución/reembolso ejecutado.

#### Requiere decisión

Sí.

#### Requiere pregunta al propietario

Sí.

### AUD01-ND-008 — Facturación, pagos y cierre tienen límites incompatibles

- Severidad: HIGH
- Categoría: Finanzas / cobranza
- Documentos afectados: 03, 04, 05, Propuesta
- Decisiones relacionadas: DEC-006, DEC-009
- Tipo epistemológico: ERROR / CONTRADICCIÓN

#### Evidencia

Se permite Viaje 1:N Factura y Factura 1:N Pago, pero estados mezclan Parcial, Vencida y En gestión. Un documento mantiene el viaje hasta cobrar; otros permiten cierre con deuda contabilizada o por rendición aprobada.

#### Problema

No se define factura multiviaje, pago multif factura ni si deuda abierta impide congelar resultado.

#### Impacto

Saldos, mora, cierres e inmutabilidad no son reproducibles.

#### Recomendación

Separar documento, saldo, vencimiento, gestión y pago; definir cierres operativo, rendición, costeo, facturación y cobranza.

#### Requiere decisión

Sí.

#### Requiere pregunta al propietario

Sí.

### AUD01-ND-009 — Temporalidad insuficiente para espera y carga/descarga

- Severidad: MEDIUM
- Categoría: Temporalidad / analítica
- Documentos afectados: 03, 04, 05, 09
- Decisiones relacionadas: ninguna
- Tipo epistemológico: RECOMENDACIÓN

#### Evidencia

Existe historial de transiciones e intervalos, pero En carga mezcla espera y carga realizada; faltan hitos independientes y semántica planificado/ocurrido/reportado/registrado.

#### Problema

No se reconstruyen con precisión espera, cola de descarga, avería o reporte tardío.

#### Impacto

KPIs de improductividad y costo de tiempo imprecisos.

#### Recomendación

Definir eventos e intervalos con inicio/fin, responsable, motivo, evidencia y tiempos semánticos.

#### Requiere decisión

Sí.

#### Requiere pregunta al propietario

Sí.

### AUD01-ND-010 — Avería en operación carece de suspensión y recuperación

- Severidad: HIGH
- Categoría: Incidencias / mantenimiento
- Documentos afectados: 02, 03, 04, 05
- Decisiones relacionadas: ninguna
- Tipo epistemológico: DECISIÓN PENDIENTE

#### Evidencia

Se registran incidencia, mantenimiento de emergencia y orden de trabajo, pero no pausa/reanudación, sustitución, transbordo, custodia, cancelación ni atribución completa.

#### Problema

No está definida la cadena incidencia → intervención → parada → recuperación.

#### Impacto

J queda parcial; costos, estados, kilometraje y responsabilidad pueden divergir.

#### Recomendación

Definir flujo excepcional y evidencia antes de modelar.

#### Requiere decisión

Sí.

#### Requiere pregunta al propietario

Sí.

### AUD01-ND-011 — Documentación aplicable no tiene clasificación cerrada

- Severidad: MEDIUM
- Categoría: Validación / autorización
- Documentos afectados: 01, 03, 04, 05
- Decisiones relacionadas: ninguna
- Tipo epistemológico: ERROR / CONTRADICCIÓN PARCIAL

#### Evidencia

Unas reglas exigen vigencia antes de salida, otras solo advierten y otras permiten excepción para bloqueo crítico; la aplicabilidad depende del servicio.

#### Problema

Falta catálogo por ruta/carga/cliente que distinga bloqueo, advertencia y excepción.

#### Impacto

Salida inválida o bloqueo indebido.

#### Recomendación

Clasificar documento aplicable, vigencia, severidad y autoridad por servicio.

#### Requiere decisión

Sí.

#### Requiere pregunta al propietario

Sí.

### AUD01-ND-012 — Oportunidad y carga mezclan intención y mercancía

- Severidad: MEDIUM
- Categoría: Comercial / carga
- Documentos afectados: 03, 04, 05
- Decisiones relacionadas: ninguna
- Tipo epistemológico: DECISIÓN PENDIENTE

#### Evidencia

Oportunidad se define como carga potencial; se permiten varias cargas y convoyes sin multiplicidad clara entre oportunidad, cotización, servicios y unidades.

#### Problema

No se sabe si una solicitud produce uno o varios servicios ni si varias cargas tienen partes comerciales distintas.

#### Impacto

D y F pueden duplicar identidad y facturación.

#### Recomendación

Separar oportunidad/cotización de mercancía efectivamente transportada y definir roles y multiplicidades.

#### Requiere decisión

Sí.

#### Requiere pregunta al propietario

Sí.

### AUD01-ND-013 — Ingreso, sobrecarga y utilidad histórica no tienen unidad estable

- Severidad: MEDIUM
- Categoría: Economía / lenguaje
- Documentos afectados: 01, 02, 03, 04, 09, Propuesta
- Decisiones relacionadas: ninguna
- Tipo epistemológico: HIPÓTESIS A VALIDAR

#### Evidencia

Ingreso se usa para flete/adicionales, para lo facturado y para el ciclo; sobrecarga aparece como S/1,000 sin definición; S/2,500 se llama utilidad por viaje aunque el ejemplo es un ciclo.

#### Problema

No se comparan contratado, facturado, cobrado ni utilidad por viaje/ciclo.

#### Impacto

Umbrales y KPIs pueden usar cifras no comparables.

#### Recomendación

Confirmar sobrecarga, tratamiento tributario y unidad de S/2,500; etiquetar estimaciones.

#### Requiere decisión

Sí.

#### Requiere pregunta al propietario

Sí.

## 6. Auditoría Viaje vs Ciclo

| Caso | Resultado |
|---|---|
| A | Parcial: dos viajes en ciclo o un viaje con retorno. |
| B | Parcial: espera sin dueño económico ni intervalos completos. |
| C | No representable limpiamente: retorno vacío sin cliente/flete. |
| D | Parcial: faltan orden, partes y retorno final vacío. |
| E | No gobernado: anexar/replanificar y liberar recursos no definido. |
| F | Condicional: solo si Viaje=servicio y Ciclo=continuidad económica. |
| G | Parcial: cardinalidades nominales, faltan aplicación, estados, anulaciones y cierre. |
| H | No representable: gasto compartido sin reparto. |
| I | Físico sí, económico no: compra no es consumo del tramo. |
| J | Parcial: incidencia existe, recuperación no. |

## 7. Auditoría de estados

| Dimensión | Observación |
|---|---|
| Unidad | Separar actividad, condición, bloqueo/dotación y aptitud. |
| Viaje | Solo ejecución; oportunidad y cobranza no pertenecen a una secuencia única. |
| Administrativo | Rendición, documentación y observaciones tienen ciclo propio. |
| Financiero | Documento, saldo, vencimiento, gestión y pago son combinables. |
| Rendición | Presentada, observada, aprobada, cerrada y reabierta necesitan historial. |
| Factura/cobranza | Emitida, parcial, vencida y en gestión no son estados excluyentes. |

## 8. Invariantes de negocio extraídas

| ID | Tipo | Regla | Fuente | Bloqueante | Autorizable |
|---|---|---|---|---:|---:|
| INV-001 | BUSINESS-INVARIANT | Unidad no ejecuta asignaciones físicas incompatibles superpuestas. | 05 | Sí | No |
| INV-002 | BUSINESS-INVARIANT | Conductor no ejecuta asignaciones físicas incompatibles superpuestas. | 05 | Sí | No |
| INV-003 | BUSINESS-INVARIANT | Unidad fuera de servicio/bloqueo crítico no se programa. | 03–05 | Sí | Excepción definida |
| INV-004 | VALIDATION | Documentos aplicables vigentes antes de salida. | 03–04 | Sí | Catálogo aprobado |
| INV-005 | PROCESS-RULE | Toda carga se evalúa antes de aceptar, incluido retorno. | 02–03 | Sí | Excepción autorizada |
| INV-006 | PROCESS-RULE | Búsqueda de retorno empieza con la ida. | 03 | No | Sí |
| INV-007 | BUSINESS-INVARIANT | Adelanto no es gasto; desembolso fuente se cuenta una vez. | 01, 03–05 | Sí | No |
| INV-008 | BUSINESS-INVARIANT | Movimiento vacío conserva tiempo, km y costo aunque no tenga ingreso. | 01, 02, 09 | Sí | No |
| INV-009 | PROCESS-RULE | Rendición concilia caja y no sustituye validación económica/contable. | 01, 03–04 | No | Sí |
| INV-010 | AUTHORIZATION | Excepción, anulación y reapertura registran autoridad, motivo y evidencia. | 03–04, DEC-006 | Sí | Sí |
| INV-011 | DERIVED-RULE | Márgenes y utilidad declaran cobertura de costos. | 02–05 | No | No |
| INV-012 | BUSINESS-INVARIANT | Atribución compartida reconcilia con el gasto fuente. | Auditoría | Sí | No |
| INV-013 | BUSINESS-INVARIANT | Cierre operativo no depende de cobro. | DEC-009, 04–05 | Sí | No |
| INV-014 | PROCESS-RULE | Incidencia que causa mantenimiento conserva vínculo con parada y costo. | 03–05 | No | No |

Estas invariantes son recomendaciones de auditoría, no decisiones Accepted.

## 9. Preguntas abiertas

| ID | Pregunta | Módulos afectados | Severidad |
|---|---|---|---|
| OQ-001 | ¿Qué significan Viaje, Ciclo, Tramo y Movimiento vacío? | Dominio, datos, UX, finanzas | CRITICAL |
| OQ-002 | ¿Qué inicia, extiende y termina el ciclo? | Ciclo, cierres, reportes | CRITICAL |
| OQ-003 | ¿Qué libera unidad/conductor si persiste una cuenta por cobrar? | Programación, flota | HIGH |
| OQ-004 | ¿Cómo se atribuyen gastos y combustible compartidos? | Costeo, rendición | HIGH |
| OQ-005 | ¿La rendición es por viaje, ciclo, conductor, adelanto o periodo? | Fondos | HIGH |
| OQ-006 | ¿Una factura cubre varios servicios y un pago varias facturas? | Cobranza | HIGH |
| OQ-007 | ¿Qué costos entran en cada nivel de rentabilidad? | Finanzas, reportes | HIGH |
| OQ-008 | ¿Cómo se suspende/reanuda/reasigna una unidad averiada? | Incidencias, mantenimiento | HIGH |
| OQ-009 | ¿Qué estados documentales bloquean o solo advierten? | Documentos, autorización | HIGH |
| OQ-010 | ¿Qué tiempos son planificados, ocurridos, reportados y registrados? | Operación, KPIs | MEDIUM |
| OQ-011 | ¿Una oportunidad/cotización produce varios servicios o convoy? | Comercial, carga | MEDIUM |
| OQ-012 | ¿Qué significa sobrecarga? | Ingresos, factura | MEDIUM |
| OQ-013 | ¿S/2,500 corresponde a tramo, ciclo o promedio? | Rentabilidad | MEDIUM |

## 10. Contradicciones documentales

- Viaje hasta cobro frente a ciclo de varios viajes.
- Retorno como estado frente a retorno como viaje/tramo.
- Viaje desde oportunidad frente a oportunidad separada convertida.
- Estado único frente a DEC-009.
- Rendición en Cusco frente a operaciones encadenadas.
- Combustible especializado y también gasto.
- Factura recibida de grifo y factura emitida al cliente.
- Cierre por cobro, deuda contabilizada o rendición.
- Margen preliminar y utilidad integral sin cobertura común.

## 11. Riesgos para el modelo de datos

Cardinalidades inestables; ciclos sin secuencia/cierre; vacío no representable; doble conteo; reparto arbitrario; bloqueo falso de unidades; pagos sin aplicación inequívoca; estados no ortogonales; resultados no reproducibles.

## 12. Riesgos para UX/UI

“Mi viaje” ambiguo al cambiar de carga; selección incierta de ciclo/tramo para gastos; cierres y cobros confundidos; advertencias y bloqueos contradictorios.

## 13. Riesgos para arquitectura técnica

Sin ontología no pueden fijarse autoridad de sincronización, conflictos al anexar ciclos, permisos de cierre ni invariantes server-side. No diseñar persistencia definitiva antes de OQ-001, OQ-002, OQ-004, OQ-005, OQ-006 y OQ-007.

## 14. Cambios documentales recomendados

No aplicados: glosario; reconciliación con DEC-009; catálogo de estados; atribución; rendición; cierres; clasificación documental; flujo de avería.

## 15. Decisiones que deberían reconsiderarse o crearse

No se modifican decisiones. Revisar con el propietario la aplicación consistente de DEC-009. Crear, tras aprobación, decisiones sobre ontología, costos compartidos, rendición y cierres. Ningún hallazgo es Accepted.

## 16. Resultado

**BLOCKED**. AUD01-ND-001 es CRITICAL y permanecen HIGH abiertos en ciclo de vida, estados, costeo, rendición, cobranza y averías.

## 17. Gate hacia AUD-02

**Bloqueado.** Resolver OQ-001/OQ-002; liberación operativa de recursos; atribución de gastos/combustible; alcance de rendición; cardinalidad de facturas/pagos y cierre; cobertura de costos; y flujo de avería. AUD-02 puede inventariar evidencia, pero no aprobar cardinalidades ni modelo definitivo.

