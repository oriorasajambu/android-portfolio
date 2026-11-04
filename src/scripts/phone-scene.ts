/**
 * Procedural phone showcase. Loaded only via dynamic import so Three.js never
 * counts against the initial JavaScript budget.
 *
 * Renders on demand (state changes, tilt easing, resize) and pauses while
 * offscreen or backgrounded. All GPU resources and listeners are released in dispose().
 */
import {
  CanvasTexture,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Shape,
  SRGBColorSpace,
  WebGLRenderer,
  type Material,
  type BufferGeometry,
  type Texture,
} from 'three';
import type { FeatureId } from './viewer-state';

export interface PhoneSceneOptions {
  host: HTMLElement;
  /** Element that receives pointer tilt. */
  stage: HTMLElement;
  textures: Record<FeatureId, string[]>;
  initial: { feature: FeatureId; step: number };
  reducedMotion: () => boolean;
  mobile: () => boolean;
  onFailure: (message: string) => void;
}

export interface PhoneScene {
  show(feature: FeatureId, step: number, opts?: { instant?: boolean }): void;
  dispose(): void;
}

const PHONE_W = 1.8;
const PHONE_H = PHONE_W * (760 / 360) + 0.12;
const SCREEN_W = PHONE_W - 0.1;
const SCREEN_H = SCREEN_W * (760 / 360);
const MAX_TILT = 0.2; // radians
const TEX_W = 720;
const TEX_H = 1520;

function roundedRect(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Rasterize an illustration (SVG) into a canvas texture with rounded screen corners. */
async function loadScreenTexture(url: string, maxAnisotropy: number): Promise<Texture> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Texture request failed (${res.status}): ${url}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = objectUrl;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    ctx.fillStyle = '#0d120f';
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, TEX_W, TEX_H, 64);
    ctx.clip();
    ctx.drawImage(img, 0, 0, TEX_W, TEX_H);
    ctx.restore();
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.anisotropy = Math.min(4, maxAnisotropy);
    return tex;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function createPhoneScene(opts: PhoneSceneOptions): Promise<PhoneScene> {
  const { host, stage, onFailure } = opts;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset['phoneCanvas'] = '';

  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, powerPreference: 'low-power' });
  if (!gl) throw new Error('WebGL 2 context unavailable');

  const renderer = new WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;

  const disposables: { dispose(): void }[] = [];
  const track = <T extends Material | BufferGeometry | Texture>(x: T): T => (disposables.push(x), x);

  // Load every screen first: any failure falls back to the matching 2D view.
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const textures = {} as Record<FeatureId, Texture[]>;
  try {
    for (const [feature, urls] of Object.entries(opts.textures) as [FeatureId, string[]][]) {
      textures[feature] = await Promise.all(urls.map((u) => loadScreenTexture(u, maxAniso)));
    }
  } catch (err) {
    Object.values(textures).flat().forEach((t) => t.dispose());
    renderer.dispose();
    throw err;
  }
  Object.values(textures).flat().forEach((t) => track(t));

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 9.2);

  scene.add(new HemisphereLight(new Color('#f4fff7'), new Color('#1a221d'), 1.6));
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 6);
  scene.add(key);

  const phone = new Group();
  scene.add(phone);

  const bodyGeo = track(
    new ExtrudeGeometry(roundedRect(PHONE_W, PHONE_H, 0.26), {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 4,
      curveSegments: 12,
    }),
  );
  bodyGeo.translate(0, 0, -0.1);
  const body = new Mesh(bodyGeo, track(new MeshStandardMaterial({ color: '#1d2621', roughness: 0.45, metalness: 0.35 })));
  phone.add(body);

  const screenGeo = track(new PlaneGeometry(SCREEN_W, SCREEN_H));
  const screenA = new MeshBasicMaterial({ map: textures[opts.initial.feature][opts.initial.step] ?? null, transparent: true, toneMapped: false });
  const screenB = new MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false });
  track(screenA);
  track(screenB);
  const front = new Mesh(screenGeo, screenA);
  front.position.z = 0.102;
  const overlay = new Mesh(screenGeo, screenB);
  overlay.position.z = 0.104;
  phone.add(front, overlay);

  const btnMat = track(new MeshStandardMaterial({ color: '#2a352f', roughness: 0.5, metalness: 0.4 }));
  const btnGeo = track(new ExtrudeGeometry(roundedRect(0.05, 0.5, 0.02), { depth: 0.1, bevelEnabled: false }));
  const sideBtn = new Mesh(btnGeo, btnMat);
  sideBtn.position.set(PHONE_W / 2 + 0.04, 0.9, -0.05);
  phone.add(sideBtn);

  host.replaceChildren(canvas);

  // ---------- rendering on demand ----------
  let visible = true;
  let pageVisible = document.visibilityState === 'visible';
  let frame = 0;
  let disposed = false;
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  let fade: { from: number; start: number; dur: number } | null = null;

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.mobile() ? 1 : 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Fit the phone height into view.
    const t = Math.tan((camera.fov * Math.PI) / 360);
    camera.position.z = Math.max((PHONE_H / 2 + 0.3) / t, (PHONE_W / 2 + 0.4) / (t * camera.aspect));
    camera.updateProjectionMatrix();
  };

  const tick = (now: number) => {
    frame = 0;
    if (disposed) return;
    let animating = false;

    const k = opts.reducedMotion() ? 1 : 0.14;
    tilt.x += (tilt.tx - tilt.x) * k;
    tilt.y += (tilt.ty - tilt.y) * k;
    if (Math.abs(tilt.tx - tilt.x) > 1e-4 || Math.abs(tilt.ty - tilt.y) > 1e-4) animating = true;
    phone.rotation.set(tilt.x, tilt.y - 0.12, 0);

    if (fade) {
      const t = Math.min(1, (now - fade.start) / fade.dur);
      screenB.opacity = t;
      if (t >= 1) {
        screenA.map = screenB.map;
        screenA.needsUpdate = true;
        screenB.opacity = 0;
        fade = null;
      } else animating = true;
    }

    renderer.render(scene, camera);
    if (animating) request();
  };

  const request = () => {
    if (disposed || frame || !visible || !pageVisible) return;
    frame = requestAnimationFrame(tick);
  };

  // ---------- pointer tilt (fine pointers, motion allowed) ----------
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || opts.reducedMotion()) return;
    const r = stage.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    tilt.ty = Math.max(-1, Math.min(1, nx)) * MAX_TILT;
    tilt.tx = Math.max(-1, Math.min(1, ny)) * MAX_TILT * 0.6;
    request();
  };
  const onLeave = () => {
    tilt.tx = 0;
    tilt.ty = 0;
    request();
  };
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerleave', onLeave);

  const ro = new ResizeObserver(() => {
    resize();
    request();
  });
  ro.observe(host);

  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    request();
  });
  io.observe(host);

  const onVisibility = () => {
    pageVisible = document.visibilityState === 'visible';
    request();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const onLost = (e: Event) => {
    e.preventDefault();
    onFailure('The 3D view lost its graphics context, so the illustrated screens are shown instead.');
  };
  canvas.addEventListener('webglcontextlost', onLost);

  resize();
  request();

  return {
    show(feature, step, o = {}) {
      const tex = textures[feature]?.[step];
      if (!tex || disposed) return;
      if (o.instant || opts.reducedMotion()) {
        fade = null;
        screenA.map = tex;
        screenA.needsUpdate = true;
        screenB.opacity = 0;
      } else {
        if (fade) {
          screenA.map = screenB.map;
          screenA.needsUpdate = true;
        }
        screenB.map = tex;
        screenB.needsUpdate = true;
        screenB.opacity = 0;
        fade = { from: 0, start: performance.now(), dur: 260 };
      }
      request();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      ro.disconnect();
      io.disconnect();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      canvas.remove();
    },
  };
}
