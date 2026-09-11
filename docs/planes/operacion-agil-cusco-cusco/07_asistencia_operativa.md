# Asistencia operativa — 2026-09-11

El propietario autorizó implementar y desplegar los cinco puntos propuestos.
Continúa SESSION-20260828-011 y extiende DEC-049 mediante DEC-050.

## Comportamiento entregado

| Necesidad | Comportamiento |
|---|---|
| Siguiente paso | Inicio muestra un motivo concreto y una acción por salida; rendiciones observadas y recorridos con regreso tienen prioridad. |
| Reutilizar datos | Botón para aplicar conductor/recorrido de la salida anterior, unidad de combustible y proveedor anterior en el formulario completo. Muestra fecha de origen; no sobreescribe campos ya elegidos ni propone importes. |
| Evitar errores | Advertencia por kilometraje inferior al abastecimiento anterior o importes/precios muy alejados de una muestra comparable. Requiere revisar/corregir o marcar confirmación; editar invalida esa confirmación. |
| Buscar con palabras | «Combustible de VDR768 este mes», «gastos esta semana», «salidas pendientes de rendir». Filtros visibles y enlaces a los registros. |
| Comprender la cuenta | «Cómo se forma esta cuenta» explica entregas, gastos validados, adicionales aprobados, combustible, pagos y saldo; próximos pasos enlazan con la sección pertinente. |

## Fuentes y límites

- Se mantienen gateway y permisos existentes. Los metadatos de asociación usan
  IDs reales; no se extraen relaciones del texto mostrado. No hay esquema nuevo,
  migraciones, servicios externos ni dependencias nuevas.
- Las listas del gateway tienen un máximo de 200 registros por fuente. Cuando la
  búsqueda llega a ese límite, se avisa que puede haber registros anteriores. Una
  consulta fallida no equivale a ausencia de datos. Si la lista de cuentas alcanza
  el límite, no se afirma que una salida sin coincidencia carezca de rendición.
- La comparación de captura usa los registros disponibles y validados de una
  unidad dentro de 90 días y anteriores al hecho declarado. La referencia es la
  mediana de hasta veinte comparables, con mínimo de cinco. No compara litros con
  galones ni monedas distintas, ni considera una carga mayor como un precio mayor.
  Los umbrales orientativos están definidos en DEC-050. No es detección universal
  de fraude ni autorización para omitir las validaciones del backend.
- La lectura de kilometraje de referencia procede del historial de combustible
  válido disponible, no de GPS. Su ausencia no se convierte en cero.
- Las sugerencias de proveedor aparecen en el formulario completo de combustible,
  que ya guarda ese campo. El comando rápido no admite proveedor y conserva ese
  contrato. Ambas capturas reciben la advertencia y sugerencia de unidad de medida.
- Fechas comprendidas: hoy, ayer, esta semana, este mes y mes pasado (Perú).
  Negaciones se mantienen como texto literal. Frases no reconocidas no generan
  filtros imaginados. Buscar requiere los datos accesibles al gateway; la copia
  local conserva la cobertura disponible, sin prometer búsqueda histórica completa.
- Los avisos de captura se calculan en el dispositivo y no se guardan como nuevas
  reglas de dominio. Su confirmación no sustituye una revisión financiera. Las
  sugerencias recorren el mismo evento de cambio que la escritura para conservar
  borrador e idempotencia existentes; la confirmación excepcional no se restaura.
- La explicación financiera usa `get_cycle_rendition`; la hoja sin aprobar queda
  separada de los importes confirmados. Los pagos anulados no reducen el saldo. Las
  cuentas antiguas conservan su explicación y contrato de viaje. No se modifica
  el cálculo del servidor ni se crean rendiciones al visitar Inicio o Buscar.

## Verificación y recuperación

Pruebas de prioridades, fuentes fallidas, asociaciones, frases/fechas, unidades,
muestra mínima, pagos parciales/anulados y consistencia de cuentas. Prueba visual
local con adaptadores ficticios; la vista de prueba queda fuera del código publicado.
345 pruebas web correctas, TypeScript/lint/formato/mapa/build correctos. Publicado
desde `4d264f3`, Vercel Ready y alias confirmado, siete rutas HTTP 200 y humo
autenticado de Inicio y Buscar sin errores de consola. Las pruebas con movimientos
de cuenta y guardados se hicieron solo con adaptadores ficticios. Detalle en el log
de sesión.

Una regresión de presentación se recupera volviendo al despliegue anterior de
Vercel. No requiere revertir datos. Conservar colas, OPFS y borradores del usuario.
Android físico y el ciclo completo de reconexión no se consideran verificados
por la prueba de presentación en navegador.
