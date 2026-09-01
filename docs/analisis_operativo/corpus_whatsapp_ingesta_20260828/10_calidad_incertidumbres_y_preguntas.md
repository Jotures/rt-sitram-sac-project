# Calidad, incertidumbres y preguntas

## Calidad del corpus

| Área | Situación | Riesgo |
|---|---|---|
| Identidad | Alias de chat y nombres libres; no hay IDs de persona/cliente/unidad consistentes | Asociación equivocada al migrar o analizar. |
| Viajes | No hay código, estado ni clave que una el viaje con gasto/factura | Duplicidad o mezcla de operaciones. |
| Fechas | La fecha de mensaje no siempre es la fecha del evento | Secuencias y periodos financieros erróneos. |
| Importes | Textos con fórmulas libres y significados no definidos | Saldo/deducción incorrectos. |
| Adjuntos | Fotos sin descripción, multimedia omitido y mensajes eliminados | Evidencia incompleta. |
| Unidades | Variantes de alias y posibles errores de digitación | Vinculación errónea a flota. |
| Seguridad | Credencial GPS en texto plano histórico; el propietario informó que fue rotada | Evitar recurrencia y restringir custodia. |

## Preguntas prioritarias para el propietario

1. ¿Qué significa exactamente “para gastos”: adelanto del viaje, fondo por
   rendir, caja de conductor u otra figura?
2. ¿Qué regla autoriza descontar un saldo de rendición del sueldo y quién la
   aprueba?
3. ¿La planilla, préstamos y aportes previsionales deben formar parte del
   aplicativo o deben integrarse/gestionarse fuera de él?
4. ¿Cuándo una continuación es un tramo del mismo viaje, un retorno o un nuevo
   servicio facturable?
5. ¿Cuáles son las identidades canónicas de unidad, conductor, cliente,
   proveedor y entidad emisora para validar las variantes históricas?
6. ¿Qué documento y qué vigencia bloquean una programación de unidad?
7. ¿Los saldos de cobro de distintas entidades/razones sociales deben convivir
   en el mismo entorno de empresa o requieren separación contable?
8. ¿Qué procedimiento y custodio evitarán que las futuras credenciales GPS se
   compartan por chat?

## Decisiones que no se pueden inferir

El corpus no autoriza crear políticas salariales, migrar saldos, fijar
categorías, asumir clientes, corregir odómetros, asociar comprobantes a gastos
ni activar OCR/GPS. Esas acciones necesitan fuentes adicionales y aprobación.
