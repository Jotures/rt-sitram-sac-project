# Blueprint Funcional del Sistema Digital — R&T SITRAM SAC

> **Propósito:** definir qué debe hacer el futuro sistema digital de R&T SITRAM SAC, quién lo utilizará, qué información manejará, cómo funcionarán sus procesos, qué reglas deberá aplicar y qué indicadores deberá producir.

**Empresa:** R&T SITRAM SAC  
**Actividad:** Transporte nacional de carga pesada  
**Base de operaciones:** Cusco, Perú  
**Tipo de documento:** Blueprint Funcional  
**Versión:** 1.0  
**Estado:** Propuesta funcional inicial  
**Base documental:** Informe Contextual + Diagnóstico Operativo + Modelo Operativo Objetivo (TO-BE)

---

# 1. Objetivo del Sistema

El sistema debe convertirse en el **centro digital de control operativo de R&T SITRAM SAC**.

Su función principal será centralizar y relacionar información que actualmente se encuentra distribuida entre:

- WhatsApp;
- Excel;
- comprobantes;
- documentos físicos;
- banca;
- plataforma GPS;
- conocimiento de administradores y conductores.

El sistema deberá permitir controlar el ciclo completo:

**Cliente → oportunidad de carga → cotización → viaje → unidad → conductor → combustible → gastos → documentos → retorno → rendición → facturación → cobranza → rentabilidad → análisis.**

---

# 2. Problema que Debe Resolver

Actualmente existen seis problemas estructurales que el sistema debe atacar.

## 2.1. Información fragmentada

Los datos no se encuentran concentrados en un único lugar.

## 2.2. Rentabilidad poco visible

No existe un cálculo integral y sistemático de utilidad por:

- viaje;
- ciclo;
- unidad;
- ruta;
- cliente.

## 2.3. Flota improductiva sin medición precisa

Una unidad puede permanecer parada por:

- falta de carga;
- falta de conductor;
- taller;
- mantenimiento;
- avería;
- bloqueo.

Pero actualmente no existe un sistema estructurado para cuantificar ese tiempo.

## 2.4. Dependencia de procesos manuales

Rendiciones, gastos, comprobantes y seguimiento requieren intervención manual importante.

## 2.5. Mantenimiento parcialmente reactivo

No existe una plataforma centralizada que anticipe mantenimientos y vencimientos.

## 2.6. Gestión comercial poco estructurada

Los clientes llegan principalmente por recomendaciones y no existe todavía un pipeline comercial centralizado.

---

# 3. Visión del Producto

El sistema deberá funcionar como un:

# Centro de Control Digital R&T

Desde una única plataforma, la administración debería conocer:

- dónde está cada unidad;
- qué viaje está realizando;
- qué conductor la opera;
- qué carga transporta;
- cuánto combustible lleva consumido;
- cuánto dinero se entregó;
- cuánto se ha gastado;
- cuánto se espera cobrar;
- cuánto se ha cobrado;
- cuánto está generando el viaje;
- qué mantenimiento se aproxima;
- qué documentos vencen;
- qué unidades están improductivas;
- qué acción debe ejecutarse a continuación.

---

# 4. Principio Central del Sistema

La entidad principal será:

# VIAJE

Un viaje será el centro alrededor del cual se relacionan:

- cliente;
- unidad;
- conductor;
- ruta;
- carga;
- combustible;
- gastos;
- adelantos;
- rendiciones;
- incidencias;
- documentos;
- factura;
- cobranza;
- rentabilidad.

---

# 5. Usuarios del Sistema

Se definen inicialmente cuatro perfiles.

## 5.1. Gerencia / Propietario

Acceso prácticamente completo.

Responsabilidades:

- revisar resultados;
- aprobar excepciones;
- consultar rentabilidad;
- definir tarifas;
- revisar flota;
- controlar clientes;
- tomar decisiones.

---

## 5.2. Administración

Será el usuario principal del sistema.

Responsabilidades:

- registrar oportunidades;
- programar viajes;
- asignar unidades;
- asignar conductores;
- registrar adelantos;
- controlar documentos;
- revisar rendiciones;
- registrar cobranzas;
- gestionar mantenimiento;
- mantener información actualizada.

---

## 5.3. Conductor

Acceso limitado principalmente desde celular.

Funciones:

- visualizar viaje asignado;
- confirmar salida;
- consultar datos básicos;
- registrar kilometraje;
- registrar gastos;
- fotografiar comprobantes;
- reportar combustible;
- registrar incidencias;
- confirmar llegada;
- enviar información para rendición.

---

## 5.4. Contabilidad / Asesor externo

Acceso limitado.

Funciones potenciales:

- consultar ingresos;
- consultar gastos;
- revisar comprobantes;
- exportar información;
- revisar facturación;
- acceder a reportes necesarios.

No debería tener acceso innecesario a funciones operativas.

---

# 6. Matriz General de Permisos

| Función | Gerencia | Administración | Conductor | Contabilidad |
|---|---|---|---|---|
| Dashboard completo | Sí | Sí | No | Parcial |
| Crear viaje | Sí | Sí | No | No |
| Editar viaje | Sí | Sí | Limitado | No |
| Asignar unidad | Sí | Sí | No | No |
| Asignar conductor | Sí | Sí | No | No |
| Registrar combustible | Sí | Sí | Sí | Consulta |
| Registrar gasto | Sí | Sí | Sí | Consulta |
| Aprobar rendición | Sí | Sí | No | Consulta |
| Crear cliente | Sí | Sí | No | No |
| Registrar cobranza | Sí | Sí | No | Consulta |
| Gestionar mantenimiento | Sí | Sí | Reportar | No |
| Ver utilidad | Sí | Sí | No | Según permiso |
| Gestionar usuarios | Sí | Limitado | No | No |
| Configuración | Sí | Limitado | No | No |

---

# 7. Arquitectura Funcional

El sistema estará compuesto por los siguientes módulos principales:

1. Inicio / Centro de Control
2. Operaciones / Viajes
3. Oportunidades y Cotizaciones
4. Clientes
5. Flota
6. Conductores
7. Combustible
8. Gastos y Adelantos
9. Rendiciones
10. Mantenimiento
11. Facturación y Cobranza
12. Documentos
13. Incidencias
14. Reportes y Analítica
15. Configuración

---

# 8. Navegación Principal

La navegación administrativa debería priorizar las funciones más utilizadas.

## Menú principal

**Inicio**

**Operaciones**
- Viajes
- Programación
- Cargas / oportunidades

**Flota**
- Unidades
- Mantenimiento

**Personal**
- Conductores

**Comercial**
- Clientes
- Oportunidades

**Finanzas**
- Gastos
- Rendiciones
- Cobranza

**Documentos**

**Reportes**

**Configuración**

---

# 9. Módulo 1 — Inicio / Centro de Control

Esta será la pantalla más importante para administración y gerencia.

Debe responder:

> ¿Qué está pasando ahora mismo?

---

# 10. Dashboard — Bloque Operativo

Debe mostrar las tres unidades mediante tarjetas.

Ejemplo:

### X2Y756

**Estado:** En tránsito  
**Ruta:** Cusco → Lima  
**Conductor:** Pedro  
**Viaje:** RT-2026-0145  
**Salida:** 08 ago  
**Próxima acción:** Descarga en Lima

---

### X3N-719

**Estado:** Esperando carga  
**Ubicación:** Lima  
**Tiempo esperando:** 3 días

---

### VDR-768

**Estado:** Disponible  
**Ubicación:** Cusco  
**Próximo mantenimiento:** 1,500 km

---

# 11. Semáforo de Flota

Estados visuales sugeridos:

🟢 Operando / disponible

🟡 Esperando / próximo mantenimiento

🟠 En mantenimiento

🔴 Avería / bloqueo / problema crítico

⚫ Fuera de servicio

Los colores deben complementar el texto, nunca reemplazarlo.

---

# 12. Dashboard — Indicadores del Mes

Mostrar:

- viajes realizados;
- viajes activos;
- toneladas transportadas;
- ingresos registrados;
- gastos;
- margen;
- utilidad estimada;
- kilómetros recorridos;
- kilómetros vacíos;
- utilización de flota.

---

# 13. Dashboard — Alertas

Sección dedicada a excepciones.

Ejemplos:

**Cobranza**
> Cliente ABC tiene S/ 8,500 vencidos.

**Mantenimiento**
> X3N-719 está a 600 km de su mantenimiento.

**Operaciones**
> X2Y756 lleva 4 días esperando carga en Lima.

**Documentación**
> ITV de VDR-768 vence próximamente.

**Rendición**
> Viaje RT-2026-0140 lleva 3 días con rendición pendiente.

---

# 14. Dashboard — Próximas Acciones

El sistema debería convertir información en tareas.

Ejemplos:

- Buscar retorno para X2Y756.
- Revisar rendición RT-145.
- Cobrar factura F001-340.
- Programar mantenimiento X3N-719.
- Renovar documento.
- Asignar conductor.

---

# 15. Módulo 2 — Viajes

Será el núcleo funcional del sistema.

Pantalla principal:

# Lista de Viajes

Columnas:

- Código.
- Fecha.
- Unidad.
- Conductor.
- Cliente.
- Origen.
- Destino.
- Estado.
- Flete.
- Resultado.
- Cobranza.

---

# 16. Filtros de Viajes

Debe permitir filtrar por:

- fecha;
- unidad;
- conductor;
- cliente;
- estado;
- ruta;
- viaje directo / tercerizado;
- pendiente de rendición;
- pendiente de cobro.

---

# 17. Creación de Viaje

La creación debería dividirse en etapas.

## Paso 1 — Cliente

Seleccionar cliente existente o registrar uno nuevo.

## Paso 2 — Carga

- descripción;
- toneladas;
- origen;
- destino;
- fecha.

## Paso 3 — Tarifa

- flete;
- adicionales;
- sobrecarga;
- condición de pago.

## Paso 4 — Recursos

- unidad;
- conductor.

## Paso 5 — Evaluación económica

Costo estimado.

## Paso 6 — Validación

Comprobar:

- documentación;
- conductor;
- mantenimiento;
- disponibilidad.

## Paso 7 — Confirmación

Crear viaje.

---

# 18. Código Automático del Viaje

Ejemplo:

**RT-2026-000145**

Debe generarse automáticamente.

Nunca debería reutilizarse.

---

# 19. Ficha del Viaje

La ficha debe funcionar como expediente completo.

Pestañas:

### Resumen

### Ruta

### Carga

### Combustible

### Gastos

### Adelantos

### Documentos

### Incidencias

### Cobranza

### Rentabilidad

### Historial

---

# 20. Cabecera Permanente del Viaje

Mostrar siempre:

**RT-2026-0145**

Cusco → Lima

X2Y756

Pedro Quispe

Cliente ABC

**Estado: En tránsito**

---

# 21. Máquina de Estados del Viaje

Estados:

1. Oportunidad
2. Evaluación
3. Aprobado
4. Programado
5. En carga
6. En tránsito
7. En descarga
8. Esperando retorno
9. Retorno programado
10. En retorno
11. Rendición pendiente
12. Cobranza pendiente
13. Cerrado
14. Cancelado

No todos los viajes necesitarán necesariamente todos los estados.

---

# 22. Historial de Estados

Cada cambio debe registrar:

- estado anterior;
- estado nuevo;
- fecha;
- hora;
- usuario;
- observación opcional.

Esto permitirá reconstruir el historial completo.

---

# 23. Ciclos de Viaje

Debe permitirse relacionar varios viajes.

Ejemplo:

### Ciclo RT-C-0048

**Tramo 1**
Cusco → Lima

**Tramo 2**
Lima → Cusco

El sistema deberá calcular el resultado conjunto.

---

# 24. Resultado del Ciclo

Mostrar:

- fletes totales;
- costos;
- combustible;
- días;
- kilómetros;
- km vacíos;
- utilidad;
- utilidad/día.

---

# 25. Módulo 3 — Oportunidades y Cotizaciones

No toda carga ofrecida debe convertirse automáticamente en viaje.

Debe existir una etapa comercial previa.

Pantalla:

# Oportunidades de Carga

Campos:

- cliente;
- contacto;
- origen;
- destino;
- tipo de carga;
- toneladas;
- tarifa propuesta;
- fecha;
- retorno;
- estado.

---

# 26. Estados de una Oportunidad

- Nueva.
- En evaluación.
- Cotizada.
- Negociación.
- Aceptada.
- Rechazada.
- Perdida.
- Convertida en viaje.

---

# 27. Evaluador de Rentabilidad

Antes de aceptar una carga, la administración debería poder ingresar:

### Ingreso

Flete.

### Combustible estimado

S/.

### Gastos previstos

S/.

### Costos adicionales

S/.

### Riesgo de retorno

- confirmado;
- probable;
- ninguno.

### Resultado

**Margen estimado**

---

# 28. Semáforo de Rentabilidad

🟢 Rentable.

🟡 Margen ajustado.

🔴 Por debajo del mínimo.

El umbral deberá ser configurable.

---

# 29. Aprobación de Excepciones

Si un viaje cae debajo del margen mínimo:

> “Este viaje se encuentra por debajo del margen objetivo.”

Opciones:

- Renegociar.
- Rechazar.
- Aprobar excepción.

Una excepción debe registrar:

- usuario;
- motivo;
- fecha.

---

# 30. Módulo 4 — Clientes

Pantalla principal:

# Cartera de Clientes

Mostrar:

- cliente;
- tipo;
- viajes;
- facturación;
- saldo pendiente;
- último servicio;
- clasificación.

---

# 31. Ficha del Cliente

Información:

### Identificación

- nombre / razón social;
- RUC/DNI cuando corresponda;
- contacto;
- teléfono;
- dirección.

### Comercial

- directo / intermediario;
- sector;
- rutas frecuentes;
- tarifas habituales.

### Financiero

- condición de pago;
- saldo;
- facturas pendientes;
- historial de pagos.

### Operativo

- viajes;
- toneladas;
- incidencias.

---

# 32. Clasificación de Clientes

Configurable:

**A — Estratégico**

**B — Recurrente**

**C — Ocasional**

**D — Riesgo**

---

# 33. Score Comercial Futuro

Con datos históricos podría calcularse:

- frecuencia;
- rentabilidad;
- puntualidad de pago;
- problemas;
- continuidad.

Debe entenderse como una fase posterior, no como requisito inicial del MVP.

---

# 34. Pipeline Comercial

Pantalla tipo embudo:

**Prospecto**

↓

**Contactado**

↓

**Cotización**

↓

**Negociación**

↓

**Servicio de prueba**

↓

**Cliente activo**

↓

**Recurrente**

↓

**Contrato**

---

# 35. Módulo 5 — Flota

Pantalla:

# Unidades

Tarjetas para:

- X2Y756
- X3N-719
- VDR-768

Mostrar:

- estado;
- kilometraje;
- conductor;
- ubicación;
- viaje;
- mantenimiento próximo;
- documentos.

---

# 36. Ficha de Unidad

Pestañas:

### Resumen

### Viajes

### Combustible

### Mantenimiento

### Repuestos

### Documentos

### Incidencias

### Costos

### Rentabilidad

---

# 37. Información Maestra de Unidad

- placa;
- año;
- propiedad;
- capacidad;
- estado;
- kilometraje;
- fecha de incorporación;
- observaciones.

---

# 38. Estado Operativo de Unidad

Opciones:

- Disponible.
- Programada.
- En viaje.
- Esperando carga.
- Regresando vacía.
- Mantenimiento.
- Reparación.
- Esperando taller.
- Sin conductor.
- Bloqueada.
- Fuera de servicio.

---

# 39. Historial de Disponibilidad

Debe calcular automáticamente cuánto tiempo permanece la unidad en cada estado.

Ejemplo mensual:

**X2Y756**

- Operando: 19 días.
- Esperando carga: 4 días.
- Taller: 3 días.
- Disponible: 4 días.

---

# 40. Módulo 6 — Conductores

Pantalla:

# Conductores

Mostrar:

- nombre;
- estado;
- unidad habitual;
- viaje actual;
- documentos;
- disponibilidad.

---

# 41. Ficha del Conductor

### Personal

- nombre;
- documento;
- teléfono;
- contacto de emergencia.

### Laboral

- contrato;
- inicio;
- vencimiento;
- condición.

### Documentos

- licencia;
- SCTR;
- otros.

### Operaciones

- viajes;
- unidad;
- incidencias.

### Desempeño

- rendiciones;
- consumo;
- puntualidad;
- observaciones.

---

# 42. Estados del Conductor

- Disponible.
- Asignado.
- En viaje.
- Descanso.
- Vacaciones.
- Licencia.
- No disponible.
- Inactivo.

---

# 43. Bolsa de Conductores

Debe existir una sección opcional:

# Conductores de Respaldo

Datos:

- nombre;
- contacto;
- licencia;
- experiencia;
- disponibilidad;
- última evaluación.

---

# 44. Módulo 7 — Combustible

Pantalla principal:

# Abastecimientos

Cada registro incluye:

- unidad;
- viaje;
- conductor;
- fecha;
- kilometraje;
- ubicación;
- grifo;
- cantidad;
- precio;
- total;
- factura;
- fotografía.

---

# 45. Flujo desde el Conductor

Desde el celular:

**Registrar combustible**

1. Seleccionar viaje.
2. Kilometraje.
3. Cantidad.
4. Monto.
5. Grifo.
6. Fotografiar comprobante.
7. Guardar.

---

# 46. Indicadores de Combustible

Por:

- viaje;
- unidad;
- conductor;
- ruta;
- mes.

KPIs:

- costo/km;
- consumo/km;
- consumo/viaje;
- variación contra promedio.

---

# 47. Alertas de Consumo

Ejemplo:

> “El consumo del viaje RT-145 supera en 17% el promedio histórico de X2Y756.”

Debe ser una alerta informativa, no una acusación automática de irregularidad.

---

# 48. Módulo 8 — Gastos y Adelantos

Debe distinguir claramente:

# Adelanto

Dinero entregado antes o durante el viaje.

# Gasto

Dinero efectivamente utilizado.

---

# 49. Crear Adelanto

Campos:

- viaje;
- conductor;
- fecha;
- monto;
- motivo;
- medio de entrega;
- observación.

Estado:

- Entregado.
- Parcialmente rendido.
- Rendido.

---

# 50. Registro de Gasto

Campos:

- viaje;
- fecha;
- categoría;
- importe;
- proveedor;
- comprobante;
- foto;
- observación.

---

# 51. Categorías Iniciales de Gasto

- Combustible.
- Peaje.
- Alimentación.
- Garaje.
- Hospedaje.
- Reparación.
- Repuesto.
- Llantería.
- Carga/descarga.
- Otros.

Configurables desde administración.

---

# 52. Módulo 9 — Rendiciones

Pantalla:

# Rendiciones Pendientes

Mostrar:

- viaje;
- conductor;
- adelantos;
- gastos registrados;
- diferencia;
- estado.

---

# 53. Fórmula de Rendición

**Adelantos – gastos justificados = saldo**

Resultados posibles:

### Saldo positivo

Conductor devuelve dinero.

### Cero

Rendición exacta.

### Saldo negativo

Empresa debe reembolsar diferencia validada.

---

# 54. Estados de Rendición

- Pendiente.
- En revisión.
- Observada.
- Aprobada.
- Cerrada.

---

# 55. Observaciones de Rendición

Administración debe poder marcar:

- comprobante faltante;
- gasto sin sustento;
- monto inconsistente;
- explicación requerida.

---

# 56. Cierre de Rendición

Una vez aprobada:

- no debe poder modificarse libremente;
- cualquier modificación posterior debe quedar registrada.

---

# 57. Módulo 10 — Mantenimiento

Pantalla principal:

# Centro de Mantenimiento

Mostrar por unidad:

- kilometraje actual;
- próximo mantenimiento;
- alertas;
- trabajos activos;
- historial.

---

# 58. Plan Preventivo

Cada tarea debe tener:

- nombre;
- unidad;
- frecuencia en km;
- frecuencia en tiempo cuando aplique;
- último servicio;
- próximo servicio.

Ejemplos:

- aceite;
- filtros;
- inspecciones;
- otros componentes definidos por la empresa.

---

# 59. Alertas de Mantenimiento

Ejemplo:

**Próximo**
> Faltan 1,500 km.

**Urgente**
> Faltan 300 km.

**Vencido**
> Excedido en 450 km.

---

# 60. Orden de Trabajo

Cuando una unidad ingresa al taller:

- unidad;
- problema;
- tipo;
- taller;
- fecha ingreso;
- kilometraje;
- diagnóstico;
- repuestos;
- mano de obra;
- fecha salida;
- costo.

---

# 61. Tipos de Mantenimiento

- Preventivo.
- Correctivo.
- Emergencia.
- Inspección.

---

# 62. Repuestos

Cada orden puede registrar múltiples repuestos.

Campos:

- nombre;
- marca;
- cantidad;
- costo;
- proveedor;
- fecha;
- kilometraje.

Esto permitirá conocer el historial completo de componentes.

---

# 63. Disponibilidad de Talleres

Registro de proveedores:

- taller;
- contacto;
- especialidad;
- ubicación;
- observaciones.

Categorías:

- Principal.
- Alternativo.
- Especialista.
- Emergencia.

---

# 64. Módulo 11 — Facturación y Cobranza

Pantalla:

# Cuentas por Cobrar

Mostrar:

- cliente;
- viaje;
- factura;
- monto;
- emisión;
- vencimiento;
- saldo;
- estado.

---

# 65. Estados de Cobranza

- Por facturar.
- Pendiente.
- Parcial.
- Pagada.
- Vencida.
- En gestión.

---

# 66. Registrar Pago

Campos:

- cliente;
- factura;
- fecha;
- monto;
- medio;
- referencia;
- observación.

Permitir pagos parciales.

---

# 67. Antigüedad de Deuda

Agrupar:

- 0–7 días.
- 8–15 días.
- 16–30 días.
- más de 30 días.

Los rangos deberían ser configurables.

---

# 68. Perfil Financiero del Cliente

Mostrar:

- saldo total;
- días promedio de pago;
- facturas vencidas;
- último pago;
- historial.

---

# 69. Módulo 12 — Documentos

El sistema debe funcionar como repositorio organizado.

---

# 70. Documentos de Unidad

Ejemplos:

- SOAT.
- ITV.
- tarjeta/documentación de mercancías.
- pólizas.
- otros.

Campos:

- documento;
- número;
- emisión;
- vencimiento;
- archivo.

---

# 71. Documentos de Conductor

- licencia;
- contrato;
- SCTR;
- documentos relacionados.

---

# 72. Documentos de Viaje

- guía remitente;
- guía transportista;
- factura;
- comprobantes;
- otros.

---

# 73. Vencimientos

Configurar alertas:

- 30 días.
- 15 días.
- 7 días.
- vencido.

---

# 74. Módulo 13 — Incidencias

Tipos iniciales:

- avería;
- accidente;
- bloqueo;
- retraso;
- problema de carga;
- problema documental;
- cliente;
- combustible;
- conductor;
- otro.

---

# 75. Registrar Incidencia

Campos:

- viaje;
- unidad;
- conductor;
- fecha;
- ubicación;
- categoría;
- severidad;
- descripción;
- fotografía;
- acción tomada.

---

# 76. Severidad

### Baja

No afecta significativamente el viaje.

### Media

Genera demora o costo.

### Alta

Interrumpe la operación.

### Crítica

Implica riesgo importante para personas, carga o unidad.

---

# 77. Módulo 14 — Reportes y Analítica

El sistema debe responder preguntas empresariales, no solamente almacenar datos.

---

# 78. Reporte de Viajes

Por periodo:

- viajes;
- ruta;
- unidad;
- conductor;
- cliente;
- toneladas;
- ingresos.

---

# 79. Reporte de Flota

Por unidad:

- viajes;
- días operativos;
- días detenidos;
- kilómetros;
- ingresos;
- costos;
- utilidad.

---

# 80. Reporte de Tiempo Improductivo

Clasificar:

- esperando carga;
- sin conductor;
- taller;
- avería;
- bloqueo;
- disponible sin viaje.

Mostrar:

**días + costo estimado + tendencia.**

---

# 81. Reporte de Rentabilidad

Permitir comparar:

### Por viaje

### Por ciclo

### Por unidad

### Por ruta

### Por cliente

### Por mes

---

# 82. Reporte de Combustible

- importe;
- cantidad;
- km;
- costo/km;
- unidad;
- conductor;
- ruta.

---

# 83. Reporte de Carga

Debe responder a una necesidad expresamente identificada por R&T SITRAM SAC:

### Por mes

- toneladas transportadas de salida;
- toneladas de retorno;
- total;
- rutas;
- tendencia.

---

# 84. Reporte de Kilómetros Vacíos

Mostrar:

- kilómetros totales;
- km cargados;
- km vacíos;
- porcentaje vacío.

Por:

- unidad;
- ruta;
- mes.

---

# 85. Reporte de Mantenimiento

- costo;
- unidad;
- repuestos;
- taller;
- tiempo inmovilizado;
- mantenimiento preventivo vs. correctivo.

---

# 86. Reporte de Cobranza

- facturado;
- cobrado;
- pendiente;
- vencido;
- promedio de pago.

---

# 87. Dashboard Gerencial

La gerencia debería poder cambiar entre:

## Hoy

Operación actual.

## Semana

Producción reciente.

## Mes

Rentabilidad.

## Año

Tendencias.

---

# 88. Indicadores Estratégicos

## Productividad

- viajes/unidad;
- toneladas/unidad;
- utilización.

## Operaciones

- días esperando carga;
- km vacíos.

## Costos

- costo/km;
- combustible/km;
- mantenimiento/km.

## Rentabilidad

- utilidad/viaje;
- utilidad/unidad;
- utilidad/ruta;
- utilidad/cliente.

## Comercial

- clientes activos;
- porcentaje directos;
- porcentaje tercerizados.

## Finanzas

- cuentas por cobrar;
- días promedio de cobranza.

---

# 89. Módulo 15 — Configuración

Administración autorizada podrá configurar:

- categorías de gasto;
- tipos de carga;
- rutas;
- estados;
- márgenes objetivo;
- usuarios;
- permisos;
- alertas;
- proveedores;
- talleres.

---

# 90. Auditoría

Toda operación crítica debe registrar:

- usuario;
- fecha;
- hora;
- acción.

Especialmente:

- eliminación;
- cambio de monto;
- aprobación;
- cierre;
- modificación de rendición;
- cambio de tarifa.

---

# 91. Eliminación Lógica

Los registros financieros y operativos importantes no deberían borrarse físicamente de manera ordinaria.

Deberían:

- anularse;
- conservar historial;
- registrar motivo.

---

# 92. Búsqueda Global

El sistema debería permitir buscar rápidamente:

- placa;
- código de viaje;
- cliente;
- conductor;
- factura;
- documento.

---

# 93. Adjuntos

Permitir:

- fotografías;
- PDF;
- imágenes de comprobantes;
- documentos.

Cada archivo debe pertenecer a una entidad concreta.

---

# 94. Experiencia del Conductor

La interfaz móvil del conductor debe ser extremadamente sencilla.

Pantalla principal:

# Mi Viaje

Mostrar únicamente lo esencial.

---

# 95. Inicio del Conductor

Ejemplo:

**Viaje RT-145**

Cusco → Lima

Unidad X2Y756

Carga: 32 t

Botones principales:

**Registrar combustible**

**Registrar gasto**

**Reportar incidencia**

**Ver documentos**

**Confirmar llegada**

---

# 96. Principio UX para Conductores

El conductor no debería navegar por un sistema administrativo complejo.

Debe poder completar operaciones frecuentes en:

**2–4 toques**, siempre que sea posible.

---

# 97. Captura de Comprobantes

Flujo:

1. Cámara.
2. Fotografía.
3. Monto.
4. Categoría.
5. Guardar.

El procesamiento automático del comprobante podría añadirse posteriormente.

---

# 98. Operación con Mala Conectividad

Debido a que las unidades viajan por distintas rutas nacionales, el sistema debería diseñarse considerando que puede existir conectividad limitada.

Objetivo funcional:

El conductor debería poder registrar información esencial incluso cuando temporalmente no tenga conexión y sincronizarla posteriormente.

---

# 99. Información Offline Prioritaria

- viaje activo;
- datos básicos;
- gastos;
- combustible;
- incidencias;
- fotografías pendientes.

---

# 100. Sincronización

Cuando vuelva la conexión:

- enviar registros;
- confirmar sincronización;
- evitar duplicados.

---

# 101. GPS

La plataforma GPS actual puede mantenerse.

Una integración futura podría utilizarse para mostrar:

- ubicación;
- recorridos;
- kilómetros;
- paradas.

Debe considerarse una integración posterior si la plataforma utilizada ofrece mecanismos técnicos adecuados.

---

# 102. WhatsApp

WhatsApp puede continuar como canal de comunicación.

Pero el sistema debe evitar depender de WhatsApp como base de datos.

Ejemplo:

> “Se malogró una llanta.”

No debería quedar solamente como mensaje.

Debe convertirse en:

**Incidencia → Unidad → Viaje → Costo → Evidencia.**

---

# 103. Integraciones Potenciales Futuras

No son necesarias para el MVP.

Podrían evaluarse posteriormente:

- GPS;
- facturación electrónica;
- banca;
- almacenamiento documental;
- mensajería;
- mapas;
- herramientas contables.

La decisión dependerá de costos y APIs disponibles.

---

# 104. Modelo Conceptual de Datos

## Entidades principales

### Empresa

### Usuario

### Cliente

### Contacto

### Oportunidad

### Cotización

### Viaje

### Ciclo de viaje

### Ruta

### Carga

### Unidad

### Conductor

### Adelanto

### Gasto

### Abastecimiento

### Rendición

### Documento

### Mantenimiento

### Orden de trabajo

### Repuesto

### Proveedor

### Factura

### Pago

### Incidencia

### Estado de unidad

---

# 105. Relaciones Fundamentales

**Cliente → muchos viajes**

**Unidad → muchos viajes**

**Conductor → muchos viajes**

**Viaje → muchos gastos**

**Viaje → muchos abastecimientos**

**Viaje → muchos documentos**

**Viaje → muchas incidencias**

**Viaje → una o varias facturas**

**Factura → uno o varios pagos**

**Unidad → muchos mantenimientos**

---

# 106. Reglas Funcionales Críticas

### RF-001

Todo viaje debe tener código único.

### RF-002

Todo viaje aprobado debe tener cliente.

### RF-003

Todo viaje programado debe tener unidad.

### RF-004

Todo viaje programado debe tener conductor.

### RF-005

Una unidad fuera de servicio no puede asignarse.

### RF-006

Un conductor no disponible no puede asignarse.

### RF-007

El sistema debe advertir documentos vencidos.

### RF-008

Todo gasto debe asociarse a viaje o gasto general.

### RF-009

Todo abastecimiento debe asociarse a unidad.

### RF-010

Todo adelanto debe generar rendición pendiente.

### RF-011

Una rendición cerrada no puede modificarse sin trazabilidad.

### RF-012

Todo ingreso pendiente debe generar cuenta por cobrar.

### RF-013

Un viaje no puede considerarse económicamente cerrado con gastos sin conciliar.

### RF-014

Toda excepción de margen debe registrar autorización.

### RF-015

Toda anulación debe registrar motivo.

---

# 107. Reglas de Disponibilidad

Una unidad está **Disponible** únicamente si:

- no tiene viaje activo;
- no está en mantenimiento;
- no está bloqueada;
- documentación requerida válida;
- condición operativa aceptable.

---

# 108. Reglas de Programación

Antes de confirmar un viaje:

Sistema verifica:

**Unidad**

✓ disponible

**Conductor**

✓ disponible

**Documentación**

✓ vigente

**Mantenimiento**

✓ sin bloqueo crítico

Si existe una advertencia no crítica:

permitir continuar con confirmación.

Si existe un bloqueo crítico:

impedir programación salvo regla autorizada definida.

---

# 109. Reglas de Rentabilidad

Configuración:

**Margen mínimo deseado**

Cuando:

`margen estimado < margen mínimo`

mostrar advertencia.

No eliminar la capacidad de decisión gerencial.

---

# 110. Sistema de Alertas

Clasificación:

### Informativa

Próximo evento.

### Advertencia

Requiere atención.

### Crítica

Puede impedir operación.

---

# 111. Centro de Notificaciones

Debe existir una bandeja de alertas con:

- tipo;
- fecha;
- entidad;
- prioridad;
- estado.

Estados:

- Nueva.
- Vista.
- En gestión.
- Resuelta.

---

# 112. Notificaciones Futuras

Potencialmente:

- dentro de la aplicación;
- push;
- correo;
- mensajería.

El mecanismo se definirá durante el diseño técnico.

---

# 113. MVP — Alcance Recomendado

No se recomienda construir todo al mismo tiempo.

El MVP debe concentrarse en resolver los problemas operativos centrales.

---

# 114. MVP — Módulos Obligatorios

## 1. Inicio

Estado de unidades + viajes activos.

## 2. Viajes

Ciclo principal.

## 3. Flota

Unidades y estados.

## 4. Conductores

Asignación.

## 5. Combustible

Registro.

## 6. Gastos

Registro.

## 7. Adelantos y Rendiciones

Conciliación.

## 8. Mantenimiento

Calendario básico.

## 9. Clientes

Información básica.

## 10. Cobranza

Pendientes.

---

# 115. MVP — Funcionalidades que Pueden Esperar

- CRM avanzado.
- scoring automático.
- IA.
- predicción.
- integración bancaria.
- integración GPS avanzada.
- integración contable profunda.
- mantenimiento predictivo.
- OCR sofisticado.
- optimización automática de rutas.

---

# 116. Orden de Desarrollo Recomendado

## Sprint / Etapa 1

- usuarios;
- unidades;
- conductores;
- clientes.

## Etapa 2

- viajes;
- estados;
- asignaciones.

## Etapa 3

- combustible;
- gastos;
- adelantos.

## Etapa 4

- rendiciones;
- cierre de viaje.

## Etapa 5

- cobranza.

## Etapa 6

- mantenimiento.

## Etapa 7

- dashboards;
- reportes;
- alertas.

---

# 117. Pantallas MVP

Como mínimo:

1. Login
2. Inicio
3. Viajes
4. Crear viaje
5. Detalle de viaje
6. Unidades
7. Detalle de unidad
8. Conductores
9. Clientes
10. Registrar combustible
11. Registrar gasto
12. Adelantos
13. Rendiciones
14. Mantenimiento
15. Cobranza
16. Alertas
17. Reportes básicos
18. Configuración

---

# 118. Aplicación para Conductores

Podría formar parte del mismo sistema con interfaz adaptada.

Pantallas mínimas:

1. Inicio.
2. Mi viaje.
3. Combustible.
4. Gastos.
5. Comprobantes.
6. Incidencias.
7. Historial reciente.

---

# 119. Criterios de Usabilidad

La plataforma debe ser:

- rápida;
- simple;
- legible;
- apta para celular;
- usable por personas con distintos niveles digitales;
- tolerante a errores;
- clara en estados.

No debería obligar al usuario a conocer terminología técnica compleja.

---

# 120. Prevención de Errores

Ejemplos:

Antes de cerrar rendición:

> “Faltan dos gastos sin comprobar.”

Antes de programar:

> “La ITV de esta unidad está vencida.”

Antes de duplicar:

> “Existe un abastecimiento similar registrado hace 2 minutos.”

---

# 121. Confirmaciones

Evitar confirmaciones innecesarias para acciones normales.

Solicitarlas para:

- eliminar;
- anular;
- cerrar;
- aprobar excepción;
- modificar información financiera cerrada.

---

# 122. Diseño para Crecimiento

Aunque inicialmente existen tres unidades, nunca deben codificarse reglas como:

“Unidad 1, Unidad 2, Unidad 3”.

Las unidades deben ser registros dinámicos.

Esto permitirá incorporar nuevas unidades sin rediseñar el sistema.

---

# 123. Diseño Multiusuario

El sistema debe contemplar que:

- administrador;
- conductor;
- gerencia;

puedan registrar información relacionada con el mismo viaje.

Debe existir sincronización y control de conflictos.

---

# 124. Auditoría Financiera

Para movimientos económicos guardar:

- creador;
- fecha;
- modificador;
- motivo de modificación;
- valor anterior;
- valor nuevo cuando corresponda.

---

# 125. Datos Maestros

Elementos que no deberían escribirse repetidamente:

- clientes;
- unidades;
- conductores;
- proveedores;
- talleres;
- rutas;
- categorías.

Se seleccionan desde catálogos.

---

# 126. Cierre de Viaje

Un viaje tendrá dos cierres.

## Cierre Operativo

Cuando:

- transporte terminó;
- documentación fue registrada;
- kilometraje final existe;
- rendición completada.

## Cierre Financiero

Cuando:

- costos completos registrados;
- facturación registrada;
- cobranza finalizada o correctamente contabilizada;
- resultado calculado.

---

# 127. Pantalla de Rentabilidad del Viaje

Mostrar:

## Ingreso

S/ X

## Gastos directos

S/ X

## Costos operativos

S/ X

## Costos asignados

S/ X

---

**Utilidad**

S/ X

**Margen**

X%

---

# 128. Transparencia del Cálculo

El usuario debe poder tocar cada cifra y conocer de dónde proviene.

Nunca mostrar una utilidad como una “caja negra”.

---

# 129. Costos Generales

Debe permitirse registrar gastos no asociados directamente a un viaje:

- administración;
- contabilidad;
- asesoría;
- alquileres cuando corresponda;
- otros.

Estos pueden clasificarse como:

# Gasto General

En una fase posterior podrán prorratearse entre viajes.

---

# 130. Costeo por Kilómetro

Una vez existan datos suficientes:

**Costo/km = costos operativos / kilómetros recorridos**

Podrá utilizarse para mejorar cotizaciones.

---

# 131. Tarifa Recomendada — Fase Posterior

Con históricos:

- ruta;
- combustible;
- km;
- mantenimiento;
- margen objetivo;

el sistema podría sugerir:

> “Tarifa mínima estimada: S/ X.”

La decisión final seguirá siendo humana.

---

# 132. Indicadores del MVP

No deben construirse decenas inicialmente.

Prioridad:

1. Viajes por mes.
2. Utilización de flota.
3. Días de unidad parada.
4. Km vacíos.
5. Combustible por viaje.
6. Costo por viaje.
7. Utilidad por viaje.
8. Utilidad por unidad.
9. Cobranza pendiente.
10. Mantenimiento próximo.

---

# 133. North Star Metric

Indicador estratégico recomendado:

# Utilidad generada por unidad por día disponible

Este indicador combina:

- productividad;
- ingresos;
- costos;
- utilización.

---

# 134. Métricas de Adopción del Sistema

También debe medirse si el software realmente se utiliza.

Ejemplos:

- % viajes registrados.
- % gastos digitalizados.
- % comprobantes adjuntos.
- % rendiciones cerradas.
- tiempo promedio de registro.
- registros pendientes.

---

# 135. Requisitos de Calidad de Datos

Los campos críticos deben tener validaciones.

Ejemplo:

Flete:

`> 0`

Kilometraje final:

`>= kilometraje inicial`

Monto:

`>= 0`

Fecha de llegada:

`>= fecha de salida`

---

# 136. Campos Obligatorios vs. Opcionales

Evitar formularios excesivos.

Solo exigir información estrictamente necesaria para la operación.

Otros campos pueden completarse posteriormente.

---

# 137. Importación Inicial

Para comenzar a utilizar la plataforma, se requerirá cargar:

### Unidades

3 actuales.

### Conductores

3 actuales.

### Clientes activos

Cartera vigente.

### Talleres/proveedores principales.

### Documentos vigentes.

No es necesario digitalizar todo el histórico desde 2013.

---

# 138. Migración de Excel

La información realmente útil de Excel podrá:

- importarse;
- limpiarse;
- conservarse como histórico.

Debe evitarse trasladar datos duplicados o inconsistentes únicamente por conservarlos.

---

# 139. Estrategia de Lanzamiento

## Etapa A — Administración

Primero se utiliza internamente.

## Etapa B — Un conductor piloto

Probar experiencia móvil.

## Etapa C — Tres conductores

Extender.

## Etapa D — Contabilidad

Dar acceso relevante.

## Etapa E — Analítica avanzada

Cuando exista información suficiente.

---

# 140. Piloto Recomendado

Seleccionar:

- una unidad;
- un conductor;
- una ruta frecuente.

Registrar digitalmente el ciclo completo.

Evaluar:

- facilidad;
- errores;
- información faltante;
- tiempos;
- utilidad.

Luego corregir antes de extender.

---

# 141. Criterios de Éxito del MVP

El MVP se considerará exitoso si permite:

### Operación

Saber dónde y en qué estado se encuentran las unidades.

### Viajes

Registrar el ciclo completo.

### Gastos

Conocer cuánto costó cada viaje.

### Rendición

Conciliar adelantos.

### Finanzas

Conocer utilidad estimada.

### Mantenimiento

Anticipar servicios.

### Cobranza

Conocer quién debe dinero.

---

# 142. Preguntas que el Sistema Debe Poder Responder

En menos de un minuto:

> ¿Dónde están las unidades?

> ¿Cuál está parada?

> ¿Por qué está parada?

> ¿Cuánto tiempo lleva así?

> ¿Qué viajes están activos?

> ¿Cuánto costó el último viaje?

> ¿Cuánto combustible consumió?

> ¿Cuánto dejó de utilidad?

> ¿Quién todavía debe pagar?

> ¿Qué mantenimiento viene?

> ¿Cuál unidad genera más dinero?

> ¿Cuál ruta es más rentable?

---

# 143. Funciones Futuras de Inteligencia Artificial

La IA debe introducirse después de consolidar datos.

Potenciales capacidades:

## Costos

Detectar viajes anómalos.

## Combustible

Detectar consumo fuera de rango.

## Mantenimiento

Predecir necesidades.

## Comercial

Recomendar tarifas.

## Cobranza

Priorizar deudas.

## Operaciones

Analizar causas de inactividad.

## Gerencia

Generar resúmenes automáticos.

---

# 144. Asistente Empresarial Futuro

Una fase avanzada podría permitir preguntas como:

> “¿Cuánto ganamos con X2Y756 este mes?”

> “¿Qué ruta dejó más utilidad?”

> “¿Qué unidad gastó más combustible?”

> “¿Cuántos días estuvimos parados por falta de conductor?”

> “¿Qué clientes pagan más tarde?”

> “¿Qué mantenimiento corresponde esta semana?”

El asistente consultaría los datos estructurados del sistema.

---

# 145. Principio de IA

La IA nunca debería sustituir el registro estructurado.

Primero:

**datos confiables.**

Después:

**inteligencia sobre esos datos.**

---

# 146. Modelo de Madurez Digital Objetivo

## Nivel 1

Registro digital.

## Nivel 2

Centralización.

## Nivel 3

Indicadores.

## Nivel 4

Alertas y automatización.

## Nivel 5

Predicción e inteligencia.

R&T SITRAM SAC debería avanzar progresivamente, no intentar comenzar directamente en el nivel 5.

---

# 147. Límites del Sistema

La primera versión no pretende sustituir automáticamente:

- contabilidad profesional;
- asesoría legal;
- GPS especializado;
- banca;
- sistemas regulatorios.

Su foco será:

# Gestión Operativa Empresarial

---

# 148. Alcance Funcional Resumido

El sistema debe conectar:

**Clientes**

↓

**Carga**

↓

**Cotización**

↓

**Viaje**

↓

**Unidad + conductor**

↓

**Combustible + gastos**

↓

**Documentos + incidencias**

↓

**Retorno**

↓

**Rendición**

↓

**Facturación**

↓

**Cobranza**

↓

**Rentabilidad**

↓

**Indicadores**

---

# 149. Resultado Esperado del Producto

Con el sistema funcionando correctamente, R&T SITRAM SAC debería dejar de depender de preguntas como:

> “¿Dónde estaba esa factura?”

> “¿Cuánto se le dio al conductor?”

> “¿Cuánto habrá gastado esa unidad?”

> “¿Cuánto ganamos aproximadamente?”

> “¿Cuándo le toca cambio de aceite?”

> “¿Cuántos días estuvo parada?”

Y poder responder mediante datos:

> “Está registrado aquí.”

---

# 150. Prioridad Absoluta del Producto

El software no debe medirse por la cantidad de módulos construidos.

Debe medirse por cuánto mejora estas cuatro variables:

1. **Control.**
2. **Utilización de flota.**
3. **Rentabilidad.**
4. **Capacidad de decisión.**

---

# 151. Jerarquía de Desarrollo

La prioridad funcional debe seguir este orden:

### 1. Viajes

### 2. Unidades

### 3. Gastos y combustible

### 4. Rendiciones

### 5. Rentabilidad

### 6. Mantenimiento

### 7. Cobranza

### 8. Clientes

### 9. Analítica

### 10. Automatización

### 11. IA

---

# 152. Producto Mínimo Recomendado

Una primera versión verdaderamente útil podría reducirse a cinco dominios centrales:

# OPERACIONES

Viajes + unidades + conductores.

# DINERO DEL VIAJE

Combustible + gastos + adelantos + rendición.

# FLOTA

Mantenimiento + disponibilidad.

# COBRANZA

Ingresos pendientes.

# CONTROL

Dashboard + reportes básicos.

Todo lo demás puede construirse progresivamente alrededor de este núcleo.

---

# 153. Principio de Diseño Final

Cada módulo debe responder a una pregunta concreta.

### Viajes

¿Qué estamos transportando?

### Flota

¿Qué están haciendo nuestras unidades?

### Conductores

¿Quién está operando?

### Combustible

¿Cuánto estamos consumiendo?

### Gastos

¿En qué estamos gastando?

### Rendiciones

¿Dónde está el dinero entregado?

### Mantenimiento

¿Qué necesita cada unidad?

### Cobranza

¿Quién nos debe?

### Reportes

¿Estamos ganando o perdiendo?

---

# 154. Roadmap Funcional Sugerido

## Versión 0.1 — Fundaciones

- autenticación;
- usuarios;
- unidades;
- conductores;
- clientes.

## Versión 0.2 — Operaciones

- viajes;
- programación;
- estados;
- historial.

## Versión 0.3 — Dinero del viaje

- combustible;
- gastos;
- adelantos;
- comprobantes.

## Versión 0.4 — Cierre

- rendiciones;
- cierre operativo;
- rentabilidad básica.

## Versión 0.5 — Flota

- mantenimiento;
- documentos;
- alertas.

## Versión 0.6 — Finanzas

- facturación;
- cobranza;
- cuentas pendientes.

## Versión 0.7 — Gerencia

- dashboards;
- KPIs;
- reportes.

## Versión 1.0 — Sistema Operativo Estable

Todos los flujos esenciales funcionando de extremo a extremo.

---

# 155. Definición de “Terminado” por Funcionalidad

Una función no está terminada únicamente porque existe una pantalla.

Debe cumplir:

- flujo completo;
- validaciones;
- permisos;
- historial;
- estados;
- manejo de errores;
- adaptación móvil cuando corresponda;
- datos disponibles para reportes.

---

# 156. Principio de Arquitectura Funcional

El sistema debe diseñarse de manera que cada nueva funcionalidad aproveche datos ya existentes.

Ejemplo:

El kilometraje registrado durante un viaje debe servir posteriormente para:

- mantenimiento;
- combustible;
- costo/km;
- utilización;
- reportes.

No debe pedirse varias veces el mismo dato.

---

# 157. Resultado del Blueprint

Con este documento quedan definidas las principales reglas funcionales para construir el futuro sistema de R&T SITRAM SAC.

La cadena de diseño empresarial queda así:

**Informe Contextual**

↓

**Diagnóstico Operativo**

↓

**Modelo Operativo Objetivo**

↓

# Blueprint Funcional

↓

**Arquitectura de Información**

↓

**UX/UI**

↓

**Arquitectura Técnica**

↓

**Desarrollo**

↓

**Piloto**

↓

**Operación**

↓

**Optimización**

---

# 158. Recomendación Final

El siguiente paso no debería ser empezar a programar inmediatamente.

Antes conviene producir dos documentos derivados de este blueprint:

## Documento A — Arquitectura de Información y Modelo de Datos

Definir exactamente:

- entidades;
- campos;
- relaciones;
- estados;
- identificadores;
- reglas de integridad.

## Documento B — Especificación UX/UI

Definir:

- navegación;
- jerarquía;
- pantallas;
- componentes;
- acciones;
- flujos;
- diseño móvil para conductores;
- diseño administrativo.

Con esos dos documentos, el proyecto estará suficientemente definido para pasar a arquitectura técnica y desarrollo con mucho menor riesgo de construir funcionalidades equivocadas.

---

# Conclusión

El futuro sistema de R&T SITRAM SAC no debe entenderse simplemente como una aplicación para registrar viajes.

Debe convertirse progresivamente en el **sistema operativo digital del negocio**.

Su núcleo será el viaje, pero su verdadero valor estará en relacionar cada operación con:

**personas + activos + dinero + documentos + tiempo + rentabilidad.**

La plataforma deberá permitir que una empresa actualmente gestionada mediante experiencia, WhatsApp, Excel, documentos y conocimiento acumulado pueda conservar esa experiencia y transformarla en procesos estructurados, trazables y medibles.

El producto correcto será aquel que permita administrar tres unidades de manera sencilla hoy y que, sin cambiar la lógica fundamental del negocio, pueda acompañar a R&T SITRAM SAC cuando opere cinco, diez o más unidades en el futuro.