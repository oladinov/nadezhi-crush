import * as THREE from 'three';
import gsap from 'gsap';
import { Cell } from '../core/types';
import { GameScene } from './scene';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class FXManager {
  private scene: GameScene;
  private selectionMesh: THREE.Mesh;
  private hintGroup: THREE.Group;
  private activeParticles: Particle[] = [];
  private particleGeo: THREE.PlaneGeometry;

  constructor(scene: GameScene) {
    this.scene = scene;
    this.particleGeo = new THREE.PlaneGeometry(0.12, 0.12);

    // Selection highlight mesh
    const selGeo = new THREE.RingGeometry(0.44, 0.54, 32);
    const selMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15, // Golden yellow
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    this.selectionMesh = new THREE.Mesh(selGeo, selMat);
    this.selectionMesh.position.set(0, 0, 0.1);
    this.selectionMesh.visible = false;
    this.scene.fxGroup.add(this.selectionMesh);

    // Hint group
    this.hintGroup = new THREE.Group();
    this.scene.fxGroup.add(this.hintGroup);

    // Register update in scene
    this.scene.onUpdate((dt, time) => {
      this.update(dt, time);
    });
  }

  public showSelection(cell: Cell | null) {
    if (!cell) {
      this.selectionMesh.visible = false;
      return;
    }
    const worldPos = this.scene.cellToWorld(cell.r, cell.c);
    this.selectionMesh.position.set(worldPos.x, worldPos.y, 0.1);
    this.selectionMesh.visible = true;
  }

  public showHint(a: Cell, b: Cell) {
    this.clearHint();
    const posA = this.scene.cellToWorld(a.r, a.c);
    const posB = this.scene.cellToWorld(b.r, b.c);

    const hintMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ringGeo = new THREE.RingGeometry(0.42, 0.48, 24);

    const meshA = new THREE.Mesh(ringGeo, hintMat);
    meshA.position.set(posA.x, posA.y, 0.08);
    const meshB = new THREE.Mesh(ringGeo, hintMat);
    meshB.position.set(posB.x, posB.y, 0.08);

    this.hintGroup.add(meshA);
    this.hintGroup.add(meshB);

    gsap.to([meshA.scale, meshB.scale], {
      x: 1.15,
      y: 1.15,
      duration: 0.5,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }

  public clearHint() {
    gsap.killTweensOf(this.hintGroup.children.map((c) => c.scale));
    while (this.hintGroup.children.length > 0) {
      this.hintGroup.remove(this.hintGroup.children[0]);
    }
  }

  /**
   * Spawns a burst of particles at a given world position.
   */
  public spawnBurst(pos: THREE.Vector3, colorHex: number, count = 10, speedMult = 1.0) {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 1,
    });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeo, mat.clone());
      mesh.position.copy(pos);
      mesh.position.z = 0.2;
      this.scene.fxGroup.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = (1.5 + Math.random() * 2.5) * speedMult;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0
      );

      this.activeParticles.push({
        mesh,
        vel,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3,
      });
    }
  }

  /**
   * Spawns a floating score number sprite at a cell.
   */
  public spawnFloatingScore(pos: THREE.Vector3, points: number) {
    if (points <= 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a'; // Bright yellow
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(`+${points}`, 64, 32);
    ctx.fillText(`+${points}`, 64, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.9, 0.45, 1);
    sprite.position.set(pos.x, pos.y + 0.1, 0.4);
    this.scene.fxGroup.add(sprite);

    gsap.to(sprite.position, {
      y: pos.y + 0.6,
      duration: 0.8,
      ease: 'power2.out',
    });
    gsap.to(sprite.scale, {
      x: 1.1,
      y: 0.55,
      duration: 0.2,
      yoyo: true,
      repeat: 1,
    });
    gsap.to(spriteMat, {
      opacity: 0,
      duration: 0.4,
      delay: 0.4,
      onComplete: () => {
        if (sprite.parent) sprite.parent.remove(sprite);
        texture.dispose();
        spriteMat.dispose();
      },
    });
  }

  /**
   * Screen shake proportional to power / cell count.
   */
  public shake(power = 1.0) {
    const intensity = Math.min(0.25, 0.04 * power);
    const duration = Math.min(0.4, 0.15 + power * 0.02);

    gsap.killTweensOf(this.scene.boardGroup.position);
    gsap.fromTo(
      this.scene.boardGroup.position,
      { x: (Math.random() - 0.5) * intensity, y: (Math.random() - 0.5) * intensity },
      {
        x: 0,
        y: 0,
        duration,
        ease: 'elastic.out(1.2, 0.2)',
      }
    );
  }

  /**
   * Visual ignition telegraph: highlights the bomb and its affected area right before detonating!
   */
  public showBombIgnition(center: THREE.Vector3, tier: 1 | 2): Promise<void> {
    return new Promise((resolve) => {
      // 1. Center fiery ring
      const ringGeo = new THREE.RingGeometry(0.2, 0.48, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24, // Bright amber
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.95,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(center.x, center.y, 0.35);
      this.scene.fxGroup.add(ring);

      // 2. Area boundary box (3x3 or 5x5)
      const size = tier === 1 ? 2.9 : 4.9;
      const boxGeo = new THREE.PlaneGeometry(size, size);
      const boxMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.22,
      });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.set(center.x, center.y, 0.05);
      this.scene.fxGroup.add(box);

      // Animate charge
      gsap.fromTo(
        ring.scale,
        { x: 0.6, y: 0.6 },
        {
          x: 1.5,
          y: 1.5,
          duration: 0.26,
          ease: 'power2.out',
        }
      );

      gsap.to(boxMat, {
        opacity: 0.45,
        duration: 0.12,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut',
      });

      gsap.to(ringMat, {
        opacity: 0,
        duration: 0.26,
        ease: 'power1.in',
        onComplete: () => {
          if (ring.parent) ring.parent.remove(ring);
          if (box.parent) box.parent.remove(box);
          ringGeo.dispose();
          ringMat.dispose();
          boxGeo.dispose();
          boxMat.dispose();
          resolve();
        },
      });
    });
  }

  /**
   * Radiant rainbow prismatic beams that shoot out from the rainbow gem to all targets.
   */
  public spawnRainbowPrismaticBeams(
    fromPos: THREE.Vector3,
    targetPositions: THREE.Vector3[],
    colorHex = 0xffffff
  ): Promise<void> {
    return new Promise((resolve) => {
      if (targetPositions.length === 0) {
        resolve();
        return;
      }

      // Shockwave burst from rainbow center
      this.spawnShockwave(fromPos, 2.0, 0.35);

      const promises: Promise<void>[] = targetPositions.map((toPos) => {
        return this.spawnLaserBeam(fromPos, toPos, colorHex);
      });

      Promise.all(promises).then(() => resolve());
    });
  }

  /**
   * Spawns laser beam line from rainbow cell to target cell.
   */
  public spawnLaserBeam(fromPos: THREE.Vector3, toPos: THREE.Vector3, colorHex = 0xffffff): Promise<void> {
    return new Promise((resolve) => {
      const dir = new THREE.Vector3().subVectors(toPos, fromPos);
      const len = dir.length();
      if (len < 0.01) {
        resolve();
        return;
      }

      const geom = new THREE.PlaneGeometry(0.14, len);
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.95,
      });
      const beam = new THREE.Mesh(geom, mat);

      const mid = new THREE.Vector3().addVectors(fromPos, toPos).multiplyScalar(0.5);
      beam.position.set(mid.x, mid.y, 0.32);
      beam.rotation.z = Math.atan2(dir.y, dir.x) - Math.PI / 2;

      this.scene.fxGroup.add(beam);

      // Target impact halo
      const hitGeo = new THREE.RingGeometry(0.2, 0.45, 24);
      const hitMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.85,
      });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.set(toPos.x, toPos.y, 0.35);
      this.scene.fxGroup.add(hitMesh);

      gsap.fromTo(
        beam.scale,
        { x: 0.1, y: 1 },
        {
          x: 2.2,
          duration: 0.22,
          ease: 'power2.out',
          onComplete: () => {
            gsap.to(mat, {
              opacity: 0,
              duration: 0.15,
              onComplete: () => {
                if (beam.parent) beam.parent.remove(beam);
                geom.dispose();
                mat.dispose();
              },
            });
          },
        }
      );

      gsap.fromTo(
        hitMesh.scale,
        { x: 0.5, y: 0.5 },
        {
          x: 1.4,
          y: 1.4,
          duration: 0.32,
          ease: 'power2.out',
          onComplete: () => {
            if (hitMesh.parent) hitMesh.parent.remove(hitMesh);
            hitGeo.dispose();
            hitMat.dispose();
            resolve();
          },
        }
      );
    });
  }

  /**
   * Expanding shockwave ring (for full board wipe or mega explosion).
   */
  public spawnShockwave(center: THREE.Vector3, maxRadius = 6.0, duration = 0.6) {
    const ringGeo = new THREE.RingGeometry(0.1, 0.3, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(center.x, center.y, 0.25);
    this.scene.fxGroup.add(ring);

    gsap.to(ring.scale, {
      x: maxRadius,
      y: maxRadius,
      duration,
      ease: 'power2.out',
    });
    gsap.to(ringMat, {
      opacity: 0,
      duration,
      ease: 'power2.in',
      onComplete: () => {
        if (ring.parent) ring.parent.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
      },
    });
  }

  private update(dt: number, time: number) {
    // Pulse selection indicator
    if (this.selectionMesh.visible) {
      const s = 1.0 + 0.08 * Math.sin(time * 8);
      this.selectionMesh.scale.set(s, s, 1);
      this.selectionMesh.rotation.z += dt * 1.5;
    }

    // Update particles
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        this.activeParticles.splice(i, 1);
        continue;
      }

      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.y += p.vel.y * dt;
      p.vel.y -= 3.5 * dt; // Gravity
      const progress = p.life / p.maxLife;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
      const scale = 1 - progress * 0.5;
      p.mesh.scale.set(scale, scale, 1);
    }
  }

  public clearAll() {
    this.clearHint();
    this.showSelection(null);
    for (const p of this.activeParticles) {
      if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
    }
    this.activeParticles = [];
  }
}
