# Procesos AS-IS observados

## 1. Viaje y dinero operativo

```text
Declaración libre de viaje
  -> combustible y fondo para gastos informados
  -> salida/continuación comunicada por chat
  -> foto o aviso de gastos posterior
  -> saldo/deuda anotado de forma libre
  -> posible descuento en sueldo o seguimiento administrativo
```

**HECHO DOCUMENTADO:** los mensajes de viaje suelen contener combustible,
efectivo para gastos y carga. **PATRÓN OBSERVADO:** la evidencia de gasto se
registra por separado, a veces días después. **INFERENCIA A VALIDAR:** el saldo
“debe” representa una rendición individual; el sentido exacto y el aprobador no
siempre están expresados.

## 2. Flota y mantenimiento

```text
Aviso de falla, cambio o compra
  -> referencia libre a unidad/componente
  -> a veces fotografía o kilometraje
  -> siguiente cambio ocasionalmente anotado
```

Los mensajes incluyen aceite, frenos, filtros, llantas, componentes mecánicos,
garaje y reparaciones. No se ve un identificador de orden de trabajo, proveedor
normalizado, costo desagregado, estado de aprobación ni cierre de mantenimiento.

## 3. Facturación, detracción y cobranza

```text
Lista manual de fletes por cobrar o por facturar
  -> PDF/constancia o referencia de factura
  -> depósito/detracción o saldo comunicado
  -> seguimiento posterior en una lista libre
```

El corpus muestra facturación y seguimiento de cuentas por cobrar, pero el
vínculo entre cliente, viaje, factura, pago y entidad emisora no es constante ni
siempre aparece en un mismo mensaje.

## 4. Sueldo y adelantos personales

```text
Base salarial escrita libremente
  - descuentos, saldos de gasto y/o adelantos
  -> monto pagado comunicado
```

El chat mezcla la liquidación de viajes con descuentos de sueldo y conceptos
personales/previsionales. Esto es un proceso distinto de una rendición de viaje
y requiere una delimitación de alcance antes de modelarlo.

## 5. Documentos, GPS y comunicación no operativa

Los documentos de unidad y comprobantes se comparten como archivos. También se
observa una credencial de GPS enviada por el chat, lo cual es una práctica de
riesgo. Una rama de conversación corresponde a identidad de marca y marketing;
se cataloga como contexto no operativo y no se convierte en requisito del
sistema de control.
