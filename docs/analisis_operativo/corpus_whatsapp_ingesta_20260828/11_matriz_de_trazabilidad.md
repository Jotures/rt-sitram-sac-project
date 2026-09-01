# Matriz de trazabilidad

| Afirmación / patrón | Evidencia del corpus | Nivel | Contrato o fuente del aplicativo | Lectura |
|---|---|---|---|---|
| Los viajes se declaran con ruta, conductor, unidad y carga libres. | `WAM-00009`, `WAM-00114`, `WAM-00371`, `WAM-00544` | HECHO + PATRÓN | `trips`, `loads` en `20260813180000_create_business_mvp_schema.sql` | El sistema puede estructurar la información; no migrar sin resolución de alias. |
| Un viaje puede continuar/reanudarse. | `WAM-00450`–`WAM-00453`, `WAM-00512`, `WAM-00534` | HECHO | `operational_cycles`, `return_status` | Contrastar el uso real del ciclo con UAT. |
| Combustible y fondo para gastos se registran junto al viaje. | 125/134 y 133/134 candidatos, respectivamente | PATRÓN | `fuel_entries`, `advances` | El sistema exige mayor estructura que el chat. |
| Gastos y saldos se informan por separado, usualmente con foto. | `WAM-00006`, `WAM-00029`, `WAM-00550`; 108 medios candidatos | PATRÓN | `expenses`, `settlements`, `files` | Falta clave de enlace explícita. |
| Parte de los saldos aparece en pago de sueldo. | `WAM-00232`, `WAM-00366`, `WAM-00541` | PATRÓN | No hay módulo de planilla identificado | Validar alcance antes de diseñar. |
| Mantenimiento usa componente/compra y a veces odómetro. | `WAM-00056`, `WAM-00356`, `WAM-00503` | PATRÓN | `maintenance_plans`, `work_orders`, `parts`, `odometer_entries` | Mapeable con revisión humana. |
| Cobranza y facturas se siguen en listas libres y PDF. | `WAM-00042`–`WAM-00053`, `WAM-00172`, `WAM-00218` | PATRÓN | `invoices`, `payments`, archivos privados | Verificar entidades emisoras y conciliación. |
| Documentos de unidad existen como paquetes adjuntos. | `WAM-00075`–`WAM-00077`; `WA-PDF-006`–`WA-PDF-008` | HECHO | `documents`, `files` | Inventariar/validar antes de migrar. |
| Una credencial GPS se compartió históricamente por chat. | `WAM-00510` | HECHO | Secretos server-side previstos por decisiones GPS | El propietario informó que fue rotada; no usar ni repetir. |

Esta matriz apunta a contratos implementados, no prueba que cada superficie haya
sido usada o aceptada. Las pruebas/UAT siguen siendo necesarias para afirmar
“implementado y usable”.
