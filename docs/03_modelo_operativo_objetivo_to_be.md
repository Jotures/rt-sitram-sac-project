# Modelo Operativo Objetivo (TO-BE) — R&T SITRAM SAC

> **Propósito:** definir cómo debería operar R&T SITRAM SAC de manera estandarizada, medible y escalable, estableciendo procesos, responsabilidades, reglas de negocio, controles e indicadores que posteriormente puedan implementarse mediante herramientas digitales.

**Empresa:** R&T SITRAM SAC  
**Actividad:** Transporte nacional de carga pesada  
**Base de operaciones:** San Jerónimo, Cusco  
**Modelo:** TO-BE / Estado Operativo Objetivo  
**Horizonte inicial:** 12 meses  

---

# 1. Visión del Modelo Operativo Objetivo

El modelo operativo futuro de R&T SITRAM SAC debe permitir que la empresa pase de una gestión basada principalmente en experiencia, comunicación informal y registros dispersos hacia una operación donde cada viaje, unidad, conductor, gasto, cliente y movimiento financiero pueda ser:

- identificado;
- registrado;
- relacionado;
- monitoreado;
- medido;
- comparado;
- auditado;
- analizado.

El objetivo no es burocratizar el negocio.

El objetivo es que la empresa pueda crecer sin perder control.

La operación futura debe responder permanentemente cinco preguntas:

1. **¿Dónde está cada unidad?**
2. **¿Qué actividad está realizando?**
3. **¿Cuánto está costando?**
4. **¿Cuánto ingreso está generando?**
5. **¿Cuál es la siguiente acción que debe ejecutarse?**

---

# 2. Principios del Modelo Operativo

El funcionamiento futuro debe construirse alrededor de ocho principios.

## 2.1. Un viaje = una unidad de control

Cada viaje debe existir como un registro independiente desde que aparece la oportunidad comercial hasta que se cobra completamente y se cierra económicamente.

Nada relacionado con un viaje debería quedar aislado.

Combustible, gastos, conductor, carga, cliente, documentos, cobranza y rentabilidad deben estar vinculados al mismo viaje.

---

## 2.2. Una sola fuente de verdad

La información principal del negocio no debería existir en versiones diferentes en:

- WhatsApp;
- Excel;
- memoria del administrador;
- documentos físicos;
- conversaciones con conductores.

Debe existir un registro central.

WhatsApp puede continuar utilizándose como herramienta de comunicación, pero no debería ser el repositorio definitivo de información empresarial.

---

## 2.3. Registrar una sola vez

Un dato ingresado correctamente no debería volver a escribirse varias veces.

Ejemplo:

Si una unidad está asociada al viaje, sus datos deberían aparecer automáticamente en:

- control de combustible;
- documentos;
- rendición;
- mantenimiento;
- análisis financiero.

---

## 2.4. Control antes que automatización

Primero se debe definir:

**qué se hace → quién lo hace → cuándo → con qué información → qué resultado produce.**

Posteriormente se automatiza.

---

## 2.5. Gestión por excepciones

La administración no debería revisar manualmente absolutamente todo.

El sistema debería llamar la atención cuando ocurra algo fuera de lo esperado:

- gasto excesivo;
- unidad detenida demasiado tiempo;
- documento por vencer;
- mantenimiento pendiente;
- consumo anormal;
- factura vencida;
- viaje con margen bajo;
- conductor sin documentación vigente.

---

## 2.6. Rentabilidad por ciclo completo

Un viaje de ida no debe evaluarse de manera aislada cuando existe una operación de retorno.

La unidad económica recomendable será:

**ciclo de transporte = ida + espera + retorno + gastos asociados.**

---

## 2.7. Trazabilidad

Toda operación relevante debería poder responder:

- quién la registró;
- cuándo;
- para qué unidad;
- para qué viaje;
- por qué monto;
- con qué comprobante.

---

## 2.8. Escalabilidad

Los procesos diseñados para tres unidades deberían poder funcionar también con:

- 5;
- 10;
- 20;
- más unidades,

sin depender exclusivamente de que una persona recuerde cómo funciona cada caso.

---

# 3. Arquitectura General del Negocio

El modelo operativo se organiza en nueve macroprocesos:

1. **Gestión comercial y cargas**
2. **Planificación y programación**
3. **Ejecución del viaje**
4. **Combustible y gastos**
5. **Rendición y cierre operacional**
6. **Facturación y cobranza**
7. **Flota y mantenimiento**
8. **Recursos humanos y conductores**
9. **Control gerencial y análisis**

Todos convergen en una entidad central:

# VIAJE

---

# 4. Modelo Maestro del Viaje

Cada viaje debe disponer de un identificador único.

Ejemplo:

**RT-2026-000145**

Ese código acompañará toda la operación.

## 4.1. Información mínima

### Identificación

- Código.
- Fecha de creación.
- Estado.
- Tipo de viaje.
- Unidad.
- Conductor.

### Comercial

- Cliente.
- Tipo de cliente.
- Directo / tercero.
- Origen.
- Destino.
- Tipo de carga.
- Toneladas.
- Flete negociado.
- Sobrecarga.
- Condiciones de pago.

### Operaciones

- Fecha programada de carga.
- Fecha real.
- Hora de salida.
- Kilometraje inicial.
- Fecha de llegada.
- Kilometraje final.

### Finanzas

- Ingreso esperado.
- Ingreso final.
- Combustible.
- Peajes.
- viáticos.
- garaje;
- otros gastos.
- costos atribuibles.
- margen.
- utilidad.

### Documentación

- Guía remitente.
- Guía transportista.
- factura;
- comprobantes;
- fotografías/documentos asociados.

---

# 5. Estados del Viaje

Todo viaje debería encontrarse en uno y solo uno de los siguientes estados principales:

## 1. Oportunidad

Existe una posible carga pero todavía no ha sido aceptada.

## 2. Evaluación

Se está calculando tarifa, costos y rentabilidad.

## 3. Aprobado

El viaje fue aceptado comercialmente.

## 4. Programado

Tiene unidad y conductor asignados.

## 5. En carga

La unidad se encuentra esperando o realizando carga.

## 6. En tránsito

Está viajando con carga.

## 7. En descarga

Llegó al destino.

## 8. Esperando retorno

La unidad no tiene todavía carga de regreso.

## 9. Retorno programado

Ya dispone de la siguiente carga.

## 10. En retorno

Se encuentra viajando hacia la base u otro destino.

## 11. Rendición pendiente

Terminó físicamente el viaje, pero todavía no se han conciliado gastos.

## 12. Facturación/cobranza pendiente

La operación está cerrada, pero todavía existe saldo por cobrar.

## 13. Cerrado

Todos los gastos fueron conciliados y los ingresos registrados.

## 14. Cancelado

El viaje fue cancelado.

---

# 6. Proceso Objetivo de Gestión Comercial

## 6.1. Entrada

Toda carga potencial debe registrarse como una **oportunidad**.

Información mínima:

- cliente;
- contacto;
- origen;
- destino;
- carga;
- toneladas;
- fecha;
- tarifa propuesta;
- condiciones de pago.

---

## 6.2. Evaluación previa

Antes de aceptar se realiza una estimación.

### Ingresos

Flete previsto.

### Costos variables

- combustible;
- peajes;
- viáticos;
- garajes;
- gastos de ruta.

### Riesgo de retorno

Clasificación:

- Retorno confirmado.
- Retorno probable.
- Sin retorno identificado.

### Resultado

Debe generarse:

**Margen esperado**

y una clasificación:

- Rentable.
- Rentabilidad ajustada.
- No rentable.
- Requiere negociación.

---

# 7. Regla de Tarifa Mínima

La empresa debería establecer una tarifa mínima interna.

No necesariamente será comunicada al cliente.

Debe funcionar como límite de decisión.

La tarifa mínima debería considerar:

- combustible previsto;
- gastos del viaje;
- costo conductor;
- mantenimiento;
- desgaste;
- costos administrativos;
- margen mínimo objetivo;
- riesgo de retorno.

### Regla

> Ningún viaje con margen proyectado inferior al mínimo definido debería aprobarse sin autorización administrativa explícita.

---

# 8. Gestión Objetivo de Clientes

Cada cliente debe disponer de una ficha.

## Información

- razón social/nombre;
- RUC/DNI si corresponde;
- contactos;
- teléfonos;
- rutas utilizadas;
- historial de viajes;
- tarifas históricas;
- condiciones de pago;
- facturas;
- deuda;
- puntualidad;
- incidencias.

## Clasificación sugerida

### A — Estratégico

Alta frecuencia, buen pago, buena rentabilidad.

### B — Recurrente

Operaciones periódicas.

### C — Ocasional

Servicios esporádicos.

### D — Riesgo

Retrasos frecuentes, problemas documentales o comerciales.

---

# 9. Captación Comercial Objetivo

La empresa debería pasar de un modelo predominantemente reactivo:

**“esperar recomendaciones o buscar carga cuando la unidad llega”**

a un modelo mixto:

### Canal 1
Clientes actuales.

### Canal 2
Recomendaciones.

### Canal 3
Prospección directa.

### Canal 4
Alianzas con operadores logísticos.

### Canal 5
Empresas grandes.

### Canal 6
Sector minero.

---

# 10. Pipeline Comercial

La futura gestión comercial debería manejar estados:

**Prospecto → Contactado → Cotización → Negociación → Prueba → Cliente activo → Cliente recurrente → Contrato.**

Esto permitirá medir si la estrategia de conseguir contratos estables está funcionando.

---

# 11. Planificación de Flota

Antes de asignar un viaje se deben verificar cuatro elementos:

1. Unidad disponible.
2. Conductor disponible.
3. Documentación vigente.
4. Mantenimiento compatible con el viaje.

Una unidad no debería considerarse disponible únicamente porque esté estacionada en Cusco.

Debe cumplir todos los requisitos.

---

# 12. Estados Objetivo de las Unidades

Cada vehículo debe tener un estado operativo.

- Disponible.
- Programado.
- En viaje.
- Esperando carga.
- Regresando vacío.
- En mantenimiento preventivo.
- En reparación.
- Esperando taller.
- Sin conductor.
- Bloqueado.
- Inmovilizado.
- Fuera de servicio.

Cada cambio debe incluir:

- fecha;
- hora;
- motivo.

---

# 13. Tablero Diario de Operaciones

La administración debería visualizar diariamente:

| Unidad | Conductor | Ubicación | Estado | Viaje | Próxima acción |
|---|---|---|---|---|---|

Ejemplo conceptual:

**X2Y756 | Juan | Lima | Esperando retorno | RT-0145 | Buscar carga**

El objetivo es comprender el estado de la empresa en menos de un minuto.

---

# 14. Gestión de Carga de Retorno

La búsqueda de retorno no debería comenzar necesariamente después de descargar.

Debería empezar desde la programación de la ida.

## Proceso objetivo

### Antes de salir

Buscar posibles retornos.

### Durante el viaje

Confirmar oportunidades.

### Antes de descargar

Actualizar contactos.

### Después de descargar

Seleccionar alternativa.

---

# 15. Semáforo de Retorno

Cada viaje puede clasificarse:

🟢 **Confirmado**

Carga de retorno contratada.

🟡 **Probable**

Existe negociación avanzada.

🔴 **No identificado**

Todavía no existe carga.

Este indicador debería aparecer en el tablero operativo.

---

# 16. Gestión de Kilómetros Vacíos

El kilometraje debe clasificarse en:

- km con carga;
- km sin carga.

## Indicador

**% km vacíos = km vacíos / km totales × 100**

El objetivo administrativo debería ser reducir progresivamente este porcentaje.

---

# 17. Gestión de Combustible

Cada abastecimiento debe registrarse individualmente.

## Campos

- viaje;
- unidad;
- conductor;
- fecha;
- ubicación;
- grifo;
- kilometraje;
- cantidad;
- precio;
- importe;
- número de factura;
- comprobante.

Cuando sea posible debe registrarse también:

- volumen comprado.

---

# 18. Control de Rendimiento

Por unidad:

**kilómetros recorridos / combustible utilizado**

El negocio debería construir progresivamente un rango normal de consumo para cada vehículo.

Una desviación importante debería generar revisión.

### Posibles causas

- carga;
- carretera;
- velocidad;
- conducción;
- motor;
- neumáticos;
- falla mecánica.

---

# 19. Gestión de Adelantos

Antes del viaje se genera un **adelanto formal de viaje**.

## Debe incluir

- código de viaje;
- conductor;
- fecha;
- monto;
- concepto estimado.

Ejemplo:

- alimentación;
- peajes;
- garajes;
- otros.

El conductor confirma la recepción.

---

# 20. Gastos Durante el Viaje

Cada gasto debe asociarse al viaje.

Campos mínimos:

- fecha;
- categoría;
- monto;
- comprobante;
- descripción.

Categorías estandarizadas:

- combustible;
- peaje;
- alimentación;
- hospedaje;
- garaje;
- mantenimiento de emergencia;
- repuesto;
- carga/descarga;
- otros.

---

# 21. Rendición Objetivo

Cuando el conductor regresa:

### Paso 1
Entrega comprobantes.

### Paso 2
Se registran gastos.

### Paso 3
Se comparan con adelantos.

### Paso 4
Se determina:

- saldo a devolver;
- reembolso al conductor;
- rendición correcta.

### Paso 5
Administración valida.

### Paso 6
Se cierra la rendición.

Un nuevo adelanto importante no debería mezclarse con una rendición anterior sin cerrar.

---

# 22. Cierre Operativo del Viaje

El viaje se considera operativamente cerrado cuando:

- carga entregada;
- documentación completa;
- kilometraje final registrado;
- gastos ingresados;
- rendición conciliada;
- incidencias documentadas.

Pero todavía puede quedar **financieramente abierto** si el cliente no ha pagado.

---

# 23. Costeo Objetivo por Viaje

Cada viaje debería producir automáticamente cuatro resultados.

## 23.1. Ingreso bruto

Flete + adicionales.

## 23.2. Margen directo

Ingreso menos:

- combustible;
- peajes;
- viáticos;
- garajes;
- otros gastos directos.

## 23.3. Margen operativo

Margen directo menos:

- conductor;
- mantenimiento asignado;
- neumáticos;
- seguros;
- desgaste/depreciación.

## 23.4. Utilidad económica

Margen operativo menos proporción de:

- administración;
- contabilidad;
- asesoría;
- otros gastos generales.

---

# 24. Rentabilidad del Ciclo

Cuando existe ida y retorno relacionado, debería existir también un:

# CICLO OPERATIVO

Ejemplo:

**Cusco → Lima + Lima → Cusco**

El ciclo calculará:

- ingresos totales;
- costos totales;
- días utilizados;
- km cargados;
- km vacíos;
- utilidad total;
- utilidad por día.

Esto evita considerar rentable una ida cuyo retorno destruye el margen.

---

# 25. Gestión Objetivo de Cobranza

Al cerrar un viaje se genera una cuenta por cobrar cuando corresponda.

Debe contener:

- cliente;
- factura;
- monto;
- fecha de emisión;
- fecha de vencimiento;
- monto pagado;
- saldo.

Estados:

- Pendiente.
- Parcial.
- Pagada.
- Vencida.

---

# 26. Alertas de Cobranza

Ejemplo:

🟢 Por vencer.

🟡 Vencida pocos días.

🔴 Atraso importante.

La administración debe disponer de una vista:

**“Dinero pendiente de cobro”**

sin revisar manualmente facturas individuales.

---

# 27. Gestión Objetivo de Mantenimiento

El mantenimiento debe dividirse formalmente en:

## Preventivo

Basado en:

- kilometraje;
- tiempo;
- recomendaciones técnicas.

## Correctivo

Originado por:

- avería;
- desgaste;
- incidente.

## Emergencia

Reparación realizada durante un viaje.

---

# 28. Plan de Mantenimiento por Unidad

Cada unidad debe disponer de:

- kilometraje actual;
- último servicio;
- próxima fecha;
- próximo kilometraje;
- componentes críticos;
- historial.

Ejemplo:

**Cambio de aceite**

Último: 420,000 km  
Próximo: 430,000 km  
Actual: 427,500 km

El sistema debería advertir antes del vencimiento.

---

# 29. Orden de Trabajo

Toda reparación relevante debe generar una orden.

Campos:

- unidad;
- problema;
- taller;
- fecha ingreso;
- fecha salida;
- diagnóstico;
- repuestos;
- mano de obra;
- costo;
- kilometraje;
- tiempo inmovilizado.

---

# 30. Gestión de Talleres

Aunque exista un taller habitual, R&T SITRAM SAC debería disponer de una red mínima de respaldo.

Clasificación:

- taller principal;
- taller alternativo;
- especialista;
- emergencia.

Objetivo:

Reducir la dependencia de un solo proveedor y los tiempos de espera de 3–5 días.

---

# 31. Inventario Básico de Repuestos Críticos

No es necesario crear un gran almacén.

Puede establecerse una lista de elementos cuya ausencia genera paradas frecuentes.

Ejemplos según experiencia futura:

- filtros;
- componentes de desgaste;
- elementos eléctricos;
- repuestos de alta rotación.

La lista deberá definirse a partir del historial real.

---

# 32. Gestión de Conductores

Cada conductor debería disponer de un expediente único.

## Información

- datos personales;
- contrato;
- licencia;
- vigencias;
- SCTR;
- documentos;
- unidad habitual;
- viajes;
- incidencias;
- capacitaciones.

---

# 33. Reserva de Conductores

Dado que la falta de conductor puede inmovilizar una unidad durante semanas, la empresa debería desarrollar una **bolsa de respaldo**.

No necesariamente requiere contratar inmediatamente un cuarto conductor permanente.

Puede comenzar con:

- candidatos previamente evaluados;
- conductores eventuales confiables;
- contactos disponibles.

---

# 34. Evaluación de Conductores

Los conductores podrían evaluarse utilizando:

- puntualidad;
- cumplimiento documental;
- cuidado de unidad;
- consumo;
- incidencias;
- rendición;
- comunicación;
- seguridad.

El objetivo no debe ser únicamente sancionar, sino detectar necesidades de capacitación y reconocer buen desempeño.

---

# 35. Gestión Documental

Toda documentación debe clasificarse por entidad.

## Unidad

- SOAT.
- ITV.
- documentación vehicular.
- seguros.
- permisos.

## Conductor

- licencia.
- contrato.
- SCTR.
- documentos laborales.

## Viaje

- guías.
- comprobantes.
- documentos de carga.

## Cliente

- contratos.
- órdenes.
- facturación.

---

# 36. Control de Vencimientos

Los documentos deben generar alertas:

- 30 días antes;
- 15 días antes;
- 7 días antes;
- vencido.

La empresa debe evitar descubrir un vencimiento el mismo día de un viaje.

---

# 37. Gestión de Incidencias

Toda situación extraordinaria debe registrarse.

Tipos:

- avería;
- accidente;
- retraso;
- bloqueo;
- problema documental;
- rechazo de carga;
- incidente con cliente;
- devolución;
- sobrecosto;
- otro.

Debe incluir:

- viaje;
- unidad;
- fecha;
- descripción;
- impacto;
- solución.

---

# 38. Sistema de Responsabilidades

Para una estructura pequeña, no es necesario crear departamentos complejos.

Se necesita claridad.

## Administración

Responsable de:

- programación;
- viajes;
- clientes;
- cobranzas;
- rendiciones;
- documentación;
- coordinación.

## Conductores

Responsables de:

- ejecución;
- documentación de ruta;
- comprobantes;
- reportes;
- cuidado operativo;
- incidencias.

## Contabilidad externa

Responsable de:

- registro contable;
- obligaciones tributarias;
- declaraciones;
- asesoría contable.

## Taller/proveedor

Responsable de:

- ejecución técnica según orden.

## Gerencia

Responsable de:

- tarifas;
- inversiones;
- clientes estratégicos;
- crecimiento;
- decisiones de excepción.

---

# 39. Matriz RACI Simplificada

| Proceso | Gerencia | Administración | Conductor | Contabilidad |
|---|---|---|---|---|
| Aceptar cliente estratégico | A | R | I | I |
| Programar viaje | I/A | R | I | - |
| Ejecutar viaje | I | C | R | - |
| Registrar gastos | I | A | R | C |
| Rendición | I | R | R | C |
| Cobranza | A | R | - | C |
| Mantenimiento | A | R | C | - |
| Documentación | A | R | C | C |
| Análisis financiero | A | R | - | C |

**R:** Responsable de ejecutar  
**A:** Responsable final  
**C:** Consultado  
**I:** Informado

---

# 40. Reunión Operativa Semanal

Una vez por semana debería realizarse una revisión corta.

Duración recomendada:

**20–30 minutos.**

Preguntas:

1. ¿Dónde están las tres unidades?
2. ¿Qué viajes se terminaron?
3. ¿Qué viajes siguen abiertos?
4. ¿Qué unidades estuvieron paradas?
5. ¿Por qué?
6. ¿Qué cobranzas están pendientes?
7. ¿Qué mantenimiento viene?
8. ¿Qué oportunidades de carga existen?
9. ¿Existe algún riesgo para la próxima semana?

---

# 41. Revisión Mensual Gerencial

Una revisión mensual debería analizar:

### Producción

- viajes;
- toneladas;
- kilómetros.

### Utilización

- días productivos;
- días detenidos.

### Comercial

- clientes;
- contratos;
- cargas.

### Finanzas

- ingresos;
- costos;
- utilidad.

### Mantenimiento

- gastos;
- paradas.

### Cobranza

- saldos pendientes.

---

# 42. Dashboard Gerencial Objetivo

El futuro tablero principal debería mostrar como máximo los indicadores esenciales.

## Hoy

- unidades operando;
- unidades detenidas;
- cargas activas;
- viajes en tránsito.

## Mes

- viajes realizados;
- toneladas;
- ingresos;
- costos;
- utilidad.

## Eficiencia

- utilización de flota;
- km vacíos;
- consumo combustible/km.

## Riesgos

- mantenimientos próximos;
- documentos por vencer;
- cobranzas vencidas;
- unidades detenidas.

---

# 43. KPI Maestro: Utilización de Flota

La empresa debería adoptar como uno de sus principales indicadores:

**Utilización = tiempo productivo / tiempo disponible**

Los tiempos improductivos deben clasificarse por causa.

Ejemplo mensual:

- falta de carga;
- falta de conductor;
- taller;
- avería;
- bloqueo;
- otros.

Esto permitirá atacar las causas que realmente cuestan dinero.

---

# 44. KPI Maestro: Utilidad por Unidad

No basta saber la utilidad total de la empresa.

Debe conocerse:

**Unidad X2Y756**
- ingresos;
- gastos;
- mantenimiento;
- utilidad.

Y compararse con las demás.

Esto permitirá responder:

> ¿Qué vehículo produce realmente más valor?

---

# 45. KPI Maestro: Utilidad por Ruta

Ejemplo:

| Ruta | Viajes | Ingresos | Costos | Utilidad |
|---|---:|---:|---:|---:|
| Cusco–Lima–Cusco | — | — | — | — |
| Cusco–Ilo–Cusco | — | — | — | — |
| Lima–Puerto Maldonado–Cusco | — | — | — | — |

Con datos suficientes, la empresa podrá identificar corredores estratégicos.

---

# 46. KPI Maestro: Utilidad por Cliente

Dos clientes que pagan el mismo flete pueden generar resultados diferentes.

Deben considerarse:

- tiempo de espera;
- ruta;
- cobranza;
- problemas;
- recurrencia.

Esto permitirá clasificar clientes no solo por facturación, sino por **valor real para R&T SITRAM SAC**.

---

# 47. Gestión de Riesgos Operativos

Cada riesgo relevante debe tener:

- indicador;
- responsable;
- respuesta.

## Combustible

Respuesta:
revisión de tarifa y consumo.

## Retorno vacío

Respuesta:
búsqueda anticipada.

## Falta de conductor

Respuesta:
bolsa de respaldo.

## Taller saturado

Respuesta:
proveedores alternativos.

## Cobranza

Respuesta:
alertas y límites de crédito.

## Bloqueos

Respuesta:
seguimiento de rutas y reprogramación.

---

# 48. Política de Excepciones

No todos los viajes seguirán siempre el flujo ideal.

Por ello, las excepciones deben permitirse, pero registrarse.

Ejemplo:

Un viaje poco rentable puede aceptarse porque:

- mantiene relación estratégica;
- posiciona una unidad;
- asegura retorno;
- abre un cliente importante.

La decisión debería quedar documentada.

---

# 49. Requisitos del Futuro Sistema Digital

La solución tecnológica futura debería reflejar este modelo.

## Módulo 1 — Inicio / Dashboard

Estado general de la operación.

## Módulo 2 — Viajes

Ciclo completo de transporte.

## Módulo 3 — Flota

Unidades, estados y documentación.

## Módulo 4 — Conductores

Personal operativo.

## Módulo 5 — Clientes

CRM básico.

## Módulo 6 — Combustible

Abastecimientos y rendimiento.

## Módulo 7 — Gastos y rendiciones

Control de adelantos.

## Módulo 8 — Mantenimiento

Preventivo y correctivo.

## Módulo 9 — Finanzas operativas

Ingresos, costos y utilidad.

## Módulo 10 — Cobranza

Facturas y saldos.

## Módulo 11 — Documentos

Archivos y vencimientos.

## Módulo 12 — Reportes

Indicadores y análisis.

---

# 50. Lo que WhatsApp debería seguir haciendo

WhatsApp puede continuar siendo útil para:

- comunicación;
- mensajes;
- fotos rápidas;
- avisos;
- coordinación.

Pero un mensaje importante debería transformarse en un registro.

Ejemplo:

Conductor envía fotografía de factura.

La información debería terminar asociada al:

**viaje + gasto + comprobante.**

---

# 51. Lo que Excel debería dejar de hacer progresivamente

Excel puede mantenerse durante la transición, pero no debería convertirse permanentemente en:

- base principal de viajes;
- sistema de mantenimiento;
- sistema de cobranza;
- base de documentos;
- historial completo.

A medida que se implante el sistema, Excel debería quedar principalmente para:

- análisis extraordinario;
- exportación;
- reportes específicos.

---

# 52. Integración GPS

La plataforma GPS existente no necesariamente debe reemplazarse.

La solución futura debería, cuando sea técnicamente posible, relacionar:

**unidad + viaje + ubicación.**

En una etapa avanzada podría utilizarse para:

- verificar llegada;
- duración;
- kilómetros;
- paradas;
- rutas.

---

# 53. Modelo de Datos Conceptual

Las entidades principales serían:

### Viaje

Se relaciona con:

### Unidad

### Conductor

### Cliente

### Ruta

### Carga

### Abastecimiento

### Gasto

### Adelanto

### Rendición

### Documento

### Mantenimiento

### Factura

### Pago

### Incidencia

Estas relaciones constituirán la base de la futura arquitectura tecnológica.

---

# 54. Reglas de Negocio Fundamentales

## Regla 1

Todo viaje debe tener código.

## Regla 2

Todo gasto debe pertenecer a un viaje o a un costo general.

## Regla 3

Todo combustible debe pertenecer a una unidad.

## Regla 4

Todo viaje debe tener conductor.

## Regla 5

Una unidad en mantenimiento no puede ser programada.

## Regla 6

Un conductor no disponible no puede ser asignado.

## Regla 7

Los documentos obligatorios deben estar vigentes antes de salida.

## Regla 8

Todo adelanto debe rendirse.

## Regla 9

Todo viaje debe cerrarse económica y operacionalmente.

## Regla 10

Todo ingreso pendiente debe tener una cuenta por cobrar.

---

# 55. Alertas Operativas Objetivo

El futuro sistema debería poder generar alertas como:

### Unidad
“X2Y756 lleva 4 días esperando carga.”

### Mantenimiento
“X3N-719 está a 800 km del próximo cambio.”

### Cobranza
“Factura F001-123 venció hace 7 días.”

### Documentación
“ITV de VDR-768 vence en 20 días.”

### Combustible
“Consumo 18% superior al promedio de esta unidad.”

### Rentabilidad
“Margen proyectado inferior al mínimo.”

---

# 56. Objetivos Operativos a 12 Meses

El modelo TO-BE debería permitir perseguir objetivos cuantificables.

Las metas numéricas definitivas deberán establecerse después de obtener una línea base.

Inicialmente se propone medir y posteriormente mejorar:

- utilización de flota;
- kilómetros vacíos;
- tiempo esperando carga;
- tiempo por mantenimiento;
- consumo;
- margen;
- cobranza;
- disponibilidad de conductores.

No es recomendable fijar porcentajes arbitrarios antes de conocer los datos reales de varios meses.

---

# 57. Fases de Implementación del Modelo

## Fase 0 — Preparación

Duración conceptual:
2–4 semanas.

Definir:

- categorías;
- responsables;
- códigos;
- reglas;
- formularios.

---

## Fase 1 — Estandarización

Implementar primero manualmente:

- ficha de viaje;
- estados;
- gastos;
- rendición;
- combustible;
- mantenimiento.

Objetivo:

Comprobar que el proceso funciona antes del software.

---

## Fase 2 — Registro Digital Central

Digitalizar:

- viajes;
- flota;
- conductores;
- gastos;
- combustible;
- mantenimiento;
- cobranza.

---

## Fase 3 — Indicadores

Construir:

- utilización;
- km vacíos;
- utilidad;
- consumo;
- mantenimiento;
- cobranza.

---

## Fase 4 — Automatización

Incorporar:

- alertas;
- vencimientos;
- cierres;
- cálculos;
- reportes.

---

## Fase 5 — Inteligencia Operativa

Con suficiente histórico:

- predicción de costos;
- comparación de rutas;
- tarifa recomendada;
- mantenimiento predictivo;
- detección de anomalías.

---

# 58. Transición AS-IS → TO-BE

## Actualmente

Información distribuida.

### Objetivo

Información centralizada.

---

## Actualmente

Evaluación principalmente por experiencia.

### Objetivo

Experiencia + datos + costeo.

---

## Actualmente

Mantenimiento parcialmente reactivo.

### Objetivo

Mantenimiento programado.

---

## Actualmente

Carga de retorno buscada en gran parte durante la operación.

### Objetivo

Retorno anticipado siempre que sea posible.

---

## Actualmente

Rentabilidad aproximada.

### Objetivo

Rentabilidad por viaje, unidad, ruta y cliente.

---

## Actualmente

Riesgos detectados cuando ocurren.

### Objetivo

Alertas anticipadas.

---

# 59. Organización Objetivo

Con tres unidades no se recomienda una estructura corporativa pesada.

La organización objetivo puede continuar siendo pequeña.

## Gerencia

Dirección y decisiones estratégicas.

## Administración Operativa

Centro de control diario.

## Conductores

Ejecución.

## Contabilidad externa

Cumplimiento y soporte financiero.

## Asesoría jurídica

Servicio externo según necesidad.

## Talleres

Red externa de mantenimiento.

La mejora principal no consiste en aumentar burocracia, sino en definir responsabilidades y información.

---

# 60. Centro de Control Operativo

Conceptualmente, la administración debería convertirse en un pequeño:

# Centro de Control R&T

Desde allí debería poder conocerse:

- ubicación;
- disponibilidad;
- carga;
- conductor;
- mantenimiento;
- costos;
- cobranza;
- próxima acción.

Este concepto debería guiar el diseño del futuro software.

---

# 61. Criterios para Comprar una Nueva Unidad

El crecimiento de flota no debería basarse únicamente en disponibilidad de capital.

Antes de adquirir otra unidad debería analizarse:

- utilización actual de las tres;
- demanda no atendida;
- disponibilidad de conductor;
- clientes;
- margen;
- costo financiero;
- mantenimiento;
- retorno estimado.

Pregunta crítica:

> ¿Necesitamos más unidades o necesitamos utilizar mejor las que ya tenemos?

El sistema futuro debería permitir responder esa pregunta con evidencia.

---

# 62. Preparación para Clientes Corporativos y Mineros

Para captar clientes de mayor escala, R&T SITRAM SAC deberá fortalecer progresivamente:

- documentación;
- seguros;
- seguridad;
- trazabilidad;
- mantenimiento;
- antecedentes;
- capacidad;
- seguimiento GPS;
- cumplimiento;
- reportes.

El modelo operativo objetivo crea precisamente la estructura necesaria para demostrar ese nivel de control.

---

# 63. Escenario Objetivo de un Viaje

Un viaje ideal futuro podría funcionar así:

### 08:00

Administración recibe solicitud.

### 08:10

Registra oportunidad.

### 08:15

Sistema estima costos.

### 08:20

Gerencia acepta tarifa.

### 08:25

Se asigna unidad.

### 08:30

Sistema verifica:

- conductor;
- documentos;
- mantenimiento.

### 09:00

Se genera viaje.

### Antes de salir

Se registra:

- kilometraje;
- combustible;
- adelanto;
- documentación.

### Durante viaje

Conductor registra incidencias y comprobantes.

### Antes de llegar

Administración ya trabaja en retorno.

### Descarga

Se confirma entrega.

### Retorno

Se vincula segunda carga al ciclo.

### Cusco

Se realiza rendición.

### Sistema

Calcula resultado.

### Administración

Factura.

### Cobranza

Se monitorea.

### Cierre

Viaje finalizado y disponible para análisis.

---

# 64. Resultado Esperado

Al aplicar este modelo, R&T SITRAM SAC debería evolucionar hacia una organización capaz de responder de manera rápida y confiable:

### Operación

¿Qué está ocurriendo?

### Finanzas

¿Cuánto estamos ganando?

### Productividad

¿Qué unidad produce más?

### Comercial

¿Qué cliente conviene más?

### Mantenimiento

¿Qué unidad requiere atención?

### Riesgo

¿Qué puede generar una parada?

### Crecimiento

¿Podemos incorporar otra unidad?

---

# 65. North Star Operativa

El indicador conceptual que resume gran parte del negocio podría expresarse como:

> **Maximizar la utilidad generada por cada unidad por día disponible, manteniendo seguridad, cumplimiento y confiabilidad operativa.**

Esto integra:

- utilización;
- tarifa;
- costos;
- mantenimiento;
- retorno;
- disponibilidad.

---

# 66. Conclusión

El modelo operativo objetivo de R&T SITRAM SAC debe transformar el negocio desde una operación funcional pero parcialmente fragmentada hacia una estructura integrada donde cada viaje pueda seguirse desde la oportunidad comercial hasta la cobranza final.

El cambio fundamental consiste en convertir la experiencia acumulada de la empresa en **procesos explícitos y medibles**.

R&T SITRAM SAC no necesita convertirse en una empresa burocrática.

Necesita convertirse en una empresa **observable**.

Es decir, una empresa donde en cualquier momento la administración pueda conocer:

> **qué está pasando, qué está costando, qué está produciendo, qué está fallando y qué debe hacerse después.**

Una vez implementado este modelo, la empresa tendrá una base mucho más sólida para:

- aumentar la flota;
- negociar contratos;
- trabajar con clientes corporativos;
- reducir tiempos muertos;
- controlar costos;
- proteger márgenes;
- adoptar automatización;
- incorporar inteligencia artificial.

---

# 67. Próxima Etapa Recomendada

Con este documento quedan construidas tres capas:

**1. Informe Contextual — qué es R&T SITRAM SAC.**

**2. Diagnóstico Operativo — qué problemas y brechas existen.**

**3. Modelo Operativo Objetivo — cómo debería funcionar.**

El siguiente paso debe ser convertir el modelo TO-BE en un:

# Blueprint Funcional del Sistema Digital

Ese documento deberá especificar exactamente:

- módulos;
- pantallas;
- usuarios;
- permisos;
- datos;
- flujos;
- estados;
- formularios;
- reglas;
- automatizaciones;
- alertas;
- dashboards;
- reportes;
- arquitectura funcional mínima.

Ese blueprint será el puente directo entre **el negocio** y **el futuro software de R&T SITRAM SAC**.