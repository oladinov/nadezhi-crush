import * as THREE from 'three';
import { Gem, GemColor } from '../core/types';
import { rainbowFragmentShader, rainbowVertexShader } from './shaders';

export type GemSkinMode = 'jewels' | 'emotes';

export interface GemView {
  id: number;
  gem: Gem;
  group: THREE.Group;
  mesh: THREE.Mesh;
  halo?: THREE.Sprite;
  tier2Ring?: THREE.Mesh;
  sparks?: THREE.Points;
  sparkVelocities?: THREE.Vector3[];
  shaderMaterial?: THREE.ShaderMaterial;
  baseScale: THREE.Vector3;
}

export class GemViewManager {
  private gemPlaneGeo: THREE.PlaneGeometry;
  private rainbowGeo: THREE.IcosahedronGeometry;
  private ringGeo: THREE.RingGeometry;
  private haloTexture: THREE.CanvasTexture;
  private jewelMaterials: THREE.MeshBasicMaterial[] = [];
  private emoteMaterials: (THREE.MeshBasicMaterial | null)[] = [];
  public skinMode: GemSkinMode = 'emotes';

  public views: Map<number, GemView> = new Map();

  // Color palette: Red, Blue, Green, Amber, Purple
  public readonly COLOR_HEXES = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0xa855f7];

  constructor() {
    this.gemPlaneGeo = new THREE.PlaneGeometry(0.84, 0.84);
    this.rainbowGeo = new THREE.IcosahedronGeometry(0.38, 1);
    this.ringGeo = new THREE.RingGeometry(0.44, 0.52, 24);

    this.haloTexture = this.createHaloTexture();
    this.initJewelMaterials();
    this.loadEmoteTextures();
  }

  private createHaloTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.7)');
    grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.2)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private initJewelMaterials() {
    // Generate distinct, high-res procedural jewel textures for each color
    for (let c = 0; c < 5; c++) {
      const texture = this.createJewelTexture(c as GemColor);
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
      });
      this.jewelMaterials.push(mat);
    }
  }

  private loadEmoteTextures() {
    const loader = new THREE.TextureLoader();
    const emotePaths = [
      'emotes/1103355444124209192.webp', // Clown
      'emotes/1103355458179309619.webp', // Screaming girl
      'emotes/1142187365251686491.webp', // Crying cat
      'emotes/1536895951950577814.webp', // GG cat
      'emotes/1536895958728835182.webp', // LABURE girl
    ];

    for (let i = 0; i < 5; i++) {
      loader.load(
        emotePaths[i],
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          this.emoteMaterials[i] = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
          });
          if (this.skinMode === 'emotes') {
            for (const view of this.views.values()) {
              if (view.gem.kind !== 'rainbow' && view.gem.color === i) {
                view.mesh.material = this.emoteMaterials[i]!;
              }
            }
          }
        },
        undefined,
        () => {
          // Fallback to jewel texture if emote fails to load
          this.emoteMaterials[i] = this.jewelMaterials[i];
        }
      );
    }
  }

  private createJewelTexture(color: GemColor): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const baseHexes = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7'];
    const lightHexes = ['#fca5a5', '#93c5fd', '#6ee7b7', '#fde68a', '#d8b4fe'];
    const darkHexes = ['#991b1b', '#1e40af', '#065f46', '#92400e', '#581c87'];

    const cx = 128;
    const cy = 128;
    const r = 96;

    ctx.clearRect(0, 0, 256, 256);

    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;

    // Outer polygon based on color
    ctx.beginPath();
    if (color === 0) {
      // Hexagon (Ruby)
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3 - Math.PI / 6;
        const x = cx + r * Math.cos(ang);
        const y = cy + r * Math.sin(ang);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else if (color === 1) {
      // Rhombus / Teardrop diamond (Sapphire)
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.9, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r * 0.9, cy);
    } else if (color === 2) {
      // Octagon (Emerald)
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4 - Math.PI / 8;
        const x = cx + r * Math.cos(ang);
        const y = cy + r * Math.sin(ang);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else if (color === 3) {
      // Triangle / Rounded jewel (Amber)
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.95, cy + r * 0.7);
      ctx.lineTo(cx - r * 0.95, cy + r * 0.7);
    } else {
      // 5-point Star gem (Amethyst)
      for (let i = 0; i < 10; i++) {
        const ang = (i * Math.PI) / 5 - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.65;
        const x = cx + rad * Math.cos(ang);
        const y = cy + rad * Math.sin(ang);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.closePath();

    // Fill with gradient
    const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, lightHexes[color]);
    grad.addColorStop(0.4, baseHexes[color]);
    grad.addColorStop(1, darkHexes[color]);
    ctx.fillStyle = grad;
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Inner bevel facets
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.stroke();

    // Inner bright facet
    ctx.beginPath();
    ctx.arc(cx - 24, cy - 28, 22, 0, Math.PI * 2);
    const glint = ctx.createRadialGradient(cx - 24, cy - 28, 0, cx - 24, cy - 28, 22);
    glint.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    glint.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glint;
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  public getMaterial(color: GemColor): THREE.MeshBasicMaterial {
    if (this.skinMode === 'emotes' && this.emoteMaterials[color]) {
      return this.emoteMaterials[color]!;
    }
    return this.jewelMaterials[color];
  }

  public createGemView(gem: Gem): GemView {
    const group = new THREE.Group();
    let mesh: THREE.Mesh;
    let halo: THREE.Sprite | undefined;
    let tier2Ring: THREE.Mesh | undefined;
    let sparks: THREE.Points | undefined;
    let sparkVelocities: THREE.Vector3[] | undefined;
    let shaderMaterial: THREE.ShaderMaterial | undefined;

    if (gem.kind === 'rainbow') {
      shaderMaterial = new THREE.ShaderMaterial({
        vertexShader: rainbowVertexShader,
        fragmentShader: rainbowFragmentShader,
        uniforms: {
          uTime: { value: 0 },
        },
      });
      mesh = new THREE.Mesh(this.rainbowGeo, shaderMaterial);
      group.add(mesh);
    } else {
      // Normal or Bomb
      const mat = this.getMaterial(gem.color);
      mesh = new THREE.Mesh(this.gemPlaneGeo, mat);
      group.add(mesh);

      if (gem.kind === 'bomb') {
        // Halo sprite
        const spriteMat = new THREE.SpriteMaterial({
          map: this.haloTexture,
          color: new THREE.Color(this.COLOR_HEXES[gem.color]),
          transparent: true,
          blending: THREE.AdditiveBlending,
          opacity: 0.8,
        });
        halo = new THREE.Sprite(spriteMat);
        const haloScale = gem.tier === 2 ? 1.5 : 1.15;
        halo.scale.set(haloScale, haloScale, 1);
        group.add(halo);

        // Tier 2 rotating ring
        if (gem.tier === 2) {
          const ringMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(this.COLOR_HEXES[gem.color]),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
          });
          tier2Ring = new THREE.Mesh(this.ringGeo, ringMat);
          group.add(tier2Ring);
        }

        // Sparks points
        const sparkCount = gem.tier === 2 ? 12 : 7;
        const sparkGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(sparkCount * 3);
        sparkVelocities = [];

        for (let i = 0; i < sparkCount; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 0.6;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
          positions[i * 3 + 2] = 0.05;
          sparkVelocities.push(
            new THREE.Vector3(
              (Math.random() - 0.5) * 0.4,
              (Math.random() - 0.5) * 0.4,
              0
            )
          );
        }
        sparkGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const sparkMat = new THREE.PointsMaterial({
          color: 0xffffff,
          size: 0.08,
          transparent: true,
          blending: THREE.AdditiveBlending,
        });
        sparks = new THREE.Points(sparkGeo, sparkMat);
        group.add(sparks);
      }
    }

    const view: GemView = {
      id: gem.id,
      gem,
      group,
      mesh,
      halo,
      tier2Ring,
      sparks,
      sparkVelocities,
      shaderMaterial,
      baseScale: new THREE.Vector3(1, 1, 1),
    };

    this.views.set(gem.id, view);
    return view;
  }

  public updateViewGems(dt: number, time: number) {
    for (const view of this.views.values()) {
      if (view.gem.kind === 'rainbow') {
        // Rotate rainbow mesh in 3D
        view.mesh.rotation.x += dt * 0.8;
        view.mesh.rotation.y += dt * 1.2;
        if (view.shaderMaterial) {
          view.shaderMaterial.uniforms.uTime.value = time;
        }
      } else if (view.gem.kind === 'bomb') {
        // Bomb pulse: scale = 1 + 0.06 * sin(t * 6)
        const pulse = 1 + 0.06 * Math.sin(time * 6);
        view.group.scale.set(
          view.baseScale.x * pulse,
          view.baseScale.y * pulse,
          view.baseScale.z
        );

        // Tier 2 ring rotation
        if (view.tier2Ring) {
          view.tier2Ring.rotation.z += dt * 2.5;
        }

        // Sparks CPU update
        if (view.sparks && view.sparkVelocities) {
          const posAttr = view.sparks.geometry.attributes.position as THREE.BufferAttribute;
          const pos = posAttr.array as Float32Array;
          for (let i = 0; i < view.sparkVelocities.length; i++) {
            pos[i * 3] += view.sparkVelocities[i].x * dt;
            pos[i * 3 + 1] += view.sparkVelocities[i].y * dt;
            // Wrap sparks around center
            if (Math.abs(pos[i * 3]) > 0.45) pos[i * 3] *= -0.8;
            if (Math.abs(pos[i * 3 + 1]) > 0.45) pos[i * 3 + 1] *= -0.8;
          }
          posAttr.needsUpdate = true;
        }
      }
    }
  }

  public removeView(id: number): GemView | undefined {
    const view = this.views.get(id);
    if (view) {
      if (view.group.parent) {
        view.group.parent.remove(view.group);
      }
      this.views.delete(id);
    }
    return view;
  }

  public clearAll() {
    for (const view of this.views.values()) {
      if (view.group.parent) {
        view.group.parent.remove(view.group);
      }
    }
    this.views.clear();
  }

  public setSkinMode(mode: GemSkinMode) {
    this.skinMode = mode;
    for (const view of this.views.values()) {
      if (view.gem.kind !== 'rainbow') {
        view.mesh.material = this.getMaterial(view.gem.color);
      }
    }
  }
}
