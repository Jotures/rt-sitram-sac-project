# Plan Maestro de Implementación — Sistema Digital R&T SITRAM SAC

> **Propósito:** transformar la arquitectura empresarial, funcional, de datos, UX/UI y técnica de R&T SITRAM SAC en un programa de implementación ejecutable, incremental y verificable, desde la validación tecnológica inicial hasta el piloto productivo y despliegue completo.

**Empresa:** R&T SITRAM SAC  
**Producto:** Centro de Control Digital R&T  
**Documento:** Plan Maestro de Implementación  
**Versión:** 1.0  
**Estado:** Plan base para ejecución  
**Arquitectura:** PWA local-first / offline-first  
**Frontend objetivo:** React + TypeScript + Vite  
**Base central:** PostgreSQL / Supabase  
**Base local:** SQLite  
**Sincronización:** PowerSync  
**Usuarios:** Gerencia, Administración, Conductores y Contabilidad

---

# 1. Objetivo del Plan

Este documento responde a la pregunta:

> **¿En qué orden debe construirse el sistema para minimizar riesgo y obtener valor operativo lo antes posible?**

El objetivo no es construir todos los módulos definidos anteriormente de manera simultánea.

La estrategia será:

```text id="s0uqug"
VALIDAR
↓
CONSTRUIR FUNDACIONES
↓
IMPLEMENTAR OPERACIÓN
↓
IMPLEMENTAR DINERO DEL VIAJE
↓
CERRAR EL CICLO
↓
CONTROLAR FLOTA
↓
CONTROLAR COBRANZA
↓
MEDIR
↓
PILOTAR
↓
CORREGIR
↓
DESPLEGAR
↓
OPTIMIZAR
```

---

# 2. Principio Rector

El sistema deberá construirse siguiendo una regla:

> **Ninguna capa avanzada debe desarrollarse antes de demostrar que la capa fundamental anterior funciona correctamente en condiciones reales.**

Por ejemplo:

No construir inteligencia artificial antes de tener datos confiables.

No construir dashboards sofisticados antes de poder cerrar correctamente un viaje.

No construir mantenimiento predictivo antes de registrar kilometraje y mantenimientos.

No expandir a todos los conductores antes de validar offline con uno.

---

# 3. Prioridades Globales

Orden de importancia:

1. Integridad de datos.
2. Funcionamiento offline.
3. Sincronización.
4. Seguridad.
5. Viajes.
6. Gastos y combustible.
7. Rendiciones.
8. Mantenimiento.
9. Cobranza.
10. Indicadores.
11. Automatización.
12. Inteligencia artificial.

---

# 4. Alcance Inicial

El objetivo del MVP será conseguir que R&T SITRAM SAC pueda administrar digitalmente un viaje completo.

Desde:

```text id="5lmosg"
PROGRAMACIÓN
```

hasta:

```text id="65l9ax"
CIERRE OPERATIVO
+
CIERRE ECONÓMICO
```

incluyendo:

- unidad;
- conductor;
- carga;
- combustible;
- adelantos;
- gastos;
- comprobantes;
- incidencias;
- kilometraje;
- rendición;
- mantenimiento básico;
- cobranza básica.

---

# 5. Qué NO Pertenece al MVP Inicial

Queda explícitamente fuera del núcleo inicial:

- IA;
- mantenimiento predictivo;
- OCR avanzado;
- integración bancaria;
- optimización automática de rutas;
- facturación electrónica integrada;
- integración GPS profunda;
- CRM avanzado;
- portal de clientes;
- aplicación nativa Android;
- aplicación iOS independiente;
- microservicios;
- data warehouse.

Estas capacidades podrán añadirse posteriormente.

---

# 6. Estrategia General de Implementación

El proyecto se divide en diez fases.

| Fase | Nombre |
|---|---|
| 0 | Preparación y decisiones |
| 1 | Technical Spike |
| 2 | Fundación de plataforma |
| 3 | Núcleo maestro |
| 4 | Operaciones y viajes |
| 5 | Dinero del viaje |
| 6 | Cierre, mantenimiento y documentos |
| 7 | Cobranza y rentabilidad |
| 8 | Dashboard y reportes |
| 9 | Piloto productivo |
| 10 | Rollout y estabilización |

---

# FASE 0 — PREPARACIÓN Y DECISIONES

# 7. Objetivo

Preparar el proyecto para que desarrollo pueda comenzar sin ambigüedades fundamentales.

---

# 8. Épica 0.1 — Repositorio

Crear repositorio principal:

```text id="j50o48"
rt-sitram/
```

Estructura inicial:

```text id="m3kvfr"
apps/
  web/

packages/
  domain/
  ui/
  shared/

supabase/
  migrations/
  functions/
  tests/

powersync/
  schema/
  streams/

docs/
  architecture/
  adr/

tests/
```

---

# 9. Épica 0.2 — ADR Iniciales

Crear los Architecture Decision Records:

```text id="qwtyvr"
ADR-001 PWA como cliente principal

ADR-002 Arquitectura offline-first

ADR-003 PowerSync para sincronización

ADR-004 Supabase/PostgreSQL como backend

ADR-005 UUID como identificadores

ADR-006 Registros financieros cerrados inmutables

ADR-007 Monolito modular

ADR-008 Storage privado

ADR-009 Estados operativo/administrativo/financiero separados
```

---

# 10. Épica 0.3 — Convenciones

Definir:

- idioma del código;
- nomenclatura SQL;
- nombres de tablas;
- nombres de columnas;
- formato de migraciones;
- política Git;
- ramas;
- Pull Requests;
- commits;
- revisión.

Recomendación:

Código:

```text id="qgoaaa"
inglés
```

Interfaz:

```text id="i2hig6"
español
```

---

# 11. Épica 0.4 — Definition of Done

Toda funcionalidad deberá cumplir:

- código terminado;
- pruebas;
- validaciones;
- permisos;
- manejo de errores;
- mobile cuando corresponda;
- persistencia;
- sincronización cuando aplique;
- auditoría cuando aplique;
- documentación mínima.

---

# 12. Gate de Fase 0

No iniciar construcción funcional hasta disponer de:

- repositorio;
- convenciones;
- entornos definidos;
- ADR;
- estructura del proyecto;
- Definition of Done.

---

# FASE 1 — TECHNICAL SPIKE

# 13. Objetivo

Resolver primero los mayores riesgos técnicos.

La pregunta fundamental:

> **¿Puede realmente un conductor utilizar la PWA en carretera sin conexión, cerrar la aplicación y sincronizar posteriormente sin perder ni duplicar información?**

---

# 14. Spike 1 — Persistencia Offline

Construir únicamente:

```text id="xbziag"
Login
↓
Viaje ficticio
↓
Registrar gasto
```

Prueba:

1. iniciar online;
2. descargar datos;
3. activar modo avión;
4. registrar gasto;
5. cerrar PWA;
6. cerrar navegador;
7. volver a abrir;
8. verificar gasto.

### Criterio de aceptación

El gasto permanece.

---

# 15. Spike 2 — Sincronización

Continuar escenario:

1. registrar varios gastos offline;
2. recuperar internet;
3. sincronizar;
4. consultar PostgreSQL.

### Criterios

- todos llegan;
- ninguno se duplica;
- IDs se conservan;
- usuario ve estado sincronizado.

---

# 16. Spike 3 — Combustible

Registrar offline:

- kilometraje;
- cantidad;
- unidad;
- monto;
- proveedor.

Verificar sincronización.

---

# 17. Spike 4 — Fotografías

Prueba:

```text id="ssh0xx"
Modo avión
↓
Tomar foto
↓
Asociarla a gasto
↓
Cerrar aplicación
↓
Abrir
↓
Recuperar internet
↓
Subir a Storage
```

### Criterios

- fotografía no se pierde;
- no se duplica;
- queda relacionada al gasto correcto;
- puede visualizarse posteriormente.

---

# 18. Spike 5 — RLS

Crear usuarios de prueba:

```text id="lu6723"
Gerencia

Administración

Conductor A

Conductor B
```

Probar:

### Conductor A

Puede ver su viaje.

No puede ver viaje de B.

No puede consultar utilidad general.

### Administración

Puede consultar viajes de R&T.

### Usuario ajeno

No puede consultar registros empresariales.

---

# 19. Spike 6 — Conflictos

Simular:

### Dispositivo A offline

modifica información.

### Administración online

modifica la misma entidad.

Recuperar conexión.

Verificar resultado.

---

# 20. Spike 7 — Operación Crítica Server-Side

Construir prueba de:

```text id="549yo9"
close_settlement()
```

Debe ejecutarse como operación transaccional.

---

# 21. Dispositivos de Prueba

El Technical Spike no debe limitarse al emulador.

Debe probarse en:

- Android real similar al utilizado por conductor;
- laptop/PC;
- Wi-Fi;
- datos móviles;
- modo avión;
- conexión intermitente.

---

# 22. Gate Fase 1

Para continuar:

- offline persiste;
- sync funciona;
- fotos funcionan;
- RLS funciona;
- no existen duplicados críticos;
- conflicto tiene estrategia conocida;
- dispositivo objetivo funciona.

Si cualquiera de estos puntos falla, se corrige antes de desarrollar módulos mayores.

---

# FASE 2 — FUNDACIÓN DE PLATAFORMA

# 23. Objetivo

Construir la infraestructura permanente del producto.

---

# 24. Épica 2.1 — Proyecto Supabase

Configurar:

- proyecto;
- PostgreSQL;
- Auth;
- Storage;
- variables;
- entornos.

---

# 25. Épica 2.2 — Migraciones

Crear migraciones iniciales.

Orden sugerido:

```text id="3nixyd"
001 companies

002 profiles

003 roles

004 clients

005 vehicles

006 drivers

007 trips

008 expenses

009 fuel_entries

010 advances

011 settlements

012 maintenance

013 documents

014 invoices

015 payments

016 incidents

017 alerts

018 audit_events
```

No tienen que desarrollarse funcionalmente todas inmediatamente, pero el núcleo estructural debe ser coherente.

---

# 26. Épica 2.3 — RLS

Crear políticas desde el comienzo.

No esperar al final.

Regla base:

```text id="al2ye7"
registro.empresa_id
=
usuario.empresa_id
```

---

# 27. Épica 2.4 — Auth

Implementar:

- login;
- logout;
- recuperación de sesión;
- usuario deshabilitado;
- protección de rutas.

---

# 28. Épica 2.5 — Storage

Crear buckets privados.

Estructura inicial:

```text id="00j2qo"
companies/
  {empresa}/
    trips/
    vehicles/
    drivers/
```

---

# 29. Épica 2.6 — PowerSync

Configurar:

- esquema local;
- streams;
- connector;
- upload;
- estado de sincronización.

---

# 30. Épica 2.7 — PWA

Configurar:

- manifest;
- iconos;
- service worker;
- offline shell;
- instalación.

---

# 31. Épica 2.8 — Observabilidad Básica

Registrar:

- errores;
- app version;
- sync status;
- last successful sync.

---

# 32. Gate Fase 2

Debe existir una aplicación que:

- instala;
- autentica;
- abre offline después de sincronizar;
- guarda datos locales;
- sincroniza;
- respeta RLS.

---

# FASE 3 — NÚCLEO MAESTRO

# 33. Objetivo

Construir los datos fundamentales utilizados por todas las demás funciones.

---

# 34. Épica 3.1 — Empresa

Implementar:

- datos básicos;
- configuración;
- moneda;
- timezone.

---

# 35. Épica 3.2 — Unidades

Funciones:

- listar;
- crear;
- editar;
- consultar detalle;
- activar/desactivar.

Campos esenciales:

- placa;
- año;
- capacidad;
- propietario;
- kilometraje;
- estado.

---

# 36. Épica 3.3 — Estado de Unidad

Registrar historial:

```text id="qmqcp2"
DISPONIBLE
EN_VIAJE
MANTENIMIENTO
ESPERANDO_CARGA
SIN_CONDUCTOR
...
```

Regla:

solo un estado activo simultáneo.

---

# 37. Épica 3.4 — Conductores

Funciones:

- listar;
- crear;
- editar;
- disponibilidad;
- documentos básicos.

---

# 38. Épica 3.5 — Clientes

Funciones:

- crear;
- editar;
- buscar;
- historial básico.

Campos mínimos:

- razón social/nombre;
- documento;
- teléfono;
- tipo de relación;
- condición de pago.

---

# 39. Épica 3.6 — Proveedores

Registrar:

- grifos;
- talleres;
- repuesteras;
- otros.

---

# 40. Épica 3.7 — Catálogos

Crear:

- categorías de gasto;
- tipos de incidencia;
- tipos de mantenimiento;
- medios de pago;
- unidades de volumen;
- tipos de documentos.

---

# 41. Datos Iniciales R&T

Carga inicial:

### Unidades

- X2Y756.
- X3N-719.
- VDR-768.

### Conductores

Tres conductores actuales.

### Clientes

Solo cartera activa y relevante.

### Proveedores

Grifos/talleres principales.

---

# 42. Criterios de aceptación Fase 3

Administración puede:

- consultar unidades;
- consultar conductores;
- consultar clientes;
- editar información;
- trabajar con esos datos offline cuando corresponda.

---

# FASE 4 — OPERACIONES Y VIAJES

# 43. Objetivo

Construir el corazón del sistema.

---

# 44. Épica 4.1 — Crear Viaje

Flujo:

```text id="ird5k7"
Cliente
↓
Servicio
↓
Unidad
↓
Conductor
↓
Validación
↓
Programar
```

---

# 45. Historia de Usuario

> Como administrador, quiero crear un viaje y asignarle cliente, unidad y conductor para poder controlar toda la operación desde un único registro.

### Criterios

- código único;
- cliente requerido;
- origen;
- destino;
- fecha;
- unidad disponible;
- conductor disponible.

---

# 46. Épica 4.2 — Estados Separados

Implementar:

```text id="0968o5"
operational_status

administrative_status

financial_status
```

---

# 47. Épica 4.3 — Transiciones

Acciones:

```text id="04v2bn"
Programar

Iniciar carga

Iniciar viaje

Registrar llegada

Completar descarga

Esperar retorno

Iniciar retorno

Finalizar operación
```

No editar estados manualmente desde un select ordinario.

---

# 48. Épica 4.4 — Historial

Cada transición debe guardar:

- fecha;
- usuario;
- estado anterior;
- nuevo;
- observación.

---

# 49. Épica 4.5 — Kilometraje

Registrar:

- salida;
- llegada;
- combustible;
- mantenimiento.

Validación:

nuevo valor no puede disminuir silenciosamente.

---

# 50. Épica 4.6 — Carga

Registrar:

- descripción;
- toneladas;
- origen;
- destino;
- adicionales.

---

# 51. Épica 4.7 — Retorno

Campo visible:

```text id="6dnodw"
CONFIRMADO

PROBABLE

SIN IDENTIFICAR
```

El Dashboard debe destacar viajes sin retorno.

---

# 52. Épica 4.8 — Aplicación del Conductor

Pantalla:

# Mi Viaje

Acciones principales:

- iniciar;
- combustible;
- gasto;
- incidencia;
- llegada.

---

# 53. Épica 4.9 — Timeline

Mostrar:

```text id="qc2yqa"
Programado
↓
Carga
↓
Salida
↓
Tránsito
↓
Llegada
↓
Descarga
↓
Retorno
↓
Finalizado
```

---

# 54. Épica 4.10 — Offline

Todo el flujo esencial del conductor debe funcionar sin conexión.

---

# 55. Tests críticos Fase 4

- viaje online;
- viaje offline;
- cierre y reapertura app;
- cambio de estado;
- kilometraje;
- conductor incorrecto;
- unidad ocupada;
- documento crítico vencido.

---

# 56. Gate Fase 4

Debe poder ejecutarse digitalmente un viaje físico completo sin utilizar Excel para reconstruir su operación.

---

# FASE 5 — DINERO DEL VIAJE

# 57. Objetivo

Relacionar el movimiento físico con el movimiento económico.

---

# 58. Épica 5.1 — Adelantos

Administración registra:

- viaje;
- conductor;
- monto;
- fecha;
- medio.

---

# 59. Épica 5.2 — Gastos

Conductor puede registrar:

- categoría;
- monto;
- comprobante;
- nota.

Debe funcionar offline.

---

# 60. Épica 5.3 — Combustible

Registrar:

- kilometraje;
- cantidad;
- unidad;
- precio;
- monto;
- proveedor;
- comprobante.

---

# 61. Épica 5.4 — Evidencias

Fotografía:

- almacenamiento local inicial;
- cola;
- subida;
- estado visible.

---

# 62. Épica 5.5 — Validación de Gastos

Estados:

```text id="3rawzt"
PENDIENTE
APROBADO
OBSERVADO
RECHAZADO
```

---

# 63. Épica 5.6 — Gastos Generales

Administración puede registrar gastos:

```text id="xr345j"
VIAJE
UNIDAD
GENERAL
```

---

# 64. Épica 5.7 — Detección Básica de Duplicados

Advertir si existe:

- mismo viaje;
- mismo monto;
- fecha cercana;
- mismo comprobante.

No borrar automáticamente.

---

# 65. Tests Fase 5

- gasto offline;
- foto offline;
- combustible;
- múltiples adelantos;
- duplicado;
- gasto sin comprobante;
- gasto observado;
- sincronización interrumpida.

---

# 66. Gate Fase 5

Al terminar un viaje debe poder saberse:

- cuánto dinero se entregó;
- cuánto combustible se utilizó;
- qué otros gastos existieron;
- qué comprobantes respaldan cada movimiento.

---

# FASE 6 — RENDICIONES, MANTENIMIENTO Y DOCUMENTOS

# 67. Épica 6.1 — Rendición

Crear automáticamente una rendición vinculada al viaje.

Mostrar:

```text id="niehjd"
Adelantos
Gastos aprobados
Saldo
```

---

# 68. Épica 6.2 — Revisión

Administración puede:

- aprobar;
- observar;
- rechazar gastos.

---

# 69. Épica 6.3 — Cierre

RPC:

```text id="gn2qbn"
close_settlement()
```

Debe:

1. validar;
2. calcular;
3. cerrar;
4. auditar.

---

# 70. Épica 6.4 — Reapertura

Solo rol autorizado.

Requiere:

- motivo;
- auditoría.

---

# 71. Épica 6.5 — Planes de Mantenimiento

Registrar:

- unidad;
- servicio;
- frecuencia km;
- frecuencia tiempo;
- último servicio.

---

# 72. Épica 6.6 — Próximo Mantenimiento

Calcular:

```text id="n98gfk"
kilometraje objetivo
-
kilometraje actual
```

---

# 73. Épica 6.7 — Órdenes de Trabajo

Registrar:

- problema;
- taller;
- entrada;
- salida;
- diagnóstico;
- costo;
- repuestos.

---

# 74. Épica 6.8 — Estado de Unidad

Al iniciar mantenimiento:

```text id="vaa106"
MANTENIMIENTO
```

o:

```text id="i59fh5"
REPARACIÓN
```

Debe impedir programación según reglas.

---

# 75. Épica 6.9 — Documentos

Registrar:

- SOAT;
- ITV;
- SCTR;
- otros.

Con:

- emisión;
- vencimiento;
- archivo.

---

# 76. Épica 6.10 — Renovación

Nunca reemplazar silenciosamente documento histórico.

Crear nueva vigencia.

---

# 77. Épica 6.11 — Alertas

Generar:

- mantenimiento próximo;
- mantenimiento vencido;
- documento próximo;
- documento vencido;
- rendición pendiente.

---

# 78. Gate Fase 6

El sistema debe poder impedir o advertir que una unidad con bloqueo crítico sea programada.

Además, una rendición debe poder cerrarse completamente con trazabilidad.

---

# FASE 7 — COBRANZA Y RENTABILIDAD

# 79. Objetivo

Cerrar el ciclo económico.

---

# 80. Épica 7.1 — Facturas

Registrar:

- cliente;
- viaje;
- serie;
- número;
- fecha;
- vencimiento;
- monto.

No implica todavía integración electrónica.

---

# 81. Épica 7.2 — Pagos

Registrar:

- factura;
- monto;
- fecha;
- medio;
- referencia.

Permitir:

- pago parcial;
- pago completo.

---

# 82. Épica 7.3 — Saldo

Derivar:

```text id="escwv9"
factura
-
pagos
=
saldo
```

---

# 83. Épica 7.4 — Estados

```text id="zqb2xb"
POR_FACTURAR

POR_COBRAR

PARCIAL

PAGADO

VENCIDO
```

---

# 84. Épica 7.5 — Cobranza

Pantalla:

```text id="l8g779"
Total pendiente

Vencido

Por vencer
```

---

# 85. Épica 7.6 — Alertas de Cobranza

Generar automáticamente según vencimiento.

---

# 86. Épica 7.7 — Rentabilidad Directa

Calcular:

```text id="hxje0c"
Ingresos
-
Combustible
-
Gastos directos
=
Margen directo
```

---

# 87. Épica 7.8 — Rentabilidad Operativa

Añadir:

- mantenimiento atribuible;
- conductor;
- otros costos de unidad.

Solo cuando exista una metodología validada.

---

# 88. Épica 7.9 — Profit Snapshot

Al cerrar financieramente:

guardar resultado aprobado.

---

# 89. Gate Fase 7

Debe poder responderse con datos:

> ¿Cuánto ingresó este viaje?

> ¿Cuánto gastó?

> ¿Cuánto falta cobrar?

> ¿Qué margen produjo?

---

# FASE 8 — DASHBOARD Y REPORTES

# 90. Objetivo

Transformar información transaccional en gestión.

---

# 91. Épica 8.1 — Dashboard Operativo

Mostrar:

- unidades;
- estado;
- ubicación textual/GPS futura;
- viajes;
- espera;
- próximas acciones.

---

# 92. Épica 8.2 — KPIs Iniciales

Solo diez:

1. Viajes del mes.
2. Toneladas.
3. Ingresos.
4. Costos directos.
5. Margen.
6. Utilización.
7. Días detenidos.
8. Km vacíos.
9. Por cobrar.
10. Mantenimiento próximo.

---

# 93. Épica 8.3 — Utilización de Flota

Construir desde historial de estados.

Debe permitir:

```text id="5dannj"
Productivo

Esperando carga

Taller

Sin conductor

Bloqueado
```

---

# 94. Épica 8.4 — Reporte por Unidad

Mostrar:

- viajes;
- ingresos;
- combustible;
- mantenimiento;
- días detenidos;
- margen.

---

# 95. Épica 8.5 — Reporte por Ruta

Mostrar:

- viajes;
- toneladas;
- ingresos;
- costos;
- margen;
- km vacíos.

---

# 96. Épica 8.6 — Reporte de Cliente

Mostrar:

- viajes;
- facturación;
- saldo;
- tiempo de pago;
- margen.

---

# 97. Épica 8.7 — Tiempo Improductivo

Pregunta central:

> ¿Por qué nuestras unidades estuvieron detenidas?

---

# 98. Regla de Reportes

No introducir más KPIs hasta que los existentes se utilicen para decisiones reales.

---

# FASE 9 — PILOTO PRODUCTIVO

# 99. Objetivo

Validar el sistema con una operación real.

---

# 100. Alcance

Elegir:

```text id="w4yvc3"
1 unidad
+
1 conductor
+
1 administrador
+
1 ruta frecuente
```

---

# 101. Qué Registrar

Todo:

- programación;
- salida;
- combustible;
- gastos;
- fotografías;
- incidencias;
- llegada;
- retorno;
- rendición;
- factura;
- pago.

---

# 102. Operación Paralela

Durante los primeros viajes puede mantenerse temporalmente el proceso anterior como respaldo.

Pero debe evitarse que la duplicación se convierta en permanente.

Objetivo:

comparar y validar.

---

# 103. Métricas del Piloto

Medir:

### UX

- tiempo registrar gasto;
- tiempo registrar combustible;
- errores;
- campos confusos.

### Técnico

- errores de sincronización;
- fotos pendientes;
- crashes;
- conflictos.

### Datos

- gastos completos;
- viaje completo;
- documentos completos.

### Negocio

- utilidad calculable;
- tiempos muertos visibles.

---

# 104. Reunión Post-Viaje

Después de cada viaje piloto:

Preguntar al conductor:

- ¿qué fue difícil?
- ¿qué sobró?
- ¿qué faltó?
- ¿qué tardó demasiado?
- ¿qué no entendiste?

Preguntar a administración:

- ¿qué tuviste que corregir?
- ¿qué información faltó?
- ¿qué seguías buscando fuera del sistema?

---

# 105. Registro de Hallazgos

Clasificar:

```text id="buheab"
CRÍTICO

ALTO

MEDIO

BAJO
```

---

# 106. Problema Crítico

Ejemplo:

- datos perdidos;
- gasto duplicado;
- viaje imposible de cerrar;
- permiso incorrecto.

Bloquea rollout.

---

# 107. Problema Alto

Ejemplo:

- flujo confuso;
- demasiados pasos;
- foto difícil de cargar.

Debe corregirse antes de expansión completa.

---

# 108. Gate del Piloto

No ampliar hasta cumplir:

- cero pérdida de datos;
- cero duplicados financieros críticos;
- sync estable;
- conductor puede usarlo;
- administración puede cerrar viaje;
- rentabilidad calculable;
- RLS validado;
- errores críticos resueltos.

---

# FASE 10 — ROLLOUT

# 109. Etapa 10.1 — Segundo Conductor

Añadir:

- segunda unidad;
- segundo conductor.

Observar conflictos y concurrencia.

---

# 110. Etapa 10.2 — Tercera Unidad

Incorporar flota completa.

---

# 111. Etapa 10.3 — Gerencia

Activar:

- dashboards;
- reportes;
- métricas.

---

# 112. Etapa 10.4 — Contabilidad

Dar acceso limitado a:

- gastos;
- comprobantes;
- facturas;
- pagos;
- exportaciones.

---

# 113. Etapa 10.5 — Retiro de Registros Duplicados

Cuando el sistema sea estable:

identificar qué Excel o registros ya no deben mantenerse.

No continuar eternamente con:

```text id="p5msyo"
Sistema
+
Excel
+
WhatsApp
+
papel
```

para la misma información.

---

# 114. Rol de WhatsApp Después del Rollout

WhatsApp queda para:

- comunicación;
- coordinación;
- urgencias.

No para:

- registro definitivo de gastos;
- archivo de comprobantes;
- historial de viajes;
- mantenimiento.

---

# 115. Rol de Excel

Debe quedar principalmente para:

- análisis extraordinarios;
- exportación;
- requerimientos contables específicos.

No como fuente principal de verdad operacional.

---

# 116. Estrategia de Datos Iniciales

No migrar toda la información histórica desde 2013.

---

# 117. Datos que Sí Conviene Migrar

- unidades activas;
- conductores;
- clientes activos;
- proveedores;
- documentos vigentes;
- mantenimientos recientes confiables;
- cuentas por cobrar actuales.

---

# 118. Datos que Pueden Archivarse

- Excel históricos;
- reportes antiguos;
- documentos no necesarios diariamente.

---

# 119. Regla de Migración

> **Dato dudoso no se convierte automáticamente en dato oficial del nuevo sistema.**

---

# 120. Plan de Pruebas Integral

El proyecto debe tener cinco niveles.

---

# 121. Nivel 1 — Unit Tests

Dominio:

```text id="63q8r3"
calculateSettlement

calculateMargin

calculateInvoiceBalance

validateTripTransition

canScheduleVehicle
```

---

# 122. Nivel 2 — DB Tests

Validar:

- constraints;
- foreign keys;
- unique;
- funciones;
- triggers cuando existan.

---

# 123. Nivel 3 — RLS Tests

Cada rol.

---

# 124. Nivel 4 — Sync Tests

Online/offline.

---

# 125. Nivel 5 — End-to-End

Flujo completo.

---

# 126. E2E Crítico 1

```text id="n549e3"
Crear viaje
↓
Asignar
↓
Salir
↓
Gastar
↓
Retornar
↓
Rendir
↓
Facturar
↓
Cobrar
↓
Cerrar
```

---

# 127. E2E Crítico 2

```text id="8msolh"
Viaje
↓
Modo avión
↓
3 gastos
↓
2 combustibles
↓
1 incidencia
↓
foto
↓
reinicio aplicación
↓
internet
↓
sync
```

---

# 128. E2E Crítico 3

```text id="deepql"
Unidad con ITV vencida
↓
intentar programar
↓
bloqueo
```

---

# 129. E2E Crítico 4

```text id="j0d4jh"
Mantenimiento vencido
↓
advertencia/bloqueo según regla
```

---

# 130. E2E Crítico 5

```text id="u9dqgl"
Pago parcial
↓
saldo
↓
segundo pago
↓
factura pagada
```

---

# 131. Estrategia de Seguridad

Antes de producción:

- revisar RLS;
- revisar Storage;
- revisar permisos;
- eliminar secretos del cliente;
- revisar logs;
- probar escalada de privilegios.

---

# 132. Checklist de Seguridad

```text id="2vh8p7"
□ RLS en tablas expuestas

□ Buckets privados

□ Service role solo servidor

□ Usuario desactivado realmente pierde acceso

□ Conductor no ve otros viajes

□ Auditoría activa

□ Pagos no se eliminan físicamente

□ Rendiciones cerradas protegidas
```

---

# 133. Estrategia de Backup

Antes del piloto:

- backup PostgreSQL configurado;
- estrategia Storage definida;
- procedimiento de restauración escrito.

---

# 134. Prueba de Restauración

Realizar:

```text id="8g3k88"
backup
↓
restaurar en staging
↓
validar
```

antes de considerar terminada la preparación productiva.

---

# 135. Estrategia de Observabilidad

Registrar:

- error rate;
- sync failures;
- pendientes;
- attachments pendientes;
- versión aplicación;
- última sincronización.

---

# 136. Métricas de Salud Técnica

```text id="sji8jx"
Sync success %

Pending operations

Failed attachments

Application crashes

RPC errors
```

---

# 137. Métricas de Adopción

```text id="rbvgzs"
% viajes registrados

% gastos registrados digitalmente

% gastos con comprobante

% rendiciones cerradas

% unidades con mantenimiento actualizado
```

---

# 138. Métricas de Valor Empresarial

Después de obtener suficiente histórico:

```text id="d5f681"
Utilización

Días detenidos

Km vacíos

Margen/viaje

Cobranza

Combustible/km
```

---

# 139. Roadmap de Releases

## v0.1 — Technical Foundation

- Auth.
- PWA.
- SQLite.
- PowerSync.
- RLS.

## v0.2 — Masters

- unidades;
- conductores;
- clientes.

## v0.3 — Trips

- viajes;
- estados;
- conductor móvil.

## v0.4 — Trip Money

- combustible;
- gastos;
- adelantos.

## v0.5 — Settlement

- rendición;
- cierre.

## v0.6 — Fleet Control

- mantenimiento;
- documentos;
- incidencias.

## v0.7 — Collections

- facturas;
- pagos;
- cobranza.

## v0.8 — Analytics

- dashboards;
- reportes.

## v0.9 — Pilot Hardening

- errores;
- UX;
- performance;
- seguridad.

## v1.0 — Production

Operación completa estable.

---

# 140. Dependencias Críticas

```text id="jsdul8"
PowerSync spike
     ↓
Viajes offline
     ↓
Gastos offline
     ↓
Rendiciones
```

```text id="ttm0uc"
Odómetro
     ↓
Mantenimiento
     ↓
Alertas
```

```text id="cc2yei"
Viajes
+
Gastos
+
Combustible
     ↓
Rentabilidad
```

```text id="0azzra"
Facturas
+
Pagos
     ↓
Cobranza
```

---

# 141. Qué Puede Construirse en Paralelo

Una vez resuelta la fundación:

### Equipo A

Viajes.

### Equipo B

Design system / UX.

### Equipo C

Datos maestros.

Pero:

Rendiciones no debería finalizarse antes que gastos.

Reportes no deberían finalizarse antes que rentabilidad.

---

# 142. Priorización MoSCoW

## MUST

- Auth.
- unidades.
- conductores.
- clientes.
- viajes.
- offline.
- sync.
- gastos.
- combustible.
- adelantos.
- rendición.
- mantenimiento básico.
- documentos.
- cobranza básica.

## SHOULD

- alertas;
- incidencias;
- reportes;
- rentabilidad;
- exportaciones.

## COULD

- pipeline comercial;
- GPS;
- push notifications;
- OCR.

## WON'T — MVP

- IA;
- predicción;
- optimización automática;
- microservicios.

---

# 143. Backlog por Épicas

## EPIC-01 — Platform Foundation

## EPIC-02 — Identity & Security

## EPIC-03 — Fleet Master

## EPIC-04 — Drivers

## EPIC-05 — Clients

## EPIC-06 — Trips

## EPIC-07 — Driver Mobile

## EPIC-08 — Fuel

## EPIC-09 — Expenses

## EPIC-10 — Advances

## EPIC-11 — Settlements

## EPIC-12 — Maintenance

## EPIC-13 — Documents

## EPIC-14 — Incidents

## EPIC-15 — Billing

## EPIC-16 — Collections

## EPIC-17 — Alerts

## EPIC-18 — Analytics

## EPIC-19 — Audit

## EPIC-20 — Pilot & Rollout

---

# 144. Ejemplo de Historia — Registrar Gasto

```text id="8t3y5w"
US-EXP-001
```

> Como conductor quiero registrar un gasto desde mi celular para que quede relacionado automáticamente con mi viaje.

### Criterios

```text id="qohqjl"
Given
tengo viaje activo

When
registro categoría + monto

Then
el gasto queda asociado al viaje
```

```text id="dq2tfw"
Given
no tengo internet

When
registro gasto

Then
queda guardado localmente
```

```text id="14a8rj"
Given
recupero internet

Then
el gasto se sincroniza
sin duplicarse
```

---

# 145. Ejemplo — Combustible

```text id="unwmno"
US-FUEL-001
```

Campos requeridos:

- kilometraje;
- cantidad;
- unidad de volumen;
- monto.

Criterios:

- funciona offline;
- genera registro de odómetro;
- queda vinculado a unidad y viaje;
- permite fotografía.

---

# 146. Ejemplo — Cerrar Rendición

```text id="g4kqr6"
US-SET-010
```

> Como administrador quiero cerrar una rendición para determinar formalmente el saldo del conductor.

Debe comprobar:

- gastos revisados;
- adelantos;
- saldo;
- auditoría.

---

# 147. Ejemplo — Programar Unidad

```text id="9h12eo"
US-TRIP-020
```

No permitir:

- unidad en taller;
- viaje activo incompatible;
- documento crítico vencido.

---

# 148. Definición de Bloqueadores

Un issue será bloqueador si afecta:

- pérdida de datos;
- dinero;
- seguridad;
- sincronización;
- capacidad de operar.

---

# 149. Severidad de Bugs

## P0

Pérdida/corrupción de datos.

## P1

Función crítica inutilizable.

## P2

Función funciona parcialmente.

## P3

Problema menor/visual.

---

# 150. Política de Producción

No desplegar con:

```text id="35sej9"
P0 abiertos
```

ni con:

```text id="yc88cv"
P1 conocidos que afecten operación principal
```

---

# 151. Estrategia de Feature Flags

Mantener funciones incompletas desactivadas.

Ejemplo:

```text id="00kfza"
GPS = OFF

AI = OFF

ADVANCED_ANALYTICS = OFF
```

---

# 152. Criterios para v1.0

El sistema se considerará v1.0 cuando:

### Operación

- tres unidades pueden gestionarse.

### Conductores

- tres pueden registrar desde celular.

### Offline

- funciona correctamente.

### Viajes

- ciclo completo.

### Dinero

- gastos + combustible + rendición.

### Flota

- mantenimiento básico.

### Finanzas

- cobranza.

### Seguridad

- roles/RLS.

### Datos

- auditables.

### Reportes

- indicadores esenciales.

---

# 153. Qué NO Define Este Plan

No fija:

- número exacto de semanas;
- número exacto de desarrolladores;
- presupuesto;
- proveedor final de hosting frontend;
- API GPS concreta;
- integración contable.

Esos elementos dependerán de los recursos disponibles.

---

# 154. Estrategia si Solo Existe un Desarrollador

Prioridad aún más estricta:

```text id="2toxno"
Spike
↓
Foundation
↓
Trips
↓
Expenses
↓
Settlement
↓
Maintenance
↓
Collections
↓
Reports
```

No trabajar simultáneamente en cinco módulos.

---

# 155. Estrategia si Existe Equipo

Puede dividirse por verticales funcionales.

Pero una sola persona/rol técnico debe mantener coherencia de:

- dominio;
- DB;
- RLS;
- sincronización.

---

# 156. Documentación Continua

Mantener:

```text id="oj2jie"
/docs
```

con:

- arquitectura;
- ADR;
- dominio;
- flujos;
- decisiones;
- runbooks.

---

# 157. Runbooks Necesarios

Antes de producción:

```text id="yurdbv"
¿Qué hacer si PowerSync falla?

¿Qué hacer si un conductor pierde el celular?

¿Qué hacer si falla Storage?

¿Cómo restaurar backup?

¿Cómo desactivar usuario?

¿Cómo reabrir rendición?

¿Cómo corregir un pago?
```

---

# 158. Capacitación

Administración:

- crear viaje;
- revisar;
- rendir;
- mantener flota;
- cobrar.

Conductor:

- viaje;
- combustible;
- gasto;
- incidencia;
- offline.

---

# 159. Capacitación del Conductor

Debe ser breve.

Idealmente:

```text id="0g22hz"
15–30 minutos
```

y reforzarse con uso real.

Si requiere varias horas para aprender operaciones básicas, la UX debe revisarse.

---

# 160. Soporte Inicial

Durante piloto:

crear canal claro para:

- bug;
- duda;
- sugerencia.

Cada reporte deberá clasificarse.

---

# 161. Ciclo de Feedback

```text id="y4j5kp"
USO REAL
↓
OBSERVACIÓN
↓
PROBLEMA
↓
PRIORIZACIÓN
↓
CORRECCIÓN
↓
NUEVA VERSIÓN
```

---

# 162. No Construir desde Suposiciones

Si durante piloto se descubre que conductores registran un gasto no contemplado:

no forzar la operación al diseño anterior.

Actualizar:

- proceso;
- modelo;
- interfaz.

---

# 163. Fase de Hardening

Antes de v1.0 realizar exclusivamente:

- bugs;
- seguridad;
- sync;
- performance;
- accesibilidad;
- recuperación;
- consistencia.

No añadir grandes funciones nuevas.

---

# 164. Checklist Preproducción

## Infraestructura

```text id="hxz9tt"
□ Production configurado

□ Variables correctas

□ Storage privado

□ Backup

□ Restore probado
```

## Seguridad

```text id="oc5sqe"
□ RLS

□ Roles

□ Sesiones

□ Auditoría
```

## Offline

```text id="ipsesk"
□ modo avión

□ cierre app

□ reinicio

□ sync

□ archivos
```

## Operación

```text id="wg58i1"
□ viaje

□ gasto

□ combustible

□ rendición

□ mantenimiento

□ cobranza
```

---

# 165. Checklist de Piloto

```text id="eljrli"
□ unidad seleccionada

□ conductor capacitado

□ administrador capacitado

□ datos iniciales cargados

□ documentos cargados

□ soporte disponible

□ procedimiento de fallback
```

---

# 166. Checklist de Rollout

```text id="9drj0q"
□ piloto aprobado

□ P0 = 0

□ P1 críticos = 0

□ 2.º conductor preparado

□ 3.º conductor preparado

□ gerencia capacitada

□ contabilidad preparada

□ Excel redundantes identificados
```

---

# 167. Roadmap Posterior a v1.0

Una vez estable:

## v1.1

Mejoras UX y productividad.

## v1.2

CRM / oportunidades.

## v1.3

GPS.

## v1.4

Facturación integrada.

## v1.5

OCR.

## v2.0

Analítica avanzada.

## v2.x

IA.

El orden real dependerá de valor demostrado.

---

# 168. Criterio para Implementar GPS

Solo cuando pueda responder una pregunta empresarial importante.

Ejemplos:

- ubicación actual;
- km reales;
- tiempo detenido;
- validación llegada.

No integrarlo únicamente porque la API exista.

---

# 169. Criterio para OCR

Implementarlo cuando exista suficiente volumen de comprobantes como para justificar reducir digitación.

---

# 170. Criterio para IA

Solo cuando:

- datos estén estructurados;
- históricos sean suficientes;
- indicadores sean confiables;
- usuarios ya utilicen el sistema.

---

# 171. Indicadores de Éxito a 3–6 Meses de Operación

Después de estabilizar:

- >90% viajes registrados digitalmente;
- >90% gastos de viaje registrados;
- rendiciones trazables;
- mantenimiento centralizado;
- deuda visible;
- tiempo de unidad detenida medible.

Las metas definitivas deberán ajustarse a la línea base real.

---

# 172. Indicadores de Éxito Empresarial Posteriores

El sistema debería permitir mejorar progresivamente:

- utilización de flota;
- tiempo de retorno;
- km vacíos;
- consumo;
- cobranza;
- margen.

No se deben prometer porcentajes de mejora antes de obtener datos reales.

---

# 173. North Star del Proyecto

> **Construir un sistema suficientemente confiable para que R&T SITRAM SAC pueda tomar decisiones operativas y económicas utilizando sus datos reales en lugar de reconstruir la operación desde mensajes, documentos dispersos y memoria.**

---

# 174. Secuencia Maestra

```text id="to0a1v"
0. PREPARACIÓN

        ↓

1. TECHNICAL SPIKE
   Offline / Sync / Files / RLS

        ↓

2. FUNDACIÓN
   Auth / DB / Storage / PWA

        ↓

3. MAESTROS
   Unidad / Conductor / Cliente

        ↓

4. VIAJES
   Operación completa

        ↓

5. DINERO
   Combustible / Gastos / Adelantos

        ↓

6. CONTROL
   Rendición / Mantenimiento / Documentos

        ↓

7. FINANZAS
   Facturas / Pagos / Rentabilidad

        ↓

8. INTELIGENCIA DE NEGOCIO
   Dashboard / KPIs / Reportes

        ↓

9. PILOTO
   1 unidad

        ↓

10. ROLLOUT
    3 unidades

        ↓

11. OPTIMIZACIÓN

        ↓

12. AUTOMATIZACIÓN / IA
```

---

# 175. Orden Real de Construcción Recomendado

Si se comienza mañana, el orden debe ser:

```text id="xblsqi"
1.
Crear repositorio y ADR

2.
Configurar Supabase

3.
Configurar PowerSync

4.
Construir spike offline

5.
Probar Android real

6.
Crear RLS

7.
Crear tablas maestras

8.
Crear Viaje

9.
Crear Mi Viaje conductor

10.
Registrar gasto

11.
Registrar combustible

12.
Registrar fotografías offline

13.
Implementar adelantos

14.
Implementar rendición

15.
Implementar cierre de viaje

16.
Implementar mantenimiento

17.
Implementar documentos

18.
Implementar cobranza

19.
Calcular rentabilidad

20.
Crear dashboard

21.
Piloto

22.
Corregir

23.
Rollout
```

---

# 176. Principal Regla de Control del Proyecto

Cuando aparezca una idea nueva durante desarrollo:

> **¿Es necesaria para completar el flujo MVP actual?**

Si la respuesta es no:

```text id="xyqxfs"
BACKLOG
```

No interrumpir la secuencia principal.

---

# 177. Riesgo Más Grande del Proyecto

El mayor riesgo no es tecnológico.

Es intentar construir demasiado.

La documentación realizada hasta ahora describe una visión amplia del futuro sistema.

Eso no significa que todo deba aparecer en la primera versión.

La estrategia correcta es construir un **núcleo estrecho pero completo**.

---

# 178. Núcleo Estrecho pero Completo

Debe poder hacer perfectamente:

```text id="7cvr82"
VIAJE
↓
COMBUSTIBLE
↓
GASTOS
↓
RENDICIÓN
↓
RESULTADO
```

antes de incorporar grandes módulos adicionales.

---

# 179. Definición del Primer Producto Realmente Valioso

El primer punto en el que el sistema genera valor real será cuando, al terminar un viaje, R&T SITRAM SAC pueda abrirlo y ver:

```text id="ki9k8y"
Unidad

Conductor

Ruta

Carga

Kilómetros

Combustible

Adelanto

Gastos

Comprobantes

Saldo

Ingreso

Margen
```

todo conectado.

Ese será el primer gran hito empresarial.

---

# 180. Segundo Gran Hito

Cuando la empresa pueda abrir el sistema y responder:

> **¿Por qué estuvo parada cada unidad este mes?**

---

# 181. Tercer Gran Hito

Cuando pueda responder:

> **¿Qué rutas y clientes realmente nos dejan mayor utilidad?**

---

# 182. Cuarto Gran Hito

Cuando pueda utilizar esos datos para decidir:

- comprar unidad;
- cambiar ruta;
- negociar tarifa;
- buscar contrato;
- reducir costos.

---

# 183. Resultado Final del Plan

Al ejecutar correctamente este Plan Maestro, R&T SITRAM SAC deberá terminar con un sistema donde:

### Conductores

registran la operación desde carretera.

### Administración

controla viajes y dinero.

### Gerencia

comprende resultados y riesgos.

### Contabilidad

accede a información organizada.

### Sistema

conserva historial y trazabilidad.

### Datos

permiten decisiones.

---

# 184. Estado del Proyecto Después de Este Documento

La cadena completa queda:

```text id="zr9dcm"
1. Informe Contextual
   Qué es el negocio

2. Diagnóstico Operativo
   Qué problemas existen

3. Modelo Operativo Objetivo
   Cómo debería funcionar

4. Blueprint Funcional
   Qué debe hacer el sistema

5. Arquitectura de Información
   Qué datos necesita

6. Especificación UX/UI
   Cómo interactúa el usuario

7. Arquitectura Técnica
   Cómo se construye

8. PLAN MAESTRO DE IMPLEMENTACIÓN
   En qué orden se construye
```

---

# 185. Próximo Paso Recomendado

El diseño conceptual principal ya está suficientemente desarrollado.

El siguiente paso no debería ser otro documento estratégico general.

Debe comenzar la **preimplementación técnica**.

La primera entrega concreta debería ser:

# Paquete de Fundación Técnica — Etapa 0 + Technical Spike

Incluyendo:

```text id="9e6j25"
Repositorio
+
ADR
+
Supabase inicial
+
PowerSync inicial
+
PWA mínima
+
Auth
+
SQLite local
+
RLS base
+
prueba offline real
+
prueba de fotografía
+
prueba de sincronización
```

Solo cuando ese paquete supere los gates definidos en este documento debe comenzar la construcción completa del módulo **Viajes**.

---

# Conclusión

R&T SITRAM SAC ya cuenta con suficiente definición para comenzar la ejecución del proyecto sin saltar directamente a programación desordenada.

La construcción debe avanzar mediante verticales funcionales completas y verificables.

No:

```text id="sr2k0d"
50 pantallas
+
20 tablas
+
10 módulos
```

con procesos incompletos.

Sí:

```text id="cxcdrb"
1 flujo
↓
completo
↓
probado
↓
offline
↓
seguro
↓
utilizable
```

y después el siguiente.

La primera misión técnica no será construir un dashboard atractivo.

Será demostrar que:

> **un conductor puede salir de Cusco con un viaje en su celular, perder completamente la señal, registrar combustible y gastos durante la ruta, cerrar la aplicación, volver a abrirla y, al recuperar internet, entregar toda esa información correctamente a la administración sin pérdidas ni duplicados.**

Si ese flujo funciona, la base tecnológica del producto estará validada.

A partir de allí, el resto del sistema puede construirse incrementalmente sobre una arquitectura sólida.

La secuencia final recomendada es:

**validar → construir → probar → pilotar → corregir → desplegar → medir → optimizar.**

Y solo después:

**automatizar → predecir → incorporar inteligencia.**