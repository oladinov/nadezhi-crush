import { Board, LevelConfig } from '../core/types';
import { hashString } from '../core/rng';
import { createEmptyBoard } from '../core/board';

/**
 * Helper to build an 8x8 didactic board with a guaranteed move on the first turn.
 */
function makeDidacticBoard(
  colorsCount: 4 | 5,
  setupFn: (board: Board) => void
): Board {
  const board = createEmptyBoard(8, 8);
  let id = 1;
  // Checkerboard-like pattern to prevent initial 3-in-a-rows
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const color = ((r * 2 + c + (r % 2)) % colorsCount) as any;
      board[r][c] = { id: id++, kind: 'normal', color };
    }
  }
  setupFn(board);
  return board;
}

export const CURATED_LEVELS: LevelConfig[] = [
  // Level 1: Match 3 y cascadas (4 colores)
  {
    level: 1,
    seed: hashString('level_1'),
    rows: 8,
    cols: 8,
    colors: 4,
    moves: 20,
    goals: [{ type: 'score', target: 1500 }],
    title: 'Primeros Pasos',
    description: 'Aprende los fundamentos del Match-3.',
    tutorialKey: 'swap_match3',
  },

  // Level 2: Cascadas
  {
    level: 2,
    seed: hashString('level_2'),
    rows: 8,
    cols: 8,
    colors: 4,
    moves: 18,
    goals: [{ type: 'score', target: 3000 }],
    title: 'Cascadas de Puntos',
    description: 'Las cascadas multiplican tus puntos hasta x4.',
    tutorialKey: 'cascades',
  },

  // Level 3: Match 4 -> Bomba Tier 1
  {
    level: 3,
    seed: hashString('level_3'),
    rows: 8,
    cols: 8,
    colors: 4,
    moves: 20,
    goals: [
      { type: 'create', kind: 'bomb', tier: 1, count: 1 },
      { type: 'score', target: 2000 },
    ],
    title: 'Forja de Bombas',
    description: 'Combina 4 gemas en línea para crear una Bomba Tier 1 (3x3).',
    tutorialKey: 'create_bomb1',
    boardOverride: makeDidacticBoard(4, (board) => {
      // Setup a horizontal 4-match at row 3
      // Cells (3,1), (3,2), (3,4) color 0; cell (4,3) color 0. Swapping (4,3) with (3,3) creates 4-match!
      board[3][1] = { id: 101, kind: 'normal', color: 0 };
      board[3][2] = { id: 102, kind: 'normal', color: 0 };
      board[3][3] = { id: 103, kind: 'normal', color: 1 };
      board[3][4] = { id: 104, kind: 'normal', color: 0 };
      board[4][3] = { id: 105, kind: 'normal', color: 0 };
    }),
  },

  // Level 4: Detonar bombas
  {
    level: 4,
    seed: hashString('level_4'),
    rows: 8,
    cols: 8,
    colors: 4,
    moves: 18,
    goals: [
      { type: 'detonate', count: 2 },
      { type: 'score', target: 3500 },
    ],
    title: 'Detonación Táctica',
    description: 'Activa bombas incluyéndolas en un match o con otra explosión.',
    tutorialKey: 'detonate_bomb',
  },

  // Level 5: Encadenar bombas
  {
    level: 5,
    seed: hashString('level_5'),
    rows: 8,
    cols: 8,
    colors: 4,
    moves: 18,
    goals: [{ type: 'detonate', count: 3 }],
    title: 'Reacción en Cadena',
    description: 'Las explosiones detonan todas las bombas a su alcance.',
    tutorialKey: 'chain_bombs',
  },

  // Level 6: Fuegos artificiales
  {
    level: 6,
    seed: hashString('level_6'),
    rows: 8,
    cols: 8,
    colors: 4,
    moves: 16,
    goals: [
      { type: 'detonate', count: 5 },
      { type: 'score', target: 5000 },
    ],
    title: 'Fuegos Artificiales',
    description: 'Desata múltiples detonaciones.',
  },

  // Level 7: L/T -> Bomba Tier 2 (5x5)
  {
    level: 7,
    seed: hashString('level_7'),
    rows: 8,
    cols: 8,
    colors: 4,
    moves: 20,
    goals: [{ type: 'create', kind: 'bomb', tier: 2, count: 1 }],
    title: 'Mega Bomba 5x5',
    description: 'Crea una bomba Tier 2 combinando 5 gemas en forma de T o L.',
    tutorialKey: 'create_bomb2',
    boardOverride: makeDidacticBoard(4, (board) => {
      // T-shape almost formed: (3,2), (3,3), (3,4) and (1,3), (4,3). Swapping (4,3) to (2,3) forms T at (3,3)
      board[3][1] = { id: 201, kind: 'normal', color: 2 };
      board[3][2] = { id: 202, kind: 'normal', color: 2 };
      board[3][3] = { id: 203, kind: 'normal', color: 3 };
      board[3][4] = { id: 204, kind: 'normal', color: 2 };
      board[1][3] = { id: 205, kind: 'normal', color: 2 };
      board[2][3] = { id: 206, kind: 'normal', color: 2 };
    }),
  },

  // Level 8: Explosión Masiva
  {
    level: 8,
    seed: hashString('level_8'),
    rows: 8,
    cols: 8,
    colors: 4,
    moves: 18,
    goals: [
      { type: 'detonate', count: 4 },
      { type: 'score', target: 6000 },
    ],
    title: 'Explosión Masiva',
    description: 'Aprovecha el poder devastador de las bombas 5x5.',
  },

  // Level 9: Match 5 -> Arcoíris (introduce 5 colores)
  {
    level: 9,
    seed: hashString('level_9'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 22,
    goals: [{ type: 'create', kind: 'rainbow', count: 1 }],
    title: 'El Prisma Arcoíris',
    description: 'Combina 5 gemas en línea para crear una Gema Arcoíris. ¡Se suma el 5º color!',
    tutorialKey: 'create_rainbow',
    boardOverride: makeDidacticBoard(5, (board) => {
      // 5-in-a-row setup at row 4
      board[4][0] = { id: 301, kind: 'normal', color: 3 };
      board[4][1] = { id: 302, kind: 'normal', color: 3 };
      board[4][2] = { id: 303, kind: 'normal', color: 1 };
      board[4][3] = { id: 304, kind: 'normal', color: 3 };
      board[4][4] = { id: 305, kind: 'normal', color: 3 };
      board[3][2] = { id: 306, kind: 'normal', color: 3 };
    }),
  },

  // Level 10: Poder Cromático
  {
    level: 10,
    seed: hashString('level_10'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 20,
    goals: [
      { type: 'create', kind: 'rainbow', count: 1 },
      { type: 'score', target: 8000 },
    ],
    title: 'Poder Cromático',
    description: 'Desata el poder de los colores.',
  },

  // Level 11: Arcoíris + normal
  {
    level: 11,
    seed: hashString('level_11'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 18,
    goals: [{ type: 'collect', color: 0, count: 12 }],
    title: 'Limpieza Elemental',
    description: 'Intercambia un Arcoíris con cualquier color para destruir todas las gemas de ese color.',
    tutorialKey: 'fusion_rainbow_normal',
    boardOverride: makeDidacticBoard(5, (board) => {
      board[3][3] = { id: 401, kind: 'rainbow' };
      board[3][4] = { id: 402, kind: 'normal', color: 0 };
    }),
  },

  // Level 12: Cosecha de Gemas
  {
    level: 12,
    seed: hashString('level_12'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 18,
    goals: [
      { type: 'collect', color: 1, count: 15 },
      { type: 'score', target: 10000 },
    ],
    title: 'Cosecha de Gemas',
    description: 'Recolecta gemas específicas usando fusiones estratégicas.',
  },

  // Level 13: Bomba + Bomba
  {
    level: 13,
    seed: hashString('level_13'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 16,
    goals: [{ type: 'score', target: 12000 }],
    title: 'Fusión Sísmica',
    description: 'Intercambia dos Bombas juntas: destruirá la fila completa, columna completa y un área 5x5.',
    tutorialKey: 'fusion_bomb_bomb',
    boardOverride: makeDidacticBoard(5, (board) => {
      board[4][3] = { id: 501, kind: 'bomb', color: 2, tier: 1 };
      board[4][4] = { id: 502, kind: 'bomb', color: 4, tier: 1 };
    }),
  },

  // Level 14: Doble Implosión
  {
    level: 14,
    seed: hashString('level_14'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 16,
    goals: [
      { type: 'detonate', count: 6 },
      { type: 'score', target: 14000 },
    ],
    title: 'Doble Implosión',
    description: 'Multiplica el impacto con fusiones de bombas.',
  },

  // Level 15: Arcoíris + Bomba
  {
    level: 15,
    seed: hashString('level_15'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 16,
    goals: [{ type: 'detonate', count: 8 }],
    title: 'Tormenta de Bombas',
    description: 'Intercambia un Arcoíris con una Bomba para transformar todo ese color en bombas y detonarlas en cadena.',
    tutorialKey: 'fusion_rainbow_bomb',
    boardOverride: makeDidacticBoard(5, (board) => {
      board[3][3] = { id: 601, kind: 'rainbow' };
      board[3][4] = { id: 602, kind: 'bomb', color: 1, tier: 1 };
    }),
  },

  // Level 16: Apocalipsis de Color
  {
    level: 16,
    seed: hashString('level_16'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 15,
    goals: [
      { type: 'detonate', count: 10 },
      { type: 'score', target: 18000 },
    ],
    title: 'Apocalipsis de Color',
    description: 'Detonaciones masivas en cadena.',
  },

  // Level 17: Arcoíris + Arcoíris
  {
    level: 17,
    seed: hashString('level_17'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 15,
    goals: [{ type: 'score', target: 22000 }],
    title: 'Cataclismo Total',
    description: 'Intercambia dos Arcoíris juntos para limpiar todo el tablero en una colosal onda expansiva.',
    tutorialKey: 'fusion_rainbow_rainbow',
    boardOverride: makeDidacticBoard(5, (board) => {
      board[3][3] = { id: 701, kind: 'rainbow' };
      board[3][4] = { id: 702, kind: 'rainbow' };
    }),
  },

  // Level 18: Onda Expansiva
  {
    level: 18,
    seed: hashString('level_18'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 15,
    goals: [{ type: 'score', target: 26000 }],
    title: 'Onda Expansiva',
    description: 'Crea arcoíris dobles para arrasar el tablero.',
  },

  // Level 19: Examen Mixto 1
  {
    level: 19,
    seed: hashString('level_19'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 20,
    goals: [
      { type: 'score', target: 25000 },
      { type: 'detonate', count: 6 },
      { type: 'create', kind: 'bomb', count: 2 },
    ],
    title: 'Gran Maestro: Fase 1',
    description: 'Combina todas las habilidades para superar este desafío.',
  },

  // Level 20: Examen Mixto 2 (Graduación)
  {
    level: 20,
    seed: hashString('level_20'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 20,
    goals: [
      { type: 'score', target: 32000 },
      { type: 'detonate', count: 8 },
      { type: 'create', kind: 'rainbow', count: 1 },
    ],
    title: 'Graduación: Nexo Prismático',
    description: '¡El examen definitivo de Match-3! Demuestra tu maestría.',
  },
];
