# R&T_SITRAM_Documento_Maestro_Analisis_y_Vision_V2    
## Centro de Control Digital / R&T Control Tower — R&T SITRAM SAC

**Fecha:** 16 de agosto de 2026  
**Proyecto:** R&T SITRAM SAC  
**Repositorio:** `Jotures/rt-sitram-sac-project`  
**Propósito de este documento:** consolidar la comprensión, análisis, decisiones, alternativas, ideas, riesgos y visión de evolución discutidos durante este hilo sobre el sistema digital de R&T SITRAM SAC, incorporando además la investigación posterior sobre mapa operativo, Google Maps/MapLibre, Goldcar/Wialon, rutas, geocercas, ETA, PostGIS y telemetría.

**Versión:** 2.0 — ampliada con la capa geoespacial y de Control Tower.

---

# 1. Resumen ejecutivo

El proyecto de R&T SITRAM SAC no debe entenderse solamente como una aplicación para reemplazar Excel, WhatsApp o registros manuales.

La visión que surgió durante el análisis es más amplia:

> **Construir un Centro de Control Digital que represente la operación real de R&T, conecte viajes, unidades, conductores, dinero, documentos, GPS, mantenimiento, cobranza y rentabilidad, y que evolucione progresivamente hacia un sistema de apoyo a decisiones.**

La arquitectura actualmente planteada es coherente con esa visión:

- PWA como cliente principal.
- React + TypeScript + Vite.
- Supabase/PostgreSQL como backend.
- PowerSync + SQLite para funcionamiento local-first/offline-first.
- Supabase Auth.
- Storage privado.
- Edge Functions para integraciones externas y secretos.
- Monolito modular.
- `VIAJE` como entidad operativa central.

La conclusión principal del análisis no fue que el proyecto necesite un rediseño completo.

Al contrario:

> **La arquitectura de destino está bien planteada. Lo que más debe cuidarse es la estrategia de ejecución y el control del alcance.**

El principal riesgo no es React, Supabase, PowerSync, Goldcar u OCR.

El principal riesgo es:

> **scope creep: intentar construir un TMS completo antes de que la empresa obtenga valor operativo real.**

Por ello, la recomendación es construir verticalmente y validar primero un viaje completo de extremo a extremo.

---

# 2. Estado real actual del proyecto

Durante el hilo se revisó el repositorio público:

`Jotures/rt-sitram-sac-project`

La estructura confirma que el proyecto ya está organizado como un monorepo con `pnpm`.

Estructura conceptual actual:

```text
rt-sitram-sac-project/
│
├── docs/
│   ├── contexto del negocio
│   ├── diagnóstico
│   ├── modelo TO-BE
│   ├── blueprint funcional
│   ├── arquitectura de información
│   ├── UX/UI
│   ├── arquitectura técnica
│   ├── plan maestro
│   ├── síntesis
│   ├── decisiones
│   ├── auditorías
│   └── sesiones
│
└── implementation/
    ├── apps/
    │   └── web/
    ├── packages/
    ├── supabase/
    ├── powersync/
    ├── tests/
    ├── package.json
    └── pnpm-workspace.yaml
```

## 2.1. Stack ya fijado

La implementación actual utiliza o contempla:

```text
Frontend
React
TypeScript
Vite

Backend
Supabase
PostgreSQL

Auth
Supabase Auth

Offline
PowerSync
SQLite

Archivos
Supabase Storage

Server-side
PostgreSQL Functions / RPC
Supabase Edge Functions
```

## 2.2. Estado de desarrollo

El código se encuentra todavía en la etapa de **Technical Spike**.

La interfaz actual valida principalmente:

- shell PWA;
- estado de red;
- configuración de Supabase;
- autenticación base.

Todavía no existen las funcionalidades empresariales completas.

La migración de base de datos existente corresponde a datos experimentales de spike y no representa todavía el contrato de dominio final.

El último estado registrado del proyecto señala como bloqueo:

- falta de Docker/daemon local disponible para validar Supabase local;
- pendiente validar Auth y RLS en ejecución;
- después de eso, continuar con PowerSync + SQLite.

Por tanto, el proyecto todavía se encuentra en un punto ideal para ajustar estrategia sin necesidad de rehacer una gran cantidad de código.

---

# 3. Opinión general sobre el proyecto

La valoración general es positiva.

El proyecto tiene varios elementos que normalmente se definen mucho más tarde:

- comprensión profunda del negocio;
- arquitectura funcional;
- modelo de datos;
- arquitectura técnica;
- decisiones explícitas;
- principios offline-first;
- separación entre dominio, aplicación, datos e interfaz;
- estrategia de sincronización;
- seguridad y RLS;
- trazabilidad;
- visión de evolución.

Esto es una ventaja.

Sin embargo, también genera un riesgo:

> tener una arquitectura muy madura antes de haber cerrado todavía un viaje real dentro del sistema.

Por eso, la recomendación es conservar la arquitectura de destino pero simplificar la implementación inicial.

---

# 4. Principio rector propuesto

El sistema debería evolucionar en esta secuencia:

```text
REGISTRAR
↓
CENTRALIZAR
↓
MEDIR
↓
COMPARAR
↓
ALERTAR
↓
PREDECIR
↓
RECOMENDAR
↓
AUTOMATIZAR
```

No se debe intentar saltar directamente a IA, optimización o predicción sin datos operativos confiables.

---

# 5. El VIAJE como centro del sistema

La decisión de utilizar `VIAJE` como entidad operativa central es una de las decisiones más acertadas del diseño.

Un viaje debe unir:

```text
Cliente
   │
   ↓
Oportunidad
   │
   ↓
Cotización
   │
   ↓
VIAJE
   │
   ├── Unidad
   ├── Conductor
   ├── Ruta
   ├── Carga
   ├── Combustible
   ├── Gastos
   ├── Adelantos
   ├── Documentos
   ├── Incidencias
   ├── GPS
   ├── Rendición
   ├── Facturación
   ├── Cobranza
   └── Rentabilidad
```

La interfaz administrativa debería explotar esta idea.

Ejemplo de una vista de viaje:

```text
┌────────────────────────────────────┐
│ RT-2026-000145                     │
│ Cusco → Lima                       │
│ EN TRÁNSITO                        │
├────────────────────────────────────┤
│ 🚛 Unidad        V5F-XXX           │
│ 👤 Conductor     Juan              │
│ 📍 Ubicación     Abancay           │
│ 🕒 Última señal  hace 3 min        │
├────────────────────────────────────┤
│ Ingreso esperado      S/ 3,200     │
│ Combustible           S/ 1,380     │
│ Otros gastos          S/   340     │
│ Costo acumulado       S/ 1,720     │
├────────────────────────────────────┤
│ Documentos  ✓                      │
│ Rendición   Pendiente              │
├────────────────────────────────────┤
│ Timeline                           │
│ 14:21 Combustible registrado      │
│ 13:08 GPS: Abancay                │
│ 07:42 Viaje iniciado              │
└────────────────────────────────────┘
```

---

# 6. Reformas propuestas a la estrategia actual

## 6.1. Offline-first selectivo

No todo el sistema necesita el mismo nivel de funcionamiento offline.

### Conductor

Sí necesita offline real para:

- consultar su viaje;
- registrar combustible;
- registrar gastos;
- registrar kilometraje;
- tomar fotografías;
- registrar incidencias;
- confirmar salida/llegada;
- guardar borradores.

### Administración / Gerencia

Puede trabajar principalmente online, con caché y tolerancia a fallos, sin necesidad de replicar cada dato histórico en cada dispositivo.

Conclusión:

> mantener PowerSync, pero sincronizar selectivamente lo que cada perfil realmente necesita.

---

# 7. Construcción vertical en lugar de construcción por módulos aislados

En vez de desarrollar completamente:

```text
clientes
↓
conductores
↓
flota
↓
rutas
↓
viajes
↓
gastos
↓
rendiciones
```

se recomienda construir un flujo vertical:

```text
Crear viaje
↓
Asignar unidad
↓
Asignar conductor
↓
Iniciar viaje
↓
Registrar combustible
↓
Registrar gastos
↓
Adjuntar comprobantes
↓
Confirmar llegada
↓
Rendir
↓
Cerrar viaje
↓
Ver utilidad
```

Cuando un viaje real pueda recorrer todo ese flujo, se habrá alcanzado un MVP con valor.

---

# 8. Dos experiencias dentro de la misma PWA

No se recomienda crear dos aplicaciones separadas.

Se recomienda una sola PWA con experiencias distintas.

## 8.1. Administración / Gerencia

Interfaz de información densa:

```text
Inicio
Operaciones
Viajes
Flota
Clientes
Dinero
Mantenimiento
Cobranza
Documentos
Reportes
```

## 8.2. Conductor

Interfaz extremadamente simple:

```text
MI VIAJE

[ Combustible ]

[ Gasto ]

[ Foto ]

[ Incidencia ]

[ Kilometraje ]

[ Llegué ]
```

El conductor no debe navegar por un ERP.

---

# 9. Sincronización como parte de la UX

En una aplicación offline, no basta con mostrar:

```text
ONLINE
OFFLINE
```

El usuario debe conocer el estado real de sus datos.

Estados recomendados:

```text
✓ Todo sincronizado

↑ 3 cambios pendientes

⚠ 1 archivo pendiente de subir

✕ Error al sincronizar gasto
```

La aplicación debe transmitir:

> “Tus datos están guardados localmente, aunque todavía no hayan llegado al servidor.”

---

# 10. Integración GPS Goldcar / Wialon

Se investigó la plataforma GPS utilizada por R&T.

La conclusión es que existen dos caminos posibles:

1. API REST propia de Goldcar.
2. Wialon Remote API/SDK, debido a que el portal de Goldcar utiliza Wialon.

La arquitectura del proyecto ya había reservado un espacio para integración GPS.

Conceptualmente:

```text
Goldcar / Wialon
       │
       ▼
Adaptador GPS server-side
       │
       ▼
PostgreSQL
       │
       ▼
PowerSync
       │
       ▼
PWA
```

## 10.1. Principio de seguridad

El token de Goldcar/Wialon nunca debe enviarse al frontend.

Debe residir en:

- secretos server-side;
- Edge Function;
- servicio backend.

Nunca en:

```text
VITE_GOLDCAR_TOKEN=...
```

---

# 11. Modelo sugerido para GPS

No utilizar la placa como clave primaria interna.

Ejemplo:

```text
vehicles
────────────────────────
id
plate
gps_provider
gps_external_id
...
```

Y telemetría separada:

```text
vehicle_gps_positions
────────────────────────
id
vehicle_id
recorded_at
latitude
longitude
speed_kmh
heading
altitude
ignition
provider
provider_event_id
received_at
```

---

# 12. El GPS no debe ser solamente un mapa

La integración GPS puede evolucionar hacia una fuente automática de eventos.

Ejemplo:

```text
07:12  Salió de base
07:43  Salió de Cusco
10:18  Parada 22 min
10:42  Movimiento reanudado
13:05  Abancay
16:34  Parada combustible
20:51  Llegada a Lima
```

Esto permite construir un **gemelo digital del viaje**.

---

# 13. GPS como fuente de inteligencia operativa

El GPS puede ayudar a calcular:

```text
kilómetros reales
tiempo real del viaje
horas detenido
días esperando retorno
desvíos
tiempo improductivo
km vacíos
km cargados
```

Y después alimentar:

```text
costo/km
ingreso/km
utilidad/km
utilidad/día
consumo real
eficiencia de la unidad
```

---

# 14. Autoridad del GPS

El GPS debe ser evidencia, no autoridad empresarial.

Por ejemplo:

```text
GPS detecta llegada
```

no debe significar automáticamente:

```text
cerrar viaje
aprobar rendición
registrar pago
```

Las operaciones críticas continúan bajo reglas de dominio y control humano.

---

# 15. OCR y escaneo inteligente

También se analizó la futura incorporación de OCR.

OCR significa:

> Optical Character Recognition / Reconocimiento Óptico de Caracteres.

Pero el sistema propuesto no debería limitarse a:

```text
imagen → texto
```

La visión es:

```text
imagen
↓
corrección
↓
OCR
↓
comprensión del documento
↓
JSON estructurado
↓
validación
↓
confirmación humana
```

---

# 16. Flujo de comprobante de combustible

Ejemplo:

```text
Conductor toma foto
        ↓
Escáner corrige perspectiva
        ↓
OCR
        ↓
Extractor
        ↓
Datos propuestos
        ↓
Conductor revisa
        ↓
Confirmar
        ↓
Registro combustible
        ↓
Foto queda como evidencia
```

Campos posibles:

```text
Proveedor
RUC
Fecha
Tipo de comprobante
N° comprobante
Combustible
Cantidad
Unidad
Precio unitario
Total
IGV
```

---

# 17. OCR no debe ser autoridad financiera

Una regla importante:

> El OCR propone; el usuario confirma.

Nunca asumir que un valor extraído automáticamente es correcto.

Ejemplo de flujo:

```text
DOCUMENTO ORIGINAL
        ↓
OCR
        ↓
DATOS PROPUESTOS
        ↓
VALIDACIÓN AUTOMÁTICA
        ↓
REVISIÓN HUMANA
        ↓
CONFIRMAR
        ↓
REGISTRO DEFINITIVO
```

---

# 18. Bandeja universal de documentos

Una mejora propuesta fue crear una **bandeja de documentos** transversal.

En vez de que cada módulo tenga su propio sistema aislado de fotos:

```text
Documento entra
      ↓
Bandeja R&T
      ↓
Tipo detectado
      ↓
OCR
      ↓
Datos sugeridos
      ↓
Usuario confirma
      ↓
Se vincula a:
viaje
combustible
gasto
unidad
conductor
mantenimiento
```

Esto permitiría reutilizar el mismo pipeline para:

- combustible;
- peajes;
- boletas;
- facturas;
- SOAT;
- ITV;
- SCTR;
- órdenes de mantenimiento;
- comprobantes;
- documentos del conductor.

---

# 19. No reinventar la rueda

Se decidió que una estrategia importante del proyecto será reutilizar librerías y repositorios existentes.

## 19.1. Captura y escaneo

Candidato:

```text
puffinsoft/jscanify
```

Utilidad:

- detectar papel;
- recortar;
- corregir perspectiva;
- mejorar captura.

## 19.2. OCR

Candidatos:

```text
PaddlePaddle/PaddleOCR
naptha/tesseract.js
mindee/doctr
```

## 19.3. Extracción estructurada

Referencia conceptual:

```text
invoice-x/invoice2data
```

Su patrón de plantillas y reglas puede utilizarse para proveedores conocidos.

Ejemplo:

```text
Proveedor conocido
↓
Plantilla específica
↓
Regex / reglas
↓
Datos estructurados
```

## 19.4. Casos desconocidos

Para documentos que no encajan en una plantilla:

```text
OCR
↓
LLM / visión
↓
JSON estructurado
```

---

# 20. Arquitectura de documentos recomendada

```text
                  FOTO
                    │
                    ▼
              ┌──────────┐
              │ jscanify │
              └────┬─────┘
                   │
             foto corregida
                   │
                   ▼
          ┌─────────────────┐
          │    PaddleOCR    │
          │       o         │
          │  Tesseract.js   │
          └────────┬────────┘
                   │
                 texto
                   │
            ┌──────┴──────┐
            │             │
            ▼             ▼
 proveedor conocido    desconocido
            │             │
            ▼             ▼
 reglas/template         IA
            │             │
            └──────┬──────┘
                   ▼
             JSON propuesto
                   │
                   ▼
          Validaciones R&T
                   │
                   ▼
         CONDUCTOR CONFIRMA
                   │
                   ▼
             PostgreSQL
```

---

# 21. Arquitectura formal de integraciones

Se propone una capa explícita:

```text
integrations/
│
├── gps/
│   ├── GpsProvider
│   ├── GoldcarProvider
│   └── WialonProvider
│
├── documents/
│   ├── Scanner
│   ├── OcrEngine
│   └── DocumentExtractor
│
└── notifications/
    └── NotificationProvider
```

El dominio no debe conocer detalles específicos de proveedores.

Debe conocer abstracciones:

```text
GpsProvider
OcrEngine
DocumentScanner
DocumentExtractor
```

Así, Goldcar puede ser sustituido por otro proveedor sin reescribir el dominio.

---

# 22. Repositorios externos: criterio de uso

No instalar cualquier wrapper por existir.

Antes de adoptar una dependencia evaluar:

```text
actividad reciente
licencia
mantenimiento
compatibilidad
tamaño
seguridad
comunidad
calidad de API
dependencias
```

En Wialon, por ejemplo, se concluyó que algunos wrappers existentes son antiguos.

Por eso es preferible:

```text
adaptador TypeScript delgado
+
API oficial
```

antes que acoplar el proyecto a una librería abandonada.

---

# 23. Calculadora / Evaluador de Viajes

Se propuso crear una herramienta central:

# Evaluador de Viajes R&T

Su objetivo:

> determinar antes de aceptar una carga si el viaje conviene, cuánto debería cobrarse y hasta dónde se puede negociar.

---

# 24. Inputs de la calculadora

Ejemplo:

```text
Origen
Destino
Toneladas
Tarifa ofrecida
Unidad
Precio diesel
Consumo esperado
Peajes
Viáticos
Otros gastos
Días estimados
Probabilidad retorno
Ingreso retorno esperado
```

---

# 25. Outputs básicos

```text
Ingreso
Costo esperado
Utilidad
Margen %
Costo/km
Ingreso/km
Utilidad/km
Utilidad/día
Días de ciclo
```

---

# 26. Tres precios de negociación

La herramienta debería mostrar:

```text
PRECIO DE EQUILIBRIO
No pierdes, pero no generas margen.

PRECIO MÍNIMO RECOMENDADO
Margen mínimo aceptable.

PRECIO OBJETIVO
Rentabilidad saludable.
```

Ejemplo:

```text
Equilibrio            S/ 2,800
Mínimo recomendado    S/ 3,350
Objetivo               S/ 3,650
```

---

# 27. Simulador de negociación

Durante una llamada:

```text
Oferta cliente
S/ 6,300
```

el sistema puede recalcular inmediatamente:

```text
Utilidad: S/ 870
Margen: 13.8 %
Utilidad/día: S/ 145

🟠 Aceptable solo con retorno
prácticamente asegurado.
```

---

# 28. Análisis del ciclo completo

No analizar únicamente:

```text
Cusco → Lima
```

sino:

```text
Cusco → Lima
+
Lima → retorno
```

El `CICLO_OPERATIVO` es fundamental.

La rentabilidad real debe considerar:

- ida;
- espera;
- retorno;
- regreso vacío;
- combustible;
- tiempo improductivo.

---

# 29. Probabilidad de retorno

Ejemplo:

```text
Probabilidad histórica de retorno: 75 %
Ingreso medio retorno: S/ 8,200
```

Valor esperado:

```text
0.75 × 8,200
=
S/ 6,150
```

No significa que se reciban S/6,150.

Es una medida estadística para comparar decisiones.

---

# 30. Escenarios

El evaluador debería mostrar:

```text
CONSERVADOR
Sin retorno
🔴 Riesgoso

PROBABLE
Retorno histórico promedio
🟢 Rentable

FAVORABLE
Buen retorno
🟢 Muy rentable
```

---

# 31. El tiempo como costo

No basta con utilidad absoluta.

Ejemplo:

```text
Viaje A
S/ 2,500
15 días
=
S/ 166/día

Viaje B
S/ 2,000
7 días
=
S/ 286/día
```

El segundo puede usar mejor el activo aunque gane menos por viaje.

Por eso el sistema debe medir:

```text
utilidad/día
utilización
tiempo improductivo
```

---

# 32. Aprendizaje histórico del Evaluador de Viajes

Al inicio se usan estimaciones manuales.

Después:

```text
histórico de viajes
+
GPS
+
combustible
+
gastos
+
tiempos
```

permite que el sistema sugiera automáticamente:

```text
Costo histórico
Consumo esperado
Duración esperada
Días de espera
Tarifa media
Margen histórico
Retorno probable
```

---

# 33. Scoring del viaje

Se propuso un score explicable:

```text
VIABILIDAD

82 / 100

Rentabilidad        90/100
Retorno             65/100
Cliente             95/100
Tiempo              72/100
Riesgo operativo    80/100
```

Nunca debe ser una caja negra.

El usuario debe poder preguntar:

> ¿Por qué 82?

y ver los factores.

---

# 34. Motor de reglas y alertas

Antes de IA avanzada, el sistema puede generar muchísimo valor con reglas simples.

Ejemplos:

```text
SOAT vence en 30 días
→ alerta
```

```text
Unidad lleva 3 días esperando retorno
→ alerta
```

```text
Combustible > 20 % sobre referencia
→ alerta
```

```text
Factura lleva 25 días sin cobrar
→ alerta
```

```text
Mantenimiento próximo por kilometraje
→ alerta
```

```text
GPS indica movimiento
pero viaje no está iniciado
→ advertencia
```

---

# 35. Capa de eventos operativos

Se recomendó introducir una tabla transversal:

```text
trip_events
────────────────────────
id
trip_id
event_type
occurred_at
actor_id
latitude
longitude
payload
source
```

Fuentes posibles:

```text
MANUAL
GPS
OCR
SYSTEM
INTEGRATION
```

Esto permite una línea de tiempo unificada.

---

# 36. Estado financiero en tiempo casi real

Cada viaje puede mostrar:

```text
INGRESOS

Flete
Adicionales

COSTOS

Combustible
Peajes
Viáticos
Gastos
Mantenimiento imputado

RESULTADO

Utilidad estimada
Margen
Costo/km
Ingreso/km
```

Durante el viaje, estos valores se actualizan conforme entran datos.

---

# 37. Mantenimiento basado en uso real

El mantenimiento debería evolucionar desde:

```text
“creo que ya toca”
```

hacia:

```text
Odómetro actual
Próximo mantenimiento
Km restantes
Promedio km/día
Fecha estimada
```

Ejemplo:

```text
Odómetro             486,320 km
Próximo servicio     490,000 km
Promedio diario          430 km

Estimación:
8.6 días
```

---

# 38. Mantenimiento analítico

Más adelante:

```text
historial de reparaciones
+
consumo
+
kilometraje
+
GPS
+
costos
```

podría ayudar a responder:

```text
¿Conviene reparar?
¿Conviene renovar?
¿Conviene vender?
¿Qué unidad está encareciendo?
```

---

# 39. Gestión de cobranza

Cada factura debería evolucionar como un estado:

```text
Día 0
Emitida

Día 20
Normal

Día 28
Próximo vencimiento

Día 30
Vence hoy

Día 35
⚠ Atraso

Día 45
🔴 Riesgo
```

---

# 40. Scoring de clientes

Ejemplo:

```text
CLIENTE MINERA XYZ

Rentabilidad        92/100
Puntualidad pago    88/100
Frecuencia          81/100
Retornos            76/100
Incidencias         95/100

Score total
87 / 100

🟢 CLIENTE ESTRATÉGICO
```

Otro:

```text
Score 42 / 100

🔴 ALTO RIESGO
```

---

# 41. La cobranza alimenta las futuras cotizaciones

Ejemplo:

El cliente pide otro viaje.

El sistema puede advertir:

```text
Historial de pago:
47 días promedio

Condición pactada:
30 días

Deuda pendiente:
S/ 14,200

⚠ Riesgo comercial alto
```

Entonces la decisión de aceptar una nueva carga incorpora también el riesgo financiero.

---

# 42. Radar de retorno

Una futura capacidad muy valiosa:

```text
Lima → Cusco

Tiempo medio para carga:
2.8 días

Tarifa media:
S/ 8,350

Probabilidad <24 h:
22 %

Probabilidad <72 h:
71 %
```

Esto alimenta el Evaluador de Viajes antes de aceptar la ida.

---

# 43. Optimización de flota

Cuando la empresa crezca, el sistema puede evaluar múltiples oportunidades y múltiples unidades.

Ejemplo:

```text
Viaje A
Viaje B
Viaje C

Unidad 1
Unidad 2
Unidad 3
```

El sistema propone combinaciones que optimicen:

```text
utilidad esperada
-
km vacíos
-
tiempo improductivo
-
riesgo
-
mantenimiento próximo
```

---

# 44. IA: cuándo sí tiene sentido

La IA no debería incorporarse como un chatbot decorativo.

Debe conectarse con datos confiables.

Ejemplos:

> ¿Cómo va la empresa hoy?

Respuesta basada en:

- viajes activos;
- ingresos;
- gastos;
- cobranza;
- mantenimiento;
- alertas.

---

# 45. Copiloto empresarial

Preguntas posibles:

```text
¿Cómo va la empresa hoy?
```

```text
¿Conviene aceptar Cusco–Lima por S/ 3,300?
```

```text
¿Qué debería atender hoy?
```

```text
¿Qué unidad está rindiendo peor?
```

```text
¿Qué clientes pagan más tarde?
```

```text
¿Cuál ruta nos deja mejor utilidad por día?
```

---

# 46. Briefing diario automático

Ejemplo:

```text
R&T — RESUMEN 7:00 AM

🚛 FLOTA
2 en ruta
1 disponible

💰 COBRANZA
S/ 31,400 pendiente
S/ 8,500 vencido

🔧 MANTENIMIENTO
1 servicio próximo

📄 DOCUMENTOS
SOAT Unidad 03 → 19 días

⚠ ALERTAS
Unidad 02 consumo +18 %

📦 OPORTUNIDADES
3 cargas por evaluar
```

---

# 47. Visión ambiciosa: R&T Control Tower

La evolución final podría denominarse:

# R&T Control Tower

Una pantalla central:

```text
┌─────────────────────────────────────────────┐
│              R&T CONTROL TOWER              │
├───────────────────────────┬─────────────────┤
│                           │ FLOTA           │
│         MAPA              │                 │
│                           │ 🟢 2 operando   │
│     🚛                    │ 🟡 1 espera     │
│                 🚛        │ 🔴 0 averías    │
├───────────────────────────┼─────────────────┤
│ VIAJES ACTIVOS            │ ALERTAS         │
│                           │                 │
│ RT-145 Cusco→Lima  68 %   │ ⚠ Combustible │
│ RT-146 Lima→Cusco  24 %   │ ⚠ Documento   │
├───────────────────────────┼─────────────────┤
│ INGRESOS MES              │ RENTABILIDAD    │
│ S/ 84,300                 │ S/ 19,420       │
├───────────────────────────┴─────────────────┤
│ PRÓXIMAS ACCIONES                           │
│ Cobrar ABC • Cotizar XYZ • Mantto Unidad 3 │
└─────────────────────────────────────────────┘
```

---

# 48. Arquitectura conceptual final

```text
                    R&T CONTROL TOWER
                           │
          ┌────────────────┴────────────────┐
          │                                 │
       GERENCIA                         CONDUCTOR
          │                                 │
          └──────────────┬──────────────────┘
                         │
                       PWA
                         │
                SQLite / PowerSync
                         │
                    PostgreSQL
                         │
    ┌──────────────┬─────┴─────┬──────────────┐
    │              │           │              │
   GPS         DOCUMENTOS   FINANZAS      OPERACIÓN
 Goldcar          OCR       Cobranza        Viajes
 Wialon           IA        Costos          Flota
    │              │           │              │
    └──────────────┴─────┬─────┴──────────────┘
                         │
                   EVENTOS R&T
                         │
                    ANALÍTICA
                         │
                MOTOR DE DECISIÓN
                         │
        ┌────────────────┼─────────────────┐
        │                │                 │
      ALERTAS       PREDICCIONES      RECOMENDACIONES
        │                │                 │
        └────────────────┴─────────────────┘
                         │
                      COPILOTO
```

---

# 49. Lo que hace único al sistema

La ventaja final no estaría en poseer:

- GPS;
- OCR;
- React;
- Supabase;
- IA.

Todos esos elementos pueden ser comprados o replicados.

La ventaja estaría en el histórico específico de R&T:

```text
cómo consume esta unidad
cómo conduce este conductor
cómo paga este cliente
cómo rinde esta ruta
cuánto tarda este retorno
cómo cambia el costo real
qué mantenimiento presenta cada unidad
```

Con años de datos, el sistema podría decir:

> **“Basado en cómo funciona realmente R&T…”**

Y esa base de conocimiento sería difícil de copiar.

---

# 50. Frontera de automatización

Aunque el sistema sea ambicioso, no debe automatizar ciegamente decisiones sensibles.

Deben seguir bajo control humano:

- aceptar contratos importantes;
- aprobar pagos;
- cerrar rendiciones;
- anular movimientos financieros;
- cambiar permisos;
- cerrar periodos;
- aprobar excepciones;
- tomar decisiones empresariales sensibles.

La regla sería:

> **La IA recomienda. Las reglas controlan. La gerencia decide.**

---

# 51. Qué NO construir todavía

No se recomienda implementar todavía:

- microservicios;
- Kubernetes;
- data warehouse;
- app Android nativa;
- app iOS independiente;
- IA predictiva compleja;
- chatbot general;
- optimizador avanzado;
- sistema GPS propio;
- OCR propio entrenado desde cero;
- facturación electrónica completa;
- arquitectura distribuida de eventos.

No porque sean imposibles.

Sino porque todavía existe mucho valor más barato por capturar.

---

# 52. Roadmap recomendado desde el estado actual

```text
AHORA
│
├─ 1. Resolver Supabase real / entorno
│
├─ 2. Validar Auth + RLS
│
├─ 3. PowerSync + SQLite spike
│
├─ 4. Crear modelo mínimo real
│     ├── unidad
│     ├── conductor
│     └── viaje
│
├─ 5. Primer viaje completo real
│
├─ 6. Combustible + gastos offline
│
├─ 7. Fotografías / comprobantes
│
├─ 8. Rendición
│
├─ 9. Cierre de viaje + utilidad
│
│        ← MVP REAL
│
├─ 10. Piloto con 1 conductor
│
├─ 11. Corregir UX
│
├─ 12. Evaluador de Viajes
│
├─ 13. Goldcar / Wialon spike
│
├─ 14. GPS dentro del viaje
│
├─ 15. Escáner + OCR spike
│
├─ 16. OCR de combustible
│
├─ 17. Bandeja de documentos
│
├─ 18. Documentos + vencimientos
│
├─ 19. Mantenimiento
│
├─ 20. Cobranza
│
├─ 21. Alertas y reglas
│
├─ 22. Analítica histórica
│
├─ 23. Scoring
│
├─ 24. Optimización
│
└─ 25. IA / Copiloto
```

---

# 53. Definición práctica del MVP

MVP no significa:

> veinte pantallas.

MVP significa:

> **poder administrar correctamente un viaje real de principio a fin.**

Debe ser posible:

```text
cotizar
↓
programar
↓
asignar unidad
↓
asignar conductor
↓
salir
↓
registrar combustible
↓
registrar gastos
↓
adjuntar comprobantes
↓
llegar
↓
rendir
↓
cerrar
↓
saber cuánto dejó
```

---

# 54. Evolución conceptual del producto

## Etapa 1 — Registro digital

```text
“Ya no usamos cuadernos/Excel para todo.”
```

## Etapa 2 — Centro de control

```text
“Sabemos qué está pasando.”
```

## Etapa 3 — Sistema analítico

```text
“Sabemos qué rinde y qué no.”
```

## Etapa 4 — Sistema predictivo

```text
“Sabemos qué probablemente ocurrirá.”
```

## Etapa 5 — Sistema de decisión

```text
“Sabemos qué conviene hacer.”
```

## Etapa 6 — Control Tower

```text
“El sistema observa, aprende, alerta y ayuda a dirigir la empresa.”
```

---

# 55. Principios finales recomendados

## 55.1. No reinventar la rueda

Reutilizar librerías maduras.

## 55.2. El dominio manda

Goldcar, PaddleOCR o cualquier proveedor deben ser reemplazables.

## 55.3. Offline donde aporta valor

No replicar complejidad innecesariamente.

## 55.4. Humano en decisiones críticas

Automatizar sugerencias, no autoridad empresarial sensible.

## 55.5. Datos antes que IA

Primero datos confiables.

## 55.6. Integridad antes que dashboards

Un viaje bien cerrado vale más que diez gráficas bonitas.

## 55.7. Construcción vertical

Crear valor de extremo a extremo.

## 55.8. Medir antes de optimizar

No optimizar procesos que todavía no están medidos.

## 55.9. Eventos como lenguaje común

GPS, usuario, OCR e integraciones deben poder alimentar una timeline común.

## 55.10. Explicabilidad

Scores y recomendaciones deben explicar por qué.

---

# 56. Conclusión

La visión final no es construir solamente:

> una aplicación de transporte.

La visión más potente es:

> **crear un cerebro digital de R&T SITRAM SAC.**

Un sistema que:

```text
ve
↓
registra
↓
relaciona
↓
mide
↓
compara
↓
alerta
↓
predice
↓
recomienda
```

pero que mantiene la autoridad empresarial en manos de las personas.

El producto final podría conocer:

- dónde están las unidades;
- qué viajes están activos;
- qué conductor está asignado;
- cuánto se está gastando;
- cuánto se espera ganar;
- qué documentos vencen;
- qué mantenimiento se acerca;
- qué cliente paga tarde;
- qué ruta rinde mejor;
- qué unidad está encareciendo;
- qué viaje conviene aceptar;
- qué tarifa debería negociarse;
- qué retorno es probable;
- qué acción debe atenderse primero.

La frase que mejor resume la visión es:

> **R&T Control Tower: un sistema operativo de transporte que representa la operación real de la empresa, aprende de cada viaje y ayuda a tomar mejores decisiones.**

---

# 57. Fuentes internas del proyecto relacionadas

Documentos ya existentes en el repositorio que sustentan o se relacionan con esta visión:

```text
docs/01_informe_contextual_negocio.md
docs/02_diagnostico_operativo_completo.md
docs/03_modelo_operativo_objetivo_to_be.md
docs/04_blueprint_funcional_sistema_digital.md
docs/05_arquitectura_informacion_modelo_datos.md
docs/06_especificacion_ux_ui.md
docs/07_arquitectura_tecnica_sistema.md
docs/08_plan_maestro_implementacion.md
docs/09_sintesis_comprension_negocio.md
docs/decisions/
docs/sessions/
implementation/
```

Este documento no reemplaza esos artefactos.

Su función es actuar como:

> **síntesis estratégica ampliada de la conversación, las decisiones, las ideas de evolución y la visión ambiciosa del sistema.**

---

# 58. Ampliación V2 — Mapa operativo y capa geoespacial

Esta versión incorpora un análisis adicional sobre una posible función de mapa similar a la que ofrecen plataformas de monitoreo GPS como Goldcar.

La pregunta evaluada fue:

> **¿Tiene sentido construir dentro de R&T un mapa propio para visualizar la flota, las rutas y los viajes, o sería solamente un capricho visual?**

La conclusión es clara:

> **Sí tiene sentido, pero únicamente si el mapa funciona como una superficie operativa conectada al negocio.**

Un mapa que solo muestre tres camiones sobre Perú aporta poco valor. Un mapa que conecte posición, viaje, conductor, ETA, costos, paradas, incidencias, ruta, geocercas y rentabilidad sí puede convertirse en una pieza importante del Centro de Control.

---

## 58.1. GPS y mapa son responsabilidades distintas

Goldcar/Wialon y un proveedor cartográfico no cumplen la misma función.

```text
GOLDCAR / WIALON
        │
        │ telemetría
        │
        ├── latitud
        ├── longitud
        ├── velocidad
        ├── rumbo
        ├── timestamp
        └── ignición
        │
        ▼
       R&T
        │
        ▼
GOOGLE MAPS / MAPLIBRE
        │
        ▼
visualización geográfica
```

Goldcar/Wialon debe verse como la **fuente de telemetría**.

Google Maps, MapLibre u otro proveedor debe verse como la **capa cartográfica**.

La plataforma R&T debe ser la capa que interpreta esa telemetría en términos empresariales.

---

# 59. Mapa de flota

La primera capacidad útil sería una pantalla donde gerencia pueda observar las unidades activas.

```text
┌─────────────────────────────────────────────┐
│                MAPA DE FLOTA                │
│                                             │
│                         🚛 UNIDAD 03        │
│                         Lima → Cusco         │
│                                             │
│              🚛 UNIDAD 02                  │
│              detenida                       │
│                                             │
│     🚛 UNIDAD 01                           │
│     Cusco → Lima                            │
└─────────────────────────────────────────────┘
```

Cada marcador debe abrir contexto del negocio:

```text
UNIDAD 01
────────────────────────
Placa             V5F-XXX
Viaje             RT-2026-0145
Ruta              Cusco → Lima
Conductor         Juan Pérez
Estado            EN TRÁNSITO
Velocidad         68 km/h
Ignición          ON
Última señal      hace 34 s
ETA               21:25
Progreso          67 %
Costo acumulado   S/ 3,420
Ingreso esperado  S/ 8,500

[ Ver viaje ]
[ Ver recorrido ]
```

El marcador no debe representar solamente un vehículo.

Debe representar:

```text
vehículo
+
viaje
+
conductor
+
operación
+
dinero
```

---

# 60. Ruta planificada versus ruta real

Se recomienda conservar dos conceptos separados.

## 60.1. Ruta planificada

Es el recorrido que se espera realizar.

```text
Cusco
  ↓
Abancay
  ↓
Nazca
  ↓
Lima
```

Puede contener:

- distancia esperada;
- duración esperada;
- trazado geográfico;
- puntos intermedios;
- peajes estimados;
- corredor esperado.

## 60.2. Ruta real

Es el recorrido reconstruido a partir de posiciones GPS.

```text
P1 → P2 → P3 → P4 → ... → Pn
```

La combinación permite visualizar:

```text
──────────── ruta prevista

- - - - - - ruta real

       🚛 posición actual
```

Esto permite detectar desviaciones, tiempos adicionales y kilómetros no previstos.

---

# 61. Desviaciones de ruta

El sistema puede medir la separación entre el recorrido real y el corredor esperado.

Ejemplo:

```text
Unidad V5F-XXX

Distancia fuera del
corredor esperado:
27 km

⚠ DESVIACIÓN DE RUTA
```

La desviación no debe interpretarse automáticamente como una infracción.

Puede deberse a:

- bloqueo;
- desvío vial;
- parada de combustible;
- entrega adicional;
- taller;
- decisión del conductor;
- error del proveedor de rutas.

La regla continúa siendo:

> **El sistema detecta y proporciona contexto; la persona interpreta y decide.**

---

# 62. ETA y progreso del viaje

La ubicación permite construir una experiencia de seguimiento mucho más útil.

```text
RT-2026-0145
Cusco → Lima

████████████░░░░░
67 %

Distancia recorrida
739 km

Distancia restante
361 km

Llegada estimada
21:25

Última señal
hace 42 s
```

Inicialmente el ETA puede provenir de un motor de rutas.

Más adelante puede evolucionar hacia:

```text
ETA proveedor de rutas
+
posición GPS
+
velocidad real
+
paradas reales
+
tráfico
+
histórico R&T
```

Con suficiente historial, la empresa puede desarrollar estimaciones específicas para su propia operación.

---

# 63. Geocercas

Una geocerca representa una zona operativa significativa.

Ejemplos:

```text
Base Cusco
Origen de carga
Destino
Almacén
Taller
Grifo frecuente
Zona de descarga
Cliente
```

Una geocerca puede ser:

```text
punto + radio
```

O:

```text
polígono geográfico
```

Ejemplo:

```text
┌─────────────────────────┐
│      DESTINO LIMA       │
│                         │
│           🚛            │
│                         │
└─────────────────────────┘
```

Al entrar:

```text
20:43
Unidad 01 entró en
DESTINO LIMA
```

El sistema puede crear:

```text
ARRIVAL_DETECTED
source = GPS
```

Y sugerir:

> ¿Cambiar el viaje a EN DESCARGA?

La transición de negocio sigue bajo reglas del sistema y confirmación humana cuando corresponda.

---

# 64. Detección y clasificación de paradas

La telemetría permite medir tiempos muertos.

Ejemplo normal:

```text
velocidad = 0
duración = 8 min
```

Ejemplo relevante:

```text
velocidad = 0
duración = 4 h 26 min
fuera de origen/destino
```

El sistema podría generar:

```text
⚠ PARADA PROLONGADA
```

Y permitir clasificarla:

```text
DESCANSO
COMBUSTIBLE
CARGA
DESCARGA
AVERÍA
TRÁFICO
BLOQUEO
TALLER
OTRO
```

Esto convierte GPS en métricas:

```text
tiempo conduciendo
tiempo detenido
tiempo cargando
tiempo descargando
tiempo esperando
tiempo improductivo
```

---

# 65. Cómo el mapa mejora el Evaluador de Viajes

El mapa no es una función aislada.

Alimenta directamente el motor económico.

```text
GPS
 ↓
km reales
 ↓
duración real
 ↓
paradas
 ↓
espera
 ↓
km vacíos
 ↓
ruta real
```

Combinado con:

```text
OCR / gastos
 ↓
combustible
peajes
viáticos
otros
```

produce:

```text
costo/km
ingreso/km
utilidad/km
utilidad/día
km cargados
km vacíos
tiempo improductivo
consumo por km
consumo por unidad
duración real por ruta
```

Estos datos vuelven mejores las futuras cotizaciones.

---

# 66. Google Maps como primera opción práctica

Para una primera implementación, Google Maps aparece como una opción pragmática.

Puede cubrir:

```text
mapa base
marcadores
marcadores personalizados
polylines
polígonos
rutas
distancias
duraciones
tráfico
```

Para una flota pequeña y una aplicación interna, el volumen inicial puede ser moderado.

Sin embargo:

> **La arquitectura no debe asumir que Google Maps será gratuito para siempre ni convertirse en una dependencia irreversible.**

Se debe medir uso y costos reales.

---

# 67. MapLibre como alternativa estratégica

MapLibre puede servir como motor cartográfico independiente.

Conceptualmente:

```text
R&T
  │
  ├── MapLibre GL JS
  │
  └── proveedor de tiles
```

Ventajas:

- mayor control;
- personalización;
- menor dependencia de un proveedor;
- buen encaje con GeoJSON;
- facilidad para representar datos propios.

Pero MapLibre no incluye por sí mismo todos los servicios necesarios.

Todavía se requiere decidir:

```text
tiles
ruteo
geocodificación
tráfico
```

Por ello, la recomendación inicial sería:

```text
Implementación 1:
Google Maps probablemente

Arquitectura:
MapProvider abstracto

Evolución:
MapLibre u otro proveedor
sin reescribir el dominio
```

---

# 68. OpenStreetMap y la infraestructura de mapas

Se identificó una distinción importante:

> **Datos abiertos no significa infraestructura pública gratuita e ilimitada para producción.**

OpenStreetMap ofrece datos geográficos abiertos, pero no debe asumirse que sus servidores públicos de tiles serán el backend gratuito permanente de una aplicación empresarial.

Si se utiliza MapLibre, debe existir una estrategia explícita para:

- tiles;
- proveedor;
- caché;
- costos;
- disponibilidad;
- términos de uso.

---

# 69. Ruteo específico para transporte pesado

Otra conclusión importante:

> **Mostrar una ruta de automóvil no equivale a tener navegación profesional para un camión pesado.**

Un motor especializado puede necesitar considerar:

```text
peso
peso por eje
altura
ancho
longitud
número de ejes
restricciones de carga
vías prohibidas
```

Por eso se recomienda separar:

```text
MapProvider
≠
RoutingProvider
```

Ejemplo futuro:

```text
Visualización
Google Maps / MapLibre

GPS
Goldcar / Wialon

Ruteo pesado
TomTom / HERE / proveedor especializado
```

No es necesario utilizar un único proveedor para toda la capa geográfica.

---

# 70. PostGIS como capa geoespacial

Para capacidades geográficas avanzadas se recomienda evaluar PostGIS sobre PostgreSQL/Supabase.

Puede representar y consultar:

```text
puntos
líneas
polígonos
distancias
intersecciones
geocercas
búsquedas geográficas
```

Preguntas futuras:

```text
¿La unidad está dentro de la geocerca Lima?
```

```text
¿Cuál fue la distancia entre ruta real y prevista?
```

```text
¿Qué unidad está más cerca del próximo punto de carga?
```

Esto permite que parte de la inteligencia geográfica viva en el backend y no en el frontend.

---

# 71. Modelo de datos geoespacial

Se recomienda separar la última posición del histórico completo.

## 71.1. Última posición

```text
vehicle_latest_position
────────────────────────
vehicle_id
recorded_at
latitude
longitude
speed_kmh
heading
ignition
source
```

Esta tabla o vista hace rápida la pantalla de flota.

## 71.2. Histórico

```text
gps_positions
────────────────────────
id
vehicle_id
recorded_at
latitude
longitude
speed_kmh
heading
altitude
ignition
provider
provider_event_id
received_at
```

Sirve para:

- recorridos;
- paradas;
- kilometraje;
- eventos;
- analítica;
- auditoría.

---

# 72. Realtime para el mapa

El mapa no necesita recargarse manualmente.

Conceptualmente:

```text
Goldcar
   ↓
backend
   ↓
vehicle_latest_position
   ↓
Realtime
   ↓
mapa actualiza marcador
```

Para una flota pequeña, el volumen es bajo.

No obstante, no tiene sentido actualizar segundo a segundo solo por efecto visual.

La frecuencia debe responder a necesidades reales de operación y a las condiciones de la API GPS.

---

# 73. Telemetría GPS y PowerSync no deben tratarse igual

Esta es una reforma importante respecto de una interpretación demasiado literal del offline-first.

> **No se recomienda sincronizar todo el histórico GPS a todos los dispositivos mediante PowerSync.**

El histórico puede crecer rápidamente.

Separación recomendada:

```text
PowerSync / SQLite
→ operación offline

PostgreSQL / PostGIS
→ telemetría histórica

Realtime
→ posición actual

PowerSync opcional
→ última posición conocida
```

PowerSync debe priorizar:

```text
viajes
gastos
combustible
incidencias
rendiciones
datos necesarios para conductor
```

Esto mantiene ligera la PWA.

---

# 74. Arquitectura geoespacial recomendada

```text
                GOLDCAR / WIALON
                       │
                       ▼
                gps-sync backend
                       │
                       ▼
                  PostgreSQL
            ┌──────────┴───────────┐
            │                      │
            ▼                      ▼
vehicle_latest_position       gps_positions
            │                  histórico
            │                      │
            └──────────┬───────────┘
                       │
                    PostGIS
                       │
             ┌─────────┴─────────┐
             │                   │
             ▼                   ▼
       Realtime / API        Analítica
             │                   │
             ▼                   ▼
        MAPA DE FLOTA      Evaluador de Viajes
```

El resultado es una arquitectura donde el mapa no posee la lógica empresarial.

El mapa visualiza el estado producido por el dominio.

---

# 75. R&T Control Tower con mapa integrado

La Control Tower final podría verse conceptualmente así:

```text
┌────────────────────────────────────────────────────┐
│                R&T CONTROL TOWER                   │
├──────────────────────────────┬─────────────────────┤
│                              │ FLOTA               │
│            MAPA              │                     │
│                              │ 🟢 2 en tránsito    │
│      🚛                      │ 🟡 1 disponible     │
│                    🚛        │ 🔴 0 averías        │
│                              │                     │
├──────────────────────────────┼─────────────────────┤
│ VIAJES ACTIVOS               │ ALERTAS             │
│ RT-145  Cusco→Lima    67 %   │ ⚠ parada 3 h       │
│ RT-146  Lima→Cusco    31 %   │ ⚠ SOAT próximo     │
├──────────────────────────────┼─────────────────────┤
│ COBRANZA                     │ RENTABILIDAD        │
│ S/ 31,400 pendiente          │ S/ 19,420 mes       │
├──────────────────────────────┴─────────────────────┤
│ PRÓXIMAS ACCIONES                                  │
│ Cobrar ABC · Cotizar XYZ · Mantto Unidad 03       │
└────────────────────────────────────────────────────┘
```

La idea central es:

> **El mapa es una parte de la Control Tower; no es la Control Tower completa.**

---

# 76. Qué aporta valor y qué sería capricho

## 76.1. Funciones con valor real

```text
ubicación actual
viaje asociado
última señal
velocidad
ignición
ruta real
ruta prevista
paradas
desviaciones
ETA
geocercas
eventos automáticos
km reales
km vacíos
tiempo detenido
```

## 76.2. Funciones no prioritarias

```text
camiones 3D
animaciones cinematográficas
mapa 3D permanente
Street View automático
satélite siempre activo
actualización segundo a segundo
efectos visuales complejos
```

Regla propuesta:

> **Cada elemento del mapa debe responder una pregunta operativa.**

---

# 77. Reformulación de la visión final

Con la nueva capa geoespacial, la arquitectura final puede entenderse así:

```text
                    R&T CONTROL TOWER
                           │
          ┌────────────────┴────────────────┐
          │                                 │
       GERENCIA                         CONDUCTOR
          │                                 │
          └──────────────┬──────────────────┘
                         │
                       PWA
                         │
                SQLite / PowerSync
                         │
                    PostgreSQL
                         │
    ┌──────────────┬─────┴─────┬──────────────┐
    │              │           │              │
   GPS         DOCUMENTOS   FINANZAS      OPERACIÓN
Goldcar           OCR       Cobranza        Viajes
Wialon            IA        Costos          Flota
    │              │           │              │
    └──────────────┴─────┬─────┴──────────────┘
                         │
                 CAPA GEOESPACIAL
                         │
          ┌──────────────┼──────────────┐
          │              │              │
       PostGIS      Map Provider   Route Provider
          │          Google /      general / pesado
          │          MapLibre            │
          └──────────────┼──────────────┘
                         │
                   EVENTOS R&T
                         │
                    ANALÍTICA
                         │
                MOTOR DE DECISIÓN
                         │
        ┌────────────────┼─────────────────┐
        │                │                 │
      ALERTAS       PREDICCIONES      RECOMENDACIONES
        │                │                 │
        └────────────────┴─────────────────┘
                         │
                      COPILOTO
```

---

# 78. Roadmap V2 incorporando mapa y geoespacial

El roadmap ampliado queda conceptualmente:

```text
AHORA
│
├─ 1. Resolver Supabase real / entorno
│
├─ 2. Validar Auth + RLS
│
├─ 3. PowerSync + SQLite spike
│
├─ 4. Modelo mínimo real
│     ├── unidad
│     ├── conductor
│     └── viaje
│
├─ 5. Primer viaje completo
│
├─ 6. Combustible + gastos offline
│
├─ 7. Fotografías / comprobantes
│
├─ 8. Rendición
│
├─ 9. Cierre + utilidad
│
│        ← MVP OPERATIVO REAL
│
├─ 10. Piloto con conductor
│
├─ 11. Evaluador de Viajes
│
├─ 12. Goldcar / Wialon spike
│
├─ 13. GPS dentro del viaje
│
├─ 14. Mapa de flota
│     ├── última posición
│     ├── viaje asociado
│     ├── velocidad / ignición
│     └── última señal
│
├─ 15. Recorrido histórico
│
├─ 16. Ruta prevista vs real
│
├─ 17. Geocercas
│
├─ 18. Eventos GPS y paradas
│
├─ 19. ETA
│
├─ 20. PostGIS / análisis geoespacial
│
├─ 21. Escáner + OCR spike
│
├─ 22. OCR de combustible
│
├─ 23. Bandeja universal de documentos
│
├─ 24. Documentos + vencimientos
│
├─ 25. Mantenimiento
│
├─ 26. Cobranza
│
├─ 27. Alertas + reglas
│
├─ 28. Analítica histórica
│
├─ 29. Scoring
│
├─ 30. Radar de retorno
│
├─ 31. Optimización
│
├─ 32. Ruteo pesado especializado
│
└─ 33. IA / Copiloto
```

---

# 79. Nuevos principios derivados del análisis geoespacial

## 79.1. El mapa es una interfaz, no el dominio

El dominio debe manejar conceptos propios:

```text
posición
ruta
recorrido
geocerca
parada
evento
ETA
desviación
```

No conceptos dependientes de un proveedor.

## 79.2. MapProvider y RoutingProvider son reemplazables

No acoplar R&T a Google, MapLibre, TomTom, HERE o cualquier proveedor concreto.

## 79.3. GPS es evidencia

Goldcar/Wialon informa lo observado.

R&T interpreta el significado operacional.

## 79.4. Telemetría y negocio tienen ciclos de vida distintos

Los datos GPS son más frecuentes y voluminosos.

Los datos empresariales son menos frecuentes pero más críticos.

No deben replicarse ni almacenarse con exactamente las mismas políticas.

## 79.5. No construir una réplica de Goldcar

R&T no necesita competir con el software GPS.

Debe consumir la telemetría y añadir aquello que Goldcar no conoce:

```text
cliente
viaje
costo
rentabilidad
rendición
cobranza
mantenimiento
decisiones
```

---

# 80. Síntesis de la nueva comprensión

La conclusión más importante del nuevo análisis puede resumirse así:

```text
Goldcar sabe:

V5F-XXX está aquí.
```

R&T Control Tower debería saber:

```text
V5F-XXX está aquí
        ↓
haciendo RT-2026-0145
        ↓
para Cliente ABC
        ↓
Cusco → Lima
        ↓
67 % completado
        ↓
739 km recorridos
        ↓
ETA 21:25
        ↓
S/ 3,420 gastados
        ↓
23 % margen estimado
        ↓
0 desviaciones críticas
```

Esto cambia la naturaleza del mapa.

No es:

> “poner Google Maps dentro de la aplicación”.

Es:

> **convertir la geografía y la telemetría en una dimensión más del modelo operativo y económico de R&T.**

---

# 81. Conclusión general V2

Después de incorporar GPS, OCR, evaluador económico, mapa operativo, rutas, geocercas, analítica y automatización, la visión final se vuelve más clara.

El sistema debe evolucionar de:

```text
REGISTRO DIGITAL
      ↓
CENTRO DE CONTROL
      ↓
SISTEMA ANALÍTICO
      ↓
SISTEMA PREDICTIVO
      ↓
MOTOR DE DECISIÓN
      ↓
R&T CONTROL TOWER
```

La función del sistema sería conocer y relacionar:

- qué oportunidades existen;
- cuál conviene aceptar;
- qué tarifa negociar;
- qué unidad asignar;
- qué conductor asignar;
- dónde se encuentra la unidad;
- qué ruta se esperaba;
- qué ruta recorrió realmente;
- cuánto falta para llegar;
- cuánto tiempo se perdió;
- cuánto combustible se utilizó;
- cuánto se gastó;
- qué documentos respaldan esos gastos;
- qué mantenimiento se acerca;
- cuánto se espera cobrar;
- qué cliente está atrasado;
- cuánto dejó realmente el viaje;
- cuál ruta es más rentable;
- cuál unidad es más eficiente;
- qué retorno es más probable;
- qué acción necesita atención.

La visión final no es construir una aplicación con muchas funciones independientes.

Es construir un sistema en el que cada elemento refuerza a los demás:

```text
GPS
+
MAPA
+
VIAJES
+
OCR
+
GASTOS
+
COMBUSTIBLE
+
MANTENIMIENTO
+
COBRANZA
+
HISTÓRICO
        ↓
DATOS CONFIABLES
        ↓
ANÁLISIS
        ↓
DECISIONES MEJORES
```

La frase que resume la versión ampliada de la visión es:

> **R&T Control Tower: un sistema operativo de transporte que representa la operación real de la empresa en tiempo, dinero y espacio; aprende de cada viaje y ayuda a tomar mejores decisiones.**

Y se mantiene la regla de gobierno central:

> **La IA recomienda. Las reglas controlan. La gerencia decide.**

