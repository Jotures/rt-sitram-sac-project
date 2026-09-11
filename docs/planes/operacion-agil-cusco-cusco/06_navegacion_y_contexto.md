# Navegación y asistencia contextual

Fecha: 2026-09-11. Sesión vigente: SESSION-20260828-011. Autoridad: DEC-049.
El propietario aprobó implementación y despliegue después de revisar la propuesta
de simplificar la navegación y aprovechar los datos ya conocidos.

## Distribución de la experiencia

| Lugar | Responsabilidad |
|---|---|
| Inicio rápido | Resumen de salidas en recorrido, programadas, rendiciones abiertas y comandos por confirmar; enlaces al registro concreto. |
| Salidas | Lista con búsqueda, estados y más resultados; detalle de una salida con servicios, movimientos, regreso, cuenta y documentos. |
| Finanzas | Navegación directa entre dinero entregado, gastos, combustible, rendiciones y cobranza; registros visibles y captura específica bajo demanda. |
| Servicios y fletes | Servicios comerciales separados de la salida; agregar servicio en modo rápido lleva al mismo formulario contextual de Salidas. |
| Buscar | Salidas por placa, conductor, recorrido, folio y fecha, además de entidades existentes autorizadas para el rol. |

La captura de salida tiene una sola ruta canónica. Inicio ofrece un acceso a ella.
La ruta anterior de Programación conserva acceso con el filtro de programadas;
la entrada redundante desaparece del menú rápido. La vista completa mantiene las
operaciones y las entradas antiguas desde un viaje o proveedor conservan su
contexto y formulario. Los nombres Servicios y fletes y Dinero entregado coinciden
entre navegación y títulos.

## Ayuda al registro

- El detalle de salida muestra unidad y conductor primero, con el folio secundario.
- Los movimientos desde ese detalle conservan la salida en la URL. Con varias
  salidas posibles se exige elegir; una única salida vigente puede aparecer
  preseleccionada de forma visible. No se sustituye una elección explícita.
- La partida se ofrece para una salida programada; un regreso registrado conduce
  a revisar cuenta y servicios, sin declarar por ello una rendición pendiente.
- La lista completa no se repite debajo del detalle de una salida confirmada.
- Los formularios conservan los borradores existentes por usuario y operación.
- Un movimiento parecido a otro reciente presenta importe, descripción y fecha
  del registro previo. El usuario puede corregirlo o confirmar un hecho distinto.
  Cambiar el formulario invalida esa confirmación. El mismo ID de reintento no
  genera un aviso nuevo. El alcance exacto de esta ayuda está en DEC-049.
- El guardado sigue significando copia local hasta que el diario muestre la
  confirmación. Las listas financieras vuelven a consultar al confirmarse comandos.

## Visualización y búsqueda

Los registros financieros móviles conservan fecha, estado e importe en una tarjeta.
Las acciones mantienen tamaño táctil. Los formularios complementarios se cargan
cuando hacen falta y se reduce el texto introductorio repetido.

Buscar acepta palabras en distinto orden, tildes omitidas y placas con o sin
separadores. Cada salida abre su detalle exacto. El error de una fuente no oculta
los resultados de las otras; el aviso identifica lo que falta. Cuando fallan
todas, se comunica un error de consulta, no una operación vacía. Contabilidad no
consulta ni recibe enlaces a las rutas operativas restringidas.

## Validación y límites

- TypeScript del workspace, lint, formato y mapa del repositorio.
- Pruebas web de rutas y permisos, contexto, búsqueda parcial/total y avisos de
  duplicado. La cifra final y el despliegue se registran en el log de sesión.
- Prueba visual local con los componentes reales y adaptadores de datos ficticios:
  Inicio separado, lista de gastos visible, elección entre varias salidas,
  preselección única, aviso sin guardar y guardado local tras confirmación expresa,
  estado pendiente y búsqueda por `jose qa001` con una fuente no disponible.
- Finanzas inspeccionado a 320, 390, 960 y 1440 px: importe visible y sin desborde
  horizontal de documento. La vista local de prueba fue cerrada al terminar.
- Los adaptadores, franja amarilla, navegación técnica y datos de prueba viven en
  `implementation/.local/ux-review/`, fuera del árbol versionado y del punto de
  entrada productivo. No se publican ni se registran en el backend.
- Publicado en Vercel desde `4687796`, Ready y alias principal verificados. Humo
  autenticado en Inicio, Salidas, Gastos y Buscar; búsqueda de placa sin guion
  correcta y siete rutas HTTP 200. Se comprobó la ausencia de controles ficticios
  tanto en el bundle publicado como en la interfaz. Detalle en el log de sesión.
- Sin migraciones, cambios de RLS, cierres automáticos ni nuevas dependencias.
  Se usan los comandos y canales existentes; no se hicieron movimientos reales
  para probar la interfaz. Android físico y pruebas de reconexión con el backend
  completo no se repitieron en este corte de presentación.

## Recuperación

Una regresión de presentación permite volver al despliegue previo de Vercel.
No es necesario revertir datos o migraciones. Conservar siempre las colas y los
borradores de los dispositivos; no limpiar almacenamiento como recuperación.
