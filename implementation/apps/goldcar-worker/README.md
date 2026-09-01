# Goldcar Portal Worker

Puente temporal de DEC-029 para leer la exportación CSV visible de vehículos y
última posición mediante un navegador efímero. La Etapa 3 añade una única
sincronización manual y acotada; no contiene cron, UI, histórico ni comandos
sobre dispositivos.

## Guardas

- La ejecución live exige `GOLDCAR_PORTAL_ALLOW_LIVE_READ=true`.
- Las credenciales se leen solo desde `.env.local`, ignorado por Git.
- Solo se permite un `POST` al formulario de login; las demás solicitudes de
  escritura se bloquean.
- La exportación autorizada es un `GET` exacto a
  `/objects/list/data?action=csv`.
- No se guardan cookies, CSV crudo, capturas, nombres, placas ni coordenadas en
  logs.
- Cada ejecución usa un contexto nuevo y cierra Chromium al terminar.
- `goldcar:sync` exige además `GOLDCAR_SYNC_ALLOW_PERSIST=true`, URL y clave
  `service_role` server-side, empresa y perfil activo de Gerencia.
- Antes de abrir Chromium, Supabase exige al menos un vínculo proveedor→unidad
  aprobado y una política de retención para esa empresa. No se crean vínculos
  automáticamente.
- La ejecución manual obtiene solo un snapshot. Usa lease durable, deadline,
  contador de resultados y huellas idempotentes; no simula cursor, histórico o
  paginación que el portal no ofrece.
- Solo se reintentan escrituras de persistencia transitorias con backoff/jitter.
  Una falla, 401/403, 429 o formato inesperado del portal cierra la ejecución
  con un estado sanitizado y no vuelve a iniciar sesión automáticamente.

## Prueba local

1. Copiar `.env.example` a `.env.local` sin versionarlo.
2. Completar correo y contraseña de la cuenta autorizada.
3. Mantener `GOLDCAR_PORTAL_ALLOW_LIVE_READ=false` para comprobar configuración.
4. Cambiarlo a `true` únicamente durante la ventana de prueba aprobada.
5. Desde `implementation/`, ejecutar `pnpm goldcar:probe`.

La salida incluye solamente proveedor, cantidad de activos/posiciones y rango
temporal. No imprime identificadores ni ubicaciones.

## Diagnóstico de disponibilidad del objetivo

Antes de abrir un detalle de sensores, puede ejecutarse un diagnóstico aislado
de la lista visible. Requiere, además de la guarda live, los switches
`GOLDCAR_TARGET_AVAILABILITY_INSPECTION_ALLOW_READ=true` y
`GOLDCAR_OBJECTS_BOOTSTRAP_ALLOW_DYNAMIC_READ=true`, junto con el selector
canónico ya aprobado. Desde `implementation/`:

```powershell
pnpm goldcar:inspect-target-availability
```

No abre el detalle, no hace clic, no persiste datos y no admite rutas ni límites
configurables. Su salida solo indica si el objetivo fue único visible, ausente,
oculto o ambiguo al finalizar la ventana, más indicadores booleanos agregados
de la política de bootstrap. Nunca imprime texto del portal, identificadores,
URLs, conteos, respuestas, cookies ni valores de sensores.

## Sincronización manual controlada

Solo después de que Gerencia apruebe los vínculos iniciales, la retención y la
ventana de lectura, completar en `.env.local` los valores server-side de la
sección de sincronización. Mantener ambos kill switches en `false` hasta la
ventana aprobada y ejecutar desde `implementation/`:

```powershell
pnpm goldcar:sync
```

La salida contiene únicamente identificador interno de ejecución, estado,
conteos, checkpoint temporal, duración y código de error canónico. No habilita
un job recurrente ni es apta para Vercel: Chromium debe ejecutarse en un runtime
Node separado que conserve secretos server-side.
