---
name: rt-sitram-design
description: Diseña, implementa o revisa interfaces de R&T SITRAM con la dirección Andes Operativos, incluyendo paleta, marca, responsive, accesibilidad, estados offline y motion productivo. Úsala al crear o modificar pantallas, componentes, dashboards, tablas, formularios, navegación, flujos del conductor, login o recursos PWA de este repositorio.
---

# R&T SITRAM — Andes Operativos

Construye una herramienta de operación logística con criterio humano, sobria y específica del negocio. La interfaz debe sentirse hecha para R&T SITRAM, no como una plantilla SaaS o un mosaico genérico.

## Flujo obligatorio

1. Lee AGENTS.md, docs/sessions/current.md y docs/decisions/index.md.
2. Carga solo el contexto necesario:
   - docs/01_informe_contextual_negocio.md para lenguaje y operación;
   - docs/06_especificacion_ux_ui.md para contratos UX;
   - docs/07_arquitectura_tecnica_sistema.md para offline, permisos y datos;
   - la DEC visual vigente y los archivos afectados.
3. Identifica el rol, la tarea principal, el estado de conectividad y la consecuencia del error antes de dibujar la pantalla.
4. Reutiliza primero los tokens, primitivas, marca e iconos existentes. No introduzcas un segundo sistema visual.
5. Diseña estados reales: carga, vacío, error, sin conexión, guardado local, pendiente de envío, éxito y permiso insuficiente.
6. Implementa responsive, teclado, lector de pantalla y reducción de movimiento en el mismo cambio.
7. Ejecuta el gate de validación y revisa visualmente la interfaz construida.

Consulta [references/design-system.md](references/design-system.md) para los valores, patrones y checklist vigentes.

## Firma visual

- Usa petróleo profundo como infraestructura y autoridad, marfil mineral como campo operativo y cobre oscuro como acción.
- La marca distintiva nace de rutas, hitos, ida/retorno y continuidad operativa. Evita clichés andinos, fotos de stock de camiones y decoración sin información.
- Redacta en español directo y concreto: unidad, conductor, ruta, gasto, rendición, despacho, retorno, evidencia.
- Mantén una acción primaria clara. Despliega formularios y decisiones secundarias de forma progresiva.
- En administración, prioriza atención, flota, viajes y excepciones; usa tablas y resúmenes específicos del dominio.
- En conductor, prioriza una siguiente acción, targets de al menos 48 px, progreso del viaje y certeza sobre lo guardado localmente.

## Veracidad operacional

- Nunca derives “Sincronizado” de navigator.onLine.
- Distingue conexión, guardado local, cola pendiente, envío, confirmación del servidor y error.
- No muestres ceros, tendencias, progreso, alertas ni estados inventados.
- No ocultes una operación crítica detrás del color solamente.
- No dupliques reglas de negocio en React ni eludas gateways, RLS o comandos autoritativos.

## Motion y efectos

- Usa movimiento para explicar cambio, jerarquía o confirmación; no para ambientar cada superficie.
- Aplica los tokens existentes de 70–240 ms para hover, feedback, disclosure, drawer y dialog. Reserva 400 ms para un énfasis excepcional como el trazo de ruta del login.
- Anima principalmente opacity y transform.
- Respeta prefers-reduced-motion; no bloquees una acción ni dependas de una animación para comunicar estado.
- Evita parallax, blobs, brillos, glassmorphism, gradientes decorativos, sombras flotantes excesivas y animaciones repetitivas.

## Evitar apariencia de plantilla o IA

No uses por defecto:

- grids de tarjetas idénticas o “bento” sin relación operativa;
- titulares grandilocuentes y texto de relleno;
- iconos aleatorios, emojis o ilustraciones generadas;
- esquinas excesivamente redondeadas, píldoras para todo o blur ornamental;
- una tabla universal con las mismas columnas para entidades distintas;
- cifras KPI sin contexto, fuente o siguiente acción;
- acentos de color dispersos sin jerarquía semántica.

Haz que cada pantalla responda una pregunta real: qué ocurre, qué requiere atención, qué puede hacer este rol y qué pasará con el dato si no hay señal.

## Gate de entrega

Desde implementation/, ejecuta:

    pnpm format:check
    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build

Además:

- inspecciona escritorio, lateral compacto y teléfono;
- comprueba overflow a 320–390 px, foco visible, targets táctiles y zonas seguras;
- verifica dialog/bottom sheet con título accesible, Escape, foco y restauración;
- comprueba prefers-reduced-motion;
- si cambias fuente, iconos o PWA, confirma que el service worker los precachea y que worker/WASM conservan MIME correcto;
- registra una DEC solo si cambias una regla visual duradera, no por cada componente.
