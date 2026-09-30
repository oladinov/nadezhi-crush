import * as THREE from 'three';
import { Cell } from '../core/types';
import { areCellsAdjacent } from '../core/board';
import { GameScene } from './scene';

export interface InputHandlers {
  onMoveRequested: (a: Cell, b: Cell) => void;
  onSelectionChanged: (selected: Cell | null) => void;
}

export class InputManager {
  private scene: GameScene;
  private handlers: InputHandlers;
  private raycaster: THREE.Raycaster;
  private planeZ0: THREE.Plane;
  private pointerPos: THREE.Vector2;

  public inputLock: boolean = false;
  public selectedCell: Cell | null = null;

  private isPointerDown: boolean = false;
  private startPointerWorld: THREE.Vector3 | null = null;
  private startCell: Cell | null = null;
  private activePointerId: number | null = null;

  constructor(scene: GameScene, handlers: InputHandlers) {
    this.scene = scene;
    this.handlers = handlers;
    this.raycaster = new THREE.Raycaster();
    this.planeZ0 = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.pointerPos = new THREE.Vector2();

    const dom = this.scene.renderer.domElement;
    dom.style.touchAction = 'none';

    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('pointercancel', this.onPointerUp);
  }

  public setSelectedCell(cell: Cell | null) {
    this.selectedCell = cell;
    this.handlers.onSelectionChanged(this.selectedCell);
  }

  private getCellFromEvent(e: PointerEvent): { cell: Cell | null; world: THREE.Vector3 | null } {
    const rect = this.scene.renderer.domElement.getBoundingClientRect();
    this.pointerPos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerPos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerPos, this.scene.camera);
    const worldPoint = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.planeZ0, worldPoint);

    if (!hit) {
      return { cell: null, world: null };
    }

    const cell = this.scene.worldToCell(worldPoint);
    return { cell, world: worldPoint };
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.inputLock) return;
    const { cell, world } = this.getCellFromEvent(e);
    if (!cell || !world) return;

    this.isPointerDown = true;
    this.activePointerId = e.pointerId;
    this.startCell = cell;
    this.startPointerWorld = world.clone();

    try {
      this.scene.renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if setPointerCapture fails on certain browsers
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.inputLock || !this.isPointerDown || !this.startCell || !this.startPointerWorld) {
      return;
    }
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) {
      return;
    }

    const { world } = this.getCellFromEvent(e);
    if (!world) return;

    const dx = world.x - this.startPointerWorld.x;
    const dy = world.y - this.startPointerWorld.y;
    const dist = Math.hypot(dx, dy);

    // Drag threshold: ~0.35 * CELL
    const threshold = 0.35 * this.scene.dimensions.cellSize;
    if (dist >= threshold) {
      let targetCell: Cell;

      if (Math.abs(dx) >= Math.abs(dy)) {
        // Horizontal move
        targetCell = {
          r: this.startCell.r,
          c: this.startCell.c + (dx > 0 ? 1 : -1),
        };
      } else {
        // Vertical move (note: world Y is positive UP, so dy > 0 is row r - 1)
        targetCell = {
          r: this.startCell.r + (dy > 0 ? -1 : 1),
          c: this.startCell.c,
        };
      }

      // Check bounds
      if (
        targetCell.r >= 0 &&
        targetCell.r < this.scene.dimensions.rows &&
        targetCell.c >= 0 &&
        targetCell.c < this.scene.dimensions.cols
      ) {
        const origin = this.startCell;
        this.resetPointerState(e.pointerId);
        this.setSelectedCell(null);
        this.handlers.onMoveRequested(origin, targetCell);
      }
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.isPointerDown) return;
    const originCell = this.startCell;
    const { cell: endCell } = this.getCellFromEvent(e);

    this.resetPointerState(e.pointerId);
    if (this.inputLock) return;

    if (originCell && endCell && originCell.r === endCell.r && originCell.c === endCell.c) {
      // Tap-tap logic
      if (!this.selectedCell) {
        this.setSelectedCell(originCell);
      } else {
        if (areCellsAdjacent(this.selectedCell, originCell)) {
          const from = this.selectedCell;
          this.setSelectedCell(null);
          this.handlers.onMoveRequested(from, originCell);
        } else {
          // If tapped same cell, toggle off; if tapped distant cell, switch selection
          if (this.selectedCell.r === originCell.r && this.selectedCell.c === originCell.c) {
            this.setSelectedCell(null);
          } else {
            this.setSelectedCell(originCell);
          }
        }
      }
    }
  };

  private resetPointerState(pointerId?: number) {
    this.isPointerDown = false;
    this.startCell = null;
    this.startPointerWorld = null;
    if (pointerId !== undefined) {
      try {
        this.scene.renderer.domElement.releasePointerCapture(pointerId);
      } catch {
        // Ignore
      }
    }
    this.activePointerId = null;
  }

  public destroy() {
    const dom = this.scene.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('pointermove', this.onPointerMove);
    dom.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('pointercancel', this.onPointerUp);
  }
}
