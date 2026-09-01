# Catálogo de datos y glosario

| Dominio | Datos observados en el chat | Calidad | Destino de modelo recomendado |
|---|---|---|---|
| Viaje | origen/destino libres, conductor, unidad, carga, fecha ocasional | Incompleto, sin ID ni estado verificable | `trips`, `loads`, `operational_cycles` |
| Combustible | cantidad, importe y vínculo narrado a viaje | Falta proveedor, odómetro, comprobante y método en muchos casos | `fuel_entries` |
| Fondo operativo | importe “para gastos”, canal ocasional, conductor/viaje | No siempre distingue adelanto de otro gasto | `advances` con concepto y recibo |
| Gasto | foto, descripción libre, saldo/deuda, unidad o conductor a veces | Categoría, fecha, proveedor y aprobación no estables | `expenses`, `settlements`, `files` |
| Rendición | saldo libre y descuento posterior potencial | No hay estado ni aprobador inequívoco | `settlements`, eventos y auditoría |
| Planilla | base, descuentos, adelantos/préstamos y pago | Proceso informal y mezclado con viaje | No modelar sin decisión de alcance |
| Flota | unidad, pieza, trabajo, odómetro/fecha ocasionales | Compras/reparaciones no siempre separadas | `maintenance_plans`, `work_orders`, `parts`, `odometer_entries` |
| Documentos | PDF/foto, unidad/conductor, tipo aparente | Vigencia y titularidad requieren revisión humana | `documents`, `files` privados |
| Facturación/cobranza | cliente/referencia, factura, saldo, depósito/detracción | Sin vínculo estable a viaje/pago/entidad emisora | `invoices`, `payments`, clientes |
| GPS | acceso y referencia a proveedor | Contiene secreto; no es dato operativo histórico | Configuración server-side, nunca chat |

## Términos que requieren definición de negocio

- **“Para gastos”**: puede ser fondo de viaje, adelanto, caja chica u otra
  entrega; el corpus no fija su semántica financiera.
- **“Debe” / “saldo”**: parece indicar diferencia pendiente, pero no establece
  dirección, base de cálculo, aprobador ni momento de exigibilidad.
- **“Continuar viaje”**: puede ser tramo, retorno, reanudación o nuevo servicio.
- **“Flete por cobrar”**: lista de seguimiento; no acredita una factura,
  vencimiento ni pago conciliado.
- **“Actualizado”**: mensaje sin contrato; no confirma que un maestro del
  sistema haya cambiado.
