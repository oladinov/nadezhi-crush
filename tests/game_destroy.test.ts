import { describe, it, expect, vi } from 'vitest';
import { Match3Game } from '../src/game';
import { FXManager } from '../src/view/fx';
import { GemViewManager } from '../src/view/gemViews';

describe('Match3Game.destroy', () => {
  it('calls destroy() on fx and gemManager to dispose GPU resources instead of only clearAll()', () => {
    const game = Object.create(Match3Game.prototype) as any;
    game.inactivityTimer = setTimeout(() => {}, 10_000);
    game.fx = { clearAll: vi.fn(), destroy: vi.fn() } as unknown as FXManager;
    game.gemManager = { clearAll: vi.fn(), destroy: vi.fn() } as unknown as GemViewManager;
    game.input = { destroy: vi.fn() } as unknown as Match3Game['input'];
    game.player = { destroy: vi.fn() } as unknown as Match3Game['player'];
    game.scene = { destroy: vi.fn() } as unknown as Match3Game['scene'];

    game.destroy();

    expect(game.inactivityTimer).toBeNull();
    expect(game.fx.destroy).toHaveBeenCalledTimes(1);
    expect(game.fx.clearAll).not.toHaveBeenCalled();
    expect(game.gemManager.destroy).toHaveBeenCalledTimes(1);
    expect(game.gemManager.clearAll).not.toHaveBeenCalled();
    expect(game.input.destroy).toHaveBeenCalledTimes(1);
    expect(game.player.destroy).toHaveBeenCalledTimes(1);
    expect(game.scene.destroy).toHaveBeenCalledTimes(1);
  });

  it('FXManager.destroy and GemViewManager.destroy dispose owned geometries and materials', () => {
    const makeDisposable = () => ({ dispose: vi.fn() });

    const fx = Object.create(FXManager.prototype) as any;
    fx.clearAll = vi.fn();
    fx.particleGeo = makeDisposable();
    fx.reticleMat = makeDisposable();
    fx.horizGeo = makeDisposable();
    fx.vertGeo = makeDisposable();
    fx.accentGeo = makeDisposable();
    fx.accentMat = makeDisposable();

    FXManager.prototype.destroy.call(fx);

    expect(fx.clearAll).toHaveBeenCalledTimes(1);
    expect(fx.particleGeo.dispose).toHaveBeenCalledTimes(1);
    expect(fx.reticleMat.dispose).toHaveBeenCalledTimes(1);
    expect(fx.horizGeo.dispose).toHaveBeenCalledTimes(1);
    expect(fx.vertGeo.dispose).toHaveBeenCalledTimes(1);
    expect(fx.accentGeo.dispose).toHaveBeenCalledTimes(1);
    expect(fx.accentMat.dispose).toHaveBeenCalledTimes(1);

    const gemManager = Object.create(GemViewManager.prototype) as any;
    gemManager.clearAll = vi.fn();
    gemManager.gemPlaneGeo = makeDisposable();
    gemManager.platePlaneGeo = makeDisposable();
    gemManager.rainbowGeo = makeDisposable();
    gemManager.ringGeo = makeDisposable();

    GemViewManager.prototype.destroy.call(gemManager);

    expect(gemManager.clearAll).toHaveBeenCalledTimes(1);
    expect(gemManager.gemPlaneGeo.dispose).toHaveBeenCalledTimes(1);
    expect(gemManager.platePlaneGeo.dispose).toHaveBeenCalledTimes(1);
    expect(gemManager.rainbowGeo.dispose).toHaveBeenCalledTimes(1);
    expect(gemManager.ringGeo.dispose).toHaveBeenCalledTimes(1);
  });
});
