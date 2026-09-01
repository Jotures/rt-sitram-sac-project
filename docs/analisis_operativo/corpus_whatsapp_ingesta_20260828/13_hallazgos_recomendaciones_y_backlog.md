# Hallazgos, recomendaciones y backlog

## Prioridad inmediata

| Prioridad | Hallazgo | Recomendación | Autoridad requerida |
|---|---|---|---|
| P0 | Alta de gasto posterior al cierre de rendición | El guard de inserción y la consulta privada de evidencia están implementados; faltan validar las migraciones/pgTAP en un entorno controlado y el UAT | Ingeniería / QA / Administración |
| P1 | Registro centralizado frente a captura directa del Conductor | DEC-037 acepta captura dual: Conductor offline y Administración/Gerencia en línea, con actor, motivo y auditoría; faltan validación de migraciones/pgTAP y UAT sintético | Administración / Gerencia / Conductores / QA |
| P1 | Combustible previo y gastos tardíos | DEC-037 y los contratos P1 conservan la fecha real, permiten regularización hasta el cierre y exigen reapertura auditada después; faltan validación de migraciones/pgTAP y UAT | Administración / Gerencia / QA |
| P1 | Ciclos, retornos y continuaciones | El recorrido de ciclos operativos está implementado sin fusionar viajes, facturación ni rendiciones; falta UAT de continuidad por unidad | Operaciones / Administración / QA |
| P1 | Fondo “para gastos” y frontera laboral | Los adelantos son fondos operativos rendidos al cierre; planilla queda fuera del producto por DEC-037. Falta UAT, no una integración de planilla | Gerencia / Administración / QA |
| P1 | Alias históricos de unidad, persona y cliente | DEC-037 prohíbe importación o correspondencia automática; cualquier revisión futura será humana y privada | Administración con custodio de datos |
| P2 | Mantenimiento incluye datos útiles pero incompletos | Definir categorías, proveedores, odómetro, costo/evidencia y estado de orden mínimos | Administración / Flota |
| P2 | Cobranza/facturación se sigue en listas libres | Hacer UAT del flujo factura–pago y definir el tratamiento de entidades emisoras/saldos iniciales | Administración / Contabilidad |
| P2 | Credencial GPS expuesta históricamente en el chat (`WAM-00510`) | El propietario informó que ya fue rotada; prevenir recurrencia y guardar secretos sólo server-side | Propietario o custodio de la cuenta GPS |
| P3 | Mensajes de marca se mezclan con operación | Mantener canales o repositorios separados; tratar cotización/CRM como iniciativa posterior | Propietario |

## Backlog propuesto, no comprometido

1. Aplicar y validar las migraciones/pgTAP P1 en un entorno controlado. Las
   verificaciones locales de formato, lint, TypeScript, Vitest y build ya
   pasaron; no se ha aplicado una migración ni ejecutado pgTAP local o remoto.
2. Ejecutar el [plan de pruebas de adaptación](18_plan_pruebas_adaptacion_aplicativo.md)
   con los casos sanitizados, no con datos históricos reales.
3. Facilitar UAT con Administración, Gerencia y Conductor para confirmar la
   captura dual, la regularización, el cierre/reapertura, los fondos operativos
   y los ciclos.
4. Crear un manifiesto privado de maestros canónicos con revisión humana;
   clasificar registros como migrables, referenciales o no migrables.
5. Mantener planilla fuera del producto; una futura vertical o integración
   requiere una decisión laboral y contable independiente.
6. Después de definir custodia y verdad de campo, evaluar por separado si el
   volumen de comprobantes justifica abrir la Etapa 0 del OCR; no antes.

## Resultado de esta etapa

El corpus está conservado, indexado y convertido en banco de pruebas. La
[matriz de cobertura](17_matriz_cobertura_adaptacion_aplicativo.md) concluye
que el núcleo del aplicativo es conceptualmente adecuado, pero la adaptación
actual sigue siendo parcial. DEC-037 dejó aceptadas las reglas P1 y sus
contratos, migraciones y UI están implementados y verificados localmente; aún
faltan validar migraciones/pgTAP y ejecutar UAT histórico sintético. No se deben copiar mensajes al sistema ni declarar
el producto adaptado o desplegado por este corte.
