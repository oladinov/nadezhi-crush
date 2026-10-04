import * as THREE from 'three';

export interface BoardDimensions {
  rows: number;
  cols: number;
  cellSize: number;
}

export class GameScene {
  public scene: THREE.Scene;
  public camera: THREE.OrthographicCamera;
  public renderer: THREE.WebGLRenderer;
  public container: HTMLElement;
  public boardGroup: THREE.Group;
  public gemGroup: THREE.Group;
  public fxGroup: THREE.Group;
  public boardBackgroundGroup: THREE.Group;
  public dimensions: BoardDimensions;

  private animationFrameId: number | null = null;
  private onUpdateCallbacks: ((dt: number, time: number) => void)[] = [];
  private clock: THREE.Clock;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, rows = 8, cols = 8) {
    this.container = container;
    this.dimensions = { rows, cols, cellSize: 1.0 };
    this.clock = new THREE.Clock();

    // 1. Scene (transparent to display fantasy landscape backdrop)
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // 2. Groups
    this.boardGroup = new THREE.Group();
    this.boardBackgroundGroup = new THREE.Group();
    this.gemGroup = new THREE.Group();
    this.fxGroup = new THREE.Group();

    this.boardGroup.add(this.boardBackgroundGroup);
    this.boardGroup.add(this.gemGroup);
    this.boardGroup.add(this.fxGroup);
    this.scene.add(this.boardGroup);

    // 3. Camera with safe dimension fallback against initial 0px unmeasured mobile layout
    const initW = Math.max(container.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800), 320);
    const initH = Math.max(container.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 600), 320);
    const aspect = initW / initH;
    const viewSize = Math.max(rows, cols) + 3.0;
    this.camera = new THREE.OrthographicCamera(
      (-viewSize * aspect) / 2,
      (viewSize * aspect) / 2,
      viewSize / 2,
      -viewSize / 2,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);

    // 4. Renderer with alpha support
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2));
    this.renderer.setSize(initW, initH);
    container.appendChild(this.renderer.domElement);

    // 5. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 15);
    this.scene.add(dirLight);

    // 6. Build background grid
    this.createBoardGrid(rows, cols);

    // 7. Resize handling (window event + container ResizeObserver)
    window.addEventListener('resize', this.onResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.onResize();
      });
      this.resizeObserver.observe(this.container);
    }
    this.onResize();

    // 8. Start render loop
    this.startLoop();
  }

  public cellToWorld(r: number, c: number): THREE.Vector3 {
    const { rows, cols, cellSize } = this.dimensions;
    const x = (c - (cols - 1) / 2) * cellSize;
    const y = ((rows - 1) / 2 - r) * cellSize;
    return new THREE.Vector3(x, y, 0);
  }

  public worldToCell(pos: THREE.Vector3): { r: number; c: number } | null {
    const { rows, cols, cellSize } = this.dimensions;
    const halfCell = cellSize / 2;

    const left = -((cols - 1) / 2) * cellSize - halfCell;
    const right = ((cols - 1) / 2) * cellSize + halfCell;
    const top = ((rows - 1) / 2) * cellSize + halfCell;
    const bottom = -((rows - 1) / 2) * cellSize - halfCell;

    if (pos.x < left || pos.x > right || pos.y > top || pos.y < bottom) {
      return null;
    }

    const c = Math.floor((pos.x - left) / cellSize);
    const r = Math.floor((top - pos.y) / cellSize);

    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      return { r, c };
    }
    return null;
  }

  public createBoardGrid(rows: number, cols: number) {
    this.dimensions.rows = rows;
    this.dimensions.cols = cols;

    while (this.boardBackgroundGroup.children.length > 0) {
      const child = this.boardBackgroundGroup.children[0];
      this.boardBackgroundGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    // Outer board frame
    const boardWidth = cols * this.dimensions.cellSize + 0.3;
    const boardHeight = rows * this.dimensions.cellSize + 0.3;
    const frameGeo = new THREE.PlaneGeometry(boardWidth, boardHeight);
    const frameMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.78,
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.set(0, 0, -0.05);
    this.boardBackgroundGroup.add(frameMesh);

    // Individual tile backgrounds - shared geometries and materials
    const tileGeo = new THREE.PlaneGeometry(0.92, 0.92);
    const tileMat1 = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.65,
    });
    const tileMat2 = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.65,
    });

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isAlternate = (r + c) % 2 === 0;
        const tileMesh = new THREE.Mesh(tileGeo, isAlternate ? tileMat1 : tileMat2);
        const worldPos = this.cellToWorld(r, c);
        tileMesh.position.set(worldPos.x, worldPos.y, -0.01);
        this.boardBackgroundGroup.add(tileMesh);
      }
    }
  }

  public onUpdate(callback: (dt: number, time: number) => void) {
    this.onUpdateCallbacks.push(callback);
  }

  private onResize = () => {
    let width = this.container.clientWidth;
    let height = this.container.clientHeight;

    // Safety fallback if container not yet measured by browser layout engine
    if (!width || width <= 0) width = typeof window !== 'undefined' ? window.innerWidth : 800;
    if (!height || height <= 0) height = typeof window !== 'undefined' ? window.innerHeight : 600;
    if (!width || width <= 0) width = 800;
    if (!height || height <= 0) height = 600;

    const aspect = width / height;

    const { rows, cols } = this.dimensions;
    // Provide generous headroom for top HUD and goal chips so they never overlap the board
    const boardW = cols + 1.2;
    const boardH = rows + 3.0;

    let viewWidth: number;
    let viewHeight: number;

    if (aspect >= boardW / boardH) {
      viewHeight = boardH;
      viewWidth = viewHeight * aspect;
    } else {
      viewWidth = boardW;
      viewHeight = viewWidth / aspect;
    }

    // Offset camera slightly downward (-0.65) to shift the board down into comfortable play area
    const offsetY = -0.65;

    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2 - offsetY;
    this.camera.bottom = -viewHeight / 2 - offsetY;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2));
  };

  private startLoop() {
    const tick = () => {
      const dt = Math.min(0.1, this.clock.getDelta());
      const time = this.clock.getElapsedTime();

      for (const cb of this.onUpdateCallbacks) {
        cb(dt, time);
      }

      this.renderer.render(this.scene, this.camera);
      this.animationFrameId = requestAnimationFrame(tick);
    };
    this.animationFrameId = requestAnimationFrame(tick);
  }

  public destroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    window.removeEventListener('resize', this.onResize);
    this.onUpdateCallbacks = [];

    // Traverse scene and dispose meshes, geometries, and materials
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
