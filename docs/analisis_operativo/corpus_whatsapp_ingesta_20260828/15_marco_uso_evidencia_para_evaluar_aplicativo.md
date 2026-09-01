# Marco de uso de evidencia histórica para evaluar el aplicativo

## Propósito

Este marco convierte los patrones sanitizados del corpus de WhatsApp en una
fuente controlada de evaluación del Centro de Control Digital R&T. Su finalidad
no es reproducir el chat ni declarar correctas todas sus prácticas, sino probar
si el aplicativo puede conservar el conocimiento operativo, imponer controles
adecuados y mantener un recorrido comprensible de extremo a extremo.

La pregunta rectora es:

> **¿Puede un caso que ocurrió en la operación real representarse de forma
> completa, clara, segura y trazable dentro del aplicativo, sin depender de la
> memoria ni del contexto del chat?**

## Lugar de la evidencia en el gobierno del producto

La evidencia tiene tres usos distintos:

1. **Referencia histórica:** demuestra que una declaración, excepción o forma
   de coordinación apareció en la operación observada.
2. **Banco de pruebas:** permite construir casos sintéticos y reproducibles con
   la misma estructura del hecho, sin copiar datos personales ni financieros.
3. **Señal de adaptación:** ayuda a encontrar diferencias entre la práctica
   observada y el contrato actual del aplicativo.

No tiene autoridad para:

- crear una regla de negocio;
- validar un saldo o comprobante;
- identificar automáticamente una unidad, persona, cliente o proveedor;
- importar una operación al backend;
- aprobar una política laboral, contable, tributaria o comercial;
- modificar el aplicativo sin una decisión posterior.

## Fuentes y orden de contraste

Cada conclusión debe distinguir las siguientes fuentes:

| Nivel | Fuente | Qué demuestra |
|---:|---|---|
| 1 | Mensajes y adjuntos del corpus privado | Que una información fue declarada o compartida históricamente. |
| 2 | Documentación sanitizada del corpus | El patrón reconstruido, su frecuencia, trazabilidad y límites. |
| 3 | Migraciones, dominio y contratos de seguridad | Lo que el sistema modela y permite de forma autoritativa. |
| 4 | Gateways, rutas y componentes de la PWA | Lo que un rol puede intentar hacer desde la interfaz. |
| 5 | Pruebas automatizadas y registros de piloto | Lo que ya fue verificado técnica o funcionalmente. |
| 6 | UAT con casos derivados de la evidencia | Si la práctica resulta realmente comprensible y utilizable para R&T. |

Un esquema o una función existente no bastan para afirmar que un proceso está
cubierto. Debe existir un recorrido accesible al rol correcto y una validación
proporcional al riesgo.

## Unidad de evaluación

La unidad no será un mensaje aislado. Será un **escenario histórico
sanitizado**, formado por:

```text
contexto y precondiciones
  -> hechos o eventos observados
  -> información mínima necesaria
  -> comportamiento esperado del aplicativo
  -> controles y resultado verificable
```

Un escenario puede combinar varios mensajes cuando estos forman un patrón
repetido. Las referencias `WAM-*`, `WA-MEDIA-*` y `WA-PDF-*` conservan la
trazabilidad sin incorporar el contenido privado a Git.

## Dimensiones obligatorias

Cada escenario se evalúa en seis dimensiones:

| Código | Dimensión | Pregunta de prueba |
|---|---|---|
| `DAT` | Datos y relaciones | ¿Existen entidades, campos e identificadores que mantengan unido el caso? |
| `FLU` | Flujo y reglas | ¿El estado, orden, validación y cierre representan el proceso sin inventar reglas? |
| `ROL` | Roles y permisos | ¿La persona que realmente realiza la tarea puede ejecutarla con el alcance correcto? |
| `OFF` | Offline y sincronización | ¿La tarea crítica sobrevive sin señal, reintentos, cierre y reapertura del dispositivo? |
| `UX` | Comprensión | ¿Se entiende qué ocurrió, qué falta, qué puede hacerse y qué pasará después? |
| `AUD` | Evidencia y auditoría | ¿Quedan procedencia, revisión, correcciones y cierre trazables? |

La dimensión `OFF` puede marcarse como no aplicable cuando la acción debe ser
deliberadamente autoritativa y en línea, como el cierre financiero.

## Clasificación de cobertura

| Estado | Significado |
|---|---|
| **Cubierto y adecuado** | Contrato, superficie, control y prueba disponible representan el caso sin brecha material conocida. |
| **Cubierto; prueba histórica pendiente** | La capacidad existe y tiene pruebas generales, pero aún no fue ejecutada con el escenario derivado del corpus. |
| **Parcial** | Existe una parte del modelo o flujo, pero falta actor, momento, relación, interfaz o control importante. |
| **No cubierto** | No existe una capacidad suficiente para representar el caso. Esto no autoriza construirla automáticamente. |
| **No debe trasladarse** | La práctica histórica debe reemplazarse por un control más seguro o quedar fuera del dato autoritativo. |
| **No comparable** | La evidencia no permite determinar el resultado o la práctica está fuera del alcance evaluado. |

## Niveles de confianza

- **Alta:** patrón repetido y contrato del aplicativo verificable en código y
  pruebas.
- **Media:** patrón claro, pero uso real, semántica o superficie requieren UAT.
- **Baja:** inferencia aislada o dato insuficiente; no genera una brecha por sí
  sola.

## Regla de sanitización

Los casos versionables deben usar:

- actores ficticios por rol;
- unidades, clientes, rutas y proveedores sintéticos;
- fechas y montos de prueba que no reproduzcan transacciones reales;
- imágenes o comprobantes sintéticos;
- referencias opacas únicamente para demostrar procedencia.

No deben contener nombres, teléfonos, placas, números documentales, credenciales,
cuentas, importes identificables ni texto crudo del chat.

## Evidencia de prueba requerida

Cada ejecución debe registrar, como mínimo:

- ID del escenario y versión del banco;
- entorno aislado, versión del despliegue y dispositivo;
- rol usado;
- precondiciones y datos sintéticos;
- pasos ejecutados;
- resultado esperado y resultado observado;
- identificadores sintéticos creados;
- estado local, cola y confirmación del servidor cuando corresponda;
- incidencia y severidad si falla;
- veredicto: `PASS`, `FAIL`, `BLOCKED` o `NOT_RUN`.

## Criterio de aceptación

Un escenario crítico sólo puede considerarse adaptado cuando:

1. no pierde información necesaria del caso;
2. el actor correcto puede completar su tarea;
3. los estados y saldos no dependen de interpretación libre;
4. la operación offline conserva datos y evita duplicados cuando aplica;
5. el usuario identifica naturalmente la siguiente acción;
6. el backend conserva autoridad sobre permisos, cierres y dinero;
7. el resultado puede reconstruirse después mediante relaciones y auditoría.

Una prueba técnica aprobada y una UAT aprobada son evidencias complementarias,
no intercambiables.

## Línea base verificada en esta evaluación

El 2026-08-28 se inspeccionaron migraciones, dominio, streams de PowerSync,
gateways, rutas, componentes y pruebas del repositorio. La línea base local
pasó formato, lint, TypeScript, 78 archivos Vitest —386 pruebas—, el
verificador de seguridad de invitaciones y el build de la PWA. Además existen
9 contratos pgTAP versionados; no fueron ejecutados contra Supabase en esta
evaluación local.

La pantalla pública de acceso cargó localmente sin errores visibles ni mensajes
de consola. Las superficies autenticadas no fueron declaradas visualmente
aprobadas en esta evaluación: su comprobación completa corresponde al UAT
aislado definido en el plan de pruebas.
