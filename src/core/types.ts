export type GemColor = 0 | 1 | 2 | 3 | 4;

export interface Cell {
  r: number; // r=0 es la fila superior
  c: number;
}

export type Gem =
  | { id: number; kind: 'normal'; color: GemColor }
  | { id: number; kind: 'bomb'; color: GemColor; tier: 1 | 2 }
  | { id: number; kind: 'rainbow' };

export type Board = (Gem | null)[][]; // [fila][columna]

export type Goal =
  | { type: 'score'; target: number }
  | { type: 'collect'; color: GemColor; count: number }
  | { type: 'detonate'; count: number } // bombas activadas
  | { type: 'create'; kind: 'bomb' | 'rainbow'; tier?: 1 | 2; count: number };

export interface GoalProgress {
  score: number;
  collected: number[]; // length 5: index corresponds to GemColor
  detonated: number;
  created: {
    bomb1: number;
    bomb2: number;
    rainbow: number;
  };
}

export interface LevelConfig {
  level: number;
  seed: number; // hashString(`level_${level}`)
  rows: number;
  cols: number;
  colors: 4 | 5; // niveles tempranos usan 4 tipos
  moves: number;
  goals: Goal[]; // TODAS deben cumplirse
  boardOverride?: Board; // solo niveles didácticos curados
  tutorialKey?: string;
  title?: string;
  description?: string;
}

// ---- Línea de tiempo que la vista reproduce ----
export type ClearCause = 'match' | 'blast' | 'rainbowTarget' | 'fusion';

export type DetonateTrigger =
  | { type: 'match'; matchCells: Cell[] }
  | { type: 'blast'; sourceCell: Cell }
  | { type: 'fusion' };

export type Step =
  | { type: 'swap'; a: Cell; b: Cell; valid: boolean }
  | { type: 'transform'; cells: Cell[]; to: Gem[] } // arcoíris+bomba
  | {
      type: 'clear';
      cells: { cell: Cell; gem: Gem; wave: number }[];
      cause: ClearCause;
      cascade: number;
      points: number;
    }
  | {
      type: 'detonate';
      origin: Cell;
      gem: Gem;
      affected: Cell[];
      wave: number;
      trigger?: DetonateTrigger;
    }
  | { type: 'spawnSpecial'; cell: Cell; gem: Gem; from: Cell[] }
  | { type: 'gravity'; moves: { id: number; from: Cell; to: Cell }[] }
  | { type: 'refill'; spawns: { gem: Gem; col: number; toRow: number; dropFrom: number }[] }
  | { type: 'shuffle'; moves: { id: number; from: Cell; to: Cell }[] };

export interface TurnResult {
  accepted: boolean;
  steps: Step[];
  pointsGained: number;
  movesLeft: number;
  progress: GoalProgress;
  outcome: 'continue' | 'won' | 'lost';
  boardHash: number; // para tests, replays y detección de desincronización
}

export interface GridCore {
  readonly snapshot: Readonly<Board>;
  findValidMoves(): { a: Cell; b: Cell }[]; // orden fijo: fila-mayor
  resolveMove(a: Cell, b: Cell): TurnResult; // a = gema arrastrada, b = destino
}
