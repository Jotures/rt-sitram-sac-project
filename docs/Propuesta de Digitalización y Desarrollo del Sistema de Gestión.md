## R&T SITRAM SAC

---

> [!abstract] Ficha de la Propuesta
> **Proponente:** Josue R.
> **Destinatario:** Gerencia / Propietario — R&T SITRAM SAC
> **Proyecto:** Centro de Control Digital R&T SITRAM SAC
> **Fecha de elaboración:** Agosto 2026

---

## Carta de Presentación

Esta propuesta nace después de analizar con detalle cómo funciona R&T SITRAM SAC: cómo se consiguen las cargas, cómo se programan los viajes, cómo trabajan los conductores, cómo se controla el combustible, cómo se hacen las rendiciones, cómo se mantienen las unidades y cómo se cobra cada servicio.

El análisis que precede a esta propuesta no fue superficial. Se trabajó con información real del negocio y se elaboraron nueve documentos técnicos que van desde la comprensión del negocio hasta la arquitectura del sistema propuesto.

Este documento resume todo ese trabajo en un lenguaje claro, directo y pensado para que cualquier persona involucrada en la empresa pueda entender exactamente qué se propone hacer, por qué tiene sentido y cuánto costaría.

El documento está organizado en cuatro partes:

1. **Cómo funciona hoy el negocio** — para que exista un punto de partida común
2. **El diagnóstico** — los problemas reales que afectan la rentabilidad
3. **Cómo debería funcionar** — la visión de la operación ordenada y digitalizada
4. **La propuesta concreta** — el sistema, los módulos, el plan y la inversión

---

# PARTE I — Cómo Funciona Hoy el Negocio

> *Esta sección es importante porque una buena solución siempre parte de entender bien el problema. Todo lo que se propone más adelante está construido sobre esta comprensión.*

---

## 1. Qué es R&T SITRAM SAC

R&T SITRAM SAC es una empresa cusqueña de transporte terrestre de carga pesada, con más de una década de experiencia operando a nivel nacional desde su base en San Jerónimo, Cusco.

La empresa genera dinero de una manera muy concreta: **pone sus camiones en movimiento con carga de un cliente, lleva esa carga hasta su destino, y cobra un flete por ese servicio.**

Eso parece simple. Pero detrás de cada viaje hay una operación económica compleja que involucra combustible, conductores, peajes, documentos, mantenimiento, gastos imprevistos, búsqueda de carga de retorno y cobranza.

### La flota

| Unidad | Año | Capacidad aprox. |
| ------ | :-: | :--------------: |
| X2Y756 | 2014 | 32 toneladas |
| X3N-719 | 2015 | 32 toneladas |
| VDR-768 | 2025 | 32 toneladas |

Tres unidades. Tres conductores fijos. Dos personas en administración. Contabilidad y mantenimiento tercerizados.

> [!note] Una empresa pequeña en personas, compleja en operación
> R&T SITRAM tiene un equipo reducido, pero maneja activos de alto valor, dinero en carretera, múltiples documentos, varios clientes y una operación que no para. Esa combinación exige mucho control.

---

## 2. Cómo Funciona un Viaje

Todo comienza cuando aparece una carga. Esa carga puede llegar de un cliente habitual, una recomendación, un contacto o una oportunidad detectada en ruta.

Cuando aparece una carga, la empresa evalúa aproximadamente:

- ¿Cuánto paga el cliente?
- ¿Hacia dónde va?
- ¿Cuánto costará el combustible?
- ¿Qué otros gastos tendrá el viaje?
- ¿Hay posibilidad de conseguir carga de regreso?
- ¿El viaje parece dejar una utilidad razonable?

Esta evaluación no depende de una fórmula rígida. Depende de **la experiencia acumulada de años en el negocio** y del conocimiento práctico de costos y rutas. Eso tiene mucho valor. Pero también significa que gran parte de ese conocimiento vive en las personas y no está registrado de manera estructurada.

### El ciclo completo de un viaje

```
Aparece una carga disponible
          ↓
Se evalúa si conviene (flete, combustible, retorno)
          ↓
Se negocia y acepta
          ↓
Se asigna una unidad y un conductor
          ↓
Se preparan los documentos del viaje
          ↓
Se llena combustible para iniciar
          ↓
Se entrega adelanto de dinero al conductor
          ↓
La unidad sale de Cusco
          ↓
El conductor reporta gastos por WhatsApp
          ↓
La unidad llega al destino y descarga
          ↓
Se busca carga de retorno
     ┌────┴────┐
  Hay carga   No hay carga
     ↓            ↓
Nuevo flete   Espera 3-5 días
     └────┬────┘   (o retorno vacío)
          ↓
La unidad regresa a Cusco
          ↓
El conductor entrega comprobantes
          ↓
Administración hace la rendición de gastos
(Dinero entregado vs. gastos reales)
          ↓
Se determina saldo: ¿sobró? ¿faltó?
          ↓
Se factura y cobra al cliente
          ↓
Revisión de mantenimiento
          ↓
La unidad queda lista para el próximo viaje
```

---

## 3. La Economía del Viaje

El negocio de R&T SITRAM no debe evaluarse únicamente por el tramo de ida. **La verdadera economía aparece al ver el ciclo completo: ida + espera + retorno.**

### Caso real de referencia: Cusco → Lima → Cusco

**Ingresos del ciclo:**

| Concepto | Monto |
| -------- | -----: |
| Flete Cusco → Lima | S/ 3,200 |
| Flete Lima → Cusco | S/ 8,500 |
| Sobrecarga adicional | S/ 1,000 |
| **Total ingresos** | **S/ 12,700** |

**Costos directos del ciclo:**

| Concepto | Monto |
| -------- | -----: |
| Combustible inicial (salida de Cusco) | S/ 3,644 |
| Combustible de retorno (desde Lima) | S/ 2,930 |
| Combustible adicional en ruta | S/ 1,057 |
| Peajes, viáticos, garaje y otros | S/ 1,551 |
| **Total costos directos** | **S/ 9,182** |

> [!important] El combustible domina los costos
> En este ejemplo, el combustible representa el **83% de todos los costos directamente cuantificados del viaje** (S/ 7,631 de un total de S/ 9,182). Cualquier variación en el precio del diésel afecta directamente la rentabilidad. Si el cliente no acepta subir el flete cuando sube el combustible, el margen se comprime.

**Diferencia antes de otros costos:** S/ 12,700 − S/ 9,182 = **S/ 3,518**

De ese valor todavía deben descontarse: remuneración del conductor, mantenimiento, repuestos, neumáticos, seguros y costos administrativos.

La estimación de la empresa es que un viaje deja aproximadamente **S/ 2,500 de utilidad neta en promedio.**

---

## 4. Los Factores que Crean y Destruyen Valor

No todos los viajes dejan igual. Hay factores que hacen que un viaje sea muy rentable o que prácticamente no deje nada.

### Lo que crea valor en el negocio

Para que el negocio funcione bien necesitan coincidir al mismo tiempo:

```
✅ Unidad disponible y en buen estado
✅ Conductor disponible
✅ Buen flete negociado
✅ Ida cargada
✅ Retorno cargado (o ya confirmado antes de salir)
✅ Poca espera entre viajes
✅ Consumo de combustible controlado
✅ Sin averías en ruta
✅ Cobro rápido del cliente
```

Ese sería el "viaje ideal". Cada elemento que falta reduce la rentabilidad.

### Lo que destruye valor

> [!warning] Los principales destruyeres de rentabilidad
>
> 1. **Camión detenido** — El activo existe pero no produce, y algunos costos continúan
> 2. **Retorno vacío** — La unidad consume combustible, tiempo y desgaste sin generar ingreso
> 3. **Esperar días por carga de retorno** — En Lima pueden pasar 3 a 5 días de espera con gastos corriendo
> 4. **Aumento del combustible sin subida del flete** — El margen se comprime directamente
> 5. **Avería en ruta** — Reparación costosa + días perdidos + costo de oportunidad
> 6. **Taller indisponible** — Incluso identificada la falla, la espera puede ser de 3 a 5 días
> 7. **Falta de conductor** — Se han tenido unidades detenidas 20 días, un mes o más por esta causa
> 8. **Cliente que demora en pagar** — El viaje fue rentable en papel, pero la caja no lo ve todavía

---

## 5. Cómo Se Maneja la Información Hoy

La empresa ya genera información todos los días. El problema no es que no exista información. El problema es **dónde está esa información.**

| Herramienta | Qué contiene |
| ----------- | ------------ |
| **WhatsApp** | Reportes del conductor, fotos de facturas y boletas, gastos, incidencias |
| **Excel** | Algunos registros administrativos y contables |
| **GPS** | Ubicación de las unidades en tiempo real |
| **Facturas y boletas físicas** | Comprobantes de cada gasto del viaje |
| **Documentos físicos** | Guías de remisión, SOAT, ITV, contratos |
| **Memoria de las personas** | Criterios de decisión, historial de clientes, costos aproximados por ruta |

Ninguna de estas herramientas ve la operación completa. Para saber si un viaje fue rentable, hay que reunir manualmente información de varios lugares, calcular y recordar.

---

# PARTE II — El Diagnóstico: Qué Está Fallando

> *Esta sección identifica, con nombre y efecto económico, los problemas estructurales de la operación actual. No son opiniones; son observaciones derivadas del análisis detallado del negocio.*

---

## 6. Los Cuatro Problemas Estructurales

Después del análisis, los problemas más importantes pueden agruparse en cuatro categorías:

### Problema 1 — La información está fragmentada

Actualmente para responder una pregunta como "¿cuánto costó realmente el viaje de la semana pasada?" es necesario:

- Buscar en WhatsApp los mensajes del conductor
- Revisar el Excel con algunos gastos
- Recordar cuánto combustible se cargó y dónde
- Buscar comprobantes físicos
- Calcular manualmente

Eso funciona. Pero requiere tiempo, esfuerzo y depende de que una persona lo haga bien. Si esa persona falta o se equivoca, la información se pierde o se distorsiona.

> [!warning] Riesgo real
> Cuando el conocimiento del negocio vive principalmente en personas y no en sistemas, la empresa es vulnerable. Si una persona clave falta, parte del control del negocio también falta.

---

### Problema 2 — No se sabe con precisión cuánto deja cada viaje

La empresa tiene una estimación de utilidad promedio (S/ 2,500 por viaje), pero no tiene un sistema que calcule eso de forma automática y consistente para cada operación.

Hay cuatro niveles de rentabilidad que actualmente se confunden:

| Nivel | Qué es |
| ----- | ------ |
| **Nivel 1 — Ingreso bruto** | Todo lo facturado al cliente |
| **Nivel 2 — Margen del viaje** | Ingreso menos gastos directos del viaje |
| **Nivel 3 — Margen operativo** | Nivel 2 menos costos de la unidad (mantenimiento, desgaste) |
| **Nivel 4 — Utilidad neta** | Nivel 3 menos costos generales (administración, contabilidad, etc.) |

Sin separar esos cuatro niveles, puede parecer que un viaje dejó buena utilidad cuando en realidad el margen fue muy pequeño.

---

### Problema 3 — La flota no siempre produce cuando debería

Una unidad puede estar técnicamente disponible y aun así no estar generando ingresos. Puede estar parada por:

- Falta de conductor (casos documentados de 20 días, un mes o más)
- Esperando carga de retorno en Lima (3 a 5 días)
- Esperando disponibilidad del taller (3 a 5 días)
- Avería o reparación
- Bloqueos en ruta

La capacidad productiva real de la empresa no depende solo del número de camiones. Depende de que coincidan al mismo tiempo: **unidad disponible × conductor disponible × carga disponible × ruta operable.**

Si cualquiera de esos elementos falla, la capacidad cae.

> [!important] El indicador más importante que no se mide hoy
> **Utilización de flota = días que cada unidad genera ingresos ÷ días disponibles × 100**
>
> Sin este dato, no es posible saber si vale la pena comprar una cuarta unidad. Una cuarta unidad que tenga el mismo porcentaje de días improductivos no resuelve el problema; lo multiplica.

---

### Problema 4 — La operación comercial depende demasiado del momento

Actualmente los clientes llegan principalmente por recomendaciones. No existe un proceso comercial estructurado. La carga de retorno se busca después de llegar al destino, no antes de salir.

Eso genera:
- Incertidumbre sobre el retorno
- Esperas que reducen la rentabilidad del ciclo
- Dependencia de intermediarios para la carga Lima → Cusco

---

## 7. Resumen del Diagnóstico

| Área | Nivel actual | Impacto en rentabilidad |
| ---- | :-----------: | :---------------------: |
| Control de viajes | Básico | Alto |
| Costeo por viaje | Reactivo | Muy alto |
| Utilización de flota | Sin medición | Muy alto |
| Control de combustible | Parcial | Alto |
| Rendiciones y gastos | Manual | Medio-Alto |
| Mantenimiento | Reactivo/parcial | Alto |
| Gestión de cobranza | Básica | Medio |
| Gestión de clientes | Relacional | Medio |
| Control documental | Disperso | Medio |
| Indicadores gerenciales | Ninguno | Alto |

> [!note] El negocio no está desorganizado; está desconectado
> R&T SITRAM tiene años de experiencia, documentos, rendiciones, GPS y registros. El problema no es ausencia de información. Es que esa información está distribuida en lugares distintos y no se comunica entre sí.

---

# PARTE III — Cómo Debería Funcionar

> *Esta sección describe el estado futuro deseado: cómo debería operar R&T SITRAM SAC con una gestión ordenada, medible y digitalizada. No se trata de cambiar lo que funciona; se trata de conectar y registrar lo que ya ocurre.*

---

## 8. La Visión del Modelo Operativo Objetivo

El objetivo no es burocratizar el negocio ni llenarlo de trámites digitales.

El objetivo es que la empresa pueda responder permanentemente cinco preguntas sin tener que buscar, preguntar o calcular manualmente:

> [!tip] Las cinco preguntas que el negocio debe responder siempre
> 1. **¿Dónde está cada unidad y qué está haciendo?**
> 2. **¿Qué actividad está realizando?**
> 3. **¿Cuánto está costando en este momento?**
> 4. **¿Cuánto ingreso está generando?**
> 5. **¿Cuál es la siguiente acción que debe ejecutarse?**

Para que eso sea posible, es necesario transformar la forma en que se registra, organiza y consulta la información.

---

## 9. Los Ocho Principios del Modelo Futuro

### Principio 1 — Un viaje = una unidad de control

Cada viaje debe existir como un registro independiente desde que aparece la oportunidad comercial hasta que se cobra completamente. Todo lo relacionado con ese viaje — combustible, gastos, conductor, cliente, documentos, cobranza — debe estar vinculado al mismo registro.

### Principio 2 — Una sola fuente de verdad

La información no debe existir en versiones distintas en WhatsApp, Excel y la memoria de las personas. Debe haber un registro central. WhatsApp puede seguir siendo una herramienta de comunicación, pero no el repositorio de la información del negocio.

### Principio 3 — Registrar una sola vez

Si una unidad está asignada a un viaje, sus datos deben aparecer automáticamente en el control de combustible, en los documentos, en la rendición y en el análisis financiero. No hay que escribir lo mismo dos veces.

### Principio 4 — Evaluación previa antes de aceptar una carga

Antes de confirmar cada viaje, debe realizarse una estimación rápida:

```
Ingreso esperado − Costo estimado − Riesgo de retorno = Decisión
```

Ningún viaje con margen proyectado inferior al mínimo definido debería aprobarse sin autorización explícita.

### Principio 5 — Gestión por excepciones

La administración no debería revisar manualmente todo. El sistema debe alertar cuando algo sale de lo esperado:

- Gasto excesivo
- Unidad detenida más de X días
- Documento por vencer
- Mantenimiento pendiente
- Consumo anormal de combustible
- Factura vencida sin cobrar

### Principio 6 — Rentabilidad por ciclo completo

Un viaje de ida no puede evaluarse de forma aislada si existe operación de retorno. La unidad económica debe ser siempre el **ciclo completo**: ida + espera + retorno + todos los gastos asociados.

### Principio 7 — Trazabilidad completa

Toda operación relevante debe poder responder: ¿quién la registró? ¿cuándo? ¿para qué unidad? ¿para qué viaje? ¿por qué monto? ¿con qué comprobante?

### Principio 8 — Escalabilidad

Los procesos que funcionan con tres unidades deben funcionar también con cinco, diez o veinte. Sin depender de que una persona recuerde cómo funciona cada caso.

---

## 10. Cómo Debería Verse un Viaje en el Futuro

En el modelo futuro, cada viaje tiene un código único (por ejemplo: **RT-2026-000145**) y ese código acompaña toda la operación de principio a fin.

### Estados del viaje

```
OPORTUNIDAD → EVALUACIÓN → APROBADO → PROGRAMADO
     ↓
EN CARGA → EN TRÁNSITO → EN DESCARGA
     ↓
ESPERANDO RETORNO → RETORNO PROGRAMADO → EN RETORNO
     ↓
RENDICIÓN PENDIENTE → COBRANZA PENDIENTE → CERRADO
```

En ningún momento de ese ciclo la información debe perderse. Todo queda vinculado al mismo registro.

---

## 11. Qué Debería Saber la Empresa Cada Día

### Cada mañana (operativo)

- Dónde está cada unidad
- Qué está haciendo y con qué carga
- Si alguna unidad tiene un problema
- Qué viajes salen o llegan hoy
- Qué viene después

### Cada semana

- Viajes completados y en curso
- Unidades detenidas y por qué causa
- Cobranzas pendientes
- Mantenimientos que se aproximan

### Cada mes

- Ingresos totales y por viaje
- Costos totales y por viaje
- Utilidad por unidad y por ruta
- Utilización de flota
- Kilómetros vacíos vs. cargados
- Rentabilidad por cliente

---

## 12. La Transformación que se Propone

La empresa debe evolucionar de:

```
HOY
Experiencia + WhatsApp + Excel + GPS + Documentos dispersos
```

hacia:

```
MAÑANA
Experiencia + Sistema central + Procesos + Datos + Indicadores
```

La experiencia no desaparece. **Se fortalece con datos.**

---

# PARTE IV — La Propuesta Concreta

> *Esta es la parte más práctica del documento: qué se va a construir, cómo va a funcionar, en qué orden se desarrollará y cuánto costará.*

---

## 13. Qué Se Propone Construir

Se propone desarrollar el **Centro de Control Digital R&T SITRAM SAC**: una plataforma diseñada específicamente para este negocio, accesible desde computadora para administración y gerencia, y desde el celular para conductores.

> [!tip] Una plataforma hecha a medida
> No es un software genérico de gestión empresarial. Es un sistema construido exactamente alrededor de cómo opera R&T SITRAM SAC: sus rutas, sus conductores, sus ciclos de viaje, sus formas de rendir gastos y sus necesidades de control.

---

## 14. Los Módulos del Sistema

### 🗺️ Módulo 1 — Operaciones y Viajes

El corazón del sistema. Desde aquí se gestiona cada viaje de principio a fin.

**¿Qué permite hacer?**
- Registrar una nueva oportunidad de carga con el cliente, ruta, toneladas y flete propuesto
- Calcular una estimación rápida de rentabilidad antes de aceptar
- Asignar unidad y conductor al viaje aprobado
- Seguir el estado del viaje en tiempo real (Programado → En tránsito → En retorno → Cerrado)
- Registrar kilometraje de salida y llegada
- Cerrar económicamente el viaje vinculando todos los gastos, el flete cobrado y la utilidad calculada

**¿Qué responde?**
> Cuántos viajes están activos ahora mismo, qué unidad los opera, en qué estado están y cuánto llevan gastado.

---

### 🚛 Módulo 2 — Flota

Control completo de las tres unidades (y las que se sumen después).

**¿Qué permite hacer?**
- Ver el estado actual de cada unidad: *Operando*, *En mantenimiento*, *Esperando carga*, *Sin conductor*, *Disponible*
- Consultar el historial completo de viajes por unidad
- Registrar y controlar documentos vehiculares con alertas de vencimiento (SOAT, ITV, tarjeta de transporte)
- Medir el indicador de utilización: días productivos vs. días detenidos y por qué causa

**¿Qué responde?**
> ¿Cuántos días trabajó realmente cada camión este mes? ¿Cuántos días estuvo parado y por qué?

---

### 👷 Módulo 3 — Conductores

Control del personal que opera las unidades.

**¿Qué permite hacer?**
- Registrar el perfil completo de cada conductor con su documentación
- Ver los viajes asignados y el historial
- Controlar vencimiento de documentos (licencia, SCTR) con alertas automáticas
- Mantener una base de conductores suplentes disponibles
- Consultar el historial de consumo y gastos de cada conductor

**¿Qué responde?**
> ¿Qué conductor está disponible? ¿Quién tiene documentos próximos a vencer? ¿Qué histórico tiene cada uno?

---

### ⛽ Módulo 4 — Combustible

El costo más grande del negocio, controlado en detalle.

| Campo registrado | Para qué sirve |
| ---------------- | -------------- |
| Unidad | Saber qué camión se abasteció |
| Viaje asociado | Vincular el costo al viaje correcto |
| Kilometraje al momento del llenado | Calcular consumo exacto |
| Cantidad (litros/galones) | Medir consumo real |
| Precio por litro/galón | Detectar variaciones del mercado |
| Monto total pagado | Costear el viaje |
| Grifo / proveedor | Historial de proveedores |
| Foto del comprobante | Sustento del gasto |

**¿Qué responde?**
> ¿Cuánto consume cada unidad por kilómetro? ¿Está consumiendo más de lo normal? ¿Cuánto costó el combustible de este viaje?

---

### 💰 Módulo 5 — Gastos, Adelantos y Rendiciones

El flujo completo del dinero operativo de cada viaje.

**El flujo que digitaliza:**

```
Empresa entrega adelanto al conductor antes del viaje
          ↓
Conductor registra cada gasto desde su celular
(peajes, alimentación, garaje, reparaciones)
          ↓
Adjunta fotos de cada comprobante
          ↓
Al regresar: Administración revisa la rendición en el sistema
          ↓
El sistema calcula automáticamente:
     Adelanto entregado − Gastos registrados = Saldo
          ↓
Se determina si el conductor debe devolver o recibir diferencia
          ↓
Rendición aprobada → Viaje cerrado económicamente
```

**¿Qué responde?**
> ¿Cuánto se entregó? ¿Cuánto se gastó? ¿Qué queda pendiente de rendir? ¿Cuánto costó realmente este viaje?

---

### 🔧 Módulo 6 — Mantenimiento

Pasar de mantenimiento correctivo (esperar que algo falle) a mantenimiento preventivo (anticipar antes de que ocurra).

**¿Qué permite hacer?**
- Registrar cada intervención: cambio de aceite, reparación, repuesto, taller, costo
- Programar el próximo mantenimiento por kilometraje o fecha
- Recibir alertas cuando una unidad está próxima al siguiente mantenimiento
- Consultar el historial completo de costos de mantenimiento por unidad
- Registrar tiempo fuera de servicio y causa

**¿Qué responde?**
> ¿Cuándo corresponde el próximo mantenimiento? ¿Cuánto ha costado mantener cada unidad este año? ¿Qué unidad tiene más días fuera de servicio?

---

### 🤝 Módulo 7 — Clientes

Gestión de la cartera comercial de la empresa.

**¿Qué permite hacer?**
- Registrar cada cliente con sus datos de contacto y condiciones comerciales
- Ver el historial completo de viajes realizados para ese cliente
- Consultar las tarifas históricas negociadas
- Hacer seguimiento de la puntualidad de pago
- Evaluar la rentabilidad generada por cada cliente

**¿Qué responde?**
> ¿Qué cliente genera más utilidad? ¿Quién paga más rápido? ¿Con quién conviene trabajar más?

---

### 📄 Módulo 8 — Documentos

Repositorio digital centralizado con alertas automáticas.

| Tipo de documento | Ejemplos |
| ----------------- | -------- |
| **Vehicular** | SOAT, ITV, Tarjeta de transporte de mercancías |
| **Personal (conductor)** | Licencia de conducir, SCTR |
| **Empresarial** | Constitución, habilitaciones, contratos |
| **De viaje** | Guías de remisión, facturas, comprobantes |

El sistema advierte con anticipación cuando algún documento está próximo a vencer. Nunca más una unidad detenida por un documento vencido.

---

### 💳 Módulo 9 — Cobranza

Control de lo que los clientes deben pagar.

**¿Qué permite hacer?**
- Registrar cada factura asociada a un viaje
- Registrar los pagos recibidos
- Calcular el saldo pendiente por cliente
- Ver la antigüedad de cada factura
- Recibir alertas de facturas vencidas

**¿Qué responde?**

> [!note] La pregunta más importante de cobranza
> **¿Cuánto dinero le debe hoy cada cliente a R&T SITRAM SAC?**
> Con el sistema, esa respuesta está disponible en segundos.

---

### 📊 Módulo 10 — Dashboard y Rentabilidad (Vista Gerencial)

La pantalla más importante para la gerencia: todo el negocio en un solo lugar.

**Indicadores en tiempo real:**

| KPI | Qué mide |
| --- | -------- |
| Estado de las tres unidades | Activa / Detenida / En mantenimiento |
| Viajes activos | Con su estado actual |
| Utilización de flota (%) | Días productivos ÷ días disponibles |
| Rentabilidad del mes | Ingresos − Costos totales |
| Kilómetros vacíos vs. cargados | Eficiencia de retorno |
| Combustible consumido / km | Por unidad |
| Cobranza pendiente total | Saldo por cobrar |
| Mantenimientos próximos | Alertas preventivas |
| Días detenida por unidad | Con causa |

**Reportes disponibles:**
- Rentabilidad por viaje
- Rentabilidad por unidad
- Rentabilidad por ruta
- Rentabilidad por cliente
- Consumo de combustible histórico
- Comparativo mensual de ingresos y costos

---

## 15. Una Característica Crítica: Funciona Sin Internet

Los conductores viajan por carreteras de sierra donde la señal es mala o inexistente. El sistema no puede depender de una conexión permanente.

> [!important] Diseño Offline-First
> El sistema está diseñado para que un conductor pueda registrar gastos, combustible, kilometraje, incidencias y tomar fotos de comprobantes **aunque no tenga señal en carretera.**
>
> La información se guarda en el celular. Cuando vuelve la conexión, se sincroniza automáticamente con el servidor. **Nada se pierde.**

Esto no es un detalle técnico menor. Es un requisito fundamental para que el sistema funcione en la realidad del transporte peruano.

---

## 16. Quiénes Usan el Sistema y Cómo

| Perfil | Dispositivo | Qué puede hacer |
| ------ | :---------: | --------------- |
| **Gerencia** | PC / celular | Ver dashboard completo, rentabilidad, reportes, aprobar decisiones importantes |
| **Administración** | PC | Gestión completa: viajes, gastos, rendiciones, cobranza, mantenimiento, documentos |
| **Conductor** | Celular (app) | Ver su viaje asignado, registrar gastos, combustible, fotos, incidencias, confirmar llegadas |
| **Contabilidad** | PC (solo lectura) | Consultar ingresos, gastos, facturas, exportar información |

La interfaz del conductor está diseñada para ser muy simple: pocos botones, pantallas claras, pensada para usarse en carretera con una sola mano.

---

## 17. La Arquitectura Técnica (Explicada Sin Tecnicismos)

El sistema se construirá con tecnologías modernas, probadas y de bajo costo:

**Para la web (administración y gerencia):** Una aplicación web que funciona en cualquier navegador, desde cualquier computadora o celular con internet.

**Para los conductores:** Una aplicación instalable en el celular Android, que funciona como cualquier app pero sin necesidad de la tienda de apps.

**Para guardar la información:** Una base de datos profesional en la nube, con copias de seguridad automáticas.

**Para funcionar sin internet:** Cada celular de conductor tiene su propia copia local de la información del viaje. Cuando hay señal, se sincroniza automáticamente.

> [!abstract] Stack tecnológico seleccionado
> - **Interfaz:** React + TypeScript (web + app conductores)
> - **Base de datos en la nube:** PostgreSQL / Supabase
> - **Funcionamiento sin internet:** PowerSync + SQLite local
> - **Almacenamiento de fotos:** Supabase Storage
> - **Autenticación y seguridad:** Supabase Auth

Este stack no es el más costoso del mercado. Es el más adecuado para el tamaño y las necesidades de R&T SITRAM SAC.

---

## 18. Plan de Desarrollo por Etapas

El proyecto se construye de forma incremental. Ninguna etapa avanzada comienza antes de que la etapa anterior funcione correctamente en condiciones reales.

> [!tip] El principio rector del desarrollo
> Primero se valida que todo funciona bien. Después se construye la siguiente capa. Así se minimiza el riesgo de invertir en algo que no funciona.

### Las etapas del proyecto

| Etapa | Nombre | Qué se construye |
| :---: | ------ | ---------------- |
| **0** | Preparación | Entornos, repositorio, convenciones técnicas |
| **1** | Spike técnico | Validar que offline + sincronización funciona en carretera real |
| **2** | Fundación | Usuarios, seguridad, unidades, conductores, clientes |
| **3** | Viajes | Ciclo completo: programación, estados, asignación, cierre |
| **4** | Dinero del viaje | Combustible, adelantos, gastos, fotos de comprobantes |
| **5** | Rendiciones | Conciliación, revisión y cierre económico del viaje |
| **6** | Flota y documentos | Mantenimiento, alertas de vencimiento, incidencias |
| **7** | Cobranza | Facturas, pagos recibidos, saldos por cobrar |
| **8** | Dashboard | Rentabilidad, KPIs, reportes gerenciales |
| **9** | Piloto | Prueba real con 1 unidad y 1 conductor |
| **10** | Rollout completo | Incorporación de las 3 unidades y ajuste final |

### La Etapa 1 (Spike técnico) es la más importante

Antes de construir cualquier módulo del negocio, se valida que el sistema puede funcionar sin internet. La prueba es esta:

```
1. El conductor inicia sesión con internet
2. Descarga los datos de su viaje
3. Activa modo avión (sin señal)
4. Registra un gasto y toma foto del comprobante
5. Cierra la aplicación
6. Vuelve a abrir el celular
7. ¿El gasto sigue ahí? → SI = continuar
8. Recupera señal
9. ¿El gasto llega al servidor? → SI = la base técnica es sólida
```

Solo si esa prueba pasa, se construye todo lo demás.

---

## 19. Qué NO Incluye la Primera Versión

Para mantener el alcance controlado y dentro del presupuesto acordado, la primera versión no incluye:

- Inteligencia artificial ni predicciones automáticas
- Integración automática con bancos
- Emisión de facturas electrónicas (SUNAT)
- Lectura automática de comprobantes (OCR)
- Optimización automática de rutas
- Portal web para que los clientes vean sus pedidos
- Aplicación nativa para iPhone (iOS)

Estas funciones pueden incorporarse en versiones futuras cuando el sistema base esté funcionando bien y la empresa quiera dar el siguiente paso.

---

## 20. Lo que Recibiría R&T SITRAM SAC

Este proyecto no es solo programación. Incluye todo el trabajo que antecede y rodea al código:

| # | Entregable | Descripción |
| :- | ---------- | ----------- |
| 1 | Análisis completo del negocio | Comprensión documentada de toda la operación |
| 2 | Diagnóstico operativo | Brechas, riesgos y prioridades identificadas |
| 3 | Modelo operativo TO-BE | Cómo debería funcionar la empresa digitalizada |
| 4 | Blueprint funcional | Todos los módulos y procesos definidos |
| 5 | Arquitectura de información | Estructura de datos y relaciones |
| 6 | Diseño UX/UI | Cómo se verá y se usará el sistema |
| 7 | Arquitectura técnica | Decisiones de diseño del sistema |
| 8 | Sistema web desarrollado | La plataforma de administración y gerencia |
| 9 | Aplicación móvil para conductores | Interfaz simple para usar en carretera |
| 10 | Funcionamiento offline | Registro sin internet + sincronización automática |
| 11 | Base de datos configurada | Con la estructura del negocio de R&T SITRAM |
| 12 | Pruebas funcionales | Validación de los procesos principales |
| 13 | Piloto productivo | Implementación real con 1 unidad y 1 conductor |
| 14 | Rollout completo | Incorporación de las 3 unidades |
| 15 | Capacitación básica | Explicación a administración, gerencia y conductores |

---

## 21. Implementación Sin Riesgo para la Operación

> [!important] No se abandona el método actual de golpe
> La implementación comienza con una sola unidad. La operación de las otras dos continúa exactamente igual que siempre mientras se valida el sistema.

**Estrategia de implementación:**

```
SEMANA PILOTO
    1 unidad + 1 conductor + Administración
              ↓
    Se registra un viaje completo en el sistema
              ↓
    Se detectan problemas y ajustes necesarios
              ↓
    Se corrige
              ↓
SEGUNDA UNIDAD se incorpora
              ↓
TERCERA UNIDAD se incorpora
              ↓
Operación completa digitalizada
```

De esta manera, si algo no funciona bien en el piloto, no afecta las otras unidades. El riesgo operativo es mínimo.

---

## 22. Beneficios Concretos para la Empresa

### En el corto plazo (los primeros meses)

- Saber en tiempo real qué está haciendo cada unidad
- Tener todas las rendiciones de gastos en un solo lugar
- No perder más comprobantes en mensajes de WhatsApp
- Recibir alertas antes de que venza un documento
- Calcular automáticamente cuánto costó cada viaje

### En el mediano plazo (6 a 12 meses)

- Conocer con precisión la rentabilidad de cada viaje, ruta y cliente
- Medir la utilización real de la flota y reducir días improductivos
- Anticipar mantenimientos antes de que se conviertan en averías costosas
- Tener datos históricos para negociar mejores tarifas

### En el largo plazo

- Una operación digitalizada y documentada es un requisito para acceder a contratos con **empresas grandes y compañías mineras**
- El sistema escala con la empresa: si mañana son 5 o 10 unidades, no hay que empezar de cero
- La información histórica permite tomar mejores decisiones sobre inversiones, rutas y crecimiento

---

## 23. La Inversión

### Monto propuesto

> [!important] Inversión total del proyecto
> **S/ 2,300** — por el análisis, diseño, desarrollo, pruebas e implementación completa del sistema descrito en esta propuesta.
>
> Considerando la relación familiar y el contexto del proyecto, el **monto mínimo negociable es S/ 2,000**.
>
> Por debajo de ese monto el trabajo necesario para desarrollar el sistema con el nivel de cuidado que requiere no quedaría adecuadamente compensado.

### Forma de pago propuesta

| Hito | % | Monto | Condición de cobro |
| ---- | :-: | :---: | ------------------ |
| **Inicio** | 40% | S/ 920 | Aprobación de la propuesta e inicio del desarrollo |
| **Primera versión funcional** | 30% | S/ 690 | Sistema con viajes, unidades, conductores, gastos y combustible operativos |
| **Entrega final** | 30% | S/ 690 | MVP completo funcionando y listo para el piloto |

*Si una forma de pago diferente resulta más conveniente para la empresa, puede conversarse y acordarse.*

---

## 24. Costos de Infraestructura (Independientes del Desarrollo)

El monto propuesto cubre el trabajo de diseño y construcción. Para que el sistema funcione en producción se necesitan servicios externos. La prioridad es usar opciones gratuitas o de muy bajo costo:

| Servicio | Costo estimado | Nota |
| -------- | :-----------: | ---- |
| Base de datos (Supabase) | Gratis (plan Free) | El plan gratuito es suficiente para empezar |
| Sincronización offline (PowerSync) | Plan gratuito disponible | Revisar según uso real |
| Dominio web | ~S/ 60–80 / año | Opcional en etapa inicial |

Cualquier servicio que tenga costo será informado y aprobado antes de contratarse.

---

## 25. Propiedad del Sistema y los Datos

> [!note] Los datos son de R&T SITRAM SAC
> Todo lo que se registre en el sistema — viajes, clientes, gastos, conductores, documentos, históricos — es **propiedad exclusiva de R&T SITRAM SAC**.
>
> La empresa tendrá siempre acceso a su propia información, independientemente de cualquier decisión tecnológica o comercial futura. La información no queda atrapada en el sistema.

---

## 26. Lo que Necesito de la Empresa

El sistema más bien diseñado no funciona si las personas que lo operan no participan en su validación. Necesito:

- Confirmar que los procesos diseñados representan la realidad del negocio
- Proporcionar información para configurar el sistema (clientes, rutas típicas, etc.)
- Disponer de un conductor para las pruebas del piloto
- Informar cuando algo no represente correctamente cómo se trabaja
- Usar el sistema durante el piloto y reportar cualquier problema

---

## 27. Mi Compromiso

Mi compromiso es construir un sistema que **realmente sirva al negocio**, no simplemente entregar pantallas que se vean bien pero no se usen.

Eso implica:

- Escuchar cómo se trabaja realmente y adaptar el diseño a esa realidad
- Probar los procesos principales antes de declararlos terminados
- Corregir problemas importantes que aparezcan en el piloto
- Mantener el sistema tan simple como sea posible
- No construir funciones que no aporten valor real a la operación

---

## 28. Propuesta Final y Resumen

R&T SITRAM SAC ya sabe transportar carga. Tiene experiencia, unidades, conductores y clientes. Lo que propongo no es cambiar lo que funciona; es tomar todo ese conocimiento acumulado y convertirlo en un sistema que permita trabajar con más orden, control y capacidad de análisis.

> [!success] El objetivo del proyecto en una sola frase
> **Digitalizar y conectar la operación de R&T SITRAM SAC para saber con claridad qué hacen los camiones, cuánto cuestan, cuánto producen y dónde se puede mejorar.**

### Resumen completo de la propuesta

| Ítem | Detalle |
| ---- | ------- |
| **Producto** | Centro de Control Digital R&T SITRAM SAC |
| **Tipo** | Sistema hecho a medida para este negocio |
| **Plataformas** | Web (administración/gerencia) + App móvil (conductores) |
| **Funciona sin internet** | Sí — offline-first para conductores en carretera |
| **Módulos principales** | Viajes · Flota · Conductores · Combustible · Gastos · Rendiciones · Mantenimiento · Documentos · Cobranza · Dashboard |
| **Escalable** | Sí — funciona con 3, 5 o 10 unidades sin rediseño |
| **Piloto** | Primero 1 unidad, después se incorporan las demás |
| **Propiedad de los datos** | 100% R&T SITRAM SAC |
| **Inversión propuesta** | **S/ 2,300** |
| **Mínimo negociable** | **S/ 2,000** |
| **Forma de pago** | Tres hitos: 40% inicio / 30% primera versión / 30% entrega |
| **Infraestructura mensual** | Gratis en etapa inicial (plan Free de Supabase y PowerSync) |

---

*Propuesta elaborada por Josue R. con base en el análisis detallado del funcionamiento operativo, financiero y comercial de R&T SITRAM SAC — Agosto 2026*

*Documentación de respaldo disponible: Informe Contextual · Diagnóstico Operativo · Modelo TO-BE · Blueprint Funcional · Arquitectura de Información · Especificación UX/UI · Arquitectura Técnica · Plan Maestro de Implementación · Síntesis de Comprensión del Negocio*