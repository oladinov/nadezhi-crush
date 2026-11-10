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

const LEVEL_METADATA_21_40: Record<number, { title: string; description: string }> = {
  // Erebor (21 - 24)
  21: { title: 'Las Puertas de Piedra', description: 'Entrada ancestral al gran reino enano bajo la Montaña Solitaria.' },
  22: { title: 'Salón de los Reyes', description: 'Inmensas columnas talladas y tesoros de oro macizo resguardados por los enanos.' },
  23: { title: 'La Gran Forja de Thrór', description: 'Fuelle gigantesco y yunques donde nacen armas y armaduras legendarias.' },
  24: { title: 'La Piedra del Arca', description: 'El corazón resplandeciente de la montaña que corona el trono de Erebor.' },

  // Númenórë (25 - 28)
  25: { title: 'Bahía de Rómenna', description: 'Arribo a las costas del majestuoso reino marítimo de los Dúnedain.' },
  26: { title: 'Torres Blancas de Armenelos', description: 'Mármol resplandeciente bajo la brisa y velas doradas sobre el horizonte.' },
  27: { title: 'Cima del Meneltarma', description: 'El santuario sagrado que se alza sobre las nubes tocando los cielos de Númenórë.' },
  28: { title: 'El Foco de Eärendil', description: 'Navega guiado por la luz inmortal de la estrella más brillante del océano.' },

  // Pixie Hollow (29 - 32)
  29: { title: 'El Árbol del Polvillo', description: 'Llegada al corazón mágico de las hadas donde brota el polvillo dorado.' },
  30: { title: 'Prado de las Campanillas', description: 'Flores colosales y brisas encantadas que susurran secretos primaverales.' },
  31: { title: 'Rincón de las Estaciones', description: 'Donde el cambio de estación se teje con magia, colores y alegría natural.' },
  32: { title: 'El Gran Vuelo Mágico', description: 'Alza el vuelo sobre las copas iluminadas del valle encantado de las hadas.' },

  // Nunca Jamás (33 - 36)
  33: { title: 'La Roca de la Calavera', description: 'Misterioso enclave de mareas traicioneras y secretos custodiados por piratas.' },
  34: { title: 'Laguna de las Sirenas', description: 'Aguas cristalinas y corales resplandecientes bajo la luna de la eterna juventud.' },
  35: { title: 'Campamento del Árbol Hueco', description: 'El escondite secreto donde la aventura y la imaginación jamás envejecen.' },
  36: { title: 'El Galeón del Capitán', description: 'Duelo de ingenio y destreza sobre la cubierta del legendario navío corsario.' },

  // Monte Vesubio (37 - 40)
  37: { title: 'Faldas del Volcán Místico', description: 'Ascenso a la caldera del Monte Vesubio entre vapores azufrados y runas antiguas.' },
  38: { title: 'El Callejón de los Hechizos', description: 'Frascos borboteantes y rayos arcanos que iluminan la noche napolitana.' },
  39: { title: 'El Sanctum de Magica', description: 'La cámara secreta de Magica De Spell donde prepara sus más temibles conjuros.' },
  40: { title: 'La Moneda Número Uno', description: 'La prueba suprema para reclamar el talismán mágico y consagrarte como maestro.' },
};

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

  const meta = LEVEL_METADATA_21_40[level] ?? {
    title: `Nivel ${level}`,
    description: `Generado proceduralmente con dificultad equilibrada.`,
  };

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
