# Operaciones reconstruidas

## Regla de lectura

Las siguientes son **familias de operación reconstruidas**, no transacciones
importables. Un mensaje puede relacionarse con más de una familia y no contiene
un ID que permita enlazarlo de forma segura con otros mensajes.

## Familias recurrentes

| ID | Familia | Evidencia y patrón | Campos observados | Estado de reconstrucción |
|---|---|---|---|---|
| `OPR-001` | Declaración de salida / viaje | 134 mensajes candidatos; 128 iniciales o sin tipo y 6 continuaciones | destino/ruta libre, conductor, unidad, combustible, fondo para gastos, carga | PATRÓN OBSERVADO |
| `OPR-002` | Combustible de viaje | En 125 candidatos se indica cantidad y en 124 un importe; normalmente junto al viaje | cantidad, unidad implícita, importe, a veces ruta/unidad/conductor | PATRÓN OBSERVADO |
| `OPR-003` | Fondo operativo / adelanto de viaje | 133 candidatos de viaje mencionan efectivo para gastos | importe, ocasional canal de entrega, viaje referido libremente | PATRÓN OBSERVADO |
| `OPR-004` | Gastos y saldo de rendición | 114 candidatos, numerosos con imágenes y expresiones de saldo/deuda | conductor/unidad, ruta o fecha ocasional, saldo, imagen | PATRÓN OBSERVADO |
| `OPR-005` | Pago de sueldo y descuentos | 43 mensajes candidatos con fórmulas libres | base, descuentos, anticipos, conceptos previsionales y saldo | PATRÓN OBSERVADO |
| `OPR-006` | Mantenimiento, repuestos y llantas | 66 candidatos; algunos con kilometraje y próximo cambio | unidad, componente, compra/reparación, odómetro ocasional | PATRÓN OBSERVADO |
| `OPR-007` | Facturación, detracción y cobranza | 22 candidatos más PDF relacionados | cliente o referencia libre, factura, deuda, depósito/detracción | PATRÓN OBSERVADO |
| `OPR-008` | Custodia documental de flota | Paquetes PDF y mensajes con datos de unidad/conductor | documento, unidad, vigencia potencial, archivo | HECHO DOCUMENTADO |

## Señales de ciclo operativo

Se observan mensajes de “continuar” y de “reanudar” viaje. Esto indica que la
empresa puede tratar una ruta de múltiples tramos o una pausa como parte de un
ciclo, no necesariamente como viajes independientes. La evidencia es
suficiente para validar este comportamiento con el propietario, pero no define
aún la regla exacta de división entre viaje, ciclo y retorno.

## Cobertura de la declaración de viaje

Entre los 134 mensajes candidatos, 128 contienen un alias de unidad candidato,
125 contienen cantidad de combustible, 124 un importe de combustible, 133 un
fondo para gastos y 122 una descripción de carga. La alta repetición muestra
una plantilla informal útil para diseño, no un contrato: faltan IDs de cliente,
tiempos confirmados, odómetro inicial, responsable de aprobación y enlace
seguro a gasto, factura o cobro.
