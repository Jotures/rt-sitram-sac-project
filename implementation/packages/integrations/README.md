# Integraciones R&T

Este paquete contiene contratos puros y comprobables para integraciones externas.
No se ejecuta en el navegador ni conserva tokens, sesiones o respuestas reales
de un proveedor.

## GPS

`src/gps` define el contrato mínimo `GpsProvider` para:

- listar activos externos autorizados;
- consultar la última posición de un activo conocido;
- solicitar un intervalo de posiciones con rango y límite explícitos.

La normalización de evidencia se encuentra en `@rt-sitram/domain`. Conserva la
procedencia, valida coordenadas y tiempos, calcula una clave de deduplicación y
evita que una observación tardía haga retroceder la proyección de última
posición.

`FakeGpsProvider` existe únicamente para pruebas de contrato y UAT. No es un
fallback de producción ni emula credenciales de Goldcar, GPSWOX o Wialon.

## Estado de proveedores reales

Ningún adaptador remoto está registrado todavía. El portal Goldcar observado
por R&T no es, por sí solo, evidencia de un contrato de API soportado. Antes de
crear un adaptador real se requieren, como mínimo:

1. confirmación escrita del proveedor sobre la API, host, método de
   autenticación, límites y condiciones aplicables a la cuenta R&T;
2. token técnico dedicado, revocable y de solo lectura, limitado a las unidades
   aprobadas; nunca una sesión personal ni un secreto `VITE_*`;
3. inventario aprobado que vincule `providerAssetId` con la unidad interna por
   UUID, sin usar la placa como identidad;
4. aprobación de roles, retención, frecuencia y umbral de frescura.

El adaptador se alojará del lado servidor, con sus secretos fuera de la PWA.
Antes de importarlo desde una Supabase Edge Function se validará su empaquetado
para Deno; el alias de este workspace no debe asumirse compatible sin esa
prueba.

## Validación local

Desde `implementation/`:

```text
pnpm --filter @rt-sitram/domain typecheck
pnpm --filter @rt-sitram/domain test
pnpm --filter @rt-sitram/integrations typecheck
pnpm --filter @rt-sitram/integrations test
```
