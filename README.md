# Nadezhi Match-3 • Three.js (Motor Determinista)

Implementación arquitectónica de producción de un juego **Match-3** de alto rendimiento en **Three.js** y **TypeScript**, basado en el principio de separación estricta:
**El núcleo resuelve el turno completo de forma síncrona y determinista (`TurnResult`), y la vista únicamente reproduce la línea de tiempo de pasos (`Step[]`).**

---

## 🚀 Inicio Rápido

### Requisitos previos
- Node.js >= 18
- npm

### Instalación y Ejecución
```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo en Vite (http://localhost:5173)
npm run dev

# Ejecutar la suite completa de pruebas unitarias y de propiedades
npm test

# Compilar para producción
npm run build
```

---

## 🏛️ Arquitectura del Sistema

```
src/
  core/           # Núcleo determinista puro (cero dependencias de DOM/Three)
    types.ts      # Definición de tipos: Gem, Board, Goal, Step, TurnResult, GridCore
    rng.ts        # PRNG Mulberry32 y generador de semillas FNV-1a (stream por columna)
    board.ts      # Utilidades de tablero, clonación y hash 32-bit de estado
    patterns.ts   # Detección de runs (≥3) y union-find (MatchGroup, L/T, 4-línea, 5-línea)
    specials.ts   # Áreas de explosión (3x3, 5x5, fila+columna+5x5) y matriz de fusiones
    scoring.ts    # Multiplicador de cascadas (hasta x4) y puntos por detonaciones
    goals.ts      # Metas (score, collect, detonate, create) y progreso
    moves.ts      # Validación de movimientos y findValidMoves() en orden fila-mayor
    resolver.ts   # CoreEngine: resolución síncrona de turnos, ondas, gravedad y refill
  levels/
    curated.ts    # Niveles 1–20 didácticos (introducción progresiva de mecánicas)
    generator.ts  # Generador procedural infinito (≥21) calibrado por simulación
    bot.ts        # Bot voraz determinista para benchmarking y cálculo del score par
  view/
    scene.ts      # Three.js OrthographicCamera, frustum adaptable y render loop
    shaders.ts    # Shaders personalizados GLSL para la gema Arcoíris
    gemViews.ts   # GemViewManager: joyas vectoriales / emotes Nadezhi, bombas pulsantes
    input.ts      # PointerEvents: umbral de arrastre 0.35·CELL y sistema tap-tap
    fx.ts         # Screen shake elástico, ráfagas de partículas, floating scores, rayos láser
    player.ts     # TimelinePlayer con GSAP: squash & stretch, audio y red de seguridad
  audio/
    sound.ts      # Sintetizador procedural con Web Audio API (cascadas con pitch dinámico)
  game.ts         # Máquina de estados (Idle ⇄ Selected → Swapping → Resolving)
  main.ts         # Punto de entrada web y enlace con la interfaz HUD
  style.css       # Diseño moderno con glassmorphism, tipografía Outfit y soporte táctil
```

---

## ⚙️ Reglas y Decisiones de Diseño Implementadas

1. **Bomba Tier 1 vs Tier 2 vs Bomba+Bomba**:
   - **Bomba Tier 1** (4 en línea): explosión de 3×3.
   - **Bomba Tier 2** (L o T): explosión de 5×5 (con halo mayor y anillo giratorio).
   - **Bomba + Bomba**: destruye la fila completa + columna completa + área 5×5 centrada en la celda destino.
2. **Activación de Bombas**:
   - Se activan al ser incluidas en un match o alcanzadas por otra explosión.
   - Un intercambio directo con una gema normal no la detona por sí solo (debe generar un match válido).
3. **Gema Arcoíris**:
   - Sin color propio, se activa únicamente por intercambio con otra gema (fusión).
   - Si una explosión la alcanza, detona automáticamente contra el color más abundante del tablero (desempate: menor índice de color).
4. **Matriz de Fusión**:
   - **Arcoíris + Normal ($k$)**: destruye todas las gemas del color $k$ en el tablero con rayos concentrados.
   - **Arcoíris + Bomba ($k$)**: transforma todo el color $k$ en bombas y las detona en secuencia ordenada por distancia Manhattan.
   - **Arcoíris + Arcoíris**: aniquilación total del tablero en ondas concéntricas expansivas.
   - **Bomba + Bomba**: aniquilación sísmica (fila $\cup$ columna $\cup$ 5×5).
5. **Inmunidad de Creación**:
   - Las gemas especiales creadas durante una oleada aparecen al final de la misma y son inmunes a las explosiones de esa misma oleada.
6. **Determinismo y PRNG**:
   - Streams independientes por columna: `init`, `shuffle`, y `spawn:c` para cada columna con `Mulberry32`.
   - Cero llamadas a `Math.random()` dentro de `core/`.
   - Si no quedan jugadas posibles, el núcleo reordena con Fisher-Yates sin consumir movimiento.

---

## 🧪 Pruebas Unitarias y de Invariantes

La suite de pruebas en Vitest valida:
- **Invariantes sobre 1,000 semillas**: tablero inicial sin matches preexistentes, siempre $\ge 1$ movimiento válido, sin celdas nulas, y conservación estricta de gemas ($rows \times cols$).
- **Matriz de fusiones**: tableros dirigidos para cada una de las 4 fusiones especiales.
- **Replays idénticos**: misma secuencia de movimientos produce exactamente el mismo `boardHash` y puntuación.
- **Bot voraz & Generador procedural**: verificación del cálculo de score y generación para niveles $\ge 21$.
