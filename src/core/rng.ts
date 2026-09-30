export function hashString(s: string): number {
  // FNV-1a 32 bits
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Mulberry32 {
  public state: number;

  constructor(state: number) {
    this.state = state >>> 0;
  }

  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  clone(): Mulberry32 {
    return new Mulberry32(this.state);
  }
}

export class BoardRngManager {
  public initRng: Mulberry32;
  public shuffleRng: Mulberry32;
  public spawnRngs: Mulberry32[];

  constructor(public readonly level: number, public readonly cols: number) {
    this.initRng = new Mulberry32(hashString(`level_${level}:init`));
    this.shuffleRng = new Mulberry32(hashString(`level_${level}:shuffle`));
    this.spawnRngs = [];
    for (let c = 0; c < cols; c++) {
      this.spawnRngs.push(new Mulberry32(hashString(`level_${level}:spawn:${c}`)));
    }
  }

  getSpawnRng(c: number): Mulberry32 {
    if (c < 0 || c >= this.spawnRngs.length) {
      throw new Error(`Invalid column ${c} for BoardRngManager with ${this.spawnRngs.length} cols`);
    }
    return this.spawnRngs[c];
  }
}
