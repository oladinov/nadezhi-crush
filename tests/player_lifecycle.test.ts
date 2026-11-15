import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import type gsapType from 'gsap';
import type { Board, Gem, Step } from '../src/core/types';
import type { GameScene } from '../src/view/scene';
import type { GemView, GemViewManager } from '../src/view/gemViews';
import type { FXManager } from '../src/view/fx';
import type { TimelinePlayer as TimelinePlayerClass } from '../src/view/player';

interface MockDocument {
  hidden: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  triggerVisibilityChange: () => void;
}

let gsap: typeof gsapType;
let TimelinePlayer: typeof TimelinePlayerClass;
let sound: typeof import('../src/audio/sound').sound;

beforeAll(async () => {
  vi.useFakeTimers();
  gsap = (await import('gsap')).default;
  gsap.ticker.lagSmoothing(0);
  ({ TimelinePlayer } = await import('../src/view/player'));
  ({ sound } = await import('../src/audio/sound'));
});

afterAll(() => {
  vi.useRealTimers();
});

function createMockDocument(): MockDocument {
  const listeners = new Map<string, Set<() => void>>();
  return {
    hidden: false,
    addEventListener: vi.fn((event: string, listener: () => void) => {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener);
    }),
    removeEventListener: vi.fn((event: string, listener: () => void) => {
      listeners.get(event)?.delete(listener);
    }),
    triggerVisibilityChange() {
      for (const listener of listeners.get('visibilitychange') ?? []) {
        listener();
      }
    },
  };
}

function createStubGemView(gem: Gem): GemView {
  return {
    id: gem.id,
    gem,
    group: {
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(1, 1, 1),
    } as unknown as THREE.Group,
    mesh: {
      rotation: new THREE.Euler(),
    } as unknown as THREE.Mesh,
    baseScale: new THREE.Vector3(1, 1, 1),
  };
}

function createTestHarness(gems: Gem[] = []) {
  const views = new Map<number, GemView>();
  for (const gem of gems) {
    views.set(gem.id, createStubGemView(gem));
  }

  const scene = {
    cellToWorld: vi.fn((r: number, c: number) => new THREE.Vector3(c, -r, 0)),
    gemGroup: {
      add: vi.fn(),
    },
  } as unknown as GameScene;

  const gemManager = {
    views,
    COLOR_HEXES: [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0xa855f7],
    removeView: vi.fn((id: number) => {
      views.delete(id);
    }),
    clearAll: vi.fn(() => {
      views.clear();
    }),
    createGemView: vi.fn((gem: Gem) => {
      const view = createStubGemView(gem);
      views.set(gem.id, view);
      return view;
    }),
  } as unknown as GemViewManager;

  const fx = {
    shake: vi.fn(),
    spawnBurst: vi.fn(),
    spawnFloatingScore: vi.fn(),
    spawnCartoonPop: vi.fn(),
    spawnShockwave: vi.fn(),
    spawnBlackHoleSingularity: vi.fn().mockResolvedValue(undefined),
    spawnRainbowPrismaticBeams: vi.fn().mockResolvedValue(undefined),
    showComboBanner: vi.fn(),
    showBoardClearBanner: vi.fn(),
    showShuffleBanner: vi.fn(),
  } as unknown as FXManager;

  const player = new TimelinePlayer(scene, gemManager, fx);

  return { player, scene, gemManager, fx, views };
}

function createSnapshot(rows = 2, cols = 2): Board {
  let id = 100;
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, (): Gem => ({ id: id++, kind: 'normal', color: 0 }))
  );
}

describe('TimelinePlayer lifecycle cancellation', () => {
  let mockDoc: MockDocument;
  let activePlayer: TimelinePlayerClass | null = null;

  beforeEach(() => {
    mockDoc = createMockDocument();
    vi.stubGlobal('document', mockDoc);
    vi.spyOn(sound, 'playMatch').mockImplementation(() => {});
    vi.spyOn(sound, 'playPopSound').mockImplementation(() => {});
    vi.spyOn(sound, 'playComboChime').mockImplementation(() => {});
    vi.spyOn(sound, 'playBoardClearFanfare').mockImplementation(() => {});
    vi.spyOn(sound, 'playRainbowBeam').mockImplementation(() => {});
  });

  afterEach(() => {
    activePlayer?.destroy();
    activePlayer = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fires delayed popups and sounds when visible and not destroyed (ticker sanity check)', async () => {
    const gemA: Gem = { id: 99, kind: 'normal', color: 0 };
    const { player, gemManager, fx } = createTestHarness([gemA]);
    activePlayer = player;

    const clearStep: Step = {
      type: 'clear',
      cells: [{ cell: { r: 0, c: 0 }, gem: gemA, wave: 2, points: 100 }],
      cause: 'match',
      cascade: 2,
      points: 100,
    };

    const playPromise = player.play([clearStep]);
    await vi.advanceTimersByTimeAsync(500);
    gsap.ticker.tick();
    await playPromise;

    expect(fx.spawnFloatingScore).toHaveBeenCalledTimes(1);
    expect(fx.spawnCartoonPop).toHaveBeenCalledTimes(1);
    expect(sound.playPopSound).toHaveBeenCalledTimes(1);
    expect(gemManager.removeView).toHaveBeenCalledWith(gemA.id);
  });

  it('cancels handleClear delayed popups and sounds on visibilitychange while still removing views', async () => {
    const gemA: Gem = { id: 1, kind: 'normal', color: 0 };
    const gemB: Gem = { id: 2, kind: 'normal', color: 1 };
    const gemC: Gem = { id: 3, kind: 'normal', color: 2 };
    const { player, gemManager, fx } = createTestHarness([gemA, gemB, gemC]);
    activePlayer = player;

    const firstClearStep: Step = {
      type: 'clear',
      cells: [
        { cell: { r: 0, c: 0 }, gem: gemA, wave: 2, points: 100 },
        { cell: { r: 0, c: 1 }, gem: gemB, wave: 2, points: 100 },
      ],
      cause: 'match',
      cascade: 2,
      points: 200,
    };
    const secondClearStep: Step = {
      type: 'clear',
      cells: [{ cell: { r: 0, c: 2 }, gem: gemC, wave: 1, points: 100 }],
      cause: 'match',
      cascade: 3,
      points: 100,
    };

    const playPromise = player.play([firstClearStep, secondClearStep]);

    expect(sound.playMatch).toHaveBeenCalledTimes(1);
    expect(fx.spawnFloatingScore).not.toHaveBeenCalled();
    expect(fx.spawnCartoonPop).not.toHaveBeenCalled();
    expect(sound.playPopSound).not.toHaveBeenCalled();

    mockDoc.hidden = true;
    mockDoc.triggerVisibilityChange();

    await playPromise;

    // Second step started while already hidden, so playMatch is still only 1 call
    expect(sound.playMatch).toHaveBeenCalledTimes(1);
    expect(gemManager.removeView).toHaveBeenCalledWith(gemA.id);
    expect(gemManager.removeView).toHaveBeenCalledWith(gemB.id);
    expect(gemManager.removeView).toHaveBeenCalledWith(gemC.id);

    await vi.advanceTimersByTimeAsync(500);
    gsap.ticker.tick();

    expect(fx.spawnFloatingScore).not.toHaveBeenCalled();
    expect(fx.spawnCartoonPop).not.toHaveBeenCalled();
    expect(sound.playPopSound).not.toHaveBeenCalled();
  });

  it('does not invoke handleClear delayed popups or sounds after destroy()', async () => {
    const gemA: Gem = { id: 10, kind: 'normal', color: 2 };
    const gemB: Gem = { id: 11, kind: 'normal', color: 3 };
    const { player, gemManager, fx } = createTestHarness([gemA, gemB]);
    activePlayer = player;

    const clearStep: Step = {
      type: 'clear',
      cells: [
        { cell: { r: 1, c: 0 }, gem: gemA, wave: 2, points: 150 },
        { cell: { r: 1, c: 1 }, gem: gemB, wave: 2, points: 150 },
      ],
      cause: 'match',
      cascade: 3,
      points: 300,
    };

    const onStepComplete = vi.fn();
    void player.play([clearStep], createSnapshot(), onStepComplete);

    player.destroy();
    expect(mockDoc.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    await vi.advanceTimersByTimeAsync(500);
    gsap.ticker.tick();

    expect(fx.spawnFloatingScore).not.toHaveBeenCalled();
    expect(fx.spawnCartoonPop).not.toHaveBeenCalled();
    expect(sound.playPopSound).not.toHaveBeenCalled();
    expect(onStepComplete).not.toHaveBeenCalled();
    expect(gemManager.clearAll).not.toHaveBeenCalled();

    // Also verify post-await destroy() guard during rainbowTarget clear
    let resolveBeams!: () => void;
    const rainbowHarness = createTestHarness([
      { id: 20, kind: 'rainbow' },
      { id: 21, kind: 'normal', color: 0 },
    ]);
    activePlayer = rainbowHarness.player;
    (rainbowHarness.fx.spawnRainbowPrismaticBeams as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveBeams = resolve;
        })
    );

    const rainbowStep: Step = {
      type: 'clear',
      cells: [
        { cell: { r: 0, c: 0 }, gem: { id: 20, kind: 'rainbow' }, wave: 1, points: 200 },
        { cell: { r: 0, c: 1 }, gem: { id: 21, kind: 'normal', color: 0 }, wave: 2, points: 200 },
      ],
      cause: 'rainbowTarget',
      cascade: 1,
      points: 400,
    };

    const onRainbowStepComplete = vi.fn();
    void rainbowHarness.player.play([rainbowStep], createSnapshot(), onRainbowStepComplete);
    rainbowHarness.player.destroy();
    resolveBeams();

    await vi.advanceTimersByTimeAsync(500);
    gsap.ticker.tick();

    expect(rainbowHarness.gemManager.removeView).not.toHaveBeenCalled();
    expect(rainbowHarness.fx.spawnFloatingScore).not.toHaveBeenCalled();
    expect(rainbowHarness.fx.spawnCartoonPop).not.toHaveBeenCalled();
    expect(sound.playPopSound).not.toHaveBeenCalled();
    expect(onRainbowStepComplete).not.toHaveBeenCalled();
  });

  it('resolves handleCombo and handleBoardClear immediately on visibilitychange without waiting 180ms/700ms', async () => {
    const { player, fx } = createTestHarness();
    activePlayer = player;

    const comboStep: Step = {
      type: 'combo',
      cascade: 3,
      title: 'Combo x3',
      tier: 2,
      points: 300,
    };
    const boardClearStep: Step = {
      type: 'boardClear',
      title: 'Board Clear!',
      points: 1000,
    };

    let comboResolved = false;
    const comboPromise = player.play([comboStep]).then(() => {
      comboResolved = true;
    });

    expect(sound.playComboChime).toHaveBeenCalledTimes(1);
    expect(fx.showComboBanner).toHaveBeenCalledTimes(1);
    expect(comboResolved).toBe(false);

    mockDoc.hidden = true;
    mockDoc.triggerVisibilityChange();

    await comboPromise;
    expect(comboResolved).toBe(true);

    // Reset visibility for standalone handleBoardClear verification
    mockDoc.hidden = false;
    let boardClearResolved = false;
    const boardClearPromise = player.play([boardClearStep]).then(() => {
      boardClearResolved = true;
    });

    expect(sound.playBoardClearFanfare).toHaveBeenCalledTimes(1);
    expect(fx.showBoardClearBanner).toHaveBeenCalledTimes(1);
    expect(boardClearResolved).toBe(false);

    mockDoc.hidden = true;
    mockDoc.triggerVisibilityChange();

    await boardClearPromise;
    expect(boardClearResolved).toBe(true);
  });

  it('prevents onStepComplete, subsequent steps, and verifyAndResync after destroy() during handleCombo and handleBoardClear', async () => {
    const { player, gemManager, fx } = createTestHarness();
    activePlayer = player;

    const comboStep: Step = {
      type: 'combo',
      cascade: 4,
      title: 'Combo x4',
      tier: 3,
      points: 500,
    };
    const boardClearStep: Step = {
      type: 'boardClear',
      title: 'Board Clear!',
      points: 1200,
    };

    const onComboStepComplete = vi.fn();
    let comboFlowFinished = false;
    void player
      .play([comboStep, boardClearStep], createSnapshot(), onComboStepComplete)
      .then(() => {
        comboFlowFinished = true;
      });

    player.destroy();

    await vi.advanceTimersByTimeAsync(1000);
    gsap.ticker.tick();

    expect(comboFlowFinished).toBe(false);
    expect(onComboStepComplete).not.toHaveBeenCalled();
    expect(fx.showBoardClearBanner).not.toHaveBeenCalled();
    expect(sound.playBoardClearFanfare).not.toHaveBeenCalled();
    expect(gemManager.clearAll).not.toHaveBeenCalled();

    // Also test destroy() directly during handleBoardClear
    const secondHarness = createTestHarness();
    activePlayer = secondHarness.player;
    const onBoardClearComplete = vi.fn();
    let boardClearFinished = false;

    void secondHarness.player
      .play([boardClearStep], createSnapshot(), onBoardClearComplete)
      .then(() => {
        boardClearFinished = true;
      });

    secondHarness.player.destroy();

    await vi.advanceTimersByTimeAsync(1000);
    gsap.ticker.tick();

    expect(boardClearFinished).toBe(false);
    expect(onBoardClearComplete).not.toHaveBeenCalled();
    expect(secondHarness.gemManager.clearAll).not.toHaveBeenCalled();
  });
});
