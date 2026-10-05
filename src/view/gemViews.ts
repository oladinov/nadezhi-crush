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
  bombBadge?: THREE.Sprite;
  rainbowAura?: THREE.Sprite;
  rainbowStars?: THREE.Group;
}

// Global module-level caches to prevent texture reloading, race conditions, or fallback overwriting
let globalJewelMaterials: THREE.MeshBasicMaterial[] | null = null;
const globalEmoteTextureCache = new Map<string, THREE.Texture>();
const globalEmoteMaterialCache = new Map<string, THREE.MeshBasicMaterial>();
let globalHaloTexture: THREE.CanvasTexture | null = null;
let globalBombBadge1: THREE.CanvasTexture | null = null;
let globalBombBadge2: THREE.CanvasTexture | null = null;
let globalRainbowAura: THREE.CanvasTexture | null = null;
let globalStarTexture: THREE.CanvasTexture | null = null;

export const DEFAULT_EMOTE_PATHS = [
  '/emotes/1103355444124209192.webp', // Clown (Red - 0)
  '/emotes/1103355458179309619.webp', // Screaming girl (Blue - 1)
  '/emotes/1536895948179898388.webp', // Winter moogle (Green - 2)
  '/emotes/1536895951950577814.webp', // GG cat (Amber - 3)
  '/emotes/1536895958728835182.webp', // LABURE girl (Purple - 4)
];

export class GemViewManager {
  private gemPlaneGeo: THREE.PlaneGeometry;
  private rainbowGeo: THREE.IcosahedronGeometry;
  private ringGeo: THREE.RingGeometry;
  private haloTexture: THREE.CanvasTexture;
  private bombBadgeTexture1: THREE.CanvasTexture;
  private bombBadgeTexture2: THREE.CanvasTexture;
  private rainbowAuraTexture: THREE.CanvasTexture;
  private starGlintTexture: THREE.CanvasTexture;
  private jewelMaterials: THREE.MeshBasicMaterial[] = [];
  public skinMode: GemSkinMode = 'emotes';
  private currentEmotePaths: string[] = [...DEFAULT_EMOTE_PATHS];
  private currentEmoteMaterials: (THREE.MeshBasicMaterial | null)[] = [null, null, null, null, null];

  public views: Map<number, GemView> = new Map();

  // Color palette: Red, Blue, Green, Amber, Purple
  public readonly COLOR_HEXES = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0xa855f7];

  constructor(initialEmotePaths?: string[]) {
    this.gemPlaneGeo = new THREE.PlaneGeometry(0.84, 0.84);
    this.rainbowGeo = new THREE.IcosahedronGeometry(0.38, 1);
    this.ringGeo = new THREE.RingGeometry(0.44, 0.52, 24);

    if (initialEmotePaths && initialEmotePaths.length === 5) {
      this.currentEmotePaths = [...initialEmotePaths];
    }

    if (!globalHaloTexture) {
      globalHaloTexture = this.createHaloTexture();
    }
    this.haloTexture = globalHaloTexture;

    if (!globalBombBadge1) globalBombBadge1 = this.createBombBadgeTexture(1);
    this.bombBadgeTexture1 = globalBombBadge1;

    if (!globalBombBadge2) globalBombBadge2 = this.createBombBadgeTexture(2);
    this.bombBadgeTexture2 = globalBombBadge2;

    if (!globalRainbowAura) globalRainbowAura = this.createRainbowAuraTexture();
    this.rainbowAuraTexture = globalRainbowAura;

    if (!globalStarTexture) globalStarTexture = this.createStarGlintTexture();
    this.starGlintTexture = globalStarTexture;

    this.initJewelMaterials();
    this.loadEmoteTextures(this.currentEmotePaths);
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

  private createBombBadgeTexture(tier: 1 | 2): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // 1. Glowing outer halo
    const glow = ctx.createRadialGradient(64, 64, 20, 64, 64, 62);
    glow.addColorStop(0, tier === 2 ? 'rgba(239, 68, 68, 0.95)' : 'rgba(245, 158, 11, 0.95)');
    glow.addColorStop(0.6, tier === 2 ? 'rgba(220, 38, 38, 0.5)' : 'rgba(217, 119, 6, 0.45)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 128, 128);

    // 2. Circular badge backing plate
    ctx.beginPath();
    ctx.arc(64, 64, 44, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = tier === 2 ? '#ef4444' : '#f59e0b';
    ctx.stroke();

    // 3. Cute Cartoon Bomb Sphere
    ctx.beginPath();
    ctx.arc(64, 72, 26, 0, Math.PI * 2);
    const bombGrad = ctx.createRadialGradient(56, 64, 3, 64, 72, 26);
    bombGrad.addColorStop(0, '#94a3b8');
    bombGrad.addColorStop(0.4, '#334155');
    bombGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bombGrad;
    ctx.fill();

    // Glossy reflection
    ctx.beginPath();
    ctx.arc(54, 62, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fill();

    // Bomb neck cap
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(58, 42, 12, 6);

    // Fuse arch
    ctx.beginPath();
    ctx.moveTo(64, 42);
    ctx.quadraticCurveTo(76, 28, 70, 18);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fef08a';
    ctx.stroke();

    // Fuse spark flame
    ctx.beginPath();
    ctx.arc(70, 18, 11, 0, Math.PI * 2);
    const flameGrad = ctx.createRadialGradient(70, 18, 2, 70, 18, 11);
    flameGrad.addColorStop(0, '#ffffff');
    flameGrad.addColorStop(0.4, '#fde047');
    flameGrad.addColorStop(0.8, '#ef4444');
    flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = flameGrad;
    ctx.fill();

    // Star spark rays
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.5;
    const sparkRays = [[70, 6], [82, 18], [70, 30], [58, 18]];
    sparkRays.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.moveTo(70, 18);
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    if (tier === 2) {
      // "T2" text on bomb
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fef08a';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.strokeText('T2', 64, 74);
      ctx.fillText('T2', 64, 74);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private createRainbowAuraTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.25, 'rgba(56, 189, 248, 0.85)'); // Neon Cyan
    grad.addColorStop(0.5, 'rgba(232, 121, 249, 0.75)');  // Pink/Magenta
    grad.addColorStop(0.75, 'rgba(250, 204, 21, 0.55)'); // Gold
    grad.addColorStop(1, 'rgba(250, 204, 21, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private createStarGlintTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.translate(32, 32);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.lineTo(0, -28);
      ctx.lineTo(5, -5);
      ctx.rotate(Math.PI / 2);
    }
    ctx.closePath();
    ctx.fill();

    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    glow.addColorStop(0.5, 'rgba(250, 204, 21, 0.6)');
    glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private initJewelMaterials() {
    if (!globalJewelMaterials) {
      globalJewelMaterials = [];
      for (let c = 0; c < 5; c++) {
        const texture = this.createJewelTexture(c as GemColor);
        const mat = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
        });
        globalJewelMaterials.push(mat);
      }
    }
    this.jewelMaterials = globalJewelMaterials;
  }

  public setEmotePaths(paths: string[]) {
    if (!paths || paths.length !== 5) return;
    this.currentEmotePaths = [...paths];
    this.loadEmoteTextures(this.currentEmotePaths);
  }

  private loadEmoteTextures(paths: string[]) {
    const loader = new THREE.TextureLoader();

    paths.forEach((path, i) => {
      let mat = globalEmoteMaterialCache.get(path);
      if (!mat) {
        mat = new THREE.MeshBasicMaterial({ transparent: true });
        globalEmoteMaterialCache.set(path, mat);
      }
      this.currentEmoteMaterials[i] = mat;

      const cachedTex = globalEmoteTextureCache.get(path);
      if (cachedTex) {
        if (mat.map !== cachedTex) {
          mat.map = cachedTex;
          mat.needsUpdate = true;
        }
      } else {
        loader.load(
          path,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            globalEmoteTextureCache.set(path, tex);
            mat!.map = tex;
            mat!.needsUpdate = true;
            this.refreshCurrentViewsMaterial();
          },
          undefined,
          (err) => {
            console.warn(`Could not load emote texture ${path}:`, err);
          }
        );
      }
    });

    this.refreshCurrentViewsMaterial();
  }

  private refreshCurrentViewsMaterial() {
    if (this.skinMode === 'emotes') {
      for (const view of this.views.values()) {
        if (view.gem.kind !== 'rainbow') {
          view.mesh.material = this.getMaterial(view.gem.color);
        }
      }
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
    if (this.skinMode === 'emotes' && this.currentEmoteMaterials[color]?.map) {
      return this.currentEmoteMaterials[color]!;
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
    let bombBadge: THREE.Sprite | undefined;
    let rainbowAura: THREE.Sprite | undefined;
    let rainbowStars: THREE.Group | undefined;

    if (gem.kind === 'rainbow') {
      // 1. Shimmering prismatic aura sprite behind icosahedron
      const auraMat = new THREE.SpriteMaterial({
        map: this.rainbowAuraTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.88,
      });
      rainbowAura = new THREE.Sprite(auraMat);
      rainbowAura.scale.set(1.5, 1.5, 1);
      rainbowAura.position.set(0, 0, -0.05);
      group.add(rainbowAura);

      // 2. Sparkling orbiting star glints
      rainbowStars = new THREE.Group();
      const starMat = new THREE.SpriteMaterial({
        map: this.starGlintTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.95,
      });
      const starAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
      starAngles.forEach((ang) => {
        const star = new THREE.Sprite(starMat);
        star.scale.set(0.28, 0.28, 1);
        star.position.set(Math.cos(ang) * 0.44, Math.sin(ang) * 0.44, 0.2);
        rainbowStars!.add(star);
      });
      group.add(rainbowStars);

      // 3. 3D rotating rainbow icosahedron
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

        // Cartoon Bomb Badge on upper-right corner of the gem/emote!
        const badgeMat = new THREE.SpriteMaterial({
          map: gem.tier === 2 ? this.bombBadgeTexture2 : this.bombBadgeTexture1,
          transparent: true,
          depthTest: false,
        });
        bombBadge = new THREE.Sprite(badgeMat);
        bombBadge.scale.set(0.42, 0.42, 1);
        bombBadge.position.set(0.24, 0.24, 0.25);
        group.add(bombBadge);

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
      bombBadge,
      rainbowAura,
      rainbowStars,
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
        if (view.rainbowAura) {
          const auraPulse = 1.45 + 0.16 * Math.sin(time * 3.5);
          view.rainbowAura.scale.set(auraPulse, auraPulse, 1);
        }
        if (view.rainbowStars) {
          view.rainbowStars.rotation.z += dt * 1.5;
          const starPulse = 0.28 + 0.06 * Math.sin(time * 6);
          view.rainbowStars.children.forEach((child) => {
            child.scale.set(starPulse, starPulse, 1);
          });
        }
      } else if (view.gem.kind === 'bomb') {
        // Bomb pulse: scale = 1 + 0.06 * sin(t * 6)
        const pulse = 1 + 0.06 * Math.sin(time * 6);
        view.group.scale.set(
          view.baseScale.x * pulse,
          view.baseScale.y * pulse,
          view.baseScale.z
        );

        // Bomb badge sparkle/fuse flicker
        if (view.bombBadge) {
          const badgeScale = 0.42 + 0.04 * Math.sin(time * 9);
          view.bombBadge.scale.set(badgeScale, badgeScale, 1);
        }

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

  public disposeView(view: GemView) {
    if (view.shaderMaterial) {
      view.shaderMaterial.dispose();
    }
    if (view.halo) {
      view.halo.material.dispose();
    }
    if (view.bombBadge) {
      view.bombBadge.material.dispose();
    }
    if (view.tier2Ring) {
      if (Array.isArray(view.tier2Ring.material)) {
        view.tier2Ring.material.forEach((m) => m.dispose());
      } else {
        view.tier2Ring.material.dispose();
      }
    }
    if (view.sparks) {
      view.sparks.geometry.dispose();
      if (Array.isArray(view.sparks.material)) {
        view.sparks.material.forEach((m) => m.dispose());
      } else {
        view.sparks.material.dispose();
      }
    }
    if (view.rainbowAura) {
      view.rainbowAura.material.dispose();
    }
    if (view.rainbowStars) {
      view.rainbowStars.children.forEach((child) => {
        if (child instanceof THREE.Sprite) {
          child.material.dispose();
        }
      });
    }
  }

  public removeView(id: number): GemView | undefined {
    const view = this.views.get(id);
    if (view) {
      if (view.group.parent) {
        view.group.parent.remove(view.group);
      }
      this.disposeView(view);
      this.views.delete(id);
    }
    return view;
  }

  public clearAll() {
    for (const view of this.views.values()) {
      if (view.group.parent) {
        view.group.parent.remove(view.group);
      }
      this.disposeView(view);
    }
    this.views.clear();
  }

  public destroy() {
    this.clearAll();
    this.gemPlaneGeo.dispose();
    this.rainbowGeo.dispose();
    this.ringGeo.dispose();
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
