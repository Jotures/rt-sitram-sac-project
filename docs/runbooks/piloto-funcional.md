# Runbook — piloto funcional aislado

**Estado:** piloto aprobado por el propietario el 2026-08-20; se preserva como runbook de referencia.  
**Autoridad:** DEC-023 y el registro de la sesión `SESSION-20260813-010`.  
**Propósito:** preparar, validar, suspender o recuperar un piloto sin mezclar datos de prueba con la operación oficial.

## Límites

El piloto no es una puesta en producción ni una migración de datos del negocio. Debe usar, como mínimo, un proyecto Supabase, instancia/configuración PowerSync, Storage y origen web distintos de los de operación oficial. La PWA debe servirse desde un origen propio: así también quedan separados service worker, caché, SQLite/OPFS y sesiones locales del dispositivo.

Solo se permiten unidades reales expresamente autorizadas como maestros de referencia. Clientes, rutas, cargas, viajes, kilometraje de viaje, adelantos, combustible, gastos, comprobantes, rendiciones, facturas y pagos son datos ficticios y controlados. No se copia una base de producción, un backup productivo ni documentos oficiales al piloto.

## Manifiesto local previo

El archivo versionado [implementation/.env.pilot.example](../../implementation/.env.pilot.example) es un manifiesto local de revisión; no despliega ni configura servicios por sí mismo.

```powershell
Set-Location implementation
Copy-Item .env.pilot.example .env.pilot.local
# Completar .env.pilot.local únicamente con valores públicos del piloto.
pnpm pilot:check-env
```

`pilot:check-env` lee solo el archivo indicado, nunca usa los valores de proceso ni contacta Supabase, PowerSync o Vercel. Verifica que el manifiesto declare `VITE_APP_ENV=pilot`, un proyecto Supabase piloto coherente, una instancia PowerSync distinta y un origen web distinto del origen productivo conocido. También rechaza secretos y valores de plantilla. Una salida satisfactoria solo prueba la coherencia local: la separación remota se confirma con la lista siguiente.

No se guardan en ese archivo `service_role`, PAT, contraseñas, secretos JWT, tokens de PowerSync ni `APP_ORIGIN`. Los secretos se administran exclusivamente en los gestores remotos correspondientes.

## Bootstrap externo autorizado

Una persona con acceso autorizado ejecuta y registra estos pasos. Ningún comando `--linked` se usa hasta verificar de forma visible que apunta al proyecto piloto; el wrapper local puede conservar un perfil previo.

1. Registrar en el acta de piloto el nombre del entorno, referencia del proyecto Supabase, identificador PowerSync, proyecto/origen Vercel y responsables. No incluir secretos en el acta ni en Git.
2. Crear un proyecto Supabase nuevo para el piloto. Aplicar las migrations versionadas y comprobar que RLS, Storage privado, Auth sin registro público y los comandos autoritativos están activos. Configurar SMTP de prueba o el mecanismo de invitación autorizado.
3. Crear una instancia/configuración PowerSync nueva, conectada únicamente al Supabase piloto. Publicar y validar `implementation/powersync/streams/product-mvp.yaml` contra esa instancia; nunca reutilizar una instancia que replique producción.
4. Crear un proyecto y origen web Vercel propios del piloto. Cargar las variables públicas `VITE_*` del manifiesto validado en ese proyecto, no en el proyecto productivo.
5. Configurar Auth con el origen y redirects exactos del piloto. Configurar el secreto remoto de la Edge Function `APP_ORIGIN` con ese mismo origen; no se usa una variable `VITE_*` para sustituirlo. Redesplegar la función de invitación solo en el proyecto piloto.
6. Crear cuentas de Administración y Conductor exclusivas de prueba, con privilegios mínimos. En el Android de prueba abrir el origen piloto y confirmar que no comparte sesión, caché ni datos locales con el origen oficial.
7. Antes de ingresar datos, guardar evidencia de los identificadores remotos, versión desplegada, estado de migrations, estado de streams y resultado del chequeo local. Si algún identificador no corresponde al acta, detenerse y corregirlo antes de seguir.

## Política de datos controlados

| Clase | Permitido en piloto | No permitido |
|---|---|---|
| Maestros | Unidades reales autorizadas, catálogos mínimos y usuarios de prueba con datos personales minimizados | Copia masiva de maestros, usuarios no autorizados o credenciales de operación oficial |
| Clientes y servicios | Nombres ficticios con prefijo `PILOTO-`, rutas y cargas de ensayo | Clientes reales, órdenes comerciales, datos contractuales o información sensible |
| Viajes y operación | Fechas, toneladas, kilometrajes y estados de ensayo claramente identificados | Despachos reales, trazas oficiales o evidencias que documenten una operación real |
| Dinero y documentos | Montos, adelantos, gastos, facturas y comprobantes ficticios; imágenes sintéticas o de prueba | Pagos, comprobantes tributarios, facturas, rendiciones, documentos personales o bancarios reales |

Todo registro transaccional de ensayo debe incluir una marca visible como `PILOTO-YYYYMMDD-<secuencia>` en el campo disponible de referencia, observación o descripción. El responsable conserva un inventario mínimo de los maestros reales autorizados y de cada cuenta de prueba.

## Escenarios de aceptación y evidencia

| # | Actor | Escenario | Evidencia mínima |
|---:|---|---|---|
| 1 | Administración | Crear, aprobar y programar un viaje de prueba con cliente, unidad y conductor válidos | Identificador del viaje, estado programado y captura del resumen |
| 2 | Conductor | Ver exactamente el viaje asignado en “Mi viaje” | Captura de asignación, unidad, ruta y carga |
| 3 | Conductor | Iniciar y avanzar Carga → Ruta → Descarga → Entrega | Historial de transiciones y kilometraje |
| 4 | Conductor | Registrar varios combustibles, gastos y una evidencia sin red | Estados locales/cola y evidencia asociada al viaje |
| 5 | Conductor | Cerrar/reabrir la PWA, reconectar y recuperar el trabajo | Cola drenada, sin duplicados ni pérdida |
| 6 | Administración | Revisar actividad, registrar adelanto de prueba, rendir y cerrar | Expediente del viaje, saldo y auditoría consultables |
| 7 | Administración y Conductor | Intentar operación denegada por rol o asignación incorrecta | Error claro sin cambio de datos |

Una evidencia debe referir el identificador de escenario, fecha, versión del despliegue, dispositivo y resultado. El canal de incidencias clasifica P0 (pérdida/corrupción), P1 (flujo crítico inutilizable), P2 (función parcial) y P3 (defecto menor/visual). No se declara listo el piloto con P0 o P1 abiertos.

## Suspensión, retorno y preservación

Ante un riesgo de mezcla de entornos, pérdida, corrupción, acceso indebido o evidencia sin resolver, se detiene el piloto: no se ingresan más transacciones, se conserva la evidencia disponible y se registra la incidencia. Si existe sospecha de que se usó el origen o proyecto oficial, se desconecta el dispositivo, no se intenta “limpiar” datos y se escala al propietario para decidir la respuesta trazable.

Para volver a un estado conocido del piloto:

1. Registrar la versión, usuarios de prueba, identificadores de viajes afectados, colas pendientes y el motivo de retorno.
2. Retirar temporalmente el despliegue piloto o restaurar la última versión piloto aprobada; no hacer rollback sobre producción.
3. Revocar o deshabilitar cuentas de prueba y credenciales remotas comprometidas según corresponda.
4. Preservar el proyecto piloto, sus auditorías y datos de prueba como evidencia de QA. No se borran para “limpiar” la futura producción.
5. Si el propietario autoriza una nueva corrida limpia, crear un nuevo conjunto de datos de prueba o reiniciar únicamente el entorno piloto con una acta que documente alcance, responsable y evidencia preservada.

El paso a operación oficial requiere aprobación explícita del propietario tras la etapa 6: producción empieza sin viajes, dinero, comprobantes, rendiciones, facturas ni pagos de prueba; solo recibe los maestros reales aprobados.
