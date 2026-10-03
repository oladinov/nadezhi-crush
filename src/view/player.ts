import * as THREE from 'three';
import gsap from 'gsap';
import { Board, Step } from '../core/types';
import { GameScene } from './scene';
import { GemViewManager } from './gemViews';
import { FXManager } from './fx';
import { sound } from '../audio/sound';

export class TimelinePlayer {
  private scene: GameScene;
  private gemManager: GemViewManager;
  private fx: FXManager;
  private activeTimelines: gsap.core.Timeline[] = [];

  constructor(scene: GameScene, gemManager: GemViewManager, fx: FXManager) {
    this.scene = scene;
    this.gemManager = gemManager;
    this.fx = fx;

    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private onVisibilityChange = () => {
    if (document.hidden) {
      // Complete active timelines instantly to prevent desynchronization
      for (const tl of this.activeTimelines) {
        tl.progress(1);
      }
      this.activeTimelines = [];
    }
  };

  /**
   * Replays the deterministic Step timeline asynchronously.
   */
  public async play(
    steps: Step[],
    expectedSnapshot?: Readonly<Board>,
    onStepComplete?: (step: Step) => void
  ): Promise<void> {
    for (const step of steps) {
      await this.executeStep(step);
      if (onStepComplete) {
        onStepComplete(step);
      }
    }

    // Safety net: verify view against core snapshot
    if (expectedSnapshot) {
      this.verifyAndResync(expectedSnapshot);
    }
  }

  private executeStep(step: Step): Promise<void> {
    return new Promise((resolve) => {
      switch (step.type) {
        case 'swap':
          this.handleSwap(step, resolve);
          break;
        case 'transform':
          this.handleTransform(step, resolve);
          break;
        case 'detonate':
          this.handleDetonate(step, resolve);
          break;
        case 'clear':
          this.handleClear(step, resolve);
          break;
        case 'spawnSpecial':
          this.handleSpawnSpecial(step, resolve);
          break;
        case 'gravity':
          this.handleGravity(step, resolve);
          break;
        case 'refill':
          this.handleRefill(step, resolve);
          break;
        case 'shuffle':
          this.handleShuffle(step, resolve);
          break;
        case 'combo':
          this.handleCombo(step, resolve);
          break;
        default:
          resolve();
      }
    });
  }

  private handleSwap(step: Extract<Step, { type: 'swap' }>, done: () => void) {
    const posA = this.scene.cellToWorld(step.a.r, step.a.c);
    const posB = this.scene.cellToWorld(step.b.r, step.b.c);

    // Find views at these positions
    let viewA: any = null;
    let viewB: any = null;

    for (const v of this.gemManager.views.values()) {
      const p = v.group.position;
      if (Math.abs(p.x - posA.x) < 0.1 && Math.abs(p.y - posA.y) < 0.1) viewA = v;
      if (Math.abs(p.x - posB.x) < 0.1 && Math.abs(p.y - posB.y) < 0.1) viewB = v;
    }

    if (!viewA || !viewB) {
      done();
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        this.removeTimeline(tl);
        done();
      },
    });
    this.activeTimelines.push(tl);

    if (step.valid) {
      sound.playSwap();
      tl.to(viewA.group.position, {
        x: posB.x,
        y: posB.y,
        duration: 0.18,
        ease: 'power2.inOut',
      }, 0);
      tl.to(viewB.group.position, {
        x: posA.x,
        y: posA.y,
        duration: 0.18,
        ease: 'power2.inOut',
      }, 0);
    } else {
      // Invalid: swap halfway then return with bounce
      sound.playInvalidSwap();
      const midA = new THREE.Vector3().lerpVectors(posA, posB, 0.45);
      const midB = new THREE.Vector3().lerpVectors(posB, posA, 0.45);

      tl.to(viewA.group.position, {
        x: midA.x,
        y: midA.y,
        duration: 0.1,
        ease: 'power1.out',
      }, 0);
      tl.to(viewB.group.position, {
        x: midB.x,
        y: midB.y,
        duration: 0.1,
        ease: 'power1.out',
      }, 0);

      tl.to(viewA.group.position, {
        x: posA.x,
        y: posA.y,
        duration: 0.12,
        ease: 'elastic.out(1.2, 0.4)',
      });
      tl.to(viewB.group.position, {
        x: posB.x,
        y: posB.y,
        duration: 0.12,
        ease: 'elastic.out(1.2, 0.4)',
      }, '<');
    }
  }

  private handleTransform(step: Extract<Step, { type: 'transform' }>, done: () => void) {
    sound.playSpawnSpecial();
    const tl = gsap.timeline({
      onComplete: () => {
        this.removeTimeline(tl);
        done();
      },
    });
    this.activeTimelines.push(tl);

    step.cells.forEach((cell, idx) => {
      const newGem = step.to[idx];
      const oldView = this.gemManager.views.get(newGem.id);
      const worldPos = this.scene.cellToWorld(cell.r, cell.c);

      if (oldView) {
        this.gemManager.removeView(newGem.id);
      }
      const newView = this.gemManager.createGemView(newGem);
      newView.group.position.copy(worldPos);
      this.scene.gemGroup.add(newView.group);

      tl.fromTo(
        newView.group.scale,
        { x: 0.3, y: 0.3 },
        {
          x: 1,
          y: 1,
          duration: 0.25,
          ease: 'back.out(2)',
        },
        idx * 0.03
      );
    });
  }

  private async handleDetonate(step: Extract<Step, { type: 'detonate' }>, done: () => void) {
    const originPos = this.scene.cellToWorld(step.origin.r, step.origin.c);
    const tier = (step.gem.kind === 'bomb' ? step.gem.tier : 1) as 1 | 2;

    // 0. Illuminate what triggered this bomb (match vs chain explosion)
    if (step.trigger?.type === 'match') {
      const matchPositions = step.trigger.matchCells.map((c) =>
        this.scene.cellToWorld(c.r, c.c)
      );
      const matchColorHex =
        step.gem.kind === 'bomb'
          ? this.gemManager.COLOR_HEXES[step.gem.color]
          : 0xf59e0b;
      await this.fx.showTriggerMatch(matchPositions, originPos, matchColorHex);
    } else if (step.trigger?.type === 'blast') {
      const sourcePos = this.scene.cellToWorld(
        step.trigger.sourceCell.r,
        step.trigger.sourceCell.c
      );
      sound.playChainSpark();
      await this.fx.showChainBlastBeam(sourcePos, originPos);
    }

    // 1. Telegraph stage: Bomb glows and pulses with ignition sound
    sound.playBombIgnite();
    const bombView = this.gemManager.views.get(step.gem.id);
    if (bombView) {
      gsap.to(bombView.group.scale, {
        x: 1.35,
        y: 1.35,
        duration: 0.16,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out',
      });
    }
    await this.fx.showBombIgnition(originPos, tier);

    // 2. Blast detonation
    sound.playBombExplosion(tier);
    this.fx.shake(tier === 2 ? 3.5 : 2.2);

    if (tier === 2) {
      this.fx.spawnShockwave(originPos, 3.8, 0.45);
    }

    const colorHex =
      step.gem.kind === 'bomb'
        ? this.gemManager.COLOR_HEXES[step.gem.color]
        : 0xffffff;
    this.fx.spawnBurst(originPos, colorHex, tier === 2 ? 24 : 15, 1.4);

    if (step.points && step.points > 0) {
      this.fx.spawnFloatingScore(originPos, step.points, '#facc15');
    }

    if (step.isCrossBlast) {
      sound.playCrossBlast();
      await this.fx.spawnBombermanCrossBlast(originPos);
    }

    done();
  }

  private async handleClear(step: Extract<Step, { type: 'clear' }>, done: () => void) {
    if (step.cause === 'fusion') {
      sound.playBombExplosion(2);
      this.fx.shake(3.2);

      // Rainbow + Rainbow full board wipe: expanding ring across whole board
      if (step.cells.length > 20) {
        this.fx.spawnShockwave(new THREE.Vector3(0, 0, 0.25), 7.0, 0.75);
      }
    } else if (step.cause === 'rainbowTarget') {
      sound.playRainbowBeam();
      this.fx.shake(2.0);

      // Find rainbow position
      const rainbowItem = step.cells.find((c) => c.gem.kind === 'rainbow');
      const rainbowPos = rainbowItem
        ? this.scene.cellToWorld(rainbowItem.cell.r, rainbowItem.cell.c)
        : this.scene.cellToWorld(step.cells[0].cell.r, step.cells[0].cell.c);

      const targetPositions = step.cells
        .filter((c) => c.gem.kind !== 'rainbow')
        .map((c) => this.scene.cellToWorld(c.cell.r, c.cell.c));

      const targetGem = step.cells.find((c) => c.gem.kind !== 'rainbow')?.gem;
      const colorHex = targetGem && targetGem.kind !== 'rainbow'
        ? this.gemManager.COLOR_HEXES[targetGem.color]
        : 0xffffff;

      // Radiant prismatic laser beams shoot out to each target gem!
      await this.fx.spawnRainbowPrismaticBeams(rainbowPos, targetPositions, colorHex);
    } else {
      sound.playMatch(step.cascade);
      this.fx.shake(Math.min(2.5, 0.5 + step.cells.length * 0.15));
    }

    const tl = gsap.timeline({
      onComplete: () => {
        // Remove cleared views from view manager and scene
        for (const item of step.cells) {
          this.gemManager.removeView(item.gem.id);
        }
        this.removeTimeline(tl);
        done();
      },
    });
    this.activeTimelines.push(tl);

    // Calculate score per item for floating indicators
    const ptsPerGem = Math.round(step.points / Math.max(1, step.cells.length));

    step.cells.forEach((item, idx) => {
      const view = this.gemManager.views.get(item.gem.id);
      const worldPos = this.scene.cellToWorld(item.cell.r, item.cell.c);
      const delay = (item.wave - 1) * 0.05 + idx * 0.015;

      const colorHex =
        item.gem.kind === 'rainbow'
          ? 0xffffff
          : this.gemManager.COLOR_HEXES[item.gem.color];

      this.fx.spawnBurst(worldPos, colorHex, 8, 1.0);

      const itemPts = item.points ?? ptsPerGem;
      if (itemPts > 0) {
        const scoreColor = itemPts >= 500 ? '#fde047' : '#fef08a';
        if (delay > 0) {
          gsap.delayedCall(delay, () => {
            this.fx.spawnFloatingScore(worldPos, itemPts, scoreColor);
          });
        } else {
          this.fx.spawnFloatingScore(worldPos, itemPts, scoreColor);
        }
      }

      if (view) {
        // Dramatic cartoon pop: swell anticipation, snappy pop, burst flash, juicy pop sound
        tl.to(
          view.group.scale,
          {
            x: 1.25,
            y: 1.25,
            duration: 0.08,
            ease: 'back.out(2)',
          },
          delay
        );
        tl.to(
          view.group.scale,
          {
            x: 0,
            y: 0,
            duration: 0.12,
            ease: 'back.in(2.5)',
          },
          delay + 0.08
        );
        tl.to(
          view.mesh.rotation,
          {
            z: Math.PI * 0.5,
            duration: 0.2,
            ease: 'power1.in',
          },
          delay
        );

        gsap.delayedCall(delay + 0.07, () => {
          this.fx.spawnCartoonPop(worldPos, colorHex);
          sound.playPopSound(1.0 + Math.min(0.6, (step.cascade - 1) * 0.12));
        });
      }
    });
  }

  private handleSpawnSpecial(step: Extract<Step, { type: 'spawnSpecial' }>, done: () => void) {
    sound.playSpawnSpecial();
    const pos = this.scene.cellToWorld(step.cell.r, step.cell.c);
    const view = this.gemManager.createGemView(step.gem);
    view.group.position.copy(pos);
    view.group.scale.set(0, 0, 1);
    this.scene.gemGroup.add(view.group);

    const colorHex =
      step.gem.kind === 'rainbow'
        ? 0xffffff
        : this.gemManager.COLOR_HEXES[step.gem.color];
    this.fx.spawnBurst(pos, colorHex, 14, 1.2);

    const tl = gsap.timeline({
      onComplete: () => {
        this.removeTimeline(tl);
        done();
      },
    });
    this.activeTimelines.push(tl);

    tl.to(view.group.scale, {
      x: 1.25,
      y: 1.25,
      duration: 0.18,
      ease: 'power2.out',
    });
    tl.to(view.group.scale, {
      x: 1,
      y: 1,
      duration: 0.12,
      ease: 'bounce.out',
    });
  }

  private handleGravity(step: Extract<Step, { type: 'gravity' }>, done: () => void) {
    const tl = gsap.timeline({
      onComplete: () => {
        this.removeTimeline(tl);
        done();
      },
    });
    this.activeTimelines.push(tl);

    for (const m of step.moves) {
      const view = this.gemManager.views.get(m.id);
      if (!view) continue;

      const targetPos = this.scene.cellToWorld(m.to.r, m.to.c);
      const dr = Math.abs(m.to.r - m.from.r);
      const duration = Math.min(0.35, 0.1 + 0.07 * Math.sqrt(dr));

      tl.to(
        view.group.position,
        {
          x: targetPos.x,
          y: targetPos.y,
          duration,
          ease: 'power2.in',
        },
        0
      );

      // Subtle squash upon landing
      tl.to(
        view.group.scale,
        {
          x: 1.15,
          y: 0.88,
          duration: 0.06,
          yoyo: true,
          repeat: 1,
          ease: 'sine.out',
        },
        duration
      );
    }
  }

  private handleRefill(step: Extract<Step, { type: 'refill' }>, done: () => void) {
    const tl = gsap.timeline({
      onComplete: () => {
        this.removeTimeline(tl);
        done();
      },
    });
    this.activeTimelines.push(tl);

    for (const sp of step.spawns) {
      const view = this.gemManager.createGemView(sp.gem);
      const startPos = this.scene.cellToWorld(sp.dropFrom, sp.col);
      const targetPos = this.scene.cellToWorld(sp.toRow, sp.col);

      view.group.position.set(startPos.x, startPos.y, 0);
      this.scene.gemGroup.add(view.group);

      const dr = Math.abs(sp.toRow - sp.dropFrom);
      const duration = Math.min(0.42, 0.12 + 0.08 * Math.sqrt(dr));
      const delay = sp.col * 0.02;

      tl.to(
        view.group.position,
        {
          x: targetPos.x,
          y: targetPos.y,
          duration,
          ease: 'power2.in',
        },
        delay
      );

      // Squash and stretch landing
      tl.to(
        view.group.scale,
        {
          x: 1.18,
          y: 0.85,
          duration: 0.06,
          yoyo: true,
          repeat: 1,
          ease: 'sine.out',
        },
        delay + duration
      );
    }
  }

  private handleShuffle(step: Extract<Step, { type: 'shuffle' }>, done: () => void) {
    const tl = gsap.timeline({
      onComplete: () => {
        this.removeTimeline(tl);
        done();
      },
    });
    this.activeTimelines.push(tl);

    for (const m of step.moves) {
      const view = this.gemManager.views.get(m.id);
      if (!view) continue;

      const targetPos = this.scene.cellToWorld(m.to.r, m.to.c);
      tl.to(
        view.group.position,
        {
          x: targetPos.x,
          y: targetPos.y,
          duration: 0.35,
          ease: 'power2.inOut',
        },
        0
      );
    }
  }

  private handleCombo(step: Extract<Step, { type: 'combo' }>, done: () => void) {
    sound.playComboChime(step.tier);
    this.fx.showComboBanner(step.cascade, step.title, step.tier, step.points);
    setTimeout(() => {
      done();
    }, 180);
  }

  /**
   * Safety net: compares core snapshot with view and resyncs if any mismatch is detected.
   */
  public verifyAndResync(snapshot: Readonly<Board>) {
    const rows = snapshot.length;
    const cols = snapshot[0].length;
    let mismatch = false;

    // Check count
    if (this.gemManager.views.size !== rows * cols) {
      mismatch = true;
    }

    if (!mismatch) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const gem = snapshot[r][c];
          if (!gem) {
            mismatch = true;
            break;
          }
          const view = this.gemManager.views.get(gem.id);
          if (!view) {
            mismatch = true;
            break;
          }
          const expectedPos = this.scene.cellToWorld(r, c);
          if (
            Math.abs(view.group.position.x - expectedPos.x) > 0.15 ||
            Math.abs(view.group.position.y - expectedPos.y) > 0.15
          ) {
            mismatch = true;
            break;
          }
        }
      }
    }

    if (mismatch) {
      console.warn('Safety Net triggered: Re-synchronizing view with core snapshot!');
      this.gemManager.clearAll();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const gem = snapshot[r][c];
          if (gem) {
            const view = this.gemManager.createGemView(gem);
            const pos = this.scene.cellToWorld(r, c);
            view.group.position.copy(pos);
            this.scene.gemGroup.add(view.group);
          }
        }
      }
    }
  }

  private removeTimeline(tl: gsap.core.Timeline) {
    const idx = this.activeTimelines.indexOf(tl);
    if (idx !== -1) {
      this.activeTimelines.splice(idx, 1);
    }
  }

  /**
   * Animates a satisfying cascading entrance of all gems dropping into the board.
   * Gives the tactile and ergonomic feeling of a fresh new board.
   */
  public playBoardEntrance(board: Readonly<Board>): Promise<void> {
    return new Promise((resolve) => {
      const rows = board.length;
      const cols = board[0].length;

      const tl = gsap.timeline({
        onComplete: () => {
          this.removeTimeline(tl);
          resolve();
        },
      });
      this.activeTimelines.push(tl);

      sound.playBoardFill();

      // Gems fall into place column by column and row by row
      for (let c = 0; c < cols; c++) {
        for (let r = rows - 1; r >= 0; r--) {
          const gem = board[r][c];
          if (!gem) continue;

          const view = this.gemManager.createGemView(gem);
          const targetPos = this.scene.cellToWorld(r, c);

          // Start position: high above board (offscreen)
          const dropHeight = targetPos.y + 6.5 + (rows - r) * 0.7;
          view.group.position.set(targetPos.x, dropHeight, 0);
          view.group.scale.set(0.1, 0.1, 0.1);
          this.scene.gemGroup.add(view.group);

          // Staggered cascade: bottom gems land first, columns slightly staggered
          const delay = (rows - 1 - r) * 0.05 + c * 0.035;
          const duration = 0.38 + (rows - 1 - r) * 0.025;

          tl.to(
            view.group.position,
            {
              x: targetPos.x,
              y: targetPos.y,
              duration,
              ease: 'power2.in',
            },
            delay
          );

          tl.to(
            view.group.scale,
            {
              x: 1,
              y: 1,
              duration: 0.22,
              ease: 'power2.out',
            },
            delay
          );

          // Satisfying squash and stretch upon landing
          tl.to(
            view.group.scale,
            {
              x: 1.16,
              y: 0.86,
              duration: 0.07,
              yoyo: true,
              repeat: 1,
              ease: 'sine.out',
            },
            delay + duration
          );
        }
      }
    });
  }

  public destroy() {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    for (const tl of this.activeTimelines) {
      tl.kill();
    }
    this.activeTimelines = [];
  }
}
