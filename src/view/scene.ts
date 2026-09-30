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

  constructor(container: HTMLElement, rows = 8, cols = 8) {
    this.container = container;
    this.dimensions = { rows, cols, cellSize: 1.0 };
    this.clock = new THREE.Clock();

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a); // Deep modern slate blue

    // 2. Groups
    this.boardGroup = new THREE.Group();
    this.boardBackgroundGroup = new THREE.Group();
    this.gemGroup = new THREE.Group();
    this.fxGroup = new THREE.Group();

    this.boardGroup.add(this.boardBackgroundGroup);
    this.boardGroup.add(this.gemGroup);
    this.boardGroup.add(this.fxGroup);
    this.scene.add(this.boardGroup);

    // 3. Camera
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    const viewSize = Math.max(rows, cols) + 1.8;
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

    // 4. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    // 5. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 15);
    this.scene.add(dirLight);

    // 6. Build background grid
    this.createBoardGrid(rows, cols);

    // 7. Resize handling
    window.addEventListener('resize', this.onResize);
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
      this.boardBackgroundGroup.remove(this.boardBackgroundGroup.children[0]);
    }

    // Outer board frame
    const boardWidth = cols * this.dimensions.cellSize + 0.3;
    const boardHeight = rows * this.dimensions.cellSize + 0.3;
    const frameGeo = new THREE.PlaneGeometry(boardWidth, boardHeight);
    const frameMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.9,
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.set(0, 0, -0.05);
    this.boardBackgroundGroup.add(frameMesh);

    // Individual tile backgrounds
    const tileGeo = new THREE.PlaneGeometry(0.92, 0.92);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isAlternate = (r + c) % 2 === 0;
        const tileMat = new THREE.MeshBasicMaterial({
          color: isAlternate ? 0x243247 : 0x1a2436,
          transparent: true,
          opacity: 0.85,
        });
        const tileMesh = new THREE.Mesh(tileGeo, tileMat);
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
    const width = this.container.clientWidth;
    const height = Math.max(1, this.container.clientHeight);
    const aspect = width / height;

    const { rows, cols } = this.dimensions;
    // Ensure board always fits with margin for HUD
    const boardW = cols + 1.2;
    const boardH = rows + 1.8;

    let viewWidth: number;
    let viewHeight: number;

    if (aspect >= boardW / boardH) {
      viewHeight = boardH;
      viewWidth = viewHeight * aspect;
    } else {
      viewWidth = boardW;
      viewHeight = viewWidth / aspect;
    }

    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
