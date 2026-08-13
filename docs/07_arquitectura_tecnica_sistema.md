# Arquitectura Técnica del Sistema Digital — R&T SITRAM SAC

> **Propósito:** convertir la definición empresarial, funcional, de datos y UX/UI de R&T SITRAM SAC en una arquitectura tecnológica concreta, offline-first, segura, mantenible y preparada para crecer desde una flota inicial de tres unidades hacia una operación de mayor escala.

**Empresa:** R&T SITRAM SAC  
**Sistema:** Centro de Control Digital R&T  
**Tipo de documento:** Arquitectura Técnica  
**Versión:** 1.0  
**Fecha:** 9 de agosto de 2026  
**Estado:** Arquitectura propuesta para implementación  
**Plataformas:** PWA web/escritorio + PWA móvil para conductores  
**Paradigma:** Local-first / Offline-first  
**Backend propuesto:** Supabase + PostgreSQL  
**Sincronización propuesta:** PowerSync  
**Frontend propuesto:** React + TypeScript + Vite  
**Arquitectura de aplicación:** Monolito modular + servicios gestionados

---

# 1. Objetivo Arquitectónico

La arquitectura debe garantizar que R&T SITRAM SAC pueda operar incluso cuando una unidad se encuentre en una carretera con conectividad deficiente.

El principio fundamental será:

> **La red mejora la aplicación, pero la operación esencial no debe depender permanentemente de ella.**

Un conductor debe poder:

- consultar su viaje;
- registrar combustible;
- registrar gastos;
- guardar fotografías;
- registrar kilometraje;
- reportar incidencias;

aunque temporalmente no tenga internet.

Cuando vuelva la conectividad, la información deberá sincronizarse automáticamente.

PowerSync dispone actualmente de SDK web con una base SQLite local persistente y una cola de escrituras que puede acumular cambios mientras el dispositivo está desconectado y enviarlos posteriormente al backend. Esto encaja directamente con el problema operacional de R&T SITRAM SAC. ([docs.powersync.com](https://docs.powersync.com/client-sdks/reference/javascript-web?utm_source=chatgpt.com))

---

# 2. Decisión Arquitectónica Principal

Se recomienda utilizar:

# PWA + SQLite local + PowerSync + Supabase/PostgreSQL

Arquitectura conceptual:

```text id="v0pzaf"
┌──────────────────────────────────────────────┐
│                 USUARIO                      │
│                                              │
│   Administración / Gerencia / Conductor     │
└───────────────────┬──────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────┐
│              PWA R&T SITRAM                  │
│                                              │
│ React + TypeScript                           │
│ Service Worker                              │
│ UI / Casos de uso / Dominio                 │
│                                              │
│      ┌──────────────────────────────┐        │
│      │ SQLite local / PowerSync     │        │
│      └──────────────────────────────┘        │
└───────────────┬──────────────────────────────┘
                │
                │ Internet disponible
                ▼
┌──────────────────────────────────────────────┐
│              POWERSYNC                       │
│                                              │
│ Sync Streams                                 │
│ Descarga de cambios                          │
│ Cola de escrituras                           │
└───────────────┬──────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│                SUPABASE                      │
│                                              │
│ PostgreSQL                                   │
│ Auth                                         │
│ Storage                                      │
│ Edge Functions                              │
│ RLS / Seguridad                              │
└──────────────────────────────────────────────┘
```

PowerSync mantiene el modelo local-first sincronizando datos desde el backend hacia SQLite y gestionando una cola de escrituras del cliente; su documentación incluye integración específica con Supabase. ([docs.powersync.com](https://docs.powersync.com/integrations/supabase/guide?utm_source=chatgpt.com))

---

# 3. Por Qué una PWA

No se recomienda desarrollar inicialmente:

- una aplicación Android independiente;
- una aplicación iOS independiente;
- un sistema web separado;
- un escritorio separado.

Se recomienda una única PWA responsive.

La misma base de código atenderá:

### Administración

PC / laptop / tablet.

### Gerencia

PC / celular.

### Conductores

Android principalmente.

Las PWA pueden ofrecer una experiencia instalable y utilizar service workers para disponer del shell de la aplicación y determinados recursos incluso sin conectividad. ([web.dev](https://web.dev/learn/pwa?utm_source=chatgpt.com))

---

# 4. Qué Significa Offline-First en este Sistema

Offline-first NO significa:

> guardar formularios temporalmente en memoria.

Significa:

```text id="g3whdm"
USUARIO
   ↓
BASE LOCAL
   ↓
INTERFAZ ACTUALIZADA INMEDIATAMENTE
   ↓
SINCRONIZACIÓN CUANDO EXISTA INTERNET
   ↓
BASE CENTRAL
```

La aplicación consulta normalmente su base local.

No:

```text id="8pdtmq"
Pantalla
↓
Internet
↓
Servidor
↓
Respuesta
↓
Pantalla
```

para cada interacción cotidiana.

---

# 5. Separación entre PWA Offline y Datos Offline

Existen dos problemas diferentes.

## Problema A — Abrir la aplicación sin internet

Se resuelve principalmente mediante:

- service worker;
- app shell;
- caché de assets.

## Problema B — Trabajar con información sin internet

Se resuelve mediante:

- SQLite local;
- PowerSync;
- sincronización posterior.

El service worker permite servir recursos previamente almacenados cuando la aplicación está offline. ([developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers?utm_source=chatgpt.com))

No debe confundirse esta caché con la base empresarial.

---

# 6. Arquitectura de Alto Nivel

Se proponen siete capas:

```text id="shzjqf"
┌────────────────────────────┐
│ 1. PRESENTACIÓN            │
│ React / UX/UI              │
├────────────────────────────┤
│ 2. APLICACIÓN              │
│ Casos de uso               │
├────────────────────────────┤
│ 3. DOMINIO                 │
│ Reglas del negocio         │
├────────────────────────────┤
│ 4. DATOS LOCALES           │
│ SQLite / PowerSync         │
├────────────────────────────┤
│ 5. SINCRONIZACIÓN          │
│ PowerSync                  │
├────────────────────────────┤
│ 6. BACKEND                 │
│ Supabase / Edge Functions  │
├────────────────────────────┤
│ 7. DATOS CENTRALES         │
│ PostgreSQL                 │
└────────────────────────────┘
```

---

# 7. Principio: El Backend Sigue Siendo Autoritativo

Offline-first no significa:

> el celular tiene la última palabra.

La base central seguirá siendo la autoridad final sobre información sensible.

Especialmente:

- pagos;
- facturas;
- cierres;
- anulaciones;
- permisos;
- aprobación de rendiciones;
- cambios financieros;
- auditoría.

La base local permite trabajar.

La base central valida y consolida.

---

# 8. Stack Técnico Propuesto

## Frontend

```text id="zmrjkh"
React
TypeScript
Vite
```

Vite continúa proporcionando un flujo de construcción moderno para aplicaciones web; la versión concreta deberá fijarse mediante lockfile en el momento de iniciar el repositorio para evitar actualizaciones accidentales. ([vite.dev](https://vite.dev/?utm_source=chatgpt.com))

## PWA

```text id="es0r5f"
Web App Manifest
Service Worker
Cache Storage
```

## Base local

```text id="rsbnj7"
PowerSync Web SDK
SQLite local
```

## Backend

```text id="1xi965"
Supabase
PostgreSQL
```

## Autenticación

```text id="3cig24"
Supabase Auth
```

## Archivos

```text id="cofgfs"
Supabase Storage
```

## Sincronización

```text id="z0ji3y"
PowerSync
```

## Lógica server-side

```text id="0veoz2"
PostgreSQL Functions/RPC
+
Supabase Edge Functions
```

## Hosting frontend

```text id="uo4kv3"
Hosting estático/CDN
```

El proveedor concreto puede decidirse posteriormente sin afectar significativamente al dominio.

---

# 9. Por Qué PostgreSQL

El modelo de datos ya definido es fuertemente relacional.

Tenemos relaciones como:

```text id="8xoxgl"
Cliente
  ↓
Viaje
  ↓
Unidad
  ↓
Conductor
  ↓
Gastos
  ↓
Rendición
  ↓
Factura
  ↓
Pago
```

Por ello PostgreSQL encaja naturalmente con:

- integridad referencial;
- transacciones;
- restricciones;
- vistas;
- agregaciones;
- auditoría;
- reportes.

Supabase proporciona actualmente una base PostgreSQL por proyecto y añade Auth, Data API, Storage y otras capacidades administradas alrededor de ella. ([supabase.com](https://supabase.com/docs?utm_source=chatgpt.com))

---

# 10. Arquitectura Frontend

Se recomienda evitar un frontend organizado únicamente por:

```text id="m1wjf8"
components/
pages/
utils/
```

A medida que el producto crezca se vuelve difícil de mantener.

Se recomienda una arquitectura orientada a funcionalidades.

---

# 11. Estructura Frontend Propuesta

```text id="jqvj1u"
src/

  app/
    router/
    providers/
    layout/
    config/

  features/

    auth/

    dashboard/

    trips/
      domain/
      application/
      data/
      ui/

    fleet/

    drivers/

    clients/

    fuel/

    expenses/

    advances/

    settlements/

    maintenance/

    billing/

    collections/

    documents/

    incidents/

    alerts/

    reports/

  shared/

    ui/
    hooks/
    utils/
    validation/
    types/

  db/

    schema/
    queries/
    migrations/
    local/

  sync/

    connector/
    streams/
    upload/
    conflicts/

  services/

    storage/
    notifications/
    gps/

```

---

# 12. Arquitectura por Feature

Ejemplo:

```text id="3dbvmv"
features/trips/
```

contendrá:

```text id="cezfh4"
domain/
application/
data/
ui/
```

---

# 13. Capa Domain

Debe contener reglas del negocio.

Ejemplo:

```text id="b2zpli"
canScheduleTrip()
calculateTripMargin()
canCloseSettlement()
canAssignVehicle()
validateTripTransition()
```

Estas funciones no deben depender directamente de React.

---

# 14. Capa Application

Contiene casos de uso.

Ejemplos:

```text id="050glk"
CreateTrip
ScheduleTrip
StartTrip
CompleteTrip
RegisterFuel
CloseSettlement
RegisterPayment
```

---

# 15. Capa Data

Contiene:

- queries;
- repositories;
- mappers;
- SQLite;
- backend.

La UI no debería realizar consultas SQL arbitrarias.

---

# 16. Capa UI

Contiene:

- páginas;
- formularios;
- tablas;
- componentes específicos.

Ejemplo:

```text id="erp5br"
TripList
TripDetail
TripTimeline
CreateTripWizard
```

---

# 17. Estado del Frontend

Debe diferenciarse:

## Estado empresarial

Proviene de SQLite.

Ejemplo:

- viajes;
- unidades;
- clientes;
- gastos.

## Estado de interfaz

Existe únicamente en memoria.

Ejemplo:

- modal abierto;
- filtro;
- pestaña seleccionada;
- formulario temporal.

---

# 18. Regla Fundamental

No duplicar toda la base empresarial dentro de un gestor de estado React.

La fuente local principal será SQLite.

```text id="7cvmjw"
SQLite
↓
queries reactivas
↓
React
```

PowerSync proporciona mecanismos para observar cambios de la base local y actualizar interfaces conforme cambian los datos sincronizados. ([docs.powersync.com](https://docs.powersync.com/client-sdks/usage-examples?utm_source=chatgpt.com))

---

# 19. Base Local

PowerSync Web SDK utilizará SQLite como almacenamiento estructurado local.

El SDK web soporta diferentes mecanismos de persistencia/VFS para almacenar la base SQLite en el navegador. ([docs.powersync.com](https://docs.powersync.com/client-sdks/reference/javascript-web?utm_source=chatgpt.com))

La implementación deberá probarse específicamente en los dispositivos Android utilizados por los conductores antes del despliegue general.

---

# 20. Esquema Local

El esquema SQLite no necesita copiar cada tabla del servidor.

Solo debe contener información necesaria para trabajar offline.

---

# 21. Tablas Locales Principales

```text id="3lmb45"
clients

vehicles

drivers

trips

trip_status_history

loads

expenses

expense_categories

fuel_entries

advances

settlements

documents_metadata

incidents

maintenance_plans

work_orders

alerts
```

---

# 22. Tablas Solo Locales

También existirán entidades que no requieren sincronización.

Ejemplos:

```text id="nfrulo"
local_ui_preferences
local_drafts
local_attachment_queue
local_sync_errors
```

PowerSync permite combinar tablas sincronizadas con tablas utilizadas únicamente de forma local. ([docs.powersync.com](https://docs.powersync.com/client-sdks/reference/rust?utm_source=chatgpt.com))

---

# 23. UUID como Identificador Principal

Todos los registros que puedan crearse offline deben utilizar identificadores generables en el cliente.

Por ello:

```text id="wyb81e"
id = UUID
```

Ejemplo:

```text id="jxrhwj"
expense.id
trip.id
fuel_entry.id
incident.id
```

Nunca debemos depender de:

```text id="hw5g26"
SELECT MAX(id) + 1
```

para crear registros offline.

---

# 24. Código Humano del Viaje

Existe una diferencia entre:

```text id="z8ks9l"
id técnico
```

y:

```text id="c9s3kn"
código visible
```

Ejemplo:

```text id="b2y77u"
id:
cf20d5f7-...

codigo:
RT-2026-000145
```

---

# 25. Problema del Código Secuencial Offline

Si dos dispositivos están offline, no pueden coordinar de forma segura:

```text id="4u9cvb"
RT-145
RT-146
```

en tiempo real.

Por tanto se propone:

### ID

UUID generado inmediatamente.

### Código provisional

Ejemplo:

```text id="86dbg9"
RT-OFF-7F3K
```

### Código definitivo

Asignado por backend al sincronizar, cuando sea necesario mantener numeración empresarial secuencial.

---

# 26. Alternativa Recomendada

Si R&T SITRAM SAC no necesita una secuencia estricta legal para el código interno del viaje, puede utilizarse directamente:

```text id="98mo69"
RT-20260809-7F3K
```

Esto elimina completamente el conflicto.

Las facturas y documentos fiscales seguirían su propia numeración regulada y no dependerían del código interno del viaje.

---

# 27. Arquitectura de Sincronización

El flujo de lectura será:

```text id="144c8g"
PostgreSQL
    ↓
PowerSync Service
    ↓
Sync Streams
    ↓
SQLite local
    ↓
UI
```

---

# 28. Flujo de Escritura

```text id="u90pe1"
Usuario
   ↓
SQLite local
   ↓
PowerSync Upload Queue
   ↓
Adaptador de escritura
   ↓
Supabase
   ↓
PostgreSQL
```

Si el dispositivo está desconectado, PowerSync mantiene las escrituras pendientes y las procesa posteriormente cuando recupera conectividad. ([docs.powersync.com](https://docs.powersync.com/configuration/app-backend/client-side-integration?utm_source=chatgpt.com))

---

# 29. Sync Streams

No todos los usuarios necesitan toda la base.

Se recomienda dividir la sincronización.

---

# 30. Stream 1 — Datos Base

Prioridad alta.

```text id="i2sz6p"
empresa
usuario
categorias
unidad
conductor
clientes relevantes
```

---

# 31. Stream 2 — Operación Activa

Prioridad máxima.

```text id="ecm3ex"
viajes activos
cargas
gastos activos
combustible
adelantos
incidencias
documentos necesarios
```

---

# 32. Stream 3 — Historia Reciente

Prioridad media.

Ejemplo:

```text id="rier2l"
últimos 60–90 días
```

---

# 33. Stream 4 — Histórico

Bajo demanda.

Ejemplo:

```text id="zr1laj"
viajes de años anteriores
```

PowerSync permite actualmente priorizar streams para determinar qué conjuntos de datos deben sincronizarse primero. ([docs.powersync.com](https://docs.powersync.com/sync/advanced/prioritized-sync?utm_source=chatgpt.com))

---

# 34. Sincronización del Conductor

Un conductor no debería descargar toda la base empresarial.

Debe recibir:

```text id="t6iyr7"
SU usuario
+
SU conductor
+
SU viaje activo
+
SU unidad asignada
+
categorías necesarias
+
documentos necesarios
+
sus gastos
+
sus adelantos
+
sus incidencias
```

---

# 35. Sincronización de Administración

Administración podrá sincronizar:

- flota completa;
- conductores;
- clientes;
- viajes recientes;
- cobranza;
- mantenimiento;
- alertas.

Dado que inicialmente existen tres unidades, el volumen será manejable.

La arquitectura, sin embargo, debe estar preparada para reducir el conjunto sincronizado cuando la empresa crezca.

---

# 36. Sincronización Bajo Demanda

Para información histórica:

```text id="fdjzqy"
Usuario abre:
Viajes 2024

↓
Aplicación solicita stream histórico

↓
Datos se sincronizan

↓
Se muestran
```

Esto evita almacenar años de información innecesariamente en cada celular.

---

# 37. Sincronización de Archivos

Las fotografías y PDF no deben almacenarse dentro de SQLite como grandes blobs.

Debe sincronizarse:

```text id="cxynhn"
metadata
+
estado del archivo
```

mientras el archivo vive en almacenamiento de objetos.

PowerSync documenta un patrón específico de attachments para manejar imágenes y PDF mediante una cola offline de subida y descarga, sin almacenar los archivos dentro de la base. ([docs.powersync.com](https://docs.powersync.com/client-sdks/advanced/attachments?utm_source=chatgpt.com))

---

# 38. Flujo de Fotografía Offline

Ejemplo:

Conductor fotografía una factura.

```text id="1dakb7"
Foto
↓
Archivo local
↓
local_attachment_queue
↓
Registro GASTO creado
↓
Estado:
ARCHIVO_PENDIENTE
```

Cuando vuelve internet:

```text id="caqvkz"
archivo local
↓
Storage
↓
URL/path seguro
↓
registro actualizado
↓
ARCHIVO_SINCRONIZADO
```

---

# 39. Supabase Storage

Se utilizará para:

- comprobantes;
- fotografías;
- guías;
- documentos;
- PDF;
- archivos de mantenimiento.

Supabase Storage permite políticas de acceso basadas en RLS y dispone de buckets privados, por lo que los comprobantes empresariales no necesitan ser públicamente accesibles. ([supabase.com](https://supabase.com/docs/guides/storage/security/access-control?utm_source=chatgpt.com))

---

# 40. Estructura de Storage

Propuesta:

```text id="raygx9"
private-documents/

  companies/
    {empresa_id}/

      trips/
        {trip_id}/

          expenses/
          fuel/
          guides/
          incidents/

      vehicles/
        {vehicle_id}/

      drivers/
        {driver_id}/

      clients/
        {client_id}/
```

---

# 41. Archivos Siempre Privados

Regla:

```text id="j8ocj3"
NO usar URLs públicas permanentes
```

para:

- facturas;
- documentos personales;
- documentación vehicular;
- comprobantes;
- contratos.

El acceso debe producirse mediante autorización.

---

# 42. Backend Supabase

Se utilizarán cuatro capacidades principales:

```text id="9rdg5g"
PostgreSQL
Auth
Storage
Edge Functions
```

Supabase integra actualmente estos servicios dentro de su plataforma gestionada. ([supabase.com](https://supabase.com/docs?utm_source=chatgpt.com))

---

# 43. Arquitectura de Base de Datos

Se propone separar conceptualmente:

```text id="kzim4f"
public/
private/
analytics/
```

---

# 44. Esquema public

Datos sincronizables de negocio:

```text id="2hvy1n"
companies
profiles

clients
vehicles
drivers

trips
loads

expenses
fuel_entries
advances
settlements

maintenance_plans
work_orders

documents
incidents

invoices
payments
alerts
```

Todos deben estar protegidos mediante políticas adecuadas.

Supabase recomienda RLS para tablas expuestas a su Data API. ([supabase.com](https://supabase.com/docs/guides/database/postgres/row-level-security?utm_source=chatgpt.com))

---

# 45. Esquema private

Información exclusiva del servidor.

Ejemplos:

```text id="vkztbs"
internal_sequences
system_config
integration_secrets_metadata
internal_jobs
```

No se expondrá directamente al cliente.

---

# 46. Esquema analytics

Podrá contener:

```text id="d3542b"
views
materialized_views
aggregations
```

Ejemplos:

```text id="j75ulv"
vehicle_utilization
trip_profitability
route_profitability
customer_collections
fuel_efficiency
```

---

# 47. Integridad en PostgreSQL

Las reglas más importantes deben existir también en la base.

No únicamente en React.

Ejemplos:

```text id="1r4v9s"
CHECK monto >= 0

FOREIGN KEY trip_id

UNIQUE empresa_id + placa

UNIQUE factura_serie_numero

NOT NULL
```

Esto evita que una integración futura pueda saltarse reglas que solo existan en la interfaz.

---

# 48. Reglas de Dominio Críticas

Algunas operaciones deben ser atómicas.

Ejemplos:

### Cerrar rendición

Debe:

1. validar gastos;
2. calcular total;
3. calcular saldo;
4. cambiar estado;
5. generar auditoría.

Todo como una única operación lógica.

---

# 49. Funciones PostgreSQL / RPC

Se recomienda utilizar funciones para casos como:

```text id="bg96bq"
close_settlement()

register_payment()

cancel_trip()

approve_margin_exception()

close_trip_financially()

renew_document()
```

Estas operaciones no deberían consistir en cinco `UPDATE` independientes enviados desde el navegador.

---

# 50. Edge Functions

Las Edge Functions se reservarán principalmente para procesos que requieran:

- integración externa;
- webhooks;
- secretos;
- procesamiento de archivos;
- comunicaciones;
- lógica server-side que no corresponda directamente a SQL.

Supabase Edge Functions son actualmente funciones TypeScript server-side ejecutadas sobre su entorno basado en Deno. ([supabase.com](https://supabase.com/docs/guides/functions/architecture?utm_source=chatgpt.com))

---

# 51. Ejemplos de Edge Functions Futuras

```text id="ixz1er"
gps-webhook

send-alert

process-receipt

generate-report

sync-external-invoice

notify-document-expiry

ai-business-query
```

---

# 52. No Convertir Todo en Edge Functions

No se recomienda:

```text id="cbwfnn"
createTripFunction
getTripFunction
getVehicleFunction
getClientFunction
...
```

para cada CRUD.

Eso generaría una capa backend innecesariamente pesada.

CRUD normal:

```text id="1cqdn5"
Postgres + RLS
```

Operaciones complejas:

```text id="kzqak8"
RPC / Edge Function
```

---

# 53. Arquitectura de Comandos Críticos

Existe un problema especial con offline-first.

Ejemplo:

el administrador está offline y pulsa:

```text id="7vxeo4"
Cerrar rendición
```

Ese cierre requiere validación central.

---

# 54. Estado Pendiente de Validación

No debe mostrarse inmediatamente:

```text id="4o63qe"
RENDICIÓN CERRADA
```

como resultado definitivo.

Debe mostrarse:

```text id="dqu7kz"
CIERRE PENDIENTE DE SINCRONIZACIÓN
```

Cuando el servidor lo aprueba:

```text id="4zc8nn"
CERRADA
```

---

# 55. Tabla Local de Acciones Pendientes

Conceptualmente:

```text id="of4xd7"
pending_actions

id
action_type
entity_id
payload
created_at
status
error
```

Estados:

```text id="2lto52"
PENDING
SENDING
ACCEPTED
REJECTED
```

---

# 56. Operaciones que Pueden Ser Offline Inmediatas

### Sí

- registrar gasto;
- registrar combustible;
- registrar kilometraje;
- crear incidencia;
- agregar fotografía;
- notas;
- confirmar llegada.

---

# 57. Operaciones que Requieren Validación Final

### Servidor autoritativo

- aprobar rendición;
- registrar pago definitivo;
- anular movimiento financiero;
- cerrar período;
- aprobar excepción de margen;
- modificar permisos;
- reabrir operación cerrada.

---

# 58. Política de Conflictos

No puede existir una sola estrategia para todos los datos.

---

# 59. Tipo A — Append Only

Ejemplos:

```text id="ob274c"
gasto
abastecimiento
incidencia
pago
evento
```

Preferencia:

crear nuevos registros.

Evitar editar continuamente un mismo registro.

---

# 60. Tipo B — Datos Descriptivos

Ejemplos:

```text id="wa7tkj"
teléfono cliente
nota
dirección
```

Puede utilizarse:

```text id="jkflav"
última versión válida
```

con historial cuando resulte importante.

---

# 61. Tipo C — Datos Financieros Cerrados

Nunca resolver mediante:

```text id="n4fqml"
last-write-wins
```

Ejemplo:

Un gasto aprobado cambia de S/150 a S/100.

Debe existir:

- corrección;
- ajuste;
- autorización;
- auditoría.

---

# 62. Tipo D — Estados

Ejemplo:

Dos usuarios cambian simultáneamente un viaje.

Debe validarse la transición.

```text id="cj2h13"
EN_TRANSITO
→
FINALIZADO
```

es válida.

Pero:

```text id="tqwbhy"
CANCELADO
→
EN_TRANSITO
```

puede no serlo.

La validación debe realizarse en dominio/backend.

---

# 63. Optimistic Concurrency

Para entidades críticas puede añadirse:

```text id="hdnq7z"
version
```

Ejemplo:

```text id="0rrkk5"
version = 8
```

El servidor solo acepta modificación si continúa en versión 8.

Después:

```text id="11txlo"
version = 9
```

Si alguien ya cambió el registro:

```text id="n4lmg8"
CONFLICTO
```

---

# 64. Idempotencia

Toda operación sensible debe poder repetirse técnicamente sin duplicar el efecto.

Ejemplo:

un celular intenta enviar dos veces:

```text id="ywm1xh"
Registrar gasto S/ 350
```

Utilizar:

```text id="olgbjz"
idempotency_key
```

permite identificar que se trata de la misma operación.

---

# 65. Registros Generados Offline

Cada nuevo registro debe poseer:

```text id="0dr9us"
id
empresa_id
created_at
created_by
source_device_id
sync_status
```

Esto mejora trazabilidad.

---

# 66. Autenticación

Se propone:

```text id="0tm9zo"
Supabase Auth
```

La identidad de Supabase Auth puede vincularse con la tabla empresarial `profiles`, mientras las políticas de acceso se aplican mediante RLS. Supabase documenta esta integración entre Auth, PostgreSQL y RLS. ([supabase.com](https://supabase.com/docs/guides/auth/architecture?utm_source=chatgpt.com))

---

# 67. Perfil Empresarial

```text id="82xuz1"
auth.users
     │
     ▼
profiles

id
auth_user_id
empresa_id
rol
activo
```

---

# 68. Autorización

Autenticación responde:

> ¿Quién eres?

Autorización responde:

> ¿Qué puedes hacer?

No deben confundirse.

---

# 69. Roles Iniciales

```text id="jypey1"
GERENCIA
ADMINISTRACION
CONDUCTOR
CONTABILIDAD
```

---

# 70. Row Level Security

Ejemplo conceptual:

Conductor:

```text id="dx0q5m"
SELECT trips
WHERE driver_id = current_driver
```

Administración:

```text id="e2o8uo"
SELECT trips
WHERE empresa_id = current_company
```

Gerencia:

```text id="zgog17"
SELECT financial_reports
WHERE empresa_id = current_company
```

RLS permite precisamente restringir qué filas puede leer o modificar cada usuario. ([supabase.com](https://supabase.com/docs/guides/database/postgres/row-level-security?utm_source=chatgpt.com))

---

# 71. Aislamiento por Empresa

Todas las entidades principales incluirán:

```text id="uxito6"
empresa_id
```

La regla fundamental será:

```text id="48n7r6"
usuario.empresa_id
=
registro.empresa_id
```

Esto evita fugas de datos y prepara el sistema para un futuro multiempresa si llegara a ser necesario.

---

# 72. Seguridad por Columna

Algunas tablas pueden contener información que el conductor necesita parcialmente.

Ejemplo:

CLIENTE:

Conductor necesita:

- nombre;
- contacto operativo;
- destino.

No necesita:

- deuda;
- rentabilidad;
- límite de crédito.

Cuando sea necesario, puede separarse la información en vistas/tablas o utilizar privilegios adicionales. PostgreSQL/Supabase permiten complementar RLS con controles de columnas. ([supabase.com](https://supabase.com/docs/guides/database/postgres/column-level-security?utm_source=chatgpt.com))

---

# 73. Regla sobre Credenciales

La PWA nunca contendrá:

- contraseña de PostgreSQL;
- claves de servidor privilegiadas;
- credenciales GPS privadas;
- secretos de proveedores.

Los secretos pertenecen exclusivamente al backend.

---

# 74. Seguridad de Datos Locales

Debe asumirse que el dispositivo puede:

- perderse;
- ser robado;
- compartirse.

Por tanto:

- sincronizar únicamente datos necesarios;
- minimizar históricos locales;
- cerrar sesiones de usuarios inactivos;
- permitir revocar cuentas;
- eliminar datos locales de forma segura al cerrar sesión según política.

PowerSync documenta además mecanismos de cifrado para bases locales en sus SDK, incluido soporte en su SDK web; su configuración deberá verificarse durante el prototipo de seguridad. ([docs.powersync.com](https://docs.powersync.com/client-sdks/advanced/data-encryption?utm_source=chatgpt.com))

---

# 75. Manejo de Sesión Offline

La aplicación debe distinguir:

### Sesión previamente válida + offline

Puede seguir operando con datos permitidos almacenados localmente según la política de seguridad.

### Primer inicio de sesión

Requiere conectividad para autenticar.

### Cuenta revocada mientras está offline

El servidor aplicará la revocación al recuperar conectividad.

Por ello, los datos sensibles disponibles offline deberán mantenerse deliberadamente limitados.

---

# 76. Auditoría

Toda operación crítica debe producir:

```text id="i2hc8b"
audit_event
```

Campos:

```text id="6akd38"
id
empresa_id
user_id
action
entity_type
entity_id
before
after
reason
timestamp
```

---

# 77. Eventos Auditables

Mínimo:

```text id="4dqgd2"
PAYMENT_CREATED

PAYMENT_CANCELLED

SETTLEMENT_APPROVED

SETTLEMENT_REOPENED

TRIP_CANCELLED

AMOUNT_CHANGED

DOCUMENT_RENEWED

ROLE_CHANGED

MARGIN_EXCEPTION_APPROVED
```

---

# 78. Auditoría Append-Only

Los eventos de auditoría no deberían editarse normalmente.

```text id="9j6nn4"
CREATE
```

sí.

```text id="j0pts4"
UPDATE
DELETE
```

no como flujo cotidiano.

---

# 79. Arquitectura de Estados del Viaje

Se mantiene la mejora definida en el modelo de datos:

No utilizar:

```text id="yv59f8"
trip.status
```

para representar absolutamente todo.

Separar:

```text id="43f6i4"
operational_status

administrative_status

financial_status
```

---

# 80. Estado Operativo

```text id="jeaa8z"
PLANNED
LOADING
IN_TRANSIT
UNLOADING
WAITING_RETURN
FINISHED
CANCELLED
```

---

# 81. Estado Administrativo

```text id="g8911q"
OPEN
SETTLEMENT_PENDING
UNDER_REVIEW
SETTLEMENT_CLOSED
```

---

# 82. Estado Financiero

```text id="vcpanh"
NOT_INVOICED
RECEIVABLE
PARTIALLY_PAID
PAID
FINANCIALLY_CLOSED
```

---

# 83. Historial por Eventos

Además del estado actual:

```text id="ixo4no"
trip_status_events
```

Ejemplo:

```text id="h7psw5"
09 ago 08:10
TRIP_STARTED

10 ago 17:30
ARRIVED_DESTINATION

10 ago 19:10
WAITING_RETURN_STARTED
```

Esto permite calcular duraciones.

---

# 84. Arquitectura de Mantenimiento

Debe utilizar:

```text id="b590kx"
vehicle
   ↓
odometer
   ↓
maintenance_plan
   ↓
work_order
   ↓
parts
```

---

# 85. Odómetro como Fuente

Todo evento que produzca kilometraje:

```text id="o19r9h"
salida
llegada
combustible
mantenimiento
```

puede crear:

```text id="1t8wak"
odometer_reading
```

---

# 86. Mantenimiento Derivado

Ejemplo:

```text id="b4h56q"
Último aceite:
420,000 km

Intervalo:
10,000 km

Próximo:
430,000 km

Actual:
428,500 km
```

El sistema deriva:

```text id="szobyk"
1,500 km restantes
```

No debe escribirse manualmente.

---

# 87. Motor de Alertas

Las alertas deben surgir principalmente de datos.

No de entradas manuales.

---

# 88. Alertas por Evento

Ejemplo:

```text id="it6c5u"
gasto registrado
↓
consumo anómalo detectado
↓
alerta
```

---

# 89. Alertas Programadas

Ejemplo:

```text id="ho4551"
cada día
↓
buscar documentos próximos a vencer
↓
crear alertas
```

Supabase permite programar ejecuciones periódicas mediante `pg_cron`, incluido el disparo de Edge Functions cuando se necesite. ([supabase.com](https://supabase.com/docs/guides/functions/schedule-functions?utm_source=chatgpt.com))

---

# 90. Alertas Iniciales

```text id="80q7r6"
document_expiring

document_expired

maintenance_due

maintenance_overdue

collection_overdue

settlement_overdue

waiting_return_too_long

vehicle_without_driver

low_margin
```

---

# 91. Jobs Iniciales

Ejemplo:

### Cada madrugada

```text id="ifstec"
recalcular vencimientos
```

### Cada hora

```text id="ynajbx"
evaluar esperas prolongadas
```

### Cada cierre de viaje

```text id="upo9ec"
recalcular rentabilidad
```

No es necesario recalcular todo el negocio continuamente.

---

# 92. Arquitectura de Reportes

Separar:

## Operación

Transaccional.

## Analítica

Consultas agregadas.

No ejecutar continuamente consultas gigantes sobre tablas transaccionales desde cada dashboard.

---

# 93. Vistas Iniciales

```text id="rkg9gz"
vw_trip_profitability

vw_vehicle_utilization

vw_vehicle_downtime

vw_route_profitability

vw_customer_collection

vw_fuel_efficiency
```

---

# 94. Materialized Views — Posterior

Cuando el volumen crezca:

```text id="8hbt7e"
mv_monthly_vehicle_metrics
mv_monthly_route_metrics
```

pueden acelerar reportes.

No son necesarias inicialmente con tres vehículos.

---

# 95. Rentabilidad

La arquitectura deberá distinguir:

```text id="6kufwo"
DIRECT_MARGIN

OPERATING_MARGIN

ECONOMIC_PROFIT
```

---

# 96. Cálculo

```text id="alx44e"
INGRESOS
-
GASTOS DIRECTOS
=
MARGEN DIRECTO
```

```text id="ytfc65"
MARGEN DIRECTO
-
COSTOS UNIDAD
-
COSTOS CONDUCTOR
=
MARGEN OPERATIVO
```

```text id="n7lqld"
MARGEN OPERATIVO
-
COSTOS GENERALES ASIGNADOS
=
UTILIDAD ECONÓMICA
```

---

# 97. Datos Calculados

No almacenar como entrada manual:

```text id="d6h718"
utilidad
costo/km
km vacíos %
utilización %
```

cuando puedan derivarse de datos fuente.

---

# 98. Snapshots Financieros

Existe una excepción.

Cuando un viaje se cierra financieramente puede guardarse:

```text id="4331cs"
profit_snapshot
```

para conservar exactamente el resultado aprobado en ese momento.

Esto evita que cambios posteriores en reglas de prorrateo alteren silenciosamente reportes históricos.

---

# 99. Arquitectura de Notificaciones

Separar:

```text id="8lrmo8"
ALERTA
```

de:

```text id="10wlab"
NOTIFICACIÓN
```

---

# 100. Ejemplo

```text id="a0xazb"
Documento vence en 7 días
```

es una:

```text id="4whpn3"
ALERTA
```

La forma de avisarlo puede ser:

```text id="t2xvlv"
IN-APP
PUSH
EMAIL
WHATSAPP
```

La primera versión utilizará principalmente:

```text id="rl1isy"
IN-APP
```

---

# 101. Push Notifications

Pueden incorporarse posteriormente para:

- viaje asignado;
- mantenimiento próximo;
- cobranza crítica;
- incidencia crítica.

No son requisito del MVP.

---

# 102. Arquitectura GPS Futura

El proveedor GPS actual debe permanecer desacoplado.

Crear interfaz:

```text id="u9bz9h"
GPSProvider
```

con funciones conceptuales:

```text id="tw5lyh"
getLatestPosition(vehicle)
getVehicleHistory(vehicle, period)
```

---

# 103. Adaptador GPS

```text id="ahltp3"
GPSProvider
     │
     └── ActualProviderAdapter
```

Si mañana cambia el proveedor:

```text id="cx6x1d"
NewProviderAdapter
```

El dominio no cambia.

---

# 104. Datos GPS

No sincronizar millones de posiciones hacia todos los celulares.

Mantener datos detallados server-side.

Para operación cotidiana sincronizar principalmente:

```text id="sh1dbx"
latest_location
last_gps_update
```

---

# 105. Integración GPS — Fase Posterior

Flujo potencial:

```text id="5yumim"
Proveedor GPS
↓
Webhook/API
↓
Edge Function
↓
gps_positions
↓
latest_vehicle_position
↓
Dashboard
```

---

# 106. Arquitectura de Facturación Futura

La tabla:

```text id="4nc9c6"
invoice
```

debe ser independiente del proveedor electrónico.

---

# 107. Adapter de Facturación

```text id="44elg4"
BillingProvider
```

Posibles futuras implementaciones:

```text id="4r8ifr"
SUNATProvider
ExternalBillingProvider
ManualBillingProvider
```

El sistema operativo no debe depender de un proveedor concreto.

---

# 108. Arquitectura de IA Futura

No integrar IA directamente en el núcleo transaccional durante el MVP.

Primero deben existir datos confiables.

---

# 109. IA — Primera Etapa

Solo lectura.

Ejemplo:

```text id="03mhbr"
¿Cuál unidad tuvo más tiempo detenida este mes?
```

La IA consulta vistas analíticas.

No modifica registros.

---

# 110. IA — Segunda Etapa

Sugerencias.

Ejemplo:

```text id="5dtndt"
Este viaje presenta un consumo 18% superior al histórico.
```

---

# 111. IA — Tercera Etapa

Acciones asistidas.

Ejemplo:

```text id="34l1to"
Crear borrador de cotización
```

Siempre con aprobación humana cuando exista impacto económico.

---

# 112. Seguridad de IA

La IA debe heredar permisos.

Si el conductor no puede ver:

```text id="5jfscs"
utilidad empresarial
```

tampoco debe obtenerla preguntando al asistente.

---

# 113. Arquitectura PWA

El service worker será responsable principalmente de:

```text id="00jo5m"
HTML
CSS
JavaScript
icons
fonts de la app
fallback offline
```

Los datos empresariales dependerán de SQLite/PowerSync.

---

# 114. Estrategia de Caché

### Cache First

Assets versionados:

```text id="nh41c7"
icons
assets estáticos
```

### Network First / estrategias controladas

contenido que deba actualizarse frecuentemente.

### SQLite

datos del negocio.

No usar Cache API como sustituto de la base operacional.

---

# 115. Instalación

La PWA deberá incluir:

```text id="lm4tu6"
manifest
name
short_name
icons
theme_color
display
start_url
```

El sistema debe poder instalarse desde el navegador como aplicación.

---

# 116. Actualización de PWA

Riesgo:

Conductor tiene una versión antigua mientras se despliega una nueva.

Se necesita:

```text id="68a7zc"
versión disponible
↓
descarga
↓
aviso
↓
actualizar cuando sea seguro
```

No forzar actualización mientras el usuario está registrando un gasto.

---

# 117. Migraciones Locales

Cuando cambie el esquema SQLite:

```text id="ucsoqm"
schema version 4
→
schema version 5
```

debe existir migración segura.

Nunca:

```text id="z4am5g"
borrar DB local y volver a descargar
```

como estrategia normal.

Podría eliminar información offline pendiente.

---

# 118. Migraciones Backend

Todas las modificaciones PostgreSQL deben existir como archivos versionados.

Ejemplo:

```text id="rw05wd"
202608090001_create_trips.sql

202608090002_create_expenses.sql

202608090003_add_rls.sql
```

---

# 119. Nunca Modificar Producción Manualmente

Evitar cambios permanentes realizados únicamente desde el dashboard de base de datos.

Flujo correcto:

```text id="e1m8wl"
migration
↓
Git
↓
CI
↓
staging
↓
production
```

---

# 120. Arquitectura del Repositorio

Se recomienda inicialmente un monorepo ligero:

```text id="dvst8h"
rt-sitram/

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

# 121. Monolito Modular

No se recomienda construir microservicios.

Para una empresa de tres unidades eso agregaría:

- despliegues;
- redes;
- observabilidad;
- consistencia;
- costos;
- complejidad.

sin generar valor proporcional.

---

# 122. Arquitectura Recomendada

```text id="0jz8hz"
MODULAR MONOLITH
+
MANAGED SERVICES
```

El sistema puede escalar considerablemente antes de necesitar separar servicios.

---

# 123. Límites de Módulos

Aunque sea un monolito, módulos separados:

```text id="5crgvg"
Trips
Fleet
Drivers
Clients
Finance
Maintenance
Documents
Analytics
```

Cada uno debe poseer:

- dominio;
- casos de uso;
- interfaz de datos.

---

# 124. Dependencias entre Módulos

Ejemplo permitido:

```text id="ha4x26"
TRIPS
→ VEHICLE REPOSITORY
```

Evitar:

```text id="a104zd"
TripPage
→ SQL de maintenance
→ componente de billing
→ fetch directo
```

La dependencia debe pasar por interfaces/casos de uso.

---

# 125. Arquitectura de Pruebas

Debe existir una pirámide.

```text id="vunmfi"
             E2E
            /   \
       Integration
       /         \
       Unit / Domain
```

---

# 126. Tests Unitarios

Especialmente:

```text id="62b8ao"
calculateSettlement()

calculateTripMargin()

validateStateTransition()

calculateVehicleUtilization()

calculateInvoiceBalance()
```

---

# 127. Tests de Integración

Verificar:

- PostgreSQL;
- constraints;
- RLS;
- RPC;
- sincronización;
- Storage.

---

# 128. Tests RLS

Casos mínimos:

```text id="clrgrs"
Conductor A
NO puede ver
Viaje de Conductor B
```

```text id="u5pa34"
Conductor
NO puede ver
utilidad global
```

```text id="e72f4x"
Administración
SÍ puede ver
viajes empresa
```

```text id="b14dtw"
Usuario empresa A
NO puede acceder
empresa B
```

---

# 129. Tests Offline

Simular:

1. cargar viaje;
2. perder conexión;
3. registrar gasto;
4. registrar combustible;
5. tomar foto;
6. cerrar aplicación;
7. volver a abrir;
8. verificar datos;
9. recuperar internet;
10. sincronizar;
11. comprobar servidor.

Estos tests son de máxima prioridad.

---

# 130. Tests de Conflictos

Ejemplo:

Dispositivo A:

```text id="x074t6"
edita gasto
```

Dispositivo B:

```text id="zkeliy"
observa gasto
```

Debe verificarse qué ocurre al sincronizar.

---

# 131. Tests de Idempotencia

Enviar dos veces:

```text id="veprxx"
payment_id = ABC
```

Resultado:

```text id="0mmgnd"
1 pago
```

no:

```text id="cqmh60"
2 pagos
```

---

# 132. Tests E2E Prioritarios

### Flujo 1

Crear viaje → ejecutar → rendición → cobrar.

### Flujo 2

Viaje offline → sincronización.

### Flujo 3

Mantenimiento → bloqueo de unidad.

### Flujo 4

Documento vencido → impedir programación.

### Flujo 5

Pago parcial → pago completo.

---

# 133. Testing de Edge Functions

Las funciones server-side deberán tener pruebas de sus contratos, autenticación y errores. Supabase mantiene soporte/documentación para probar Edge Functions mediante el entorno de Deno. ([supabase.com](https://supabase.com/docs/guides/functions/unit-test?utm_source=chatgpt.com))

---

# 134. Entornos

Se necesitan al menos:

```text id="5ual4n"
LOCAL
STAGING
PRODUCTION
```

---

# 135. Local

Para desarrollo.

```text id="z0uj1f"
Base local
Supabase local/desarrollo
datos ficticios
```

---

# 136. Staging

Replica producción funcionalmente.

Usado para:

- QA;
- prueba offline;
- migraciones;
- piloto interno.

Nunca utilizar datos personales reales innecesariamente.

---

# 137. Production

Datos empresariales reales.

Acceso restringido.

---

# 138. CI/CD

Cada Pull Request deberá ejecutar:

```text id="9ghwmq"
TypeScript check

Lint

Unit tests

Integration tests esenciales

Build

Migration validation
```

---

# 139. Deploy

Solo cuando:

```text id="ut93uh"
CI = verde
```

y las migraciones han sido validadas.

---

# 140. Feature Flags

Funciones grandes deben poder activarse gradualmente.

Ejemplo:

```text id="d8miog"
ENABLE_COLLECTIONS_V2

ENABLE_GPS

ENABLE_AI
```

Esto facilita piloto controlado.

---

# 141. Estrategia de Releases

No lanzar:

```text id="q3dumc"
15 módulos nuevos
```

simultáneamente.

Usar entregas incrementales.

---

# 142. Release MVP-0

Fundación:

- login;
- roles;
- unidades;
- conductores;
- clientes.

---

# 143. Release MVP-1

Operación:

- viajes;
- estados;
- conductor móvil;
- offline.

---

# 144. Release MVP-2

Dinero del viaje:

- combustible;
- gasto;
- adelanto;
- comprobantes.

---

# 145. Release MVP-3

Rendición:

- conciliación;
- aprobación;
- cierre operativo.

---

# 146. Release MVP-4

Flota:

- mantenimiento;
- documentos;
- alertas.

---

# 147. Release MVP-5

Finanzas:

- facturas;
- pagos;
- cobranza;
- rentabilidad.

---

# 148. Release 1.0

- dashboards;
- KPIs;
- reportes;
- estabilidad;
- auditoría completa.

---

# 149. Observabilidad

El sistema debe saber cuándo está fallando.

Monitorear:

### Frontend

- errores;
- crashes;
- tiempos de carga.

### Sync

- cola pendiente;
- último sync;
- errores;
- conflictos.

### Backend

- errores RPC;
- Edge Functions;
- jobs.

### Base

- consultas lentas;
- errores;
- crecimiento.

---

# 150. Métricas de Sincronización

Registrar:

```text id="44ijx4"
last_successful_sync

pending_operations

failed_operations

pending_attachments

sync_duration
```

---

# 151. Panel Técnico Interno

Para administración técnica:

```text id="frkb9r"
Estado del sistema

Servidor
✓

Sincronización
✓

3 dispositivos

1 registro pendiente

Última sincronización:
Hace 12 segundos
```

---

# 152. Observabilidad para Usuario

No mostrar logs técnicos.

Mostrar:

```text id="0ckgdc"
✓ Todo sincronizado
```

o:

```text id="2p2f03"
3 cambios pendientes
```

---

# 153. Manejo de Errores

Clasificar:

```text id="quu8e7"
ValidationError

AuthorizationError

ConflictError

NetworkError

SyncError

ServerError
```

---

# 154. Error Recuperable

Ejemplo:

```text id="5rh9jm"
Sin internet
```

No es un error crítico.

Guardar local.

---

# 155. Error de Negocio

Ejemplo:

```text id="8m0g5m"
No se puede cerrar la rendición porque existe un gasto observado.
```

Mostrar acción concreta.

---

# 156. Error Técnico

Registrar internamente:

```text id="oh5k2r"
error_id
stack
user
device
version
```

Mostrar al usuario:

```text id="gq8vfl"
No pudimos completar esta operación.

Código:
ERR-A4F2
```

---

# 157. Backups

La estrategia debe contemplar dos mundos:

```text id="zac6ko"
DATABASE
```

y:

```text id="u7ni85"
STORAGE
```

No deben tratarse como uno solo.

Supabase documenta mecanismos de backup y restauración para PostgreSQL; además, señala que los objetos almacenados mediante Storage no forman parte de los backups de la base de datos, por lo que los documentos requieren una estrategia adicional. ([supabase.com](https://supabase.com/docs/guides/platform/backups?utm_source=chatgpt.com))

---

# 158. Backup de PostgreSQL

Debe existir:

- backup gestionado según plan;
- exportación lógica periódica cuando corresponda;
- procedimiento de restauración documentado.

Supabase proporciona herramientas de backup y restore mediante su plataforma y CLI. ([supabase.com](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore?utm_source=chatgpt.com))

---

# 159. Backup de Storage

Crear estrategia independiente para:

- documentos críticos;
- comprobantes;
- contratos;
- guías.

Posibles mecanismos:

- replicación;
- exportación periódica;
- copia hacia almacenamiento secundario.

Esto deberá definirse antes de producción.

---

# 160. Restauración

Backup que nunca fue restaurado en una prueba no debe considerarse suficiente.

Procedimiento:

```text id="2238bv"
backup
↓
restaurar staging
↓
verificar tablas
↓
verificar documentos
↓
verificar relaciones
```

---

# 161. Objetivos Iniciales de Recuperación

Como objetivo interno preliminar del MVP:

```text id="sb4x50"
RPO objetivo:
≤ 24 horas
```

```text id="654dnw"
RTO objetivo:
≤ 8 horas
```

Estos son objetivos de diseño propuestos, no garantías del proveedor.

Al crecer la operación podrán endurecerse.

---

# 162. Performance

La mayoría de interacciones operativas debe responder desde SQLite local.

Objetivos internos:

### Abrir viaje ya sincronizado

Percepción prácticamente inmediata.

### Guardar gasto offline

< 1 segundo de feedback visual.

### Búsqueda local

< 500 ms para conjuntos cotidianos.

Estos son objetivos del producto a validar mediante pruebas, no garantías técnicas.

---

# 163. Primer Sync

Debe tratarse especialmente.

Pantalla:

```text id="akl0jj"
Preparando R&T SITRAM

Descargando información necesaria...

Unidades      ✓
Clientes      ✓
Viajes        72%
```

No dejar pantalla aparentemente congelada.

---

# 164. Sync Prioritario Inicial

Orden:

```text id="zdz8w5"
1. Usuario
2. Configuración
3. Unidad/conductor
4. Viaje activo
5. Categorías
6. Datos recientes
7. Histórico
```

La capacidad de priorizar conjuntos de sincronización es una de las características actualmente documentadas por PowerSync. ([docs.powersync.com](https://docs.powersync.com/sync/advanced/prioritized-sync?utm_source=chatgpt.com))

---

# 165. Escalabilidad

La arquitectura debe crecer por volumen, no por rediseño.

Con:

```text id="k7ckop"
3 vehículos
```

puede sincronizarse bastante información.

Con:

```text id="14utoc"
50 vehículos
```

se reduce por:

- sede;
- usuario;
- fecha;
- viaje activo;
- streams.

---

# 166. PostgreSQL como Escala Central

El esquema no debe crear:

```text id="r5n1o8"
tabla_x2y756
tabla_x3n719
```

Las unidades son filas.

```text id="paxowv"
vehicles

id
plate
...
```

Esto permite añadir vehículos sin modificar código estructural.

---

# 167. Escalabilidad Organizacional

Hoy:

```text id="zsq1ro"
1 empresa
1 base
```

Mañana podría existir:

```text id="psf4bd"
R&T SITRAM
├── Cusco
├── Lima
└── Arequipa
```

Por eso se recomienda reservar conceptualmente:

```text id="6zuwar"
branch_id
```

para una futura fase, aunque no sea obligatorio implementarlo en el MVP.

---

# 168. No Sobrearquitectar Sedes

No crear todavía:

```text id="f87x91"
multi-region organization engine
```

si actualmente no existe esa necesidad.

Preparar el modelo.

No construir la complejidad.

---

# 169. Seguridad de Dispositivos

Registrar opcionalmente:

```text id="jgx7wp"
device_id
user_id
last_seen
app_version
```

Esto permitirá:

- soporte;
- revocación;
- diagnóstico de sincronización.

---

# 170. Dispositivo Perdido

Procedimiento:

1. desactivar usuario si corresponde;
2. revocar sesión;
3. impedir nuevas sincronizaciones;
4. marcar dispositivo comprometido;
5. documentar incidente.

---

# 171. Retención Local

El conductor no necesita tener cinco años de datos.

Ejemplo de política:

```text id="rxhqus"
Viaje activo
+
últimos 30 días propios
```

El histórico completo permanece centralmente.

La política concreta se validará durante el piloto.

---

# 172. Retención Central

Los registros empresariales deben conservarse conforme:

- necesidades operativas;
- contabilidad;
- obligaciones legales;
- auditoría.

La política legal exacta deberá validarse con asesoría contable/jurídica antes de automatizar eliminación.

---

# 173. API Interna

No es necesario crear inmediatamente una API REST propia completa.

El acceso puede apoyarse en:

```text id="kdihj0"
Supabase Data API
+
RPC
+
Edge Functions
```

según el caso.

Supabase documenta controles de seguridad para su Data API mediante grants, RLS y esquemas. ([supabase.com](https://supabase.com/docs/guides/api/securing-your-api?utm_source=chatgpt.com))

---

# 174. API Pública Futura

Si posteriormente clientes corporativos necesitan:

```text id="rigu9n"
estado de viaje
proof of delivery
```

se podrá construir una API externa separada.

Nunca exponer directamente la API interna completa.

---

# 175. Arquitectura para Empresas Mineras

Un futuro módulo podrá añadir:

```text id="03uruh"
client_requirements

vehicle_certifications

driver_certifications

trip_checklists
```

sin modificar el núcleo de Viajes.

---

# 176. Checklist Dinámico

Ejemplo:

Cliente minero X requiere:

```text id="yapi6g"
✓ SOAT
✓ ITV
✓ SCTR
✓ Seguro adicional
✓ Documento A
✓ Capacitación B
```

El backend evalúa:

```text id="h0pu65"
unidad apta
+
conductor apto
```

antes de programar.

---

# 177. Arquitectura de Configuración

Evitar valores rígidos en código.

Crear:

```text id="mkt65b"
company_settings
```

Ejemplos:

```text id="t4h7al"
minimum_margin
document_alert_days
settlement_alert_days
maintenance_warning_km
default_currency
fuel_unit
```

---

# 178. Configuración Versionada

Cambios económicos importantes deben conservar histórico.

Ejemplo:

```text id="3nxb87"
Margen mínimo:

10% hasta junio
15% desde julio
```

Los viajes antiguos no deben reinterpretarse automáticamente.

---

# 179. Arquitectura para Analítica

El sistema operacional almacenará hechos.

Ejemplo:

```text id="1xkeeq"
trip
expense
fuel
payment
```

Después se construyen métricas.

No al revés.

---

# 180. Eventual Data Warehouse

No requerido actualmente.

Cuando existan:

- decenas de unidades;
- millones de eventos GPS;
- años de información;
- modelos predictivos;

podría crearse un almacén analítico separado.

No corresponde al MVP.

---

# 181. ADR — Architecture Decision Records

Todas las decisiones arquitectónicas relevantes deben documentarse.

Crear:

```text id="638mg5"
docs/architecture/adr/
```

---

# 182. ADR Iniciales

```text id="9c8j7u"
ADR-001
Usar PWA como cliente principal
```

```text id="7l2lti"
ADR-002
Usar arquitectura offline-first
```

```text id="x6z9ip"
ADR-003
Usar PowerSync para sincronización
```

```text id="y1wg6y"
ADR-004
Usar Supabase/PostgreSQL como backend
```

```text id="lgnq05"
ADR-005
UUID generados en cliente
```

```text id="6pofqg"
ADR-006
Registros financieros cerrados son inmutables
```

```text id="09gz7e"
ADR-007
Monolito modular, no microservicios
```

```text id="7oe403"
ADR-008
Storage privado para documentos
```

```text id="lb5ylb"
ADR-009
Estado operativo y financiero separados
```

---

# 183. Riesgos Técnicos Principales

## R1 — Compatibilidad Offline Real

La arquitectura puede funcionar técnicamente pero debe validarse en los celulares reales utilizados por conductores.

**Mitigación:**

piloto temprano.

---

# 184. R2 — Fotografías y Mala Señal

Subir muchas fotografías puede fallar constantemente.

**Mitigación:**

- compresión;
- cola;
- reintentos;
- subida en segundo plano cuando sea posible;
- estado visible.

---

# 185. R3 — Conflictos

Dos usuarios pueden modificar la misma información.

**Mitigación:**

- append-only;
- versionado;
- comandos;
- server authority.

---

# 186. R4 — Complejidad de PowerSync

Offline-first agrega complejidad frente a una aplicación tradicional.

**Mitigación:**

utilizarlo únicamente donde aporta valor y mantener los casos de uso claramente definidos.

---

# 187. R5 — Datos Financieros Inconsistentes

Sin reglas server-side podrían producirse divergencias.

**Mitigación:**

PostgreSQL constraints + RPC + auditoría.

---

# 188. R6 — Pérdida de Dispositivo

Existe información empresarial local.

**Mitigación:**

- mínimo dataset;
- autenticación;
- revocación;
- cifrado donde aplique;
- limpieza local.

---

# 189. R7 — Dependencia de Servicios Externos

Arquitectura usa:

- Supabase;
- PowerSync.

**Mitigación:**

mantener:

- PostgreSQL como modelo estándar;
- código desacoplado;
- adapters;
- datos exportables;
- backups.

---

# 190. R8 — Sobreingeniería

Existe riesgo de construir un sistema demasiado grande.

**Mitigación:**

MVP estricto.

No construir funciones futuras antes de validar el núcleo.

---

# 191. MVP Técnico Real

La primera versión no necesita todo el documento.

Necesita:

```text id="13m24v"
AUTH
+
LOCAL DATABASE
+
SYNC
+
TRIPS
+
VEHICLES
+
DRIVERS
+
FUEL
+
EXPENSES
+
ADVANCES
+
SETTLEMENTS
+
BASIC MAINTENANCE
```

---

# 192. MVP Técnico P0

## Infraestructura

- Supabase.
- PostgreSQL.
- Auth.
- Storage.
- PowerSync.
- PWA.

## Dominio

- Empresa.
- Usuario.
- Unidad.
- Conductor.
- Cliente.
- Viaje.

## Operación

- estados;
- kilometraje;
- gastos;
- combustible.

## Finanzas

- adelantos;
- rendición.

---

# 193. MVP Técnico P1

Añadir:

- mantenimiento;
- documentos;
- incidencias;
- alertas;
- cobranza.

---

# 194. MVP Técnico P2

Añadir:

- oportunidades;
- cotizaciones;
- ciclos;
- rentabilidad avanzada;
- reportes.

---

# 195. Fase Posterior

Añadir:

- GPS;
- notificaciones push;
- OCR;
- facturación integrada;
- IA.

---

# 196. Gate Técnico Antes de Programar Todo

Antes de comprometerse con desarrollo completo debe construirse un:

# Technical Spike

pequeño.

---

# 197. Spike 1 — Offline

Prototipo mínimo:

```text id="fw1mfe"
Login
↓
Descargar viaje
↓
Modo avión
↓
Registrar gasto
↓
Cerrar app
↓
Abrir app
↓
Ver gasto
↓
Activar internet
↓
Sincronizar
↓
Verificar PostgreSQL
```

Si esto falla, no continuar con pantallas secundarias.

---

# 198. Spike 2 — Fotografías

```text id="5ip91a"
Modo avión
↓
Tomar foto
↓
Cerrar app
↓
Abrir
↓
Internet
↓
Subir
↓
Storage
```

---

# 199. Spike 3 — Conflictos

Dos dispositivos:

```text id="hpciek"
A
offline

B
online

↓
modifican mismo viaje
```

Validar estrategia.

---

# 200. Spike 4 — RLS

Crear:

```text id="m8zp5d"
Gerente
Administrador
Conductor A
Conductor B
```

Intentar accesos prohibidos.

---

# 201. Spike 5 — Rendición

Probar:

```text id="f1ityu"
adelanto
+
10 gastos
+
1 gasto offline
+
sincronización
+
aprobación
+
auditoría
```

---

# 202. Dispositivos del Piloto

El spike debe probarse al menos sobre:

- celular Android real de conductor;
- PC administrativa;
- red Wi-Fi;
- datos móviles;
- modo avión;
- conexión intermitente simulada.

---

# 203. Criterios de Aprobación Técnica del Spike

Debe demostrarse:

### Offline

✓ registros sobreviven cierre de aplicación.

### Sync

✓ no duplica.

### Files

✓ comprobantes se recuperan.

### Security

✓ roles funcionan.

### Conflict

✓ no corrompe información.

### UX

✓ conductor entiende el estado de sincronización.

---

# 204. Piloto Productivo

Después:

```text id="r0smj7"
1 unidad
+
1 conductor
+
1 administrador
+
1 ruta
```

durante varias operaciones reales.

---

# 205. No Lanzar las Tres Unidades de Golpe

Primero aprender:

- qué falta;
- qué molesta;
- qué campos sobran;
- dónde falla señal;
- qué gastos aparecen realmente.

Después ampliar.

---

# 206. Arquitectura Objetivo del MVP

```text id="z4347e"
                         ┌───────────────┐
                         │    CDN/Web    │
                         │     PWA       │
                         └───────┬───────┘
                                 │
                   ┌─────────────▼─────────────┐
                   │ React + TypeScript        │
                   │                           │
                   │ Casos de uso              │
                   │ Dominio                   │
                   │                           │
                   │ PowerSync SQLite          │
                   │ Service Worker            │
                   └───────┬─────────┬─────────┘
                           │         │
                     Sync  │         │ Attachments
                           │         │
                ┌──────────▼───┐ ┌───▼────────────┐
                │ PowerSync    │ │ Supabase       │
                │ Service      │ │ Storage        │
                └──────┬───────┘ └────────────────┘
                       │
             ┌─────────▼────────────────────────┐
             │           SUPABASE               │
             │                                  │
             │ Auth                             │
             │ PostgreSQL                       │
             │ RLS                              │
             │ RPC                              │
             │ Edge Functions                   │
             │ Scheduled Jobs                   │
             └──────────────────────────────────┘
```

---

# 207. Flujo Técnico de un Gasto Offline

```text id="5vc99w"
CONDUCTOR
↓
Registrar gasto
↓
Validación cliente
↓
INSERT SQLite
↓
UI muestra gasto inmediatamente
↓
PowerSync registra cambio
↓
SIN INTERNET
↓
queda en cola
↓
INTERNET REGRESA
↓
uploadData()
↓
Supabase
↓
PostgreSQL
↓
PowerSync redistribuye versión canónica
↓
SQLite actualizado
↓
estado = SINCRONIZADO
```

Este flujo corresponde al modelo offline-first que PowerSync documenta para escrituras locales y cola de uploads. ([docs.powersync.com](https://docs.powersync.com/configuration/app-backend/client-side-integration?utm_source=chatgpt.com))

---

# 208. Flujo Técnico de un Comprobante

```text id="mo67m9"
Foto
↓
Guardar archivo local
↓
Crear expense
↓
Crear attachment metadata
↓
SIN INTERNET
↓
Queue
↓
INTERNET
↓
Upload Storage
↓
actualizar metadata
↓
expense tiene comprobante disponible
```

---

# 209. Flujo Técnico de Cierre de Rendición

```text id="8io3q7"
ADMIN
↓
Cerrar
↓
Application layer
↓
Validación local
↓
Servidor
↓
RPC close_settlement
↓
BEGIN TRANSACTION
↓
validar gastos
↓
calcular totales
↓
cerrar
↓
audit event
↓
COMMIT
↓
sync
↓
UI actualizada
```

---

# 210. Flujo Técnico de Alerta de Mantenimiento

```text id="u8hh0x"
odometer_reading
↓
kilometraje actual
↓
maintenance_plan
↓
remaining_km
↓
threshold
↓
alert
↓
dashboard
```

---

# 211. Flujo Técnico de Cobranza

```text id="786zyp"
invoice
↓
balance
↓
due_date
↓
cron
↓
if overdue
↓
alert
↓
collection dashboard
```

---

# 212. North Star Técnica

La arquitectura debe optimizar:

> **capacidad de ejecutar la operación localmente sin perder consistencia empresarial cuando los datos vuelven a sincronizarse.**

---

# 213. Lo que No Debe Construirse

No:

```text id="b2z09m"
microservices
Kubernetes
event bus complejo
data warehouse
Kafka
GraphQL custom
native Android + iOS
machine learning
```

para el MVP.

No porque sean tecnologías malas, sino porque no resuelven los riesgos actuales prioritarios del negocio.

---

# 214. Orden de Prioridades Técnicas

```text id="doce17"
1. Correctitud
2. Offline
3. Seguridad
4. Trazabilidad
5. Simplicidad UX
6. Rendimiento
7. Automatización
8. Escalabilidad avanzada
9. IA
```

No debe invertirse ese orden.

---

# 215. Decisiones que Deben Validarse Durante el Spike

Aunque esta arquitectura recomienda tecnologías concretas, deben comprobarse empíricamente:

1. Compatibilidad real del almacenamiento PowerSync Web con los dispositivos objetivo.
2. Comportamiento al suspender/cerrar la PWA.
3. Manejo offline de fotografías grandes.
4. Duración práctica de sesiones.
5. Estrategia de conflictos.
6. Tamaño de dataset local.
7. Rendimiento en celulares económicos.
8. API disponible del GPS actual.
9. Reglas definitivas de RLS.
10. Estrategia exacta de backup de Storage.

---

# 216. Definition of Done Técnica del MVP

El MVP NO está terminado solo porque sus pantallas funcionan.

Debe cumplir:

## Offline

✓ registrar sin internet.

## Sync

✓ recuperar internet y sincronizar.

## Persistencia

✓ cerrar y abrir sin perder datos.

## Seguridad

✓ RLS validado.

## Auditoría

✓ operaciones críticas trazables.

## Archivos

✓ fotos offline/online.

## Rendición

✓ conciliación correcta.

## Mantenimiento

✓ alertas básicas.

## Calidad

✓ suite automática de pruebas.

## Recuperación

✓ backup/restauración documentada.

---

# 217. Arquitectura Evolutiva

```text id="fv7q58"
VERSIÓN 1

PWA
+
Supabase
+
PowerSync
```

↓

```text id="5bj5j7"
VERSIÓN 2

GPS
+
Automatizaciones
+
Reportes avanzados
```

↓

```text id="5cnia6"
VERSIÓN 3

OCR
+
Facturación
+
Analítica avanzada
```

↓

```text id="cdin4g"
VERSIÓN 4

IA
+
Predicción
+
Optimización
```

---

# 218. Decisiones Arquitectónicas Finales Propuestas

| Área | Decisión |
|---|---|
| Cliente | PWA |
| Frontend | React + TypeScript |
| Build | Vite |
| Persistencia cliente | SQLite |
| Offline sync | PowerSync |
| Backend | Supabase |
| Base central | PostgreSQL |
| Auth | Supabase Auth |
| Archivos | Supabase Storage privado |
| Server logic | PostgreSQL RPC + Edge Functions |
| Seguridad | RLS + roles + auditoría |
| IDs | UUID |
| Arquitectura aplicación | Monolito modular |
| Analytics | PostgreSQL views |
| GPS | Adapter futuro |
| IA | Fase posterior |
| Despliegue | Incremental |
| Estrategia inicial | 1 unidad piloto |

---

# 219. Justificación Global de la Arquitectura

La arquitectura está diseñada alrededor de las condiciones reales de R&T SITRAM SAC:

### Viajes nacionales

→ requieren offline.

### Conductores en carretera

→ requieren interfaz móvil simple.

### Tres unidades actuales

→ no requieren infraestructura distribuida compleja.

### Deseo de crecer

→ requiere modelo escalable.

### Información financiera

→ requiere servidor autoritativo y auditoría.

### Facturas y comprobantes

→ requieren almacenamiento de archivos.

### Falta de carga de retorno

→ requiere datos actualizados y alertas.

### Mantenimiento

→ requiere kilometraje histórico.

### Clientes grandes/mineras

→ requerirán mayor trazabilidad y cumplimiento.

Por ello la arquitectura busca maximizar capacidad sin maximizar complejidad.

---

# 220. Estado General del Diseño

Con la Arquitectura Técnica quedan definidas siete capas del proyecto:

```text id="kov6zq"
1. INFORME CONTEXTUAL
   ¿Qué es R&T SITRAM?

            ↓

2. DIAGNÓSTICO OPERATIVO
   ¿Qué problemas existen?

            ↓

3. MODELO OPERATIVO OBJETIVO
   ¿Cómo debería funcionar?

            ↓

4. BLUEPRINT FUNCIONAL
   ¿Qué debe hacer el software?

            ↓

5. ARQUITECTURA DE INFORMACIÓN
   ¿Qué datos existen y cómo se relacionan?

            ↓

6. ESPECIFICACIÓN UX/UI
   ¿Cómo interactuarán las personas?

            ↓

7. ARQUITECTURA TÉCNICA
   ¿Cómo se construirá técnicamente?
```

---

# 221. Próxima Etapa

El proyecto ya dispone de definición suficiente para dejar de diseñar la solución de manera abstracta.

La siguiente etapa debería ser:

# Plan Maestro de Implementación

Ese documento debe convertir toda esta arquitectura en trabajo ejecutable:

```text id="7gnn6k"
Fases
↓
Épicas
↓
Historias de usuario
↓
Tareas técnicas
↓
Dependencias
↓
Criterios de aceptación
↓
Pruebas
↓
Piloto
↓
Rollout
```

Además deberá especificar:

- qué construir primero;
- qué NO construir;
- esquema inicial de base de datos;
- orden de migraciones;
- foundation técnica;
- spike PowerSync;
- configuración Supabase;
- RLS;
- PWA;
- MVP administrativo;
- MVP conductor;
- mantenimiento;
- finanzas;
- dashboards;
- estrategia de pruebas;
- hardening;
- despliegue;
- migración de información;
- piloto con una unidad;
- incorporación de las demás unidades.

---

# 222. Conclusión

La arquitectura propuesta para R&T SITRAM SAC no parte de la pregunta:

> **“¿Qué tecnologías son más modernas?”**

Parte de:

> **“¿Qué arquitectura permite que este negocio funcione correctamente incluso cuando un camión está lejos de Cusco, sin señal, mientras administración necesita conservar control financiero y operativo?”**

La respuesta propuesta es:

# Una PWA local-first con una base SQLite en cada dispositivo, sincronizada mediante PowerSync hacia PostgreSQL/Supabase, con el servidor manteniendo autoridad sobre seguridad, dinero, cierres y auditoría.

El sistema tendrá una arquitectura relativamente sencilla:

```text id="emuv4s"
PWA
+
SQLite
+
PowerSync
+
PostgreSQL
+
Supabase
```

pero estará organizado internamente con suficientes límites para crecer.

La regla arquitectónica más importante será:

> **El usuario trabaja contra su información local; la sincronización conecta los dispositivos; PostgreSQL consolida la verdad empresarial.**

Esto permitirá que un conductor pueda continuar registrando una operación cuando pierda señal, que administración pueda recibir posteriormente esa información sin volver a transcribirla y que gerencia pueda finalmente analizar el negocio desde una fuente de datos coherente.

La arquitectura también evita intentar resolver desde el primer día problemas que todavía no existen. No requiere microservicios, infraestructura compleja ni inteligencia artificial prematura.

Primero debe conseguir:

**operar → registrar → sincronizar → controlar → medir.**

Después:

**automatizar → predecir → optimizar.**

Ese orden debe mantenerse durante toda la construcción del sistema.