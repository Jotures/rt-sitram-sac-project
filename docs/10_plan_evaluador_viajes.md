# Plan de implementación — Evaluador de Viajes R&T

**Estado:** Reemplazado como referencia activa el 2026-08-20 por el [Plan de implementación — Integración Goldcar/Wialon y GPS Operativo R&T](10_plan_integracion_goldcar.md). Se conserva como contrato e historial del Evaluador desplegado y de sus pendientes.  
**Fecha:** 2026-08-20  
**Alcance:** permitir que Administración evalúe una carga antes de aceptarla, con costos, escenarios y precios de negociación explicables.

## Propósito y autoridad

Este plan reemplaza el plan de producto utilizable y piloto funcional, retirado por instrucción del propietario después de aprobar y verificar el flujo completo de viaje. No reemplaza DEC-023: conserva el aislamiento del piloto y la exigencia de trazabilidad para futuras validaciones.

El plan concreta las secciones 23–33 y 52 del [Documento Maestro V2](../R&T_SITRAM_Documento_Maestro_Analisis_y_Vision_V2.md), el modelo de datos, la arquitectura técnica y DEC-001–DEC-025. Ante conflicto, prevalecen las decisiones aceptadas y el contrato económico aprobado en la etapa 0.

## Resultado buscado

Antes de negociar o aceptar una carga, una persona autorizada puede registrar los supuestos de ida y retorno, simular una oferta y entender:

- el ingreso y costo estimados, con su cobertura declarada;
- margen directo, margen operativo si se configuró una asignación válida, y los costos que aún no están incluidos;
- precio de equilibrio, mínimo recomendado y objetivo, una vez aprobadas sus reglas;
- resultados conservador, probable y favorable, sin convertir el retorno probable en ingreso garantizado;
- costo, ingreso y margen por kilómetro y por día solo cuando existan los datos necesarios;
- razones concretas de un resultado bajo o de una excepción.

El Evaluador ayuda a decidir; no aprueba viajes, no registra ingresos definitivos, no cierra rendiciones y no sustituye la autoridad del servidor ni el juicio humano.

```text
oportunidad o carga propuesta
  → supuestos visibles y versionados
  → escenarios calculados en dominio
  → decisión humana / excepción auditada
  → (posteriormente) creación del viaje
  → comparación estimado vs. real
```

## Línea base confirmada

- El piloto funcional del vertical de viaje fue aprobado y verificado por el propietario el 2026-08-20.
- `@rt-sitram/domain` ya separa margen directo de margen operativo, calcula desempeño de ciclo y evita afirmar utilidad neta sin cobertura suficiente.
- `trips` y `operational_cycles` ya existen; aún no hay oportunidad, cotización, evaluación persistida ni política económica versionada.
- La primera versión usa datos manuales o maestros existentes con fuente visible. GPS, ruteo externo, predicción histórica, OCR, scoring e IA no son dependencias de este plan.

## Límites de la primera versión

No se implementará todavía:

- integración Goldcar/Wialon, mapas, geocercas, ETA o PostGIS;
- cotización comercial completa, CRM, facturación o cobranza nueva;
- inferencia automática de consumo, duración, retorno o precios a partir de histórico;
- prorrateo opaco de administración, depreciación, seguros, mantenimiento, neumáticos o remuneraciones;
- score de viabilidad, recomendaciones automáticas o IA;
- una segunda PWA o replicación offline completa para el evaluador administrativo.

## Invariantes del Evaluador

1. **Estimación no es registro real.** Ningún valor calculado modifica por sí solo un viaje, una rendición, una factura ni un pago.
2. **Cobertura explícita.** Cada resultado identifica si expresa margen directo, margen operativo o una utilidad económica cuyo método de asignación fue aprobado. Los costos excluidos se muestran, no se esconden.
3. **Ciclo antes que optimismo.** Ida, espera, retorno y regreso vacío se modelan como supuestos o tramos separados; un retorno probable nunca se presenta como confirmado.
4. **Cálculo puro y reproducible.** Las fórmulas viven en `packages/domain`, reciben datos completos, rechazan valores inválidos y conservan una versión de política y de supuestos al guardar una evaluación.
5. **Autoridad y auditoría.** El servidor valida permisos, empresa, versión y transición a un viaje; aprobar una excepción requiere actor, motivo, fecha y resultado original.
6. **Explicabilidad.** Todo semáforo, precio o recomendación enlaza a sus entradas, fórmula, umbrales y costos excluidos; el color nunca es la única explicación.
7. **No inventar datos.** Si faltan kilómetros, días, consumo, precio de combustible o retorno, la interfaz marca la métrica como no calculable o solicita el dato.

## Seguimiento de ejecución

| Etapa | Estado | Evidencia / pendiente |
|---|---|---|
| 0. Contrato económico | Implementado | DEC-026 se materializa como política configurable/versionada; faltan los primeros valores aprobados y publicados por Gerencia. |
| 1. Núcleo de cálculo | Completado | Casos de dominio, precisión, escenarios, umbrales y métricas por km/día cubiertos por pruebas. |
| 2. Persistencia y seguridad | Completado | Migrations aplicadas; RLS, RPC, ACL, pgTAP transaccional y lint remoto sin hallazgos. |
| 3. Experiencia administrativa | Desplegado | Simulador publicado en la PWA de producción; falta UAT visual con una sesión administrativa autenticada y política real. |
| 4. Conversión y comparación | Pendiente | Crear viaje desde una evaluación y contrastar estimado contra real. |
| 5. UAT y calibración | Pendiente | Casos históricos/anónimos, decisiones observables y cero P0/P1. |

## Etapa 0 — Contrato económico y de decisión

**Objetivo:** fijar las reglas de negocio antes de codificar fórmulas, evitando que “utilidad” signifique cosas distintas en cada pantalla.

### Decisiones que el propietario debe aprobar

| Tema | Pregunta que debe cerrar el contrato |
|---|---|
| Unidad de negociación | ¿La tarifa y los precios se ingresan por servicio completo, tonelada, kilómetro u otra unidad? ¿Cómo se convierte cada una? |
| Cobertura de costo | ¿Qué categorías entran en costo directo inicial y cuáles se muestran como excluidas? |
| Combustible | ¿Se estima por monto directo, litros × precio, consumo × kilómetros, o combinaciones permitidas? |
| Kilómetros y tiempo | ¿Cuál es la fuente inicial autorizada para kilómetros, días de ciclo, espera y kilómetros vacíos? |
| Retorno | ¿Qué distingue retorno confirmado, probable, vacío y no identificado? ¿Quién registra su probabilidad e ingreso esperado? |
| Márgenes | ¿Cuáles son el mínimo recomendado y el objetivo, qué base usan y quién puede cambiarlos? |
| Excepción | ¿Qué roles pueden aprobar una oferta por debajo del mínimo y qué motivo/evidencia se exige? |
| Moneda y vigencia | ¿Qué monedas se permiten y durante cuánto tiempo son válidos combustible, costos y umbrales? |

### Entregables

- Glosario aprobado: ingreso estimado, ingreso contratado, costo directo, margen directo, margen operativo, utilidad económica, ciclo, retorno y excepción.
- Tabla de categorías de costos incluidas/excluidas y fuente de cada input.
- Fórmulas aprobadas, redondeo, moneda, vigencia y ejemplos de borde.
- Política de umbrales versionada, incluida la regla de precio de equilibrio, mínimo recomendado y objetivo.
- Matriz de permisos y guion de aceptación con al menos un escenario conservador, probable, favorable y bajo el mínimo.

**Resolución inicial:** DEC-026 establece que los elementos cambiantes se administran como una política económica versionada y no como constantes de código. La primera versión solo calculará margen directo con costos declarados; las capas operativa y económica se mostrarán como excluidas hasta que exista una metodología aprobada. Los valores iniciales de política se ingresan explícitamente por Gerencia.

**Gate:** ningún precio mínimo/objetivo ni evaluación fijada se publica sin una política activa. Las preguntas sin respuesta se mantienen como campos requeridos o métricas no calculables, no como supuestos del software.

## Etapa 1 — Núcleo de cálculo explicable

**Objetivo:** construir el evaluador como dominio TypeScript puro, determinista y probado antes de conectarlo a React o PostgreSQL.

- Crear tipos de entradas, supuestos de ida/retorno, cobertura de costos, resultados y razones.
- Reutilizar `calculateProfitability` y `calculateCyclePerformance` cuando encajen; extraer nuevas funciones sin cambiar el significado de los cálculos de viaje ya aceptados.
- Calcular cada escenario de forma independiente: conservador sin retorno, probable con retorno ponderado aprobado y favorable con retorno confirmado/definido por contrato.
- Producir precios de negociación solo con una política de margen aprobada; cada precio debe exponer su base, versión y condición de aplicabilidad.
- Devolver `null` con una causa para métricas no calculables; rechazar montos negativos, porcentajes fuera del rango aprobado, cronologías imposibles y mezcla de monedas.
- Añadir pruebas de redondeo, cero ingreso, falta de distancia/días, retorno improbable, precios límite, costos excluidos y resultados reproducibles.

**Gate:** la suite de dominio demuestra que los resultados son reproducibles, trazables a inputs concretos y que ninguna salida llama “utilidad neta” a una cobertura parcial.

## Etapa 2 — Persistencia, seguridad y trazabilidad

**Objetivo:** guardar evaluaciones y decisiones sin convertir un borrador comercial en una operación financiera.

- Diseñar migrations-first para evaluaciones, versiones de supuestos/políticas, tramos del ciclo y excepciones. Confirmar el modelo antes de migrar; no duplicar tablas de `trips` ni `operational_cycles`.
- Establecer `company_id`, restricciones de integridad, UUID, auditoría, RLS y permisos coherentes con DEC-018 y DEC-020.
- Publicar RPCs de comandos para crear/revisar/fijar una evaluación y aprobar una excepción. La UI no escribe SQL arbitrario ni determina la autorización.
- Persistir una instantánea inmutable de las entradas, política y resultados que respaldaron una excepción o una conversión en viaje.
- Permitir edición de borradores mientras no exista decisión fijada; las correcciones posteriores crean una nueva versión, sin sobrescribir el fundamento auditado.
- Mantener el evaluador administrativo principalmente online; si se habilita una caché local, definir explícitamente qué puede consultarse, qué no puede aprobarse offline y cómo se recuperan conflictos.
- Añadir pgTAP/RPC/RLS A/B: empresa ajena, rol conductor, política no vigente, importe manipulado, excepción sin motivo y repetición idempotente.

**Gate:** no existe forma de leer/escribir evaluaciones de otra empresa, aprobar una excepción sin permiso o alterar la instantánea que justificó una decisión.

## Etapa 3 — Simulador administrativo

**Objetivo:** entregar una experiencia de negociación rápida, clara y usable en escritorio y móvil administrativo.

- Incorporar la ruta dentro de Operaciones o Dinero tras validar con el diseño la ubicación que mejor mantenga el flujo oportunidad → evaluación → viaje.
- Construir un formulario por bloques: servicio/cliente, ida, costos, retorno, tiempo y oferta. Mostrar procedencia de valores prellenados y permitir revisar antes de calcular.
- Mostrar una comparación estable de los tres escenarios, desglose de costos, cobertura/exclusiones y precios de negociación con etiquetas textuales claras.
- Incluir una acción dominante por estado: guardar borrador, actualizar oferta, solicitar/aprobar excepción o crear viaje cuando corresponda.
- Mantener jerarquía densa pero legible, contraste AA, foco visible, mensajes de validación accionables, sin depender solo del semáforo y con `prefers-reduced-motion`.
- Cubrir navegación, validación, estados vacíos, permisos, pantalla angosta y datos incompletos mediante pruebas de UI y revisión visual.

**Gate:** una persona autorizada puede comparar una oferta en menos de una interacción guiada, identificar qué cifra no está incluida y entender por qué necesita renegociar o solicitar excepción.

## Etapa 4 — Conversión a viaje y contraste con lo real

**Objetivo:** unir la decisión comercial con el viaje sin confundir estimaciones con hechos operativos o financieros.

- Definir el comando autoritativo que crea un borrador de viaje a partir de una evaluación fijada, conservando enlace e instantánea de origen.
- Transferir solo los datos cuya correspondencia se haya aprobado; la edición posterior del viaje no reescribe la evaluación original.
- Exponer en el expediente del viaje la comparación entre estimado y registrado: ingreso, costo directo, margen, kilómetros, días y retorno, con cobertura y estado de datos.
- Señalar diferencias materiales como datos para revisión; no generar sanciones, cambios de precio ni cierres automáticos.
- Probar idempotencia, empresa/rol, conversión repetida, enlace de ciclo, cambios posteriores y la ausencia de doble contabilización de combustible/gastos.

**Gate:** cada viaje creado desde el evaluador conserva una trazabilidad legible hacia la hipótesis que lo originó y las cifras reales no se mezclan con las estimadas.

## Etapa 5 — UAT, calibración y salida

**Objetivo:** comprobar que el Evaluador mejora decisiones sin inducir una falsa certeza financiera.

Escenarios mínimos:

1. Evaluar una ida sin retorno y detectar una oferta por debajo del mínimo.
2. Comparar los tres escenarios de una misma carga y verificar las fórmulas manualmente contra el contrato aprobado.
3. Guardar, reabrir y versionar una evaluación sin perder los supuestos originales.
4. Intentar modificar/aprobar desde una empresa o rol no autorizado.
5. Solicitar y aprobar/rechazar una excepción con motivo, actor y auditoría.
6. Convertir una evaluación en viaje y comprobar la conservación de su instantánea.
7. Completar un viaje de prueba y revisar estimado contra margen directo real sin presentarlo como utilidad neta.

La validación combina pruebas de dominio, typecheck, lint, build, pgTAP/RLS/RPC, pruebas web y revisión visual. Se registran P0–P3; no se declara lista la etapa con P0/P1 abiertos ni con diferencias de fórmula no explicadas.

**Gate final:** el propietario aprueba las reglas económicas implementadas y el UAT demuestra decisiones explicables, auditables y consistentes con el resultado real disponible.

## Definition of Done

El Evaluador estará listo cuando:

- use reglas y umbrales explícitamente aprobados y versionados;
- diferencie margen directo, margen operativo y utilidad económica por su cobertura;
- no permita que datos faltantes se conviertan en certeza aparente;
- represente ida, retorno y tiempo de ciclo sin doble contar ingresos o costos;
- proteja datos por empresa y rol, y audite excepciones;
- pueda crear un viaje trazable sin transformar la estimación en un hecho financiero;
- compare estimado con datos reales sin alterar la evidencia original;
- pase validaciones automáticas, manuales, de seguridad y visuales sin P0/P1 abiertos.

## Próxima tarea única

Publicar la primera política económica con valores reales de Gerencia y ejecutar cuatro casos de decisión antes de utilizar el Evaluador en negociación real. El corte posterior a operación debe retirar los datos piloto/no negocio mediante el inventario controlado de DEC-027.
