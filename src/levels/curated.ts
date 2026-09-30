import { LevelConfig } from '../core/types';
import { hashString } from '../core/rng';

export const CURATED_LEVELS: LevelConfig[] = [
  // Nivel 1: Match 3 y cascadas (4 colores)
  {
    level: 1,
    seed: hashString('level_1'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 20,
    goals: [{ type: 'score', target: 1500 }],
    title: 'Primeros Pasos',
    description: 'Combina 3 o más elementos iguales.',
  },

  // Nivel 2: Cascadas
  {
    level: 2,
    seed: hashString('level_2'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 18,
    goals: [{ type: 'score', target: 3000 }],
    title: 'Cascadas de Puntos',
    description: 'Las cascadas multiplican tu puntuación.',
  },

  // Nivel 3: Match 4 -> Bomba Tier 1
  {
    level: 3,
    seed: hashString('level_3'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 20,
    goals: [
      { type: 'create', kind: 'bomb', tier: 1, count: 1 },
      { type: 'score', target: 2000 },
    ],
    title: 'Forja de Bombas',
    description: 'Combina 4 en línea para crear una bomba.',
  },

  // Nivel 4: Detonar bombas
  {
    level: 4,
    seed: hashString('level_4'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 18,
    goals: [
      { type: 'detonate', count: 2 },
      { type: 'score', target: 3500 },
    ],
    title: 'Detonación Táctica',
    description: 'Activa bombas para despejar el tablero.',
  },

  // Nivel 5: Encadenar bombas
  {
    level: 5,
    seed: hashString('level_5'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 18,
    goals: [{ type: 'detonate', count: 3 }],
    title: 'Reacción en Cadena',
    description: 'Detona bombas consecutivas.',
  },

  // Nivel 6: Fuegos artificiales
  {
    level: 6,
    seed: hashString('level_6'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 16,
    goals: [
      { type: 'detonate', count: 5 },
      { type: 'score', target: 5000 },
    ],
    title: 'Fuegos Artificiales',
    description: 'Desata múltiples explosiones.',
  },

  // Nivel 7: L/T -> Bomba Tier 2 (5x5)
  {
    level: 7,
    seed: hashString('level_7'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 20,
    goals: [{ type: 'create', kind: 'bomb', tier: 2, count: 1 }],
    title: 'Mega Bomba 5x5',
    description: 'Crea una bomba mayor con formas en T o L.',
  },

  // Nivel 8: Explosión Masiva
  {
    level: 8,
    seed: hashString('level_8'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 18,
    goals: [
      { type: 'detonate', count: 4 },
      { type: 'score', target: 6000 },
    ],
    title: 'Explosión Masiva',
    description: 'Aprovecha las explosiones amplias.',
  },

  // Nivel 9: Match 5 -> Arcoíris (5 colores)
  {
    level: 9,
    seed: hashString('level_9'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 22,
    goals: [{ type: 'create', kind: 'rainbow', count: 1 }],
    title: 'El Prisma Arcoíris',
    description: 'Combina 5 en línea para forjar el Arcoíris.',
  },

  // Nivel 10: Poder Cromático
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
    description: 'Crea combinaciones de alto impacto.',
  },

  // Nivel 11: Arcoíris + normal
  {
    level: 11,
    seed: hashString('level_11'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 18,
    goals: [{ type: 'collect', color: 0, count: 12 }],
    title: 'Limpieza Elemental',
    description: 'Recolecta elementos del color objetivo.',
  },

  // Nivel 12: Cosecha
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
    title: 'Cosecha del Valle',
    description: 'Completa la meta de recolección.',
  },

  // Nivel 13: Bomba + Bomba
  {
    level: 13,
    seed: hashString('level_13'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 16,
    goals: [{ type: 'score', target: 12000 }],
    title: 'Fusión Sísmica',
    description: 'Alcanza el objetivo de puntos.',
  },

  // Nivel 14: Doble Implosión
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
    description: 'Realiza detonaciones masivas.',
  },

  // Nivel 15: Arcoíris + Bomba
  {
    level: 15,
    seed: hashString('level_15'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 16,
    goals: [{ type: 'detonate', count: 8 }],
    title: 'Tormenta Mágica',
    description: 'Desencadena cadenas de bombas.',
  },

  // Nivel 16: Apocalipsis
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
    title: 'Torrente de Poder',
    description: 'Supera el umbral de detonaciones.',
  },

  // Nivel 17: Arcoíris + Arcoíris
  {
    level: 17,
    seed: hashString('level_17'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 15,
    goals: [{ type: 'score', target: 22000 }],
    title: 'Onda Cósmica',
    description: 'Destrucción total y puntuación máxima.',
  },

  // Nivel 18: Onda Expansiva
  {
    level: 18,
    seed: hashString('level_18'),
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 15,
    goals: [{ type: 'score', target: 26000 }],
    title: 'Onda Expansiva',
    description: 'Alcanza la meta de alta puntuación.',
  },

  // Nivel 19: Examen Mixto 1
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
    description: 'Desafío compuesto de maestría.',
  },

  // Nivel 20: Examen Mixto 2 (Graduación)
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
    title: 'Nexo Prismático',
    description: 'El desafío definitivo del reino.',
  },
];
