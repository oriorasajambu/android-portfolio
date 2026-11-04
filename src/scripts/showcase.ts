import { createViewerStore, type FeatureId, type ViewerState } from './viewer-state';
import type { PhoneScene } from './phone-scene';

interface StepConfig {
  id: string;
  title: string;
  caption: string;
  image: string;
}
interface FeatureConfig {
  id: FeatureId;
  label: string;
  steps: StepConfig[];
}

const mq = (q: string) => window.matchMedia(q).matches;

interface NetworkInformationLike {
  saveData?: boolean;
}

export function prefersSaveData(): boolean {
  const c = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  return Boolean(c?.saveData);
}

export function supportsWebGL2(): boolean {
  try {
    if (!('WebGL2RenderingContext' in window)) return false;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Decide whether 3D may start on its own, or needs an explicit "Enable 3D". */
export function autoEnhanceAllowed(): boolean {
  const narrow = mq('(max-width: 860px)');
  const coarse = mq('(pointer: coarse)');
  const reduced = mq('(prefers-reduced-motion: reduce)');
  return !narrow && !coarse && !reduced && !prefersSaveData();
}

export function initShowcase(root: HTMLElement): void {
  const configEl = root.querySelector<HTMLScriptElement>('[data-showcase-config]');
  if (!configEl) return;
  const features = JSON.parse(configEl.textContent || '[]') as FeatureConfig[];
  const byId = new Map(features.map((f) => [f.id, f]));

  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const screens = [...root.querySelectorAll<HTMLElement>('.screen')];
  const picks = [...root.querySelectorAll<HTMLButtonElement>('[data-pick]')];
  const prev = $<HTMLButtonElement>('[data-prev]');
  const next = $<HTMLButtonElement>('[data-next]');
  const count = $<HTMLElement>('[data-count]');
  const title = $<HTMLElement>('[data-title]');
  const caption = $<HTMLElement>('[data-caption]');
  const modeToggle = $<HTMLButtonElement>('[data-mode-toggle]');
  const status = $<HTMLElement>('[data-status-msg]');
  const modeNote = $<HTMLElement>('[data-mode-note]');
  const stage = $<HTMLElement>('[data-stage]');
  const host = $<HTMLElement>('[data-canvas-host]');

  const store = createViewerStore({ feature: features[0]!.id, step: 0, mode: '2d', status: 'idle', message: '' });
  const webgl = supportsWebGL2();
  let scene: PhoneScene | null = null;
  let loadToken = 0;

  const render = (s: ViewerState) => {
    const f = byId.get(s.feature)!;
    const step = f.steps[s.step]!;
    screens.forEach((el) => {
      const on = el.dataset['feature'] === s.feature && Number(el.dataset['step']) === s.step;
      if (on) el.setAttribute('data-active', '');
      else el.removeAttribute('data-active');
    });
    picks.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset['pick'] === s.feature)));
    count.textContent = `${f.label} · Step ${s.step + 1} of ${f.steps.length}`;
    title.textContent = step.title;
    caption.textContent = step.caption;
    prev.disabled = s.step === 0;
    next.disabled = s.step === f.steps.length - 1;

    root.dataset['mode'] = s.mode;
    root.dataset['viewerStatus'] = s.status;
    modeNote.textContent = s.mode === '3d' ? '3D view' : '2D view';

    if (!webgl) {
      modeToggle.hidden = true;
      status.textContent = '3D view is not available in this browser, so the illustrated screens are shown instead.';
      return;
    }
    modeToggle.hidden = false;
    modeToggle.disabled = s.status === 'loading';
    if (s.status === 'loading') {
      modeToggle.textContent = 'Loading 3D…';
      status.textContent = 'Loading the 3D view…';
    } else if (s.status === 'error') {
      modeToggle.textContent = 'Retry 3D';
      status.textContent = s.message;
    } else if (s.mode === '3d') {
      modeToggle.textContent = 'Use 2D view';
      status.textContent = '';
    } else {
      modeToggle.textContent = 'Enable 3D';
      status.textContent = '';
    }
  };

  store.subscribe((s, p) => {
    render(s);
    if (scene && s.mode === '3d' && (s.feature !== p.feature || s.step !== p.step)) scene.show(s.feature, s.step);
  });
  render(store.get());

  const select = (feature: FeatureId, step: number) => store.set({ feature, step });
  picks.forEach((b) => b.addEventListener('click', () => select(b.dataset['pick'] as FeatureId, 0)));
  prev.addEventListener('click', () => {
    const s = store.get();
    if (s.step > 0) select(s.feature, s.step - 1);
  });
  next.addEventListener('click', () => {
    const s = store.get();
    if (s.step < byId.get(s.feature)!.steps.length - 1) select(s.feature, s.step + 1);
  });

  const teardown = () => {
    loadToken++;
    scene?.dispose();
    scene = null;
  };

  const fail = (message: string) => {
    teardown();
    store.set({ mode: '2d', status: 'error', message });
  };

  const enable3D = async () => {
    if (!webgl || store.get().status === 'loading' || scene) return;
    const token = ++loadToken;
    store.set({ status: 'loading', message: '' });
    try {
      const { createPhoneScene } = await import('./phone-scene');
      if (token !== loadToken) return;
      const textures = Object.fromEntries(features.map((f) => [f.id, f.steps.map((st) => st.image)])) as Record<FeatureId, string[]>;
      const s = store.get();
      const created = await createPhoneScene({
        host,
        stage,
        textures,
        initial: { feature: s.feature, step: s.step },
        reducedMotion: () => mq('(prefers-reduced-motion: reduce)'),
        mobile: () => mq('(max-width: 860px)') || mq('(pointer: coarse)'),
        onFailure: (reason) => fail(reason),
      });
      if (token !== loadToken) {
        created.dispose();
        return;
      }
      scene = created;
      const now = store.get();
      scene.show(now.feature, now.step, { instant: true });
      store.set({ mode: '3d', status: 'ready', message: '' });
    } catch (err) {
      if (token !== loadToken) return;
      console.warn('[showcase] 3D unavailable:', err);
      fail('The 3D view could not start, so the illustrated screens are shown instead.');
    }
  };

  modeToggle.addEventListener('click', () => {
    const s = store.get();
    if (s.mode === '3d') {
      teardown();
      store.set({ mode: '2d', status: 'idle' });
    } else {
      void enable3D();
    }
  });

  // Automatic enhancement: desktop-class devices only, after content settles and the showcase is visible.
  if (webgl && autoEnhanceAllowed()) {
    const ric = window.requestIdleCallback as typeof window.requestIdleCallback | undefined;
    const whenIdle = (fn: () => void) => (ric ? ric(fn, { timeout: 2500 }) : window.setTimeout(fn, 1200));
    const start = () =>
      whenIdle(() => {
        const io = new IntersectionObserver((entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            io.disconnect();
            if (store.get().status === 'idle' && autoEnhanceAllowed()) void enable3D();
          }
        });
        io.observe(stage);
      });
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
  }

  window.addEventListener('pagehide', () => {
    if (!scene && store.get().status !== 'loading') return;
    teardown();
    store.set({ mode: '2d', status: 'idle', message: '' });
  });

  // Hook for automated tests only.
  (root as HTMLElement & { __viewer?: unknown }).__viewer = { store, enable3D, getScene: () => scene };
}
