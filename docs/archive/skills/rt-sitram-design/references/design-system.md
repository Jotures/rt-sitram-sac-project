# Sistema visual Andes Operativos

Este archivo describe la implementación vigente. Los archivos CSS son la fuente ejecutable de verdad; si hay divergencia, inspecciona primero implementation/apps/web/src/styles/tokens.css.

## Paleta

| Función | Token | Valor vigente | Uso |
| --- | --- | --- | --- |
| Infraestructura | --color-ink-950 | #122b33 | sidebar, fondos de autoridad, marca |
| Infraestructura secundaria | --color-ink-900 | #1d3a42 | estados oscuros y profundidad |
| Acción primaria | --color-copper-700 | #98472d | CTA y foco de decisión |
| Acento de ruta | --color-copper-500 | #c0734e | hitos y detalle, no texto pequeño |
| Campo operativo | --color-mineral-100 | #f0ede5 | fondo de aplicación |
| Superficie | --color-surface | #fffcf7 | paneles y formularios |
| Texto | --color-text | #17262c | lectura principal |
| Texto secundario | --color-text-muted | #58686d | apoyo y metadatos |
| Ruta/éxito operativo | --color-route | #2e6b62 | progreso y continuidad |
| Foco | --color-focus | #006b8f | foco visible sobre claro |

Usa los tokens semánticos de success, info, warning, risk y critical para estado. No conviertas el cobre de marca en color universal de advertencia. Para texto pequeño, usa cobre 700 o un tono más oscuro; cobre 500 es decorativo.

## Tipografía y números

- Familia: Archivo Variable, servida localmente con fallback del sistema.
- Pesos recomendados: 500 para lectura, 650–700 para etiquetas, 750–800 para títulos. Evita pesos arbitrarios distintos por plataforma.
- Usa font-variant-numeric: tabular-nums en datos operativos.
- Reserva .technical-value y la fuente monoespaciada para placas, folios, UUID abreviados, odómetro y referencias; no para párrafos.

## Forma, borde y profundidad

- Radios: 6 px controles compactos, 10 px cards/formularios, 14 px dialogs y paneles mayores.
- Borde antes que sombra. --shadow-card solo separa una superficie; --shadow-dialog se reserva para capas modales.
- Evita cards anidadas. Prefiere división, encabezado, tabla o lista cuando la relación sea lineal.
- El motivo de ruta es un recurso de marca escaso: login, lockup o momentos de progreso, nunca fondo repetido de cada tarjeta.

## Escala de movimiento

| Token | Duración | Aplicación |
| --- | ---: | --- |
| --motion-fast | 70 ms | press y respuesta inmediata |
| --motion-fade | 110 ms | hover, color y feedback breve |
| --motion-small | 150 ms | disclosure, chip, entrada pequeña |
| --motion-panel | 240 ms | drawer, dialog y bottom sheet |
| --motion-emphasis | 400 ms | énfasis único, nunca rutinario |

Easings: --ease-productive para interacción, --ease-enter al aparecer y --ease-exit al salir. Anima opacity y transform; evita animar layout o aplicar stagger a listas largas.

## Patrones por superficie

### Acceso

- Composición editorial partida en escritorio; formulario único y marca compacta en móvil.
- Copy privado y específico del turno.
- La ruta/retorno puede aparecer como trazo tenue; no uses fotografía genérica.
- Inputs de 48 px o más, foco sólido y botón estable durante busy.

### Shell administrativo

- Escritorio ancho: sidebar completo.
- Entre 961 y 1279 px: lateral compacto con labels accesibles mediante título/ARIA.
- Hasta 960 px: drawer.
- Hasta 720 px: bottom navigation más acción “Más”.
- El encabezado muestra pantalla actual y un estado de conexión/cola verificable.

### Inicio administrativo

Orden recomendado:

1. situación prioritaria con acción;
2. pulso operativo;
3. unidades y viajes activos;
4. siguiente paso;
5. resumen secundario.

No uses cuatro KPIs intercambiables como encabezado por defecto. Cada métrica necesita nombre operativo, contexto y destino accionable.

### Listados y formularios

- Define columnas por entidad: viaje/ruta/etapa/programado/flete; unidad/estado; gasto/revisión/importe.
- Header sticky y fila seleccionable cuando la densidad lo justifique.
- En móvil, oculta columnas secundarias o transforma a cards con etiquetas explícitas.
- El CTA de alta abre disclosure, drawer o dialog. No mantengas formularios largos permanentemente antes del listado.
- Errores por campo usan aria-describedby; resultado general usa role=alert o aria-live.

### Conductor

- Una acción dominante por etapa.
- Progreso: Carga → Ruta → Descarga → Entrega.
- Distingue estado confirmado de transición pendiente.
- Navegación móvil: Mi viaje, Registrar, Historial, Sincronizar y Perfil.
- Targets de 48 px; controles críticos cerca del pulgar y por encima de la safe area.
- Recuperación de evidencia mediante bottom sheet accesible; nunca window.prompt o window.confirm.

## Estados de sincronización

Usa esta secuencia conceptual:

    capturado → guardado local → en cola → enviando → confirmado
                                  ↘ requiere atención

“Con conexión” solo describe el enlace. “Sin movimientos en cola” solo describe la cola observada. “Sincronizado” exige evidencia de todas las colas relevantes y confirmación del runtime; si no existe esa evidencia, no uses la palabra.

## Accesibilidad

- Contraste AA para texto; foco visible de 3 px.
- No uses color como única señal: añade icono, copy o etiqueta.
- dialog/bottom sheet: nombre accesible, descripción, aria-modal, foco inicial, trampa/restauración, Escape y botón cerrar.
- Controles táctiles mínimo 48 × 48 px en conductor y móvil.
- Usa aria-current=page mediante navegación semántica.
- No animes en reducción de movimiento; no ocultes contenido al desactivar motion.
- Prueba zoom, textos largos, 320 px y env(safe-area-inset-*).

## Archivos canónicos

- Tokens: implementation/apps/web/src/styles/tokens.css
- Accesibilidad global: implementation/apps/web/src/styles/global.css
- Primitivas: implementation/apps/web/src/components/primitives/
- Marca: implementation/apps/web/src/components/brand/
- Shell: implementation/apps/web/src/app/shells/
- Administración: implementation/apps/web/src/features/admin-ui/
- Conductor: implementation/apps/web/src/features/driver-ui/
- PWA: implementation/apps/web/public/manifest.webmanifest e iconos
- Decisión vigente: docs/decisions/DEC-021-025.md
