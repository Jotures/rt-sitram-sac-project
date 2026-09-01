# Plan de pruebas de adaptación del aplicativo

## Objetivo

Ejecutar casos sintéticos derivados de la evidencia operativa real para medir si
el Centro de Control Digital R&T representa la práctica de la empresa con
claridad, trazabilidad y controles adecuados.

Este plan complementa el
[runbook del piloto funcional aislado](../../runbooks/piloto-funcional.md). No
autoriza probar con operaciones reales, importar el chat ni cargar documentos o
movimientos históricos en producción.

## Artefactos de entrada

1. [Marco de uso de evidencia](15_marco_uso_evidencia_para_evaluar_aplicativo.md).
2. [Banco de escenarios históricos sanitizados](16_banco_escenarios_historicos_sanitizados.md).
3. [Matriz de cobertura y adaptación](17_matriz_cobertura_adaptacion_aplicativo.md).
4. [Preguntas e incertidumbres del corpus](10_calidad_incertidumbres_y_preguntas.md).
5. DEC-037 y los contratos vigentes del repositorio.

## Estrategia de prueba

### Capa 1 — Contrato estático y automatizado

Comprueba sin introducir datos de negocio:

- entidades y relaciones del esquema;
- reglas de dominio;
- RLS y permisos;
- comandos autoritativos e idempotencia;
- tablas y colas offline;
- rutas y acciones expuestas por rol;
- estados de carga, vacío, error y sincronización;
- pruebas automatizadas existentes.

Esta capa identifica si el sistema **puede** representar el caso. No demuestra
que la persona usuaria comprenda el recorrido.

### Capa 2 — UAT histórico sintético

Administración, Gerencia y al menos un conductor ejecutan los escenarios en un
entorno aislado con datos ficticios. Se observa si pueden completar cada tarea
sin explicación externa y si reconocen el significado de estados, saldos y
acciones.

Esta capa determina si la capacidad se **adapta** a la práctica de R&T.

### Capa 3 — Regresión gobernada

Después de validar las reglas pendientes, los casos estables se transforman en
pruebas automatizadas de dominio, SQL, integración u operación offline. Las
variantes que dependen de juicio humano permanecen como UAT documentado.

No se automatiza una inferencia sin aprobación del propietario.

## Entorno y datos

- Usar el entorno aislado establecido por DEC-023.
- Identificar toda transacción con `HIST-QA-<escenario>-<corrida>`.
- Utilizar actores, clientes, unidades, rutas, montos y documentos sintéticos.
- No usar capturas, PDF, credenciales, placas, nombres ni importes del corpus.
- No ejecutar escenarios financieros contra producción.
- Preservar la evidencia de cada corrida; no borrar fallos para aparentar una
  corrida limpia.

## Roles mínimos

| Rol | Responsabilidad durante la prueba |
|---|---|
| Gerencia | Revisar decisiones, excepciones, resultados económicos y límites de alcance. |
| Administración | Crear/programar viajes, entregar fondos, revisar gastos, rendir, mantener documentos, facturar y cobrar. |
| Conductor | Recibir el viaje, ejecutar etapas y capturar actividad/evidencia con y sin conexión. |
| Observador QA | Registrar tiempos, dudas, errores, ayudas solicitadas y evidencia técnica sin dirigir la tarea. |

Contabilidad participa en los escenarios de cobranza. Planilla permanece fuera
del producto por DEC-037 hasta que exista un alcance laboral y contable nuevo.

## Preparación obligatoria

1. Confirmar que el invariante P0 y las migraciones P1/P2 estén aplicados en el
   entorno aislado. Su implementación está versionada, pero no se aplicó una
   migración ni se ejecutó pgTAP local o remoto durante los cortes P1/P2.
2. Confirmar identificadores de Supabase, PowerSync, Storage y origen web del
   piloto.
3. Confirmar versión del entorno de prueba y resultado de migraciones/pruebas,
   incluida la prueba pgTAP de alta nueva después del cierre, los contratos P1
   de representación, combustible, fondo operativo y ciclos, y los contratos
   P2 de orden, repuestos, evidencia y cierre conciliado.
4. Crear cuentas de prueba por rol y verificar aislamiento.
5. Cargar maestros sintéticos suficientes, incluyendo más de una unidad y un
   conductor correctamente vinculado.
6. Preparar archivos sintéticos válidos, inválidos, ausentes y duplicados.
7. Preparar dos dispositivos o sesiones cuando se prueben concurrencia,
   reasignación o diferencias entre Administración y Conductor.
8. Registrar el manifiesto de corrida antes de crear transacciones.

## Orden recomendado de ejecución

### Ronda A — Preparación del servicio

- Declaración estructurada de viaje.
- Prerrequisitos y programación.
- Asignación de unidad y conductor.
- Fondo operativo y combustible inicial.
- Claridad del traspaso de Administración a Conductor.
- Captura administrativa en línea con motivo, frente a captura offline del
  Conductor, sin confundir ambos actores.

### Ronda B — Ejecución y operación offline

- Inicio y progreso del viaje.
- Combustible, gasto, kilometraje e incidencia.
- Evidencia local, cierre/reapertura y reconexión.
- Consulta del comprobante privado desde el rol revisor.
- Reintento sin duplicación.
- Mensaje comprensible de cola, envío y confirmación.

### Ronda C — DEC-037: continuidad y regularización

- Crear un ciclo operativo por unidad y asociar ida, retorno o continuación;
  verificar que cada servicio sigue siendo un viaje facturable y que el ciclo
  no fusiona rendiciones ni dinero.
- Quitar y volver a asociar un viaje abierto con motivo y auditoría; probar el
  rechazo de una unidad incompatible y el cierre temprano del ciclo.
- Registrar un gasto administrativo desde un viaje programado y otro ya
  completado, conservando la fecha real y el motivo de representación.
- Registrar combustible administrativo histórico; verificar que se conserva
  como costo del viaje sin modificar el saldo de rendición del Conductor ni
  reducir el odómetro maestro.
- Cerrar la rendición: comprobar que bloquea nuevos gastos y combustible y
  que los fondos operativos no cancelados quedan rendidos y auditados.
- Reabrir la rendición desde Gerencia con motivo y regularizar de nuevo; no
  tratar la reapertura como planilla, préstamo o descuento salarial.
- Verificar que no exista una ruta que importe o empareje automáticamente un
  alias histórico; cualquier correspondencia futura es humana y privada.

### Ronda D — Rendición y frontera laboral

- Revisión, observación y rechazo de gastos.
- Saldo a devolver, reembolsar o balanceado.
- Cierre y reapertura auditada.
- Intento de trasladar un saldo a sueldo sin regla aprobada.

### Ronda E — Flota y documentos

- Crear una orden preventiva y una correctiva desde Administración; revisar
  que diagnóstico y trabajo realizado siguen siendo opcionales y que el
  progreso no puede finalizarla sin el cierre de costos y odómetro.
- Registrar proveedor, dos líneas de repuesto, odómetro y costos. Usar un caso
  decimal sintético en el que la suma de cada línea redondeada sea S/ 0.68;
  probar el rechazo de S/ 0.67 y el cierre correcto con S/ 0.68.
- Crear otra orden sin líneas y cerrarla con un monto global manual de
  repuestos; comprobar que ambos modelos conviven, pero nunca se mezclan en
  una misma orden.
- Adjuntar dos archivos privados opcionales, incluso después del cierre;
  intentar repetir un archivo y usar uno de otra empresa. Verificar que la
  evidencia no cambie diagnóstico, trabajo, estado, líneas ni costos y que el
  Conductor no pueda asociarla.
- Confirmar que la pantalla comunica que mantenimiento requiere conexión y no
  muestra una copia offline ni una cola inexistente.
- Documento vigente, vencido, faltante o sin archivo.
- Bloqueo de programación y recuperación después de regularizar.

### Ronda F — Facturación y cobranza

- Factura asociada al viaje y cliente correctos.
- Pago parcial, segundo pago y saldo.
- Intento de sobrepago o duplicación.
- Detracción y entidad emisora como brechas explícitas si continúan sin modelo.

## Hoja de ejecución por escenario

| Campo | Registro |
|---|---|
| Escenario / versión | `HIST-WA-___ / v1` |
| Corrida | `HIST-QA-___-___` |
| Fecha, entorno y despliegue |  |
| Roles y dispositivos |  |
| Precondiciones confirmadas |  |
| Resultado esperado |  |
| Resultado observado |  |
| Estado offline/local/cola/servidor |  |
| Evidencia de auditoría |  |
| Tiempo y ayudas solicitadas |  |
| Veredicto | `PASS / FAIL / BLOCKED / NOT_RUN` |
| Incidencia / severidad |  |
| Decisión o seguimiento |  |

## Criterios de claridad

Para cada tarea se observa si la persona puede responder sin ayuda:

1. ¿Qué está pasando?
2. ¿Qué información falta?
3. ¿Qué acción puede ejecutar este rol?
4. ¿Qué ocurrirá después de confirmar?
5. ¿El dato está sólo local, en cola o confirmado por el servidor?
6. ¿Qué impide cerrar o continuar?
7. ¿Dónde puede reconstruirse lo ocurrido?

Registrar una tarea como completada no basta si el usuario llegó por ensayo y
error o interpretó incorrectamente un saldo o estado.

## Severidad

| Nivel | Criterio |
|---|---|
| `P0` | Pérdida, corrupción, exposición o cruce de empresa; dinero duplicado; cierre inválido. |
| `P1` | El flujo crítico real no puede completarse o depende de una práctica insegura fuera del sistema. |
| `P2` | El proceso se completa con pérdida de contexto, pasos manuales relevantes o confusión recuperable. |
| `P3` | Defecto menor de lenguaje, disposición o presentación sin pérdida de control. |

## Gate de adaptación

No declarar el aplicativo adaptado a la operación observada mientras exista:

- un `P0` o `P1` abierto;
- una regla material sin dueño o definición;
- un escenario crítico sin ejecutar por Administración y Conductor;
- un saldo o estado que dependa de interpretación libre;
- evidencia offline que no pueda recuperarse;
- una práctica histórica insegura trasladada sin control;
- ausencia de trazabilidad entre viaje, costo, rendición, factura y pago en los
  escenarios que requieren ese recorrido.

## Decisiones previas a automatizar

DEC-037 ya resolvió para P1 el significado de “para gastos”, el registro
tardío, los ciclos, la captura dual y la frontera con planilla. Antes de
convertir todos los escenarios en regresión estable, se debe validar esa
implementación en una corrida integrada/UAT y el propietario debe resolver o
delimitar las brechas restantes:

- entidades emisoras, detracciones y saldos iniciales;
- cualquier migración de maestros o alias mediante revisión humana privada;
- documentación que bloquea una programación.

Hasta entonces, las pruebas deben verificar que el sistema no invente ni oculte
las decisiones aceptadas, y que no convierta una práctica histórica ambigua en
dato productivo.
