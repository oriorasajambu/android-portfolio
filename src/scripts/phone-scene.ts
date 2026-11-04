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
  CylinderGeometry,
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

/** A numbered callout on a screen; x/y are percentages of the screen. */
export interface Pin {
  x: number;
  y: number;
  text: string;
}

export interface PhoneSceneOptions {
  host: HTMLElement;
  /** Element that receives pointer tilt. */
  stage: HTMLElement;
  screens: Record<FeatureId, { url: string; pins: Pin[] }[]>;
  initial: { feature: FeatureId; step: number };
  reducedMotion: () => boolean;
  mobile: () => boolean;
  onFailure: (message: string) => void;
  /** Called when the visitor's rotation moves away from, or returns to, the resting pose. */
  onPoseChange?: (moved: boolean) => void;
}

export interface PhoneScene {
  show(feature: FeatureId, step: number, opts?: { instant?: boolean }): void;
  setTheme(dark: boolean): void;
  /** Ease back to the resting pose. */
  resetView(): void;
  /** Current visitor rotation in radians (for tests). */
  getPose(): { yaw: number; pitch: number };
  dispose(): void;
}

const PHONE_W = 1.8;
const PHONE_H = PHONE_W * (760 / 360) + 0.12;
const SCREEN_W = PHONE_W - 0.1;
const SCREEN_H = SCREEN_W * (760 / 360);
const MAX_TILT = 0.2; // radians, pointer range
const REST_X = 0.08; // resting pose: a slight three-quarter view
const REST_Y = -0.24;
const TURN_KICK = 0.14; // small turn on each step change
const DRAG_YAW = 0.011; // radians per CSS px
const DRAG_PITCH = 0.008;
const MAX_PITCH = 0.7;
const FRICTION = 0.93; // inertia decay per frame
const TAU = Math.PI * 2;
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

function drawPins(ctx: CanvasRenderingContext2D, pins: Pin[]) {
  pins.forEach((p, i) => {
    const x = (p.x / 100) * TEX_W;
    const y = (p.y / 100) * TEX_H;
    ctx.beginPath();
    ctx.arc(x, y, 50, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(22, 101, 52, 0.25)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 38, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 33, 0, Math.PI * 2);
    ctx.fillStyle = '#166534';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = "800 34px 'Manrope Variable', 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), x, y + 1);
  });
}

/** Rasterize an illustration (SVG) plus its pins into a canvas texture with rounded screen corners. */
async function loadScreenTexture(url: string, pins: Pin[], maxAnisotropy: number): Promise<Texture> {
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
    drawPins(ctx, pins);
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
    await document.fonts?.ready;
    for (const [feature, list] of Object.entries(opts.screens) as [FeatureId, { url: string; pins: Pin[] }[]][]) {
      textures[feature] = await Promise.all(list.map((sc) => loadScreenTexture(sc.url, sc.pins, maxAniso)));
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
  // Soft green rim from behind-left; only lit in the dark theme.
  const rim = new DirectionalLight(new Color('#86efac'), 0);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

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
  const bodyMat = track(new MeshStandardMaterial({ color: '#1d2621', roughness: 0.45, metalness: 0.35 }));
  const body = new Mesh(bodyGeo, bodyMat);
  phone.add(body);

  const screenGeo = track(new PlaneGeometry(SCREEN_W, SCREEN_H));
  const screenA = new MeshBasicMaterial({ map: textures[opts.initial.feature]?.[opts.initial.step] ?? null, transparent: true, toneMapped: false });
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
  const volBtn = new Mesh(btnGeo, btnMat);
  volBtn.scale.set(1, 0.6, 1);
  volBtn.position.set(PHONE_W / 2 + 0.04, 0.25, -0.05);
  phone.add(volBtn);

  // Back of the phone: a camera module, so spinning it around shows a real back.
  const BACK_Z = -0.1 - 0.04; // body back face incl. bevel
  const moduleMat = track(new MeshStandardMaterial({ color: '#141a16', roughness: 0.3, metalness: 0.5 }));
  const moduleGeo = track(
    new ExtrudeGeometry(roundedRect(0.66, 0.66, 0.16), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 }),
  );
  const cameraModule = new Mesh(moduleGeo, moduleMat);
  cameraModule.position.set(PHONE_W / 2 - 0.5, PHONE_H / 2 - 0.5, BACK_Z - 0.05);
  phone.add(cameraModule);
  const lensGeo = track(new CylinderGeometry(0.11, 0.11, 0.04, 32));
  const lensMat = track(new MeshStandardMaterial({ color: '#05080a', roughness: 0.1, metalness: 0.8 }));
  const ringMat = track(new MeshStandardMaterial({ color: '#56625b', roughness: 0.35, metalness: 0.9 }));
  const ringGeo = track(new CylinderGeometry(0.135, 0.135, 0.03, 32));
  const lensSpots: [number, number][] = [[-0.14, 0.14], [0.14, 0.14], [-0.14, -0.14]];
  for (const [dx, dy] of lensSpots) {
    const ring = new Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(cameraModule.position.x + dx, cameraModule.position.y + dy, BACK_Z - 0.07);
    const lens = new Mesh(lensGeo, lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(ring.position.x, ring.position.y, BACK_Z - 0.08);
    phone.add(ring, lens);
  }
  const flashGeo = track(new CylinderGeometry(0.04, 0.04, 0.02, 20));
  const flash = new Mesh(flashGeo, track(new MeshStandardMaterial({ color: '#e8e2c8', roughness: 0.4, emissive: '#3a3628' })));
  flash.rotation.x = Math.PI / 2;
  flash.position.set(cameraModule.position.x + 0.14, cameraModule.position.y - 0.14, BACK_Z - 0.07);
  phone.add(flash);

  host.replaceChildren(canvas);
  canvas.style.cursor = 'grab';

  // ---------- rendering on demand ----------
  let visible = true;
  let pageVisible = document.visibilityState === 'visible';
  let frame = 0;
  let disposed = false;
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  // Visitor rotation (drag / flick). yaw spins freely; pitch is clamped.
  const user = { yaw: 0, pitch: 0, vy: 0, vp: 0, scale: 1 };
  let drag: { id: number; x: number; y: number; type: string } | null = null;
  let resetting = false;
  let moved = false;
  const notifyPose = () => {
    const rel = ((user.yaw % TAU) + TAU) % TAU;
    const off = Math.min(rel, TAU - rel) > 0.03 || Math.abs(user.pitch) > 0.03;
    if (off !== moved) {
      moved = off;
      opts.onPoseChange?.(moved);
    }
  };
  let fade: { from: number; start: number; dur: number } | null = null;

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.mobile() ? 1 : 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Fit the phone height into view.
    const t = Math.tan((camera.fov * Math.PI) / 360);
    camera.position.z = Math.max((PHONE_H / 2 + 0.5) / t, (PHONE_W / 2 + 0.4) / (t * camera.aspect));
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

    const reduced = opts.reducedMotion();
    if (resetting) {
      const target = Math.round(user.yaw / TAU) * TAU;
      const r = reduced ? 1 : 0.16;
      user.yaw += (target - user.yaw) * r;
      user.pitch += (0 - user.pitch) * r;
      if (Math.abs(target - user.yaw) < 1e-3 && Math.abs(user.pitch) < 1e-3) {
        user.yaw = 0;
        user.pitch = 0;
        resetting = false;
      } else animating = true;
    } else if (!drag && (Math.abs(user.vy) > 1e-4 || Math.abs(user.vp) > 1e-4)) {
      user.yaw += user.vy;
      user.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, user.pitch + user.vp));
      user.vy *= FRICTION;
      user.vp *= FRICTION;
      animating = true;
    }
    const targetScale = drag && !reduced ? 1.035 : 1;
    user.scale += (targetScale - user.scale) * (reduced ? 1 : 0.2);
    if (Math.abs(targetScale - user.scale) > 1e-4) animating = true;
    phone.scale.setScalar(user.scale);
    phone.rotation.set(REST_X + tilt.x + user.pitch, REST_Y + tilt.y + user.yaw, 0);
    notifyPose();

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
    if (drag || e.pointerType !== 'mouse' || opts.reducedMotion()) return;
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

  // ---------- drag to rotate (mouse: both axes; touch: sideways only, vertical scroll stays native) ----------
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, type: e.pointerType };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointers may not be capturable */
    }
    resetting = false;
    user.vy = 0;
    user.vp = 0;
    tilt.tx = 0;
    tilt.ty = 0;
    canvas.style.cursor = 'grabbing';
    request();
  };
  const onDrag = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    user.yaw += dx * DRAG_YAW;
    user.vy = dx * DRAG_YAW;
    if (drag.type !== 'touch') {
      user.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, user.pitch + dy * DRAG_PITCH));
      user.vp = dy * DRAG_PITCH;
    }
    request();
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    canvas.style.cursor = 'grab';
    if (opts.reducedMotion() || e.type === 'pointercancel') {
      user.vy = 0;
      user.vp = 0;
    }
    request();
  };
  const reset = () => {
    user.vy = 0;
    user.vp = 0;
    resetting = true;
    request();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onDrag);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('dblclick', reset);

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

  const darkNow = document.documentElement.dataset['theme'] === 'dark';
  rim.intensity = darkNow ? 3.2 : 0;
  bodyMat.color.set(darkNow ? '#3a4740' : '#1d2621');
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
        tilt.y -= TURN_KICK; // eases back to the resting pose
      }
      request();
    },
    resetView: reset,
    getPose: () => ({ yaw: user.yaw, pitch: user.pitch }),
    setTheme(dark) {
      rim.intensity = dark ? 3.2 : 0;
      bodyMat.color.set(dark ? '#3a4740' : '#1d2621');
      request();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onDrag);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('dblclick', reset);
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
