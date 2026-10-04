import * as THREE from 'three';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { Cell } from '../core/types';
import { GameScene } from './scene';
import { sound } from '../audio/sound';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class FXManager {
  private scene: GameScene;
  private selectionGroup: THREE.Group;
  private selectionAccent: THREE.Mesh;
  private reticleMat: THREE.MeshBasicMaterial;
  private horizGeo: THREE.PlaneGeometry;
  private vertGeo: THREE.PlaneGeometry;
  private accentGeo: THREE.RingGeometry;
  private accentMat: THREE.MeshBasicMaterial;
  private hintGroup: THREE.Group;
  private activeParticles: Particle[] = [];
  private particleGeo: THREE.PlaneGeometry;

  constructor(scene: GameScene) {
    this.scene = scene;
    this.particleGeo = new THREE.PlaneGeometry(0.12, 0.12);

    // Arcade neon-cyan targeting reticle ([ ] corner brackets + rotating accent)
    this.selectionGroup = new THREE.Group();
    this.reticleMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4, // Electric cyan
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.95,
    });

    const armLength = 0.22;
    const thickness = 0.05;
    const offset = 0.44;

    this.horizGeo = new THREE.PlaneGeometry(armLength, thickness);
    this.vertGeo = new THREE.PlaneGeometry(thickness, armLength);

    // 4 Corner brackets
    const corners = [
      { x: -offset, y: offset, hx: -offset + armLength / 2, vy: offset - armLength / 2 },
      { x: offset, y: offset, hx: offset - armLength / 2, vy: offset - armLength / 2 },
      { x: -offset, y: -offset, hx: -offset + armLength / 2, vy: -offset + armLength / 2 },
      { x: offset, y: -offset, hx: offset - armLength / 2, vy: -offset + armLength / 2 },
    ];

    corners.forEach((c) => {
      const hMesh = new THREE.Mesh(this.horizGeo, this.reticleMat);
      hMesh.position.set(c.hx, c.y, 0);
      this.selectionGroup.add(hMesh);

      const vMesh = new THREE.Mesh(this.vertGeo, this.reticleMat);
      vMesh.position.set(c.x, c.vy, 0);
      this.selectionGroup.add(vMesh);
    });

    // Outer rotating corner accent diamond
    this.accentGeo = new THREE.RingGeometry(0.52, 0.54, 4);
    this.accentMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.75,
    });
    this.selectionAccent = new THREE.Mesh(this.accentGeo, this.accentMat);
    this.selectionAccent.position.set(0, 0, 0);
    this.selectionGroup.add(this.selectionAccent);

    this.selectionGroup.position.set(0, 0, 0.25);
    this.selectionGroup.visible = false;
    this.scene.fxGroup.add(this.selectionGroup);

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
      this.selectionGroup.visible = false;
      return;
    }
    const worldPos = this.scene.cellToWorld(cell.r, cell.c);
    this.selectionGroup.position.set(worldPos.x, worldPos.y, 0.25);
    this.selectionGroup.visible = true;
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
      const child = this.hintGroup.children[0];
      this.hintGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
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
  public spawnFloatingScore(pos: THREE.Vector3, points: number, colorHex: string = '#fef08a') {
    if (points <= 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colorHex;
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
   * Illuminates the 3+ matching gems that activated this bomb before detonating!
   * Shows a bright connecting line / ring on each matched gem leading into the bomb.
   */
  public showTriggerMatch(
    matchPositions: THREE.Vector3[],
    bombPos: THREE.Vector3,
    colorHex = 0xf59e0b
  ): Promise<void> {
    return new Promise((resolve) => {
      const group = new THREE.Group();
      this.scene.fxGroup.add(group);

      const ringGeo = new THREE.RingGeometry(0.24, 0.46, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.95,
      });

      matchPositions.forEach((pos) => {
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(pos.x, pos.y, 0.32);
        group.add(ring);

        // Connector line towards bomb if distant
        const dir = new THREE.Vector3().subVectors(bombPos, pos);
        const dist = dir.length();
        if (dist > 0.1) {
          const lineGeo = new THREE.PlaneGeometry(0.08, dist);
          const lineMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            blending: THREE.AdditiveBlending,
            opacity: 0.8,
          });
          const line = new THREE.Mesh(lineGeo, lineMat);
          const mid = new THREE.Vector3().addVectors(pos, bombPos).multiplyScalar(0.5);
          line.position.set(mid.x, mid.y, 0.3);
          line.rotation.z = Math.atan2(dir.y, dir.x) - Math.PI / 2;
          group.add(line);
        }
      });

      gsap.fromTo(
        group.scale,
        { x: 0.85, y: 0.85 },
        {
          x: 1.25,
          y: 1.25,
          duration: 0.22,
          yoyo: true,
          repeat: 1,
          ease: 'power2.out',
          onComplete: () => {
            gsap.to(ringMat, {
              opacity: 0,
              duration: 0.1,
              onComplete: () => {
                if (group.parent) group.parent.remove(group);
                ringGeo.dispose();
                ringMat.dispose();
                resolve();
              },
            });
          },
        }
      );
    });
  }

  /**
   * Draws a lightning spark / shockwave streak from trigger bomb to chained bomb.
   */
  public showChainBlastBeam(fromPos: THREE.Vector3, toPos: THREE.Vector3): Promise<void> {
    return new Promise((resolve) => {
      const dir = new THREE.Vector3().subVectors(toPos, fromPos);
      const len = dir.length();
      if (len < 0.05) {
        resolve();
        return;
      }

      const geom = new THREE.PlaneGeometry(0.12, len);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfef08a, // Electric bright yellow
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.95,
      });
      const beam = new THREE.Mesh(geom, mat);
      const mid = new THREE.Vector3().addVectors(fromPos, toPos).multiplyScalar(0.5);
      beam.position.set(mid.x, mid.y, 0.35);
      beam.rotation.z = Math.atan2(dir.y, dir.x) - Math.PI / 2;
      this.scene.fxGroup.add(beam);

      // Target impact spark
      const sparkGeo = new THREE.RingGeometry(0.15, 0.35, 16);
      const sparkMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.9,
      });
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      spark.position.set(toPos.x, toPos.y, 0.38);
      this.scene.fxGroup.add(spark);

      gsap.fromTo(
        beam.scale,
        { x: 0.2, y: 1 },
        {
          x: 1.8,
          duration: 0.14,
          ease: 'power2.out',
          onComplete: () => {
            if (beam.parent) beam.parent.remove(beam);
            geom.dispose();
            mat.dispose();
          },
        }
      );

      gsap.fromTo(
        spark.scale,
        { x: 0.5, y: 0.5 },
        {
          x: 1.5,
          y: 1.5,
          duration: 0.2,
          ease: 'power1.out',
          onComplete: () => {
            if (spark.parent) spark.parent.remove(spark);
            sparkGeo.dispose();
            sparkMat.dispose();
            resolve();
          },
        }
      );
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

  /**
   * Cosmic Black Hole Singularity (Rainbow + Rainbow Fusion):
   * Spawns an ethereal gravitational vortex at the fusion point, pulls all gems in a spiral
   * into the event horizon, collapses into a pinprick, and detonates in a colossal supernova!
   */
  public spawnBlackHoleSingularity(center: THREE.Vector3, gemViews: any[]): Promise<void> {
    return new Promise((resolve) => {
      const group = new THREE.Group();
      group.position.set(center.x, center.y, 0.45);
      this.scene.fxGroup.add(group);

      // 1. Accretion swirling spiral disk
      const accretionGeo = new THREE.RingGeometry(0.35, 2.4, 48);
      const accretionMat = new THREE.MeshBasicMaterial({
        color: 0xc084fc, // Radiant cosmic purple/violet
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.85,
      });
      const accretionMesh = new THREE.Mesh(accretionGeo, accretionMat);
      group.add(accretionMesh);

      // 2. Photon sphere ring (blinding white/cyan glow)
      const photonGeo = new THREE.RingGeometry(0.28, 0.38, 48);
      const photonMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.95,
      });
      const photonMesh = new THREE.Mesh(photonGeo, photonMat);
      group.add(photonMesh);

      // 3. Event horizon: deep pure black hole core
      const coreGeo = new THREE.CircleGeometry(0.3, 32);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.DoubleSide,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.z = 0.02;
      group.add(coreMesh);

      // Initial emergence of singularity
      group.scale.set(0.01, 0.01, 1);
      gsap.to(group.scale, {
        x: 1.2,
        y: 1.2,
        duration: 0.28,
        ease: 'back.out(2)',
      });

      // Accelerating vortex spin
      gsap.to(accretionMesh.rotation, {
        z: Math.PI * 8,
        duration: 1.4,
        ease: 'power2.in',
      });
      gsap.to(photonMesh.rotation, {
        z: -Math.PI * 6,
        duration: 1.4,
        ease: 'power2.in',
      });

      // Gravitational screen rumble
      this.shake(2.4);

      // Animate each gem spiraling into the vortex
      const spiralTimeline = gsap.timeline({
        onComplete: () => {
          // Collapse singularity into a tiny dense point
          gsap.to(group.scale, {
            x: 0.05,
            y: 0.05,
            duration: 0.12,
            ease: 'power3.in',
            onComplete: () => {
              // DETONATE SUPERNOVA!
              sound.playSupernovaExplosion();
              this.shake(6.0);
              this.spawnShockwave(center, 12.0, 0.85);
              this.spawnShockwave(center, 8.0, 0.55);
              this.spawnBurst(center, 0xffffff, 45, 3.0);
              this.spawnBurst(center, 0xec4899, 30, 2.4);
              this.spawnFloatingScore(center, 10000, '#f43f5e');

              if (group.parent) group.parent.remove(group);
              accretionGeo.dispose();
              accretionMat.dispose();
              photonGeo.dispose();
              photonMat.dispose();
              coreGeo.dispose();
              coreMat.dispose();
              resolve();
            },
          });
        },
      });

      gemViews.forEach((v) => {
        if (!v || !v.group) return;
        const initX = v.group.position.x;
        const initY = v.group.position.y;
        const dx = initX - center.x;
        const dy = initY - center.y;
        const r0 = Math.sqrt(dx * dx + dy * dy);
        const theta0 = Math.atan2(dy, dx);
        const delay = Math.min(0.2, r0 * 0.03);

        const proxy = { progress: 0 };
        spiralTimeline.to(
          proxy,
          {
            progress: 1,
            duration: 0.95,
            ease: 'power2.in',
            onUpdate: () => {
              const p = proxy.progress;
              const r = r0 * (1 - p);
              // Accelerating angular spin as radius shrinks
              const theta = theta0 + (2.5 + (1 - p) * 2.0) * Math.PI * p;
              v.group.position.x = center.x + Math.cos(theta) * r;
              v.group.position.y = center.y + Math.sin(theta) * r;
              const s = Math.max(0, 1 - p * p);
              v.group.scale.set(s, s, 1);
              v.group.rotation.z += 0.25;
            },
          },
          delay
        );
      });
    });
  }

  /**
   * Spawns a cartoon squash-and-stretch "POP!" comic burst with starburst flash and confetti dots.
   */
  public spawnCartoonPop(pos: THREE.Vector3, colorHex: number) {
    // 1. 10-pointed comic starburst flash
    const shape = new THREE.Shape();
    const points = 10;
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points;
      const r = i % 2 === 0 ? 0.62 : 0.26;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const starGeo = new THREE.ShapeGeometry(shape);
    const starMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.95,
      side: THREE.DoubleSide,
    });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    starMesh.position.set(pos.x, pos.y, 0.4);
    starMesh.scale.set(0.15, 0.15, 1);
    this.scene.fxGroup.add(starMesh);

    gsap.to(starMesh.scale, {
      x: 1.25,
      y: 1.25,
      duration: 0.08,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(starMesh.scale, {
          x: 0,
          y: 0,
          duration: 0.12,
          ease: 'power2.in',
          onComplete: () => {
            if (starMesh.parent) starMesh.parent.remove(starMesh);
            starGeo.dispose();
            starMat.dispose();
          },
        });
      },
    });

    // 2. High-speed comic shockwave ring
    const ringGeo = new THREE.RingGeometry(0.12, 0.24, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.85,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(pos.x, pos.y, 0.38);
    this.scene.fxGroup.add(ring);

    gsap.to(ring.scale, {
      x: 2.2,
      y: 2.2,
      duration: 0.2,
      ease: 'power1.out',
    });
    gsap.to(ringMat, {
      opacity: 0,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: () => {
        if (ring.parent) ring.parent.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
      },
    });

    // 3. 8 Radial cartoon confetti / puff particles
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 + (Math.random() - 0.5) * 0.35;
      const speed = 2.2 + Math.random() * 2.2;
      const dotMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? colorHex : 0xffffff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 1,
      });
      const dot = new THREE.Mesh(this.particleGeo, dotMat);
      dot.position.set(pos.x, pos.y, 0.39);
      this.scene.fxGroup.add(dot);
      this.activeParticles.push({
        mesh: dot,
        vel: new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed, 0),
        life: 0,
        maxLife: 0.25 + Math.random() * 0.15,
      });
    }
  }

  /**
   * Bomberman-style cross blast: shoots high-intensity fiery columns of flame
   * surging outwards to all 4 edges of the board, wiping the full row and column!
   */
  public spawnBombermanCrossBlast(center: THREE.Vector3): Promise<void> {
    return new Promise((resolve) => {
      const group = new THREE.Group();
      this.scene.fxGroup.add(group);

      const boardLimit = 4.2; // Extends across the 8x8 board

      // 4 Cardinal Ray Directions: [dx, dy, length, angle, posX, posY]
      const rays = [
        // North
        {
          len: Math.max(0.5, boardLimit - center.y),
          angle: Math.PI / 2,
          midX: center.x,
          midY: center.y + (boardLimit - center.y) / 2,
        },
        // South
        {
          len: Math.max(0.5, center.y - (-boardLimit)),
          angle: -Math.PI / 2,
          midX: center.x,
          midY: center.y - (center.y - (-boardLimit)) / 2,
        },
        // East
        {
          len: Math.max(0.5, boardLimit - center.x),
          angle: 0,
          midX: center.x + (boardLimit - center.x) / 2,
          midY: center.y,
        },
        // West
        {
          len: Math.max(0.5, center.x - (-boardLimit)),
          angle: Math.PI,
          midX: center.x - (center.x - (-boardLimit)) / 2,
          midY: center.y,
        },
      ];

      // Shake camera violently like Bomberman!
      this.shake(4.2);

      // Expanding fiery central sphere
      const centerGeo = new THREE.RingGeometry(0.2, 0.9, 32);
      const centerMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.95,
      });
      const centerMesh = new THREE.Mesh(centerGeo, centerMat);
      centerMesh.position.set(center.x, center.y, 0.38);
      group.add(centerMesh);

      gsap.to(centerMesh.scale, {
        x: 3.2,
        y: 3.2,
        duration: 0.35,
        ease: 'power2.out',
      });
      gsap.to(centerMat, {
        opacity: 0,
        duration: 0.35,
        ease: 'power2.in',
      });

      // Construct and shoot each cardinal fiery jet
      rays.forEach((r) => {
        // Outer flame jet
        const flameGeo = new THREE.PlaneGeometry(r.len, 0.72);
        const flameMat = new THREE.MeshBasicMaterial({
          color: 0xef4444, // Fiery red-orange
          transparent: true,
          blending: THREE.AdditiveBlending,
          opacity: 0.9,
          side: THREE.DoubleSide,
        });
        const flameMesh = new THREE.Mesh(flameGeo, flameMat);
        flameMesh.position.set(r.midX, r.midY, 0.34);
        flameMesh.rotation.z = r.angle;
        flameMesh.scale.set(0.1, 0.2, 1);
        group.add(flameMesh);

        // Inner searing plasma core
        const coreGeo = new THREE.PlaneGeometry(r.len, 0.32);
        const coreMat = new THREE.MeshBasicMaterial({
          color: 0xfef08a, // Pure bright yellow-white
          transparent: true,
          blending: THREE.AdditiveBlending,
          opacity: 0.95,
          side: THREE.DoubleSide,
        });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        coreMesh.position.set(r.midX, r.midY, 0.36);
        coreMesh.rotation.z = r.angle;
        coreMesh.scale.set(0.1, 0.2, 1);
        group.add(coreMesh);

        // Animate flame blast rushing out
        gsap.to([flameMesh.scale, coreMesh.scale], {
          x: 1.0,
          y: 1.0,
          duration: 0.22,
          ease: 'power3.out',
        });

        gsap.to([flameMat, coreMat], {
          opacity: 0,
          duration: 0.18,
          delay: 0.2,
          ease: 'power2.in',
        });

        // Spawn fire puff particles along the beam
        for (let i = 0; i < 4; i++) {
          const t = Math.random();
          const pGeo = new THREE.PlaneGeometry(0.18, 0.18);
          const pMat = new THREE.MeshBasicMaterial({
            color: 0xf97316,
            transparent: true,
            blending: THREE.AdditiveBlending,
            opacity: 0.9,
          });
          const pMesh = new THREE.Mesh(pGeo, pMat);
          const px = center.x + (r.midX - center.x) * (t * 2);
          const py = center.y + (r.midY - center.y) * (t * 2);
          pMesh.position.set(px, py, 0.37);
          this.scene.fxGroup.add(pMesh);
          this.activeParticles.push({
            mesh: pMesh,
            vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 0),
            life: 0,
            maxLife: 0.3 + Math.random() * 0.2,
          });
        }
      });

      // Cleanup and resolve after explosion sweeps
      setTimeout(() => {
        if (group.parent) group.parent.remove(group);
        resolve();
      }, 380);
    });
  }

  /**
   * Displays a banner informing the player that the board has no valid moves and is reshuffling
   */
  public showShuffleBanner() {
    const container = document.getElementById('combo-banner-container');
    if (!container) return;

    container.innerHTML = '';

    const banner = document.createElement('div');
    banner.className = 'combo-banner tier-1';
    banner.innerHTML = `
      <div class="combo-banner-cascade">🔄 SIN MOVIMIENTOS 🔄</div>
      <div class="combo-banner-title">¡BARAJANDO!</div>
      <div class="combo-banner-points">Nuevas oportunidades</div>
    `;

    container.appendChild(banner);

    gsap.fromTo(
      banner,
      { scale: 1.8, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.22,
        ease: 'back.out(1.8)',
        onComplete: () => {
          gsap.to(banner, {
            y: -25,
            opacity: 0,
            duration: 0.4,
            delay: 0.5,
            ease: 'power2.in',
            onComplete: () => {
              if (banner.parentElement) banner.parentElement.removeChild(banner);
            },
          });
        },
      }
    );
  }

  /**
   * Displays an arcade Killer Instinct-style Combo Banner overlay
   */
  public showComboBanner(cascade: number, title: string, tier: number, points: number) {
    const container = document.getElementById('combo-banner-container');
    if (!container) return;

    // Clear previous banner if any
    container.innerHTML = '';

    const banner = document.createElement('div');
    banner.className = `combo-banner tier-${tier}`;
    banner.innerHTML = `
      <div class="combo-banner-cascade">CASCADA ×${cascade}</div>
      <div class="combo-banner-title">${title}</div>
      <div class="combo-banner-points">+${points.toLocaleString()} PTS</div>
    `;

    container.appendChild(banner);

    // Screen shake proportional to tier
    this.shake(1.5 + tier * 0.5);

    // GSAP animation: punchy slam zoom, pulse, slide up and fade
    gsap.fromTo(
      banner,
      { scale: 2.2, opacity: 0, rotation: -6 },
      {
        scale: 1,
        opacity: 1,
        rotation: -2,
        duration: 0.22,
        ease: 'back.out(2)',
        onComplete: () => {
          gsap.to(banner, {
            scale: 1.05,
            duration: 0.35,
            yoyo: true,
            repeat: 1,
            ease: 'sine.inOut',
            onComplete: () => {
              gsap.to(banner, {
                y: -35,
                opacity: 0,
                duration: 0.3,
                ease: 'power2.in',
                onComplete: () => {
                  if (banner.parentElement) banner.parentElement.removeChild(banner);
                },
              });
            },
          });
        },
      }
    );
  }

  /**
   * Displays an epic Board Clear banner with confetti, screen shake, and random phrase
   */
  public showBoardClearBanner(title: string, points: number) {
    const container = document.getElementById('combo-banner-container');
    if (!container) return;

    // Clear previous banner if any
    container.innerHTML = '';

    const banner = document.createElement('div');
    banner.className = 'combo-banner tier-board-clear';
    banner.innerHTML = `
      <div class="combo-banner-cascade">✨ ¡TABLERO LIMPIO! ✨</div>
      <div class="combo-banner-title">${title}</div>
      <div class="combo-banner-points">+${points.toLocaleString()} PTS BONUS</div>
    `;

    container.appendChild(banner);

    // Dramatic screen shake
    this.shake(4.5);

    // Confetti celebration
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#facc15', '#ec4899', '#38bdf8', '#a855f7', '#4ade80'],
    });

    // GSAP animation: dramatic slam zoom, golden pulse, slide up and fade
    gsap.fromTo(
      banner,
      { scale: 2.8, opacity: 0, rotation: -8 },
      {
        scale: 1,
        opacity: 1,
        rotation: 0,
        duration: 0.28,
        ease: 'back.out(2.2)',
        onComplete: () => {
          gsap.to(banner, {
            scale: 1.08,
            duration: 0.45,
            yoyo: true,
            repeat: 2,
            ease: 'sine.inOut',
            onComplete: () => {
              gsap.to(banner, {
                y: -40,
                opacity: 0,
                duration: 0.35,
                ease: 'power2.in',
                onComplete: () => {
                  if (banner.parentElement) banner.parentElement.removeChild(banner);
                },
              });
            },
          });
        },
      }
    );
  }

  private update(dt: number, time: number) {
    // Pulse selection indicator
    if (this.selectionGroup.visible) {
      const s = 1.0 + 0.05 * Math.sin(time * 6);
      this.selectionGroup.scale.set(s, s, 1);
      this.selectionAccent.rotation.z += dt * 2.0;
    }

    // Update particles
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        if (Array.isArray(p.mesh.material)) {
          p.mesh.material.forEach((m) => m.dispose());
        } else {
          p.mesh.material.dispose();
        }
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
      if (Array.isArray(p.mesh.material)) {
        p.mesh.material.forEach((m) => m.dispose());
      } else {
        p.mesh.material.dispose();
      }
    }
    this.activeParticles = [];
  }

  public destroy() {
    this.clearAll();
    this.particleGeo.dispose();
    this.reticleMat.dispose();
    this.horizGeo.dispose();
    this.vertGeo.dispose();
    this.accentGeo.dispose();
    this.accentMat.dispose();
  }
}
