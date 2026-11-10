import { Goal, LevelConfig, GemColor } from '../core/types';
import { hashString, Mulberry32 } from '../core/rng';
import { CURATED_LEVELS } from './curated';
import { simulateGreedy } from './bot';

export interface CalibrationData {
  perMove: number;
}

export const DEFAULT_CALIBRATION: CalibrationData = {
  perMove: 550, // Average points generated per move on 8x8 5-color board
};

export function pickGoals(rng: Mulberry32, targetScore: number): Goal[] {
  const goalType = rng.int(4);
  const safeTarget = Math.max(1500, targetScore);

  switch (goalType) {
    case 0: {
      // Pure score (balanced at 90% so pure-score levels don't spike disproportionately above multi-goal levels)
      const score = Math.max(1500, Math.round((safeTarget * 0.9) / 500) * 500);
      return [{ type: 'score', target: score }];
    }

    case 1: {
      // Score + Detonate
      const score = Math.max(1000, Math.round((safeTarget * 0.75) / 500) * 500);
      const detonateCount = 3 + rng.int(5);
      return [
        { type: 'score', target: score },
        { type: 'detonate', count: detonateCount },
      ];
    }

    case 2: {
      // Collect color + Score
      const color = rng.int(5) as GemColor;
      const count = 12 + rng.int(10);
      const score = Math.max(1000, Math.round((safeTarget * 0.6) / 500) * 500);
      return [
        { type: 'collect', color, count },
        { type: 'score', target: score },
      ];
    }

    case 3:
    default: {
      // Create bomb/rainbow + Score
      const isRainbow = rng.next() > 0.65;
      const score = Math.max(1000, Math.round((safeTarget * 0.7) / 500) * 500);
      if (isRainbow) {
        return [
          { type: 'create', kind: 'rainbow', count: 1 },
          { type: 'score', target: score },
        ];
      } else {
        const tier = rng.next() > 0.5 ? 2 : 1;
        return [
          { type: 'create', kind: 'bomb', tier, count: 1 + rng.int(2) },
          { type: 'score', target: score },
        ];
      }
    }
  }
}

const BIOME_PROCEDURAL_LORE: {
  maxLevel: number;
  entries: { title: string; description: string }[];
}[] = [
  {
    // Colinas del Atardecer (16 - 30, procedural a partir del 21)
    maxLevel: 30,
    entries: [
      { title: 'Sendero del Ocaso', description: 'Brisa cálida entre colinas doradas y chimeneas humeantes.' },
      { title: 'Molino del Valle', description: 'Las aspas giran suavemente bajo el cielo ámbar del atardecer.' },
      { title: 'Feria de la Aldea', description: 'Faroles encendidos, música festiva y alegría en la comarca.' },
      { title: 'Mirador del Crepúsculo', description: 'Últimos rayos de sol tiñendo el horizonte de púrpura y oro.' },
    ],
  },
  {
    // Caverna de Cristales (31 - 45)
    maxLevel: 45,
    entries: [
      { title: 'Galería de Cuarzo', description: 'Destellos prismáticos reflejados en las paredes subterráneas.' },
      { title: 'Bóveda de Amatista', description: 'Geodas gigantes que vibran con energía arcana ancestral.' },
      { title: 'Río Subterráneo', description: 'Aguas minerales que fluyen entre estalactitas luminosas.' },
      { title: 'Corazón Cristalino', description: 'El santuario más profundo donde convergen todas las vetas.' },
    ],
  },
  {
    // Bosque de las Luciérnagas (46 - 60)
    maxLevel: 60,
    entries: [
      { title: 'Claro de Luna', description: 'Danza de destellos esmeralda bajo el dosel del bosque antiguo.' },
      { title: 'Raíces del Gran Árbol', description: 'Senderos musgosos custodiados por espíritus silvestres.' },
      { title: 'Estanque Estrellado', description: 'El cielo nocturno se refleja intacto sobre aguas serenas.' },
      { title: 'Santuario Nocturno', description: 'Susurros mágicos entre hojas plateadas y luciérnagas doradas.' },
    ],
  },
  {
    // Monte del Destino (61 - 75)
    maxLevel: 75,
    entries: [
      { title: 'Laderas de Ceniza', description: 'Terreno escarpado donde el calor anuncia la furia del volcán.' },
      { title: 'Puente de Obsidiana', description: 'Cruza sobre ríos incandescentes de magma ancestral.' },
      { title: 'Grieta de Fuego', description: 'Columnas de vapor y chispas que ponen a prueba tu temple.' },
      { title: 'Cámara del Cráter', description: 'El núcleo ardiente donde solo la estrategia suprema prevalece.' },
    ],
  },
  {
    // Erebor (76 - 90)
    maxLevel: 90,
    entries: [
      { title: 'Las Puertas de Piedra', description: 'Entrada ancestral al gran reino enano bajo la Montaña Solitaria.' },
      { title: 'Salón de los Reyes', description: 'Inmensas columnas talladas y tesoros de oro macizo resguardados por los enanos.' },
      { title: 'La Gran Forja de Thrór', description: 'Fuelle gigantesco y yunques donde nacen armas y armaduras legendarias.' },
      { title: 'La Piedra del Arca', description: 'El corazón resplandeciente de la montaña que corona el trono de Erebor.' },
    ],
  },
  {
    // Númenórë (91 - 105)
    maxLevel: 105,
    entries: [
      { title: 'Bahía de Rómenna', description: 'Arribo a las costas del majestuoso reino marítimo de los Dúnedain.' },
      { title: 'Torres Blancas de Armenelos', description: 'Mármol resplandeciente bajo la brisa y velas doradas sobre el horizonte.' },
      { title: 'Cima del Meneltarma', description: 'El santuario sagrado que se alza sobre las nubes tocando los cielos de Númenórë.' },
      { title: 'El Foco de Eärendil', description: 'Navega guiado por la luz inmortal de la estrella más brillante del océano.' },
    ],
  },
  {
    // Pixie Hollow (106 - 120)
    maxLevel: 120,
    entries: [
      { title: 'El Árbol del Polvillo', description: 'Llegada al corazón mágico de las hadas donde brota el polvillo dorado.' },
      { title: 'Prado de las Campanillas', description: 'Flores colosales y brisas encantadas que susurran secretos primaverales.' },
      { title: 'Rincón de las Estaciones', description: 'Donde el cambio de estación se teje con magia, colores y alegría natural.' },
      { title: 'El Gran Vuelo Mágico', description: 'Alza el vuelo sobre las copas iluminadas del valle encantado de las hadas.' },
    ],
  },
  {
    // Nunca Jamás (121 - 135)
    maxLevel: 135,
    entries: [
      { title: 'La Roca de la Calavera', description: 'Misterioso enclave de mareas traicioneras y secretos custodiados por piratas.' },
      { title: 'Laguna de las Sirenas', description: 'Aguas cristalinas y corales resplandecientes bajo la luna de la eterna juventud.' },
      { title: 'Campamento del Árbol Hueco', description: 'El escondite secreto donde la aventura y la imaginación jamás envejecen.' },
      { title: 'El Galeón del Capitán', description: 'Duelo de ingenio y destreza sobre la cubierta del legendario navío corsario.' },
    ],
  },
  {
    // Monte Vesubio (136 - 150)
    maxLevel: 150,
    entries: [
      { title: 'Faldas del Volcán Místico', description: 'Ascenso a la caldera del Monte Vesubio entre vapores azufrados y runas antiguas.' },
      { title: 'El Callejón de los Hechizos', description: 'Frascos borboteantes y rayos arcanos que iluminan la noche napolitana.' },
      { title: 'El Sanctum de Magica', description: 'La cámara secreta de Magica De Spell donde prepara sus más temibles conjuros.' },
      { title: 'La Moneda Número Uno', description: 'La prueba suprema para reclamar el talismán mágico y consagrarte como maestro.' },
    ],
  },
];

function getProceduralLevelMeta(level: number): { title: string; description: string } {
  for (const group of BIOME_PROCEDURAL_LORE) {
    if (level <= group.maxLevel) {
      const startLvl = group.maxLevel - 14;
      const offset = Math.max(0, level - startLvl);
      const entry = group.entries[offset % group.entries.length];
      return {
        title: `${entry.title}`,
        description: entry.description,
      };
    }
  }
  return {
    title: `Nivel ${level}`,
    description: `Generado proceduralmente con dificultad equilibrada.`,
  };
}

export function getSawtoothOffset(level: number): number {
  const mod = level % 10;
  if (mod === 5 || mod === 0) return -0.14; // Nivel de respiro cada 5 niveles
  if (mod === 9) return 0.12; // Pico climático de bloque
  if (mod === 3 || mod === 4 || mod === 8) return 0.06; // Nivel táctico
  return 0; // Niveles fluidos (1, 2, 6, 7)
}

export function generateLevel(level: number, calib: CalibrationData = DEFAULT_CALIBRATION): LevelConfig {
  const n = level - 21;
  const seed = hashString(`level_${level}`);
  const rng = new Mulberry32(hashString(`gen_${level}`));
  const moves = Math.max(15, 25 - Math.floor(n / 6)); // Piso de 15 movimientos para margen táctico
  const baseK = Math.min(1.22, 0.8 + 0.01 * n);
  const k = Math.max(0.75, baseK + getSawtoothOffset(level));

  const botRaw = simulateGreedy({ level, seed, moves, colors: 5 }).score; // determinista por nivel
  const softCapThreshold = 1250 * moves;
  const botFloor = 900 * moves;
  const effectiveBot =
    botRaw > softCapThreshold
      ? softCapThreshold + (botRaw - softCapThreshold) * 0.3
      : Math.max(botRaw, 0.5 * botRaw + 0.5 * botFloor);

  const par = 0.45 * calib.perMove * moves + 0.55 * effectiveBot;
  const target = Math.round((par * k) / 500) * 500;

  const meta = getProceduralLevelMeta(level);

  return {
    level,
    seed,
    rows: 8,
    cols: 8,
    colors: 5,
    moves,
    goals: pickGoals(rng, target),
    title: meta.title,
    description: meta.description,
  };
}

const levelConfigCache = new Map<number, LevelConfig>();

export function getLevelConfig(level: number): LevelConfig {
  if (level >= 1 && level <= CURATED_LEVELS.length) {
    return CURATED_LEVELS[level - 1];
  }
  const cached = levelConfigCache.get(level);
  if (cached) {
    return cached;
  }
  const config = generateLevel(level);
  levelConfigCache.set(level, config);
  return config;
}
