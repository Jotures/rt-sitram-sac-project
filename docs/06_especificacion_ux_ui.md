# Especificación UX/UI del Sistema Digital — R&T SITRAM SAC

> **Propósito:** definir cómo debe verse, organizarse y comportarse el sistema digital de R&T SITRAM SAC para que gerencia, administración y conductores puedan ejecutar sus tareas con rapidez, claridad y mínimo riesgo de error.

**Empresa:** R&T SITRAM SAC  
**Actividad:** Transporte nacional de carga pesada  
**Tipo de documento:** Especificación UX/UI  
**Versión:** 1.0  
**Estado:** Diseño funcional de experiencia  
**Plataformas objetivo:** Web responsiva + PWA móvil  
**Usuarios principales:** Gerencia, Administración, Conductores y Contabilidad  
**Base documental:** Informe Contextual + Diagnóstico Operativo + Modelo TO-BE + Blueprint Funcional + Arquitectura de Información/Modelo de Datos

---

# 1. Visión de Experiencia

El sistema debe sentirse como un **centro de control operativo**, no como un software contable tradicional.

La experiencia debe permitir comprender rápidamente:

- qué unidades están trabajando;
- cuáles están detenidas;
- dónde se encuentran;
- qué viajes están activos;
- qué problemas necesitan atención;
- qué dinero está pendiente;
- qué mantenimiento se aproxima;
- qué acción debe realizarse después.

La interfaz debe minimizar la necesidad de:

- recordar información;
- buscar conversaciones antiguas;
- revisar varios Excel;
- preguntar constantemente por WhatsApp;
- hacer cálculos manuales;
- navegar entre muchas pantallas.

---

# 2. Principio UX Central

> **La información importante debe aparecer en el momento en que permite tomar una decisión.**

Ejemplos:

Si una unidad está esperando carga, no basta con mostrar:

**Estado: Esperando carga**

Debe mostrar también:

**Esperando carga — 4 días**

y, cuando sea posible:

**Costo acumulado estimado de espera: S/ X**

---

# 3. Objetivos UX

La experiencia debe optimizar cinco variables:

## Velocidad

Las operaciones frecuentes deben realizarse en pocos pasos.

## Claridad

El usuario debe saber siempre:

- dónde está;
- qué está viendo;
- qué puede hacer.

## Prevención

La interfaz debe advertir riesgos antes de que se conviertan en problemas.

## Trazabilidad

Debe ser fácil comprender de dónde proviene cada dato.

## Simplicidad

La complejidad del negocio debe gestionarse internamente sin transferirla innecesariamente al usuario.

---

# 4. Principios de Diseño

## 4.1. Mobile First para conductores

La experiencia del conductor se diseña primero para celular.

## 4.2. Desktop First para administración

El centro administrativo debe aprovechar pantallas grandes para mostrar varias dimensiones simultáneamente.

## 4.3. Responsive siempre

La plataforma administrativa también debe funcionar correctamente desde celular o tablet.

## 4.4. Una acción primaria por contexto

Cada pantalla debe indicar claramente qué acción es la más importante.

## 4.5. Divulgación progresiva

No mostrar veinte campos si el usuario necesita únicamente cinco inicialmente.

## 4.6. Datos antes que decoración

La interfaz debe priorizar legibilidad, estados y acciones.

## 4.7. Colores como soporte, no como lenguaje único

Todo color debe acompañarse de:

- texto;
- icono;
- etiqueta.

---

# 5. Roles UX

El mismo sistema debe cambiar según el usuario.

## Gerencia

Necesita:

- resumen;
- alertas;
- rentabilidad;
- comparación;
- decisiones.

## Administración

Necesita:

- ejecutar;
- registrar;
- programar;
- revisar;
- corregir;
- cerrar procesos.

## Conductor

Necesita:

- saber qué hacer;
- registrar rápidamente;
- enviar evidencia;
- reportar problemas.

## Contabilidad

Necesita:

- consultar;
- validar;
- exportar;
- revisar documentación económica.

---

# 6. Arquitectura Global de Navegación

Para Gerencia y Administración:

```text id="m00xg2"
Inicio
│
├── Operaciones
│   ├── Viajes
│   ├── Programación
│   └── Oportunidades
│
├── Flota
│   ├── Unidades
│   ├── Mantenimiento
│   └── Documentos
│
├── Personal
│   └── Conductores
│
├── Comercial
│   ├── Clientes
│   └── Oportunidades
│
├── Finanzas
│   ├── Gastos
│   ├── Adelantos
│   ├── Rendiciones
│   └── Cobranza
│
├── Reportes
│
└── Configuración
```

---

# 7. Navegación Principal — Escritorio

Se recomienda una **barra lateral fija**.

Contenido:

```text id="h40bmx"
R&T SITRAM

Inicio

OPERACIONES
Viajes
Programación
Oportunidades

GESTIÓN
Flota
Conductores
Clientes

DINERO
Gastos
Rendiciones
Cobranza

CONTROL
Mantenimiento
Documentos
Reportes

Configuración
```

En la parte inferior:

- perfil;
- rol;
- cerrar sesión.

---

# 8. Navegación Móvil Administrativa

En móvil se recomienda navegación inferior con cinco accesos principales:

```text id="1c3q5m"
Inicio
Viajes
Flota
Finanzas
Más
```

El botón **Más** contiene:

- clientes;
- conductores;
- mantenimiento;
- documentos;
- reportes;
- configuración.

---

# 9. Navegación del Conductor

Debe ser mucho más pequeña.

```text id="atqvvo"
Inicio
Mi viaje
Registrar
Historial
Perfil
```

La sección **Registrar** abre:

- Combustible.
- Gasto.
- Incidencia.
- Kilometraje.

---

# 10. Layout General de Escritorio

Estructura:

```text id="rs4kso"
┌─────────────┬────────────────────────────────────┐
│             │ Barra superior                     │
│ Sidebar     ├────────────────────────────────────┤
│             │                                    │
│             │ Contenido                          │
│             │                                    │
│             │                                    │
└─────────────┴────────────────────────────────────┘
```

---

# 11. Barra Superior

Debe contener:

### Izquierda

- título de pantalla;
- breadcrumb cuando corresponda.

### Derecha

- búsqueda global;
- alertas;
- sincronización;
- usuario.

Ejemplo:

```text id="sbbrzd"
Viajes / RT-2026-000145       🔍   🔔 3   Rubén ▾
```

---

# 12. Búsqueda Global

Debe aceptar:

- placa;
- viaje;
- cliente;
- conductor;
- factura.

Ejemplo:

Usuario escribe:

```text id="4nlsbn"
X2Y756
```

Resultados:

```text id="a0acvk"
Unidad X2Y756
Viaje activo RT-145
Últimos viajes
Documentos
```

---

# 13. Diseño Visual General

La identidad visual debe transmitir:

- confiabilidad;
- operación;
- control;
- profesionalismo;
- solidez.

No debe parecer:

- una aplicación bancaria;
- un ERP antiguo;
- una hoja de Excel;
- un software excesivamente técnico.

---

# 14. Sistema de Superficies

Se recomienda utilizar:

## Fondo general

Gris/neutro muy claro.

## Superficie principal

Blanco.

## Tarjetas

Blanco con borde suave.

## Secciones secundarias

Gris claro.

## Alertas

Fondos tonales suaves.

La interfaz debe conservar contraste adecuado incluso en ambientes luminosos.

---

# 15. Tipografía

La tipografía debe priorizar:

- legibilidad;
- números;
- tablas;
- tamaños pequeños.

Puede utilizarse una familia sans-serif contemporánea como:

- Inter;
- Geist;
- similar.

La selección final pertenece a la etapa visual.

---

# 16. Jerarquía Tipográfica

## Título de pantalla

24–32 px.

## Título de sección

18–22 px.

## Texto normal

14–16 px.

## Información secundaria

12–14 px.

## KPI

28–40 px dependiendo del contexto.

---

# 17. Sistema de Estados

Los estados deben visualizarse mediante chips.

Ejemplo:

`En tránsito`

`Esperando carga`

`Disponible`

`Mantenimiento`

`Vencido`

Características:

- color;
- icono opcional;
- texto explícito;
- forma consistente.

---

# 18. Semántica de Color

Propuesta conceptual:

## Verde

Correcto / operativo / pagado.

## Azul

Información / programado / en tránsito.

## Amarillo

Atención / próximo / esperando.

## Naranja

Riesgo elevado.

## Rojo

Crítico / vencido / bloqueo.

## Gris

Inactivo / cerrado / información secundaria.

La paleta visual final deberá validarse posteriormente.

---

# 19. Página de Inicio — Objetivo

La página Inicio debe responder en menos de 10 segundos:

> **¿Cómo está funcionando la empresa en este momento?**

---

# 20. Dashboard — Estructura

Orden recomendado:

```text id="wn5wfy"
1. Alertas críticas
2. Estado de flota
3. Viajes activos
4. Indicadores del mes
5. Próximas acciones
6. Cobranza
7. Mantenimiento
```

---

# 21. Cabecera del Dashboard

```text id="kvjv59"
Buenos días

Domingo, 9 de agosto

3 unidades · 2 operando · 1 disponible
```

Acciones:

`+ Nuevo viaje`

`Registrar gasto`

---

# 22. Alertas Críticas

Si existen riesgos críticos, deben aparecer primero.

Ejemplo:

```text id="kywlq0"
⚠ 2 asuntos requieren atención

X2Y756 lleva 4 días esperando carga en Lima.
[Ver viaje]

ITV de VDR-768 vence en 7 días.
[Ver documento]
```

Si no existen:

```text id="cn8kgb"
✓ No hay alertas críticas
```

---

# 23. Estado de Flota

Mostrar una tarjeta por unidad.

Ejemplo:

```text id="fdvs7c"
┌───────────────────────────────┐
│ X2Y756              EN VIAJE  │
│ Cusco → Lima                  │
│                               │
│ Conductor: Carlos             │
│ Viaje: RT-145                 │
│ Salió: Hoy 07:45              │
│                               │
│ Próxima acción                │
│ Llegada estimada a Lima       │
└───────────────────────────────┘
```

---

# 24. Tarjeta de Unidad Detenida

Ejemplo:

```text id="grjb7y"
X3N-719

ESPERANDO CARGA

Lima

3 días esperando

Última actividad:
Descarga completada
06 ago · 15:42

[Buscar/Registrar retorno]
```

El tiempo detenido debe tener alta visibilidad.

---

# 25. Indicadores Principales

Máximo seis KPIs simultáneos:

```text id="6mesfj"
Viajes
8

Ingresos
S/ 87,400

Utilidad estimada
S/ 18,200

Utilización
71%

Km vacíos
14%

Por cobrar
S/ 23,500
```

Evitar llenar el inicio con métricas secundarias.

---

# 26. Tendencias

Cuando exista suficiente histórico:

```text id="59jadk"
Utilización
71%
↑ 8% vs mes anterior
```

Si no hay suficiente información:

```text id="61u53v"
Sin histórico suficiente
```

Nunca inventar tendencias.

---

# 27. Próximas Acciones

Debe funcionar como lista operativa.

Ejemplo:

```text id="8csy8r"
HOY

○ Revisar rendición RT-143
  Hace 2 días

○ Confirmar carga retorno X2Y756
  Lima

○ Renovar ITV VDR-768
  Vence en 7 días
```

---

# 28. Pantalla Viajes

Encabezado:

```text id="hy1s1d"
Viajes

[Buscar viaje] [Filtros] [+ Nuevo viaje]
```

---

# 29. Vista de Lista de Viajes

Escritorio:

| Viaje | Estado | Unidad | Cliente | Ruta | Fecha | Flete | Resultado |
|---|---|---|---|---|---|---:|---:|

Móvil:

Cada viaje se convierte en tarjeta.

---

# 30. Tarjeta de Viaje Móvil

```text id="8jeeyh"
RT-2026-000145
EN TRÁNSITO

Cusco
↓
Lima

X2Y756 · Carlos

Cliente ABC

Flete
S/ 3,200

[Ver viaje]
```

---

# 31. Filtros de Viajes

Panel lateral o modal:

### Periodo

### Estado operativo

### Estado financiero

### Unidad

### Conductor

### Cliente

### Ruta

### Modalidad

- Directo.
- Tercerizado.

### Situación

- Rendición pendiente.
- Cobranza pendiente.
- Con incidencia.

---

# 32. Crear Nuevo Viaje — Filosofía

No presentar un formulario de 30 campos.

Utilizar un flujo guiado.

```text id="zj8km6"
1 Cliente
2 Servicio
3 Recursos
4 Costos
5 Validación
```

---

# 33. Nuevo Viaje — Paso 1 Cliente

Pantalla:

```text id="tl8qva"
¿Para quién es el viaje?

[ Buscar cliente ]

Clientes recientes

Empresa ABC
Transportes XYZ
Comercial Pérez

[+ Nuevo cliente]
```

Después:

```text id="bjnlkf"
Condición habitual de pago:
7 días

Saldo pendiente:
S/ 8,500
```

Si tiene deuda importante:

```text id="h6z6pc"
⚠ Este cliente mantiene facturas vencidas.
```

---

# 34. Nuevo Viaje — Paso 2 Servicio

Campos:

- origen;
- destino;
- fecha;
- carga;
- toneladas;
- flete;
- adicionales;
- modalidad.

Origen y destino deben utilizar autocompletado cuando exista catálogo.

---

# 35. Selector de Ruta

Ejemplo:

```text id="60euov"
Origen
[Cusco                   ]

Destino
[Lima                    ]

Ruta frecuente detectada:
Cusco → Lima
```

---

# 36. Carga de Retorno

Debe incorporarse desde la creación.

```text id="0oxh7e"
Carga de retorno

○ Confirmada
○ Probable
● No identificada
```

Si no existe:

```text id="8utyjx"
⚠ Este viaje saldrá sin carga de retorno identificada.
```

No debe bloquear automáticamente.

---

# 37. Nuevo Viaje — Paso 3 Recursos

Mostrar unidades disponibles visualmente.

```text id="p45zcx"
Selecciona unidad

○ X2Y756
  Disponible · 18,430 km

○ X3N-719
  ⚠ mantenimiento en 600 km

○ VDR-768
  No disponible · En viaje
```

No mostrar como seleccionable una unidad bloqueada.

---

# 38. Selección de Conductor

```text id="2q3yze"
Selecciona conductor

○ Carlos
  Disponible

○ José
  En viaje

○ Miguel
  Descanso
```

Si no hay conductor:

```text id="rphuu3"
No existen conductores disponibles.

[Ver bolsa de respaldo]
```

---

# 39. Nuevo Viaje — Paso 4 Evaluación

Resumen:

```text id="2q0bsk"
Ingreso esperado
S/ 12,700

Combustible estimado
S/ 7,500

Otros gastos estimados
S/ 1,400

Margen preliminar
S/ 3,800
```

Indicador:

`Margen saludable`

o

`Margen bajo`

---

# 40. Transparencia del Cálculo

Cada costo debe poder expandirse:

```text id="evjxww"
Combustible estimado      S/ 7,500   >
```

Al abrir:

```text id="8jxn1v"
Cusco → Lima          S/ X
Lima → Cusco          S/ X
Estimación adicional  S/ X
```

---

# 41. Nuevo Viaje — Validación Final

Checklist:

```text id="5swcwo"
✓ Unidad disponible

✓ Conductor disponible

✓ SOAT vigente

✓ ITV vigente

✓ Mantenimiento compatible

⚠ Retorno no confirmado
```

CTA principal:

**Programar viaje**

---

# 42. Viaje con Bloqueo

Ejemplo:

```text id="apz3e0"
No se puede programar el viaje

La ITV de X2Y756 está vencida.

[Seleccionar otra unidad]

[Ver documento]
```

Una excepción solo debería aparecer para bloqueos donde la política empresarial la permita.

---

# 43. Detalle de Viaje — Arquitectura

La ficha del viaje será una de las pantallas más importantes.

Cabecera fija:

```text id="puplzf"
RT-2026-000145

Cusco → Lima

EN TRÁNSITO

X2Y756 · Carlos

Cliente ABC

[···]
```

---

# 44. Tabs del Viaje

```text id="27fm15"
Resumen
Operación
Dinero
Documentos
Incidencias
Historial
```

En móvil pueden mostrarse mediante navegación horizontal.

---

# 45. Tab Resumen

Debe mostrar:

### Estado

### Ruta

### Carga

### Unidad

### Conductor

### Cliente

### Flete

### Retorno

### Próxima acción

### Resultado preliminar

---

# 46. Timeline Operativo

Ejemplo:

```text id="rvwguq"
✓ Programado
  08 ago · 17:30

✓ Carga iniciada
  09 ago · 06:45

✓ Salida de Cusco
  09 ago · 08:02

● En tránsito
  Actual

○ Llegada

○ Descarga

○ Retorno

○ Rendición
```

Esto debe reemplazar listas confusas de estados.

---

# 47. Próxima Acción del Viaje

Siempre que sea posible:

```text id="g5ipe7"
Próxima acción

Confirmar llegada a Lima

[Confirmar llegada]
```

La interfaz debe orientar la operación.

---

# 48. Tab Operación

Mostrar:

### Kilometraje

Inicio  
Actual  
Final

### Tramos

### Carga

### Retorno

### Ubicación

### Tiempos

---

# 49. Tab Dinero

Debe separar visualmente:

```text id="cxmzma"
INGRESOS

Flete ida        S/ 3,200
Flete retorno    S/ 8,500
Adicional        S/ 1,000

Total            S/ 12,700
```

Luego:

```text id="ioyo5s"
GASTOS DIRECTOS

Combustible      S/ 7,631
Peajes           S/ ...
Viáticos         S/ ...
Garaje           S/ ...
Otros            S/ ...

Total            S/ ...
```

Después:

```text id="7d28yv"
RESULTADO

Margen directo   S/ ...
Margen operativo S/ ...
Utilidad estimada S/ ...
```

---

# 50. Resultado con Datos Incompletos

Si todavía faltan gastos:

```text id="m3eq13"
Utilidad provisional
S/ 3,518

⚠ Faltan costos por incorporar:
- conductor
- mantenimiento asignado
- gastos generales
```

Nunca presentar como definitiva una cifra incompleta.

---

# 51. Viaje Cerrado

Cuando esté completamente cerrado:

```text id="r2u58m"
✓ Viaje cerrado

Utilidad final
S/ 2,480

Margen
19.5%

Duración
8 días

Km vacíos
0 km
```

---

# 52. Flujo de Cambio de Estado

Los cambios importantes deben realizarse mediante acciones contextuales:

```text id="fqdu0a"
[Iniciar carga]

[Confirmar salida]

[Confirmar llegada]

[Completar descarga]
```

No obligar al usuario a editar manualmente un campo:

```text id="zr61ou"
Estado = EN_TRANSITO
```

---

# 53. Programación de Flota

Debe existir una vista tipo tablero/calendario.

Columnas:

```text id="vi61pq"
Hoy
Mañana
Próximos días
```

Filas:

```text id="6152y5"
X2Y756
X3N-719
VDR-768
```

Mostrar viajes programados y mantenimientos.

---

# 54. Vista Flota

Encabezado:

```text id="q2fwac"
Flota

3 unidades
2 operativas
1 disponible
```

Tarjetas:

- placa;
- estado;
- ubicación;
- conductor;
- kilometraje;
- próximo mantenimiento;
- documentos.

---

# 55. Detalle de Unidad

Cabecera:

```text id="g1y6bu"
X2Y756

2014
32 t

EN VIAJE
```

Acciones:

- Ver viaje actual.
- Registrar odómetro.
- Programar mantenimiento.
- Ver documentos.

---

# 56. Tabs de Unidad

```text id="pbb1xn"
Resumen
Actividad
Mantenimiento
Combustible
Costos
Documentos
Incidencias
```

---

# 57. Resumen de Unidad

Mostrar:

```text id="oujkm5"
Kilometraje actual
428,320 km

Este mes
3 viajes

Utilización
76%

Ingresos
S/ X

Costo combustible
S/ X

Mantenimiento
S/ X
```

---

# 58. Historial de Estados

Visualización recomendada:

```text id="ba9p3a"
09 ago
EN VIAJE
08:00 →

08 ago
DISPONIBLE
18 h

05–08 ago
ESPERANDO CARGA
3 d 4 h
```

Esto permitirá entender pérdida de productividad.

---

# 59. Mantenimiento de Unidad

Componente destacado:

```text id="wwqspj"
Próximo mantenimiento

Cambio de aceite

Actual
428,320 km

Programado
430,000 km

Faltan
1,680 km

[Programar]
```

---

# 60. Centro de Mantenimiento

Vista general:

```text id="ytl1dy"
Mantenimiento

PRÓXIMOS

X2Y756
Cambio aceite
1,680 km

X3N-719
Revisión
6 días

EN TALLER

VDR-768
Sin unidades
```

---

# 61. Crear Orden de Trabajo

Flujo:

```text id="9dna6b"
Unidad
↓
Tipo
↓
Problema
↓
Taller
↓
Fecha
↓
Guardar
```

Debe permitir inicialmente registrar aunque aún no exista diagnóstico.

---

# 62. Orden de Trabajo — Detalle

```text id="pp06vp"
OT-2026-0073

X3N-719

EN TALLER

Ingresó
08 ago · 09:20

Problema
Ruido en suspensión

Taller
Taller ABC
```

Secciones:

- diagnóstico;
- trabajos;
- repuestos;
- costos;
- tiempo detenido.

---

# 63. Conductores — Lista

Mostrar:

```text id="geehs2"
Carlos Quispe
EN VIAJE
X2Y756
Cusco → Lima

José Pérez
DISPONIBLE

Miguel ...
DESCANSO
```

---

# 64. Ficha del Conductor

Debe evitar parecer una evaluación permanente.

Secciones:

- datos;
- disponibilidad;
- documentos;
- viajes;
- rendiciones;
- incidencias.

Indicadores deben incluir contexto.

---

# 65. Experiencia del Conductor — Inicio

Pantalla principal muy simple:

```text id="97eix9"
Buenos días, Carlos

TU VIAJE ACTIVO

RT-2026-000145

Cusco → Lima

X2Y756

EN TRÁNSITO
```

Acciones grandes:

```text id="i5plvt"
[Registrar combustible]

[Registrar gasto]

[Reportar problema]
```

---

# 66. Navegación del Conductor Durante el Viaje

La prioridad debe ser el viaje activo.

No mostrar:

- otros clientes;
- otros conductores;
- rentabilidad empresarial;
- configuraciones administrativas.

---

# 67. Registrar Combustible — Móvil

Flujo:

```text id="hf7atp"
Combustible
```

Campo 1:

**Kilometraje**

Campo 2:

**Cantidad**

Campo 3:

**Unidad**

`Galones` / `Litros`

Campo 4:

**Monto total**

Campo 5:

**Grifo**

Campo 6:

**Foto del comprobante**

CTA:

**Guardar abastecimiento**

---

# 68. Optimización de Captura

El sistema ya conoce:

- viaje;
- unidad;
- conductor.

No debe preguntarlos nuevamente.

---

# 69. Registrar Gasto — Móvil

Pantalla inicial:

```text id="uuctfm"
¿Qué gasto realizaste?
```

Categorías grandes:

```text id="x2a9uz"
Peaje
Comida
Garaje
Hospedaje
Reparación
Otro
```

Después:

```text id="2lr49u"
Monto
S/ [       ]

Foto comprobante
[Tomar foto]

Nota
[Opcional]

[Guardar gasto]
```

---

# 70. Acción Rápida de Cámara

Debe poder abrirse directamente la cámara.

Después de tomar la foto:

```text id="6aob6x"
✓ Foto guardada

Monto
S/ 35.00

Categoría
Peaje

[Registrar]
```

---

# 71. Gasto sin Comprobante

Debe permitirse cuando sea operativamente necesario.

Mostrar:

```text id="btdp7a"
No agregaste comprobante.

○ Continuar sin comprobante
```

Al guardar:

```text id="pj9bho"
Estado:
Pendiente de revisión
```

---

# 72. Registrar Incidencia

Primero preguntar:

```text id="0bs50x"
¿Qué pasó?
```

Opciones:

- Avería.
- Bloqueo.
- Retraso.
- Problema con carga.
- Documentación.
- Otro.

Luego:

- descripción;
- fotografía;
- ubicación;
- severidad.

---

# 73. Incidencia Crítica

Si el conductor marca:

`Crítica`

la interfaz debe mostrar:

```text id="8k7b17"
Este reporte será marcado como urgente para administración.

[Enviar incidencia]
```

No debe intentar sustituir protocolos de emergencia.

---

# 74. Confirmar Llegada

Acción:

```text id="oxn3dz"
Llegué al destino
```

Solicitar:

- kilometraje;
- hora automática;
- observación opcional.

Después:

```text id="sftgju"
✓ Llegada registrada

Próxima acción:
Completar descarga
```

---

# 75. Operación Offline

La interfaz debe indicar claramente el estado de conexión.

Ejemplo:

```text id="y5yakn"
Sin conexión

Puedes seguir registrando información.
Se enviará automáticamente cuando vuelva internet.
```

---

# 76. Indicador de Sincronización

Estados visuales:

```text id="rb4bvn"
✓ Sincronizado

↻ 3 registros pendientes

! Error de sincronización
```

Nunca dejar al usuario sin saber si su información se guardó.

---

# 77. Registro Offline Exitoso

Después de guardar:

```text id="8kbbn7"
✓ Guardado en este dispositivo

Se sincronizará cuando vuelva la conexión.
```

---

# 78. Conflictos de Sincronización

En datos financieros:

```text id="htb1u8"
Necesitamos revisar este registro

Existe otro gasto similar registrado para este viaje.

S/ 150
09 ago · 13:42

[Revisar]
```

No resolver automáticamente si existe riesgo económico.

---

# 79. Clientes — Pantalla Principal

Columnas:

- cliente;
- clasificación;
- viajes;
- facturación;
- deuda;
- último viaje.

Indicadores superiores:

```text id="kboy07"
Clientes activos
24

Con deuda
7

Estratégicos
4
```

---

# 80. Detalle de Cliente

Cabecera:

```text id="76822b"
Empresa ABC

CLIENTE ESTRATÉGICO

12 viajes
S/ X facturado
S/ X pendiente
```

Tabs:

```text id="wttky9"
Resumen
Viajes
Cobranza
Contactos
Historial
```

---

# 81. Estado Financiero del Cliente

Mostrar claramente:

```text id="g4zjew"
Por cobrar
S/ 8,500

Factura más antigua
12 días

Promedio de pago
8 días
```

---

# 82. Cobranza — Inicio

Debe priorizar acciones.

```text id="ns1d1y"
Cobranza

Total pendiente
S/ 34,800

Vencido
S/ 12,500

Por vencer
S/ 22,300
```

---

# 83. Lista de Cobranza

Orden recomendado por urgencia.

```text id="hcqaef"
VENCIDO 12 DÍAS

Empresa ABC
F001-00342

S/ 8,500

[Registrar pago]
```

---

# 84. Registrar Pago

Campos:

- factura;
- monto;
- fecha;
- medio;
- referencia.

Si el monto es menor:

```text id="9ggict"
Pago parcial

Saldo después del pago
S/ 3,500
```

---

# 85. Factura Pagada

Después:

```text id="hnvf3d"
✓ Pago registrado

Factura pagada completamente.
```

Actualizar automáticamente:

- saldo;
- cliente;
- cobranza;
- viaje.

---

# 86. Adelantos

Pantalla por viaje:

```text id="ubu3qb"
Adelantos entregados

08 ago
S/ 1,000

09 ago
S/ 500

Total
S/ 1,500
```

---

# 87. Rendiciones — Bandeja

Mostrar principalmente pendientes.

```text id="d2wopp"
Rendiciones

5 pendientes
2 observadas
```

Tarjeta:

```text id="yx5x72"
RT-145

Carlos

Adelantos
S/ 1,500

Gastos
S/ 1,320

Diferencia
S/ 180

[Revisar]
```

---

# 88. Revisar Rendición

Estructura de dos columnas en escritorio.

Izquierda:

```text id="wv1grs"
Adelantos
```

Derecha:

```text id="06hrhq"
Gastos
```

Al final:

```text id="395fgp"
Adelantos        S/ 1,500
Gastos aprobados S/ 1,320
──────────────────────────
Saldo            S/   180
```

---

# 89. Validar Gasto

Cada gasto:

```text id="5en72u"
Peaje
S/ 18

09 ago · 12:30

[Ver comprobante]

✓ Aprobar
! Observar
```

---

# 90. Gasto Observado

Modal:

```text id="b2uiog"
¿Por qué observas este gasto?

○ Falta comprobante
○ Monto inconsistente
○ Concepto no claro
○ Duplicado
○ Otro

Comentario
[                     ]

[Guardar observación]
```

---

# 91. Cerrar Rendición

Antes:

```text id="2dzga2"
Resumen

12 gastos aprobados
1 observado
```

Si existe uno observado:

```text id="mjzst0"
No puedes cerrar todavía.

Existe 1 gasto pendiente de resolver.
```

---

# 92. Documentos

Pantalla organizada por vencimiento.

```text id="a5qz5m"
Documentos

PRÓXIMOS A VENCER

ITV — VDR-768
7 días

SCTR — Carlos
14 días
```

---

# 93. Detalle de Documento

```text id="tu5uq3"
ITV

Unidad
VDR-768

Vence
16 ago 2026

Estado
PRÓXIMO A VENCER

[Ver archivo]

[Renovar documento]
```

---

# 94. Renovación de Documento

No sobrescribir silenciosamente el anterior.

Crear nueva vigencia.

Flujo:

```text id="t389t7"
Documento anterior
Vence 16 ago

Nuevo documento
Número
Fecha emisión
Fecha vencimiento
Archivo

[Registrar renovación]
```

---

# 95. Alertas — Centro

Clasificar:

```text id="882k6h"
Todas
Críticas
Operación
Mantenimiento
Cobranza
Documentos
```

---

# 96. Tarjeta de Alerta

```text id="0vgtgu"
ALTA

X2Y756 lleva 4 días esperando carga

Lima

Hace 23 min

[Ver viaje]

[Marcar en gestión]
```

---

# 97. Ciclo de una Alerta

Estados:

```text id="kcugtr"
Nueva
↓
Vista
↓
En gestión
↓
Resuelta
```

La alerta no debe desaparecer simplemente porque fue abierta.

---

# 98. Reportes — Inicio

La pantalla debe comenzar por preguntas empresariales.

No por nombres técnicos.

Ejemplos:

```text id="d2m395"
¿Cómo está rindiendo mi flota?

¿Qué rutas dejan más utilidad?

¿Dónde perdemos tiempo?

¿Cuánto estamos gastando en combustible?

¿Quién nos debe?
```

Cada pregunta abre un reporte.

---

# 99. Reporte Flota

Visualización:

```text id="vbqj3d"
Unidad       Utilización     Viajes     Utilidad
X2Y756          78%             3       S/ X
X3N-719         64%             2       S/ X
VDR-768         82%             4       S/ X
```

---

# 100. Reporte Tiempo Improductivo

Gráfico apilado por causa:

```text id="ge6pwx"
X2Y756
████████ Espera carga
██ Taller
█ Otros
```

Debajo:

```text id="dq9x9q"
Total días improductivos
7.4 días
```

---

# 101. Reporte Rentabilidad por Ruta

```text id="csgqki"
Cusco → Lima → Cusco

5 ciclos

Ingresos
S/ X

Costo
S/ X

Utilidad
S/ X

Margen
X%
```

---

# 102. Reporte Kilómetros Vacíos

Mostrar:

```text id="arhn07"
Kilómetros totales
18,400 km

Con carga
15,900 km

Vacíos
2,500 km

13.6%
```

Con comparación mensual cuando exista histórico suficiente.

---

# 103. Reporte Combustible

Debe permitir comparar:

```text id="sj22cm"
Costo/km
Consumo/km
Costo/viaje
```

por:

- unidad;
- conductor;
- ruta.

Evitar conclusiones simplistas sobre conductores sin contexto.

---

# 104. Reporte Cobranza

Visualización:

```text id="cwp7vw"
S/ 34,800 pendientes

0–7 días
S/ X

8–15 días
S/ X

16–30 días
S/ X

+30 días
S/ X
```

---

# 105. Filtros Globales de Reportes

- periodo;
- unidad;
- ruta;
- cliente;
- conductor.

Filtros activos deben ser visibles.

Ejemplo:

```text id="916p3a"
Agosto 2026 ×
X2Y756 ×
```

---

# 106. Estados Vacíos

Una pantalla sin datos no debe parecer rota.

Ejemplo:

```text id="s8quer"
Todavía no hay viajes

Cuando registres el primer viaje aparecerá aquí.

[Crear primer viaje]
```

---

# 107. Estado Vacío de Cobranza

```text id="kqulj0"
✓ No hay pagos pendientes

Todas las facturas registradas están canceladas.
```

---

# 108. Loading States

Evitar grandes pantallas en blanco.

Usar skeletons donde corresponda.

Ejemplo:

```text id="trvkb6"
████████████
██████
████████████████
```

---

# 109. Errores

Formato:

```text id="hiorn2"
No pudimos guardar este gasto

Tu información sigue en pantalla.

[Intentar nuevamente]
```

Nunca borrar información ingresada por un fallo de conexión.

---

# 110. Errores Técnicos

No mostrar al conductor mensajes como:

```text id="sc9zzg"
500 Internal Server Error
```

Mostrar:

```text id="oa9ob8"
No pudimos completar la operación.

Código de referencia: RT-E204
```

---

# 111. Confirmaciones

Solo para acciones de impacto.

Ejemplo:

```text id="i1us0v"
¿Anular viaje RT-145?

Esta acción quedará registrada en el historial.

Motivo
[                     ]

[Cancelar] [Anular viaje]
```

---

# 112. Acciones Destructivas

Nunca utilizar rojo como acción primaria cotidiana.

Reservarlo para:

- eliminar;
- anular;
- bloquear;
- confirmar riesgos críticos.

---

# 113. Undo

Cuando sea seguro:

```text id="ty06wy"
Gasto archivado

[Deshacer]
```

No aplicarlo a operaciones financieras cerradas cuando comprometa auditoría.

---

# 114. Modales

Utilizar únicamente para:

- confirmaciones;
- formularios pequeños;
- selección;
- observaciones.

Procesos largos deben utilizar pantalla completa o drawer.

---

# 115. Drawer Lateral

Ideal para:

- filtros;
- información contextual;
- edición rápida;
- alertas.

---

# 116. Tablas

Las tablas administrativas deben permitir:

- ordenar;
- filtrar;
- buscar;
- fijar columnas esenciales;
- abrir detalle.

No convertir cada tabla en una hoja de Excel editable indiscriminadamente.

---

# 117. Tablas en Móvil

Transformar filas en tarjetas.

No utilizar desplazamiento horizontal extremo como solución principal.

---

# 118. Formularios

Reglas:

- etiquetas siempre visibles;
- unidades junto al campo;
- ejemplos;
- validación inmediata;
- teclado numérico cuando corresponda.

Ejemplo:

```text id="qv5h8z"
Monto
S/ [ 1,250.00 ]
```

---

# 119. Campos Monetarios

Mostrar separador de miles.

Ejemplo:

```text id="adb4ta"
S/ 12,700.00
```

En pantallas operativas puede simplificarse:

```text id="gu82xw"
S/ 12,700
```

cuando los céntimos no sean relevantes.

---

# 120. Kilometraje

Formato:

```text id="xc3egh"
428,320 km
```

No:

```text id="wo8e0v"
428320
```

---

# 121. Toneladas

Mostrar:

```text id="mag7hd"
32.0 t
```

o precisión adicional cuando sea necesaria.

---

# 122. Fechas

Uso contextual.

Hoy:

```text id="3illxx"
Hoy · 08:32
```

Reciente:

```text id="y0nsdi"
08 ago · 17:45
```

Formal:

```text id="m9h96i"
9 ago 2026
```

---

# 123. Tiempo Transcurrido

Especialmente importante para operación:

```text id="2ig9i2"
Esperando carga
3 d 4 h
```

Debe actualizarse automáticamente.

---

# 124. Diseño de KPIs

Cada KPI debe mostrar:

1. Nombre.
2. Valor.
3. Contexto.
4. Tendencia opcional.

Ejemplo:

```text id="mbo9ik"
Utilización de flota

71%

Este mes

↑ 8 pp
```

---

# 125. No Saturar con KPIs

El dashboard no debe mostrar 25 indicadores.

Los KPIs secundarios pertenecen a reportes.

---

# 126. Jerarquía de Alertas

## Crítica

Necesita atención inmediata.

## Alta

Necesita acción pronto.

## Media

Debe programarse.

## Informativa

Contexto.

---

# 127. Notificaciones Push

En una etapa posterior:

Administración:

```text id="cd6shj"
X2Y756 lleva 4 días esperando carga.
```

Conductor:

```text id="yqiv9j"
Nuevo viaje asignado: Cusco → Lima.
```

---

# 128. Privacidad por Rol

Conductor ve:

- su viaje;
- sus adelantos;
- sus gastos.

No ve:

- utilidad empresarial;
- otros conductores;
- deudas globales;
- costos administrativos.

---

# 129. Cambio de Rol

Si un usuario posee más de un rol:

```text id="rhybbp"
Administración ▾
```

Puede cambiar de contexto explícitamente.

Nunca mezclar permisos de manera confusa.

---

# 130. Modo de Gerencia

La gerencia puede tener una versión más ejecutiva del Inicio.

Prioridad:

```text id="kknf5r"
Rentabilidad
Utilización
Cobranza
Riesgos
Flota
```

y menos énfasis en captura operativa.

---

# 131. Modo de Administración

Prioridad:

```text id="g17as8"
Viajes
Unidades
Pendientes
Rendiciones
Alertas
```

---

# 132. Modo Contabilidad

Prioridad:

```text id="ws98p7"
Comprobantes
Gastos
Facturas
Pagos
Exportaciones
```

---

# 133. Diseño Responsive

## >= 1280 px

Sidebar completo.

## 768–1279 px

Sidebar compacto.

## < 768 px

Navegación móvil inferior.

---

# 134. Objetivos de Tamaño Táctil

Botones interactivos móviles:

mínimo aproximado de **44 × 44 px**.

Los botones primarios del conductor pueden ser mayores.

---

# 135. Uso con una Mano

Acciones principales del conductor deben quedar preferentemente en la parte media/baja de la pantalla.

Evitar colocar todo en la esquina superior.

---

# 136. Cámara y Adjuntos

Botón destacado:

```text id="k32s1x"
📷 Tomar foto
```

Después de capturar:

- previsualización;
- repetir;
- confirmar.

---

# 137. Compresión de Imágenes

Debe realizarse técnicamente sin exigir intervención del usuario, conservando suficiente legibilidad del comprobante.

---

# 138. OCR Futuro

Una futura mejora puede detectar:

- monto;
- fecha;
- RUC;
- número de comprobante.

Pero siempre permitir corrección humana.

---

# 139. Componentes Base del Design System

Debe existir una librería reutilizable:

### Button

### Input

### Select

### Search

### Card

### KPI Card

### Status Chip

### Alert

### Modal

### Drawer

### Table

### Tabs

### Timeline

### Empty State

### File Upload

### Camera Capture

### Toast

### Skeleton

### Date Picker

### Currency Input

---

# 140. Botones

## Primary

Acción principal.

## Secondary

Acción alternativa.

## Ghost

Acciones menores.

## Destructive

Anular/eliminar.

---

# 141. Botones con Verbos

Preferir:

```text id="auh7b6"
Guardar gasto
Programar viaje
Registrar pago
Cerrar rendición
```

Evitar:

```text id="kzrixx"
Aceptar
Continuar
Sí
```

cuando no quede claro qué ocurrirá.

---

# 142. Status Chip Reutilizable

Ejemplo:

```text id="liaew4"
[ EN TRÁNSITO ]
```

Debe tener propiedades:

```text id="s7bith"
label
semantic_color
icon
```

---

# 143. Componente “Entity Header”

Patrón reutilizable para:

- viaje;
- unidad;
- conductor;
- cliente;
- mantenimiento.

Ejemplo:

```text id="ri0zzt"
X2Y756

EN VIAJE

2014 · 32 t

[Acción principal] [···]
```

---

# 144. Componente “Summary Card”

Ejemplo:

```text id="vw4l9u"
Combustible

S/ 7,631

3 abastecimientos

[Ver detalle]
```

Reutilizable en viajes y unidades.

---

# 145. Componente “Timeline”

Reutilizable para:

- viaje;
- mantenimiento;
- cobranza;
- historial.

---

# 146. Componente “Action Required”

Patrón:

```text id="30fkqc"
⚠ Requiere atención

Falta registrar el kilometraje final.

[Registrar ahora]
```

---

# 147. Prioridad Visual

Orden conceptual:

```text id="1hmgrt"
Acción requerida
↓
Estado actual
↓
Dato principal
↓
Contexto
↓
Histórico
```

No al revés.

---

# 148. Microcopy

El lenguaje debe ser:

- directo;
- cotidiano;
- profesional;
- comprensible.

Ejemplo preferido:

```text id="nbmmp0"
Faltan 680 km para el próximo mantenimiento.
```

En lugar de:

```text id="s69ltx"
Umbral preventivo próximo a ser alcanzado.
```

---

# 149. Nombres de Funciones

Utilizar términos que el negocio reconoce.

Preferir:

- Viajes.
- Combustible.
- Gastos.
- Rendición.
- Mantenimiento.
- Cobranza.

Evitar terminología empresarial innecesariamente sofisticada.

---

# 150. Onboarding Inicial

Gerencia/administración:

```text id="yswn71"
Bienvenido a R&T SITRAM

Configuremos la operación inicial.

1. Empresa
2. Unidades
3. Conductores
4. Clientes
5. Documentos
```

---

# 151. Onboarding del Conductor

Máximo tres pantallas.

```text id="t0kl0m"
1. Aquí verás tu viaje.

2. Registra combustible y gastos.

3. Si no tienes internet, puedes seguir trabajando.
```

---

# 152. Primer Viaje

La interfaz puede guiar mediante ayudas contextuales.

Ejemplo:

```text id="l60yat"
Este será tu primer viaje registrado.

Te guiaremos paso a paso.
```

Después de unos usos, las ayudas desaparecen.

---

# 153. Accesibilidad

Debe contemplarse:

- contraste;
- tamaños legibles;
- no depender únicamente de color;
- etiquetas;
- estados claros;
- áreas táctiles suficientes;
- navegación mediante teclado en escritorio.

---

# 154. Operación Bajo Sol

Para uso de conductores debe priorizarse:

- contraste alto;
- fondos limpios;
- tipografía suficientemente grande;
- botones claros;
- evitar textos gris muy claro.

---

# 155. Modo Oscuro

Puede considerarse posteriormente.

No es requisito prioritario frente a:

- legibilidad;
- funcionamiento offline;
- velocidad.

---

# 156. Rendimiento Percibido

Después de tocar **Guardar**, proporcionar feedback inmediato.

```text id="dawjja"
Guardando...
```

Luego:

```text id="q76xdn"
✓ Gasto registrado
```

No dejar la interfaz aparentemente congelada.

---

# 157. Operaciones Optimistas

Pueden utilizarse en acciones de bajo riesgo.

Para datos financieros críticos, se debe confirmar persistencia antes de mostrar resultado definitivo.

---

# 158. Favoritos / Recientes

Para acelerar captura:

- clientes recientes;
- rutas recientes;
- proveedores frecuentes;
- categorías frecuentes.

---

# 159. Valores Predeterminados Inteligentes

Ejemplo:

Si el conductor está en su viaje activo:

```text id="ctfmkt"
viaje = RT-145
unidad = X2Y756
conductor = Carlos
fecha = ahora
```

No pedirlos otra vez.

---

# 160. Prellenado Seguro

El usuario siempre debe poder verificar y modificar información cuando corresponda.

---

# 161. Prevención de Duplicados

Si se registra:

```text id="c2vy69"
Grifo ABC
S/ 1,057
13:40
```

y pocos segundos después aparece otro idéntico:

```text id="cc5s7d"
¿Registrar nuevamente?

Encontramos un abastecimiento similar.
```

---

# 162. Diseño de Auditoría

No mostrar logs técnicos por defecto.

En detalle:

```text id="yh73c1"
Historial
```

Ejemplo:

```text id="n7qiru"
09 ago · 14:20
Carlos registró gasto S/ 35

09 ago · 15:02
Ana aprobó gasto
```

---

# 163. Modificaciones Financieras

Si administración cambia un monto:

```text id="66dvjv"
Monto anterior
S/ 150

Nuevo monto
S/ 105

Motivo
[                     ]
```

---

# 164. Cierre de Viaje

Pantalla de revisión:

```text id="ije36h"
Cerrar viaje RT-145

OPERACIÓN
✓ Llegada registrada
✓ Kilometraje final
✓ Descarga

DINERO
✓ Rendición
⚠ 1 gasto pendiente

DOCUMENTOS
✓ Guías

COBRANZA
Pendiente
```

Si solo la cobranza está pendiente:

Permitir cierre operativo.

---

# 165. Estados Separados en UI

Mostrar explícitamente:

```text id="p2lxr3"
Operación
FINALIZADA

Rendición
CERRADA

Cobranza
PENDIENTE
```

Esto es mejor que un único estado ambiguo.

---

# 166. Diseño de Ciclos Operativos

En detalle:

```text id="an9scz"
Ciclo RTC-048

Cusco
↓
Lima
↓
Cusco

2 viajes
8 días
```

Resumen económico del ciclo.

---

# 167. Comparación Ida vs Retorno

```text id="o1hl8k"
IDA
Ingreso S/ 3,200
Costo S/ X

RETORNO
Ingreso S/ 9,500
Costo S/ X
```

Luego:

```text id="x984x0"
CICLO COMPLETO
Utilidad S/ X
```

---

# 168. Carga de Retorno en Dashboard

Cuando una unidad viaje hacia un destino sin retorno:

```text id="paxrnz"
RETORNO

🔴 Sin carga identificada

[Gestionar retorno]
```

Debe ser una señal operativa prioritaria.

---

# 169. Flujo “Gestionar Retorno”

Opciones:

```text id="wccy12"
+ Registrar carga confirmada

+ Registrar oportunidad

Marcar:
Probable

Mantener:
Sin retorno
```

---

# 170. Programación de Mantenimiento vs Viajes

Si existe mantenimiento próximo:

```text id="m1ufi3"
X3N-719

Mantenimiento estimado:
600 km

Viaje previsto:
1,800 km

⚠ El viaje probablemente superará el mantenimiento programado.
```

Acciones:

- Programar mantenimiento antes.
- Seleccionar otra unidad.
- Autorizar operación según política.

---

# 171. Centro de Decisiones

En una futura versión, Gerencia podría disponer de una bandeja:

```text id="ylroj5"
Decisiones pendientes

1 viaje bajo margen
1 cliente con deuda elevada
1 mantenimiento postergado
```

---

# 172. Exportaciones

En reportes:

```text id="0t0i4i"
[Exportar ▾]

PDF
Excel/CSV
```

Los permisos de exportación deben controlarse.

---

# 173. Impresión

Documentos operativos relevantes deben tener vista imprimible limpia.

No imprimir navegación ni botones.

---

# 174. Diseño de Notas

Las notas deben existir como complemento.

Ejemplo:

```text id="z3zql1"
Nota
Cliente pidió entregar antes de las 10 a.m.
```

No sustituir campos estructurados.

---

# 175. Comentarios Internos

En fases posteriores puede existir:

```text id="a4ebze"
@Administración revisar comprobante
```

No es necesario en el MVP.

---

# 176. Preferencias de Usuario

Puede permitir:

- densidad de tabla;
- notificaciones;
- pantalla inicial.

Pero no es prioridad inicial.

---

# 177. Métricas UX a Medir

## Conductores

- tiempo para registrar gasto;
- tiempo para combustible;
- % registros sin error;
- % sincronizaciones exitosas.

## Administración

- tiempo para crear viaje;
- tiempo para cerrar rendición;
- tiempo para encontrar información.

## Negocio

- % viajes completamente registrados;
- % gastos con evidencia;
- % viajes cerrados oportunamente.

---

# 178. Objetivos de Experiencia

Metas iniciales deseables:

### Registrar gasto

< 30 segundos.

### Registrar combustible

< 45 segundos.

### Encontrar viaje

< 10 segundos.

### Saber estado de flota

< 10 segundos.

### Crear viaje normal

< 3 minutos.

Las cifras deberán validarse mediante pruebas reales y no considerarse compromisos técnicos rígidos.

---

# 179. Pruebas de Usabilidad

Antes del desarrollo completo:

Probar prototipos con:

- propietario/gerencia;
- persona administrativa;
- al menos un conductor.

Escenarios:

1. Crear viaje.
2. Registrar combustible.
3. Registrar gasto.
4. Ver unidad detenida.
5. Revisar rendición.
6. Registrar pago.
7. Programar mantenimiento.

---

# 180. Preguntas de Prueba

No preguntar solamente:

> ¿Te gusta?

Preguntar:

> ¿Cómo registrarías el combustible?

> ¿Dónde verías quién debe dinero?

> ¿Qué harías si una unidad se avería?

> ¿Cómo sabes qué unidad está disponible?

Observar si el usuario encuentra naturalmente la acción.

---

# 181. Criterio de Validación UX

Una pantalla está bien diseñada cuando el usuario puede entender:

1. qué está ocurriendo;
2. qué información importa;
3. qué puede hacer;
4. qué ocurrirá después;

sin explicación externa.

---

# 182. MVP UX — Pantallas Prioritarias

## P0 — Imprescindibles

1. Login.
2. Inicio.
3. Viajes.
4. Crear viaje.
5. Detalle de viaje.
6. Flota.
7. Detalle de unidad.
8. Mi viaje conductor.
9. Registrar combustible.
10. Registrar gasto.
11. Rendiciones.
12. Cobranza.
13. Mantenimiento.
14. Alertas.

## P1 — Alta prioridad

15. Clientes.
16. Conductores.
17. Documentos.
18. Incidencias.
19. Reportes.

## P2 — Posterior

20. Oportunidades avanzadas.
21. Pipeline comercial.
22. Analítica avanzada.
23. IA.

---

# 183. Flujo MVP Completo

```text id="irhp4r"
ADMINISTRACIÓN

Inicio
↓
Nuevo viaje
↓
Cliente
↓
Ruta/carga
↓
Unidad/conductor
↓
Programar
↓
Viaje activo
```

```text id="0myttq"
CONDUCTOR

Mi viaje
↓
Confirmar salida
↓
Combustible
↓
Gastos
↓
Incidencias
↓
Confirmar llegada
```

```text id="lqfwjk"
ADMINISTRACIÓN

Viaje finalizado
↓
Revisar gastos
↓
Rendición
↓
Cerrar operación
↓
Facturar
↓
Cobranza
↓
Cerrar financieramente
```

---

# 184. Mapa UX del Producto

```text id="fwh9ek"
                         ┌──────────────┐
                         │    INICIO    │
                         └──────┬───────┘
                                │
          ┌───────────────┬─────┼───────┬───────────────┐
          ↓               ↓     ↓       ↓               ↓
       VIAJES           FLOTA CLIENTES FINANZAS      CONTROL
          │               │             │               │
     ┌────┼─────┐     ┌───┼───┐     ┌───┼────┐     ┌────┼─────┐
     ↓    ↓     ↓     ↓       ↓     ↓        ↓     ↓          ↓
   Crear Detalle Ciclo Unidad Mant. Gastos Rendición Docs   Alertas
                                │
                                ↓
                           CONDUCTOR
                                │
                       ┌────────┼─────────┐
                       ↓        ↓         ↓
                  Combustible  Gasto  Incidencia
```

---

# 185. Pantalla Ideal de Administración al Iniciar el Día

Debe permitir realizar esta revisión:

```text id="chdssx"
1. ¿Dónde está cada unidad?
2. ¿Existe algún problema?
3. ¿Hay unidades esperando?
4. ¿Qué viajes salen hoy?
5. ¿Qué cobranzas requieren seguimiento?
6. ¿Qué mantenimiento se aproxima?
```

Todo sin salir del Dashboard o con un máximo de un clic hacia el detalle.

---

# 186. Pantalla Ideal del Conductor al Iniciar el Día

```text id="hjnlhk"
Tu viaje de hoy

Cusco → Lima

Unidad
X2Y756

Carga
32 t

Salida programada
08:00

[Iniciar viaje]
```

Nada más debe competir visualmente con esa acción.

---

# 187. Pantalla Ideal de Gerencia

```text id="ja3pg2"
Este mes

Utilidad estimada
S/ X

Utilización
X%

Viajes
X

Km vacíos
X%

Por cobrar
S/ X

RIESGOS

1 unidad esperando carga
1 mantenimiento próximo
```

---

# 188. Qué No Debe Hacer la UX

No debe:

- copiar el modelo de base de datos directamente en formularios;
- exponer IDs técnicos;
- obligar a escribir placas repetidamente;
- pedir información que ya conoce;
- mostrar demasiadas tablas al conductor;
- utilizar colores sin etiquetas;
- mezclar operación y contabilidad en una sola vista;
- ocultar el estado de sincronización;
- requerir internet permanente;
- presentar utilidad incompleta como definitiva.

---

# 189. Principio de Reducción de Fricción

Cada campo debe justificar su existencia.

Antes de añadir un campo:

> ¿Es necesario ahora?

Si no:

- inferir;
- prellenar;
- mover a opciones avanzadas;
- hacerlo opcional.

---

# 190. Arquitectura de Diseño Escalable

La experiencia debe funcionar igual si existen:

```text id="j7pn6t"
3 unidades
10 unidades
50 unidades
```

Con tres unidades pueden mostrarse tarjetas.

Con muchas unidades deberá poder cambiarse a:

- tabla;
- filtros;
- agrupaciones.

La arquitectura debe preverlo.

---

# 191. Diseño Preparado para Nuevas Sedes

En una futura expansión podría existir:

```text id="njw2ub"
Cusco
Lima
Arequipa
```

La interfaz podría incorporar:

```text id="4hcwpm"
Sede actual ▾
```

No es requisito del MVP.

---

# 192. Preparación para Clientes Mineros/Corporativos

El diseño futuro debe permitir incorporar requisitos adicionales sin rediseñar el núcleo:

- documentos específicos;
- certificaciones;
- checklist de seguridad;
- conductor autorizado;
- unidad autorizada;
- orden de servicio.

Estos elementos pueden agregarse como requisitos del viaje/cliente.

---

# 193. Preparación para IA

La IA debe aparecer como asistencia contextual, no como centro del producto.

Ejemplos futuros:

```text id="yizjcp"
Analizar este viaje
```

```text id="sqf6y2"
¿Por qué bajó la utilidad este mes?
```

```text id="7drigx"
¿Qué unidad tuvo más tiempo improductivo?
```

---

# 194. Asistente Gerencial Futuro

Podría existir una barra:

```text id="1bimgw"
Pregúntale a R&T

[ ¿Qué ruta dejó más utilidad este mes? ]
```

Las respuestas deberán utilizar exclusivamente datos accesibles al usuario.

---

# 195. AI Suggestions

Ejemplo:

```text id="tet25w"
Sugerencia

X2Y756 tuvo 18% más consumo de combustible que su promedio.

Posibles factores:
- ruta;
- carga;
- tráfico;
- condición mecánica.

[Ver comparación]
```

No presentar una causa como certeza sin evidencia.

---

# 196. Diseño de Confianza

Cada recomendación automática debe explicar:

- qué detectó;
- sobre qué datos;
- qué puede hacer el usuario.

---

# 197. Roadmap UX/UI

## Etapa 1 — Wireframes

Diseñar en baja fidelidad:

- Inicio;
- Viajes;
- Detalle viaje;
- Flota;
- Conductor.

## Etapa 2 — Prototipo operativo

Simular ciclo completo.

## Etapa 3 — Prueba con usuarios

Administración + conductor.

## Etapa 4 — UI visual

Aplicar:

- marca;
- colores;
- tipografía;
- componentes.

## Etapa 5 — Design System

Documentar componentes.

## Etapa 6 — Handoff

Preparar especificaciones para desarrollo.

---

# 198. Entregables UX Siguientes

A partir de esta especificación pueden producirse:

## A. User Flows

Diagramas detallados de cada proceso.

## B. Wireframes

Pantallas estructurales.

## C. Design System

Tokens y componentes.

## D. Prototipo Navegable

Experiencia completa simulada.

## E. UI Final

Diseño visual listo para desarrollo.

---

# 199. User Flows Prioritarios

Antes de diseñar todas las pantallas deben detallarse especialmente:

1. Crear y ejecutar viaje.
2. Buscar carga de retorno.
3. Registrar combustible.
4. Registrar gasto.
5. Rendición.
6. Mantenimiento.
7. Cobranza.
8. Incidencia.
9. Cierre del viaje.

---

# 200. North Star de Experiencia

La UX debe conseguir que, en cualquier momento, la persona responsable pueda abrir el sistema y comprender:

> **qué está pasando con las unidades, qué requiere atención y cómo está impactando económicamente al negocio.**

---

# 201. Criterio Rector de Diseño

Toda pantalla debe responder al menos una de estas preguntas:

### ¿Qué está pasando?

### ¿Qué necesito hacer?

### ¿Qué ocurrió?

### ¿Cuánto costó?

### ¿Cuánto produjo?

### ¿Qué riesgo existe?

### ¿Qué decisión debo tomar?

Si una pantalla no responde ninguna de ellas, probablemente su función debe revisarse.

---

# 202. Resultado de la Especificación UX/UI

Con esta especificación se define una experiencia donde el sistema deja de ser una colección de módulos y se transforma en un flujo coherente.

El usuario administrativo parte de:

```text id="j19372"
ESTADO DE LA OPERACIÓN
```

y puede navegar hacia:

```text id="wq5neb"
UNIDAD
↓
VIAJE
↓
GASTO
↓
DOCUMENTO
↓
RESULTADO
```

El conductor parte de:

```text id="dx8t5r"
MI VIAJE
```

y únicamente recibe las herramientas necesarias para:

```text id="86f48k"
EJECUTAR
↓
REGISTRAR
↓
REPORTAR
```

Gerencia parte de:

```text id="9z2idw"
RESULTADOS
+
RIESGOS
```

y profundiza únicamente cuando necesita investigar.

---

# 203. Encadenamiento del Proyecto

Con este documento, R&T SITRAM SAC ya dispone conceptualmente de seis capas:

```text id="yb1e36"
1. INFORME CONTEXTUAL
   Comprender el negocio

          ↓

2. DIAGNÓSTICO OPERATIVO
   Detectar problemas

          ↓

3. MODELO OPERATIVO OBJETIVO
   Rediseñar la operación

          ↓

4. BLUEPRINT FUNCIONAL
   Definir qué hace el sistema

          ↓

5. ARQUITECTURA DE INFORMACIÓN
   Definir datos y relaciones

          ↓

6. ESPECIFICACIÓN UX/UI
   Definir cómo interactúa el usuario
```

El proyecto ya está suficientemente definido a nivel empresarial y funcional para comenzar a traducirse a decisiones tecnológicas.

---

# 204. Próxima Etapa Recomendada

El siguiente documento debería ser:

# Arquitectura Técnica del Sistema

Su objetivo será convertir estas definiciones en una solución tecnológica concreta.

Deberá definir:

- tipo de aplicación;
- frontend;
- backend;
- base de datos;
- autenticación;
- almacenamiento;
- arquitectura offline-first;
- sincronización;
- seguridad;
- permisos;
- auditoría;
- APIs;
- integración GPS;
- despliegue;
- backups;
- observabilidad;
- estructura del código;
- estrategia de pruebas;
- entornos;
- escalabilidad.

Solo después debería elaborarse el:

# Plan Maestro de Implementación

con:

- fases;
- épicas;
- historias;
- prioridades;
- dependencias;
- criterios de aceptación;
- estrategia piloto;
- rollout.

---

# Conclusión

La experiencia objetivo de R&T SITRAM SAC debe ser mucho más sencilla que la complejidad interna del negocio.

Para **administración**, el sistema debe funcionar como un centro de control.

Para **gerencia**, como una herramienta de decisión.

Para **conductores**, como una herramienta rápida de ejecución y registro.

El principio fundamental será:

> **mostrar a cada persona únicamente la información que necesita, en el momento en que la necesita, con una acción siguiente claramente identificable.**

La calidad del producto no deberá medirse por cuántas pantallas tenga, sino por cuánto reduce:

- incertidumbre;
- tiempo administrativo;
- errores;
- información perdida;
- tiempos improductivos;
- decisiones basadas únicamente en memoria.

Y por cuánto aumenta:

- trazabilidad;
- velocidad;
- control;
- previsibilidad;
- utilización de flota;
- capacidad de decisión;
- rentabilidad.