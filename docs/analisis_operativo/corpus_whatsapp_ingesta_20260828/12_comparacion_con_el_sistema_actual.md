# Comparación con el sistema actual

## Resultado vigente

La comparación detallada se encuentra en la
[matriz de cobertura y adaptación](17_matriz_cobertura_adaptacion_aplicativo.md).
El veredicto global es **adaptación parcial**: el núcleo arquitectónico es
adecuado, pero modelado, superficie disponible y uso real no son equivalentes.

## Comparación resumida

| ID | Patrón AS-IS | Cobertura actual | Brecha / decisión requerida |
|---|---|---|---|
| `BRE-001` | Alta centralizada de viaje con ruta, unidad, conductor, carga, combustible y fondo | Parcial | Viaje/carga, programación, combustible y adelanto existen como pasos separados; validar el traspaso y el actor responsable. |
| `BRE-002` | Viaje por tramos, continuación o reanudación | Modelado, no utilizable de extremo a extremo | Existen `operational_cycles`, `cycle_id` y `return_status`, pero no se confirmó comando, sincronización ni superficie para administrar el ciclo. |
| `BRE-003` | Combustible declarado durante la preparación | Parcial | Sólo Conductor puede crear desde la UI y requiere viaje activo; Administración no puede registrar ni consultar el comprobante. |
| `BRE-004` | Fondo para gastos y rendición posterior | Parcial | Definir “para gastos”; completar la transición de estado del adelanto y su evidencia; mantenerlo separado de remuneración. |
| `BRE-005` | Gasto informado después y saldo de rendición | Parcial; hallazgo P0 | No existe alta tardía gobernada en UI y el RPC permite a personal insertar un gasto nuevo después de cerrar la rendición. |
| `BRE-006` | Saldo de viaje conectado con sueldo | No cubierto; alcance pendiente | La ausencia de planilla es segura mientras no exista política laboral. No automatizar descuentos. |
| `BRE-007` | Mantenimiento con pieza, compra y odómetro | Parcial | El esquema es amplio, pero la UI no cubre proveedor, diagnóstico, piezas detalladas ni evidencia de la orden. |
| `BRE-008` | Documentos de unidad compartidos por chat | Parcial | Hay archivo privado, vigencia y bloqueo; la UI no permite abrir el archivo ya adjuntado y falta validar el catálogo bloqueante. |
| `BRE-009` | Facturación, detracción, pagos y saldos en listas libres | Parcial | Factura y pagos parciales existen; faltan detracción y entidad emisora explícitas. |
| `BRE-010` | Alias, fotos y multimedia sin asociación segura | No debe migrarse automáticamente | Requiere correspondencia o clasificación humana; no inferir entidad ni crear archivos ficticios. |
| `BRE-011` | Credencial GPS compartida históricamente por chat | No debe trasladarse | La credencial fue rotada según el propietario; los secretos permanecen server-side. |
| `BRE-012` | Conversación de marca y cotización | Fuera del alcance evaluado | Tratar CRM/lead como iniciativa separada, no como brecha automática del control operativo. |

## Hallazgos transversales

- La evidencia muestra una bitácora centralizada; la PWA presupone captura
  directa del conductor para combustible, gastos, incidentes y kilometraje.
- La captura offline es sólida para hechos ocurridos antes del cierre físico,
  pero no resuelve el alta nueva después de completar el viaje.
- Los archivos se almacenan de forma privada, pero su consulta administrativa
  no está expuesta en las pantallas revisadas.
- RLS, autoridad del backend, idempotencia, separación de estados y rendición
  explícita deben mantenerse.
- Las superficies autenticadas requieren UAT con casos sintéticos derivados
  del corpus; una prueba estática o un esquema existente no acreditan adopción.
