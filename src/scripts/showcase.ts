import { createViewerStore, type FeatureId, type ViewerState } from './viewer-state';
import type { PhoneScene, Pin } from './phone-scene';

interface StepConfig {
  id: string;
  title: string;
  caption: string;
  image: string;
  pins: Pin[];
}
interface FeatureConfig {
  id: FeatureId;
  label: string;
  study: string;
  steps: StepConfig[];
}

const mq = (q: string) => window.matchMedia(q).matches;
const pad = (n: number) => String(n).padStart(2, '0');

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

/** 3D waits for the visitor on phones, coarse pointers, reduced motion and Save-Data. */
function deviceNeedsOptIn(): boolean {
  return (
    mq('(max-width: 860px)') || mq('(pointer: coarse)') || mq('(prefers-reduced-motion: reduce)') || prefersSaveData()
  );
}

/** Whether 3D may start on its own. */
export function autoEnhanceAllowed(): boolean {
  return !deviceNeedsOptIn();
}

/** One line explaining why 3D is waiting. */
function optInReason(): string {
  if (mq('(prefers-reduced-motion: reduce)')) return 'Reduced motion is on, so 3D waits for you and never tilts.';
  if (prefersSaveData()) return 'Data saver is on, so 3D loads only when you choose it.';
  return 'Tap 3D to see the phone in 3D.';
}

export function initShowcase(root: HTMLElement): void {
  const configEl = root.querySelector<HTMLScriptElement>('[data-showcase-config]');
  if (!configEl) return;
  const features = JSON.parse(configEl.textContent || '[]') as FeatureConfig[];
  const byId = new Map(features.map((f) => [f.id, f]));

  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const screens = [...root.querySelectorAll<HTMLElement>('.screen')];
  const picks = [...root.querySelectorAll<HTMLButtonElement>('[data-pick]')];
  const stepBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-step-btn]')];
  const viewBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-view]')];
  const prev = $<HTMLButtonElement>('[data-prev]');
  const next = $<HTMLButtonElement>('[data-next]');
  const count = $<HTMLElement>('[data-count]');
  const title = $<HTMLElement>('[data-title]');
  const caption = $<HTMLElement>('[data-caption]');
  const notice = $<HTMLOListElement>('[data-notice]');
  const noticeHead = $<HTMLElement>('[data-notice-head]');
  const studyLink = $<HTMLAnchorElement>('[data-study-link]');
  const viewToggle = $<HTMLElement>('[data-view-toggle]');
  const fallback = $<HTMLElement>('[data-fallback]');
  const status = $<HTMLElement>('[data-status-msg]');
  const retry = $<HTMLButtonElement>('[data-retry]');
  const chip = $<HTMLElement>('[data-status-chip]');
  const hint = $<HTMLElement>('[data-hint]');
  const resetView = $<HTMLButtonElement>('[data-reset-view]');
  const stage = $<HTMLElement>('[data-stage]');
  const host = $<HTMLElement>('[data-canvas-host]');

  const store = createViewerStore({ feature: features[0]!.id, step: 0, mode: '2d', status: 'idle', message: '' });
  const webgl = supportsWebGL2();
  let scene: PhoneScene | null = null;
  let loadToken = 0;
  let lastFeature: FeatureId | null = null;

  const renderNotice = (pins: Pin[]) => {
    notice.replaceChildren(
      ...pins.map((p, i) => {
        const li = document.createElement('li');
        const num = document.createElement('span');
        num.className = 'num';
        num.setAttribute('aria-hidden', 'true');
        num.textContent = String(i + 1);
        const text = document.createElement('span');
        text.textContent = p.text;
        li.append(num, text);
        return li;
      }),
    );
  };

  const render = (s: ViewerState) => {
    const f = byId.get(s.feature)!;
    const step = f.steps[s.step]!;
    screens.forEach((el) => {
      const on = el.dataset['feature'] === s.feature && Number(el.dataset['step']) === s.step;
      if (on) el.setAttribute('data-active', '');
      else el.removeAttribute('data-active');
    });
    picks.forEach((b) => {
      const on = b.dataset['pick'] === s.feature;
      b.setAttribute('aria-pressed', String(on));
      if (on && lastFeature !== null && lastFeature !== s.feature) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    if (lastFeature !== s.feature) {
      stepBtns.forEach((b, i) => {
        b.querySelector('[data-step-title]')!.textContent = f.steps[i]?.title ?? '';
      });
      studyLink.href = f.study;
      studyLink.textContent = `Read the ${f.label} study →`;
      lastFeature = s.feature;
    }
    stepBtns.forEach((b, i) => {
      b.setAttribute('aria-current', i === s.step ? 'step' : 'false');
      b.toggleAttribute('data-done', i < s.step);
      b.setAttribute('aria-label', `Step ${i + 1} of ${f.steps.length}: ${f.steps[i]?.title ?? ''}`);
    });
    count.textContent = `${f.label} · ${pad(s.step + 1)} / ${pad(f.steps.length)}`;
    title.textContent = step.title;
    caption.textContent = step.caption;
    renderNotice(step.pins);
    noticeHead.hidden = step.pins.length === 0;
    prev.disabled = s.step === 0;
    next.disabled = s.step === f.steps.length - 1;

    root.dataset['mode'] = s.mode;
    root.dataset['viewerStatus'] = s.status;

    const fine = mq('(pointer: fine)');
    if (s.mode === '3d') hint.textContent = fine ? 'Drag to rotate · double-click to reset · ← → to step' : 'Drag sideways to spin the phone';
    else hint.textContent = webgl && s.status === 'idle' && deviceNeedsOptIn() ? optInReason() : '';
    if (s.mode !== '3d') resetView.hidden = true;

    if (!webgl) {
      viewToggle.hidden = true;
      chip.hidden = true;
      fallback.hidden = false;
      retry.hidden = true;
      status.textContent = '3D view is not available in this browser, so the illustrated screens are shown instead.';
      return;
    }
    viewToggle.hidden = false;
    viewBtns.forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset['view'] === s.mode));
      b.disabled = s.status === 'loading';
    });
    chip.hidden = s.status !== 'loading';
    chip.textContent = 'Loading 3D…';
    const failed = s.status === 'error';
    fallback.hidden = !failed;
    retry.hidden = !failed;
    status.textContent = failed ? s.message : '';
  };

  store.subscribe((s, p) => {
    render(s);
    if (scene && s.mode === '3d' && (s.feature !== p.feature || s.step !== p.step)) scene.show(s.feature, s.step);
  });
  render(store.get());

  const select = (feature: FeatureId, step: number) => store.set({ feature, step });
  const go = (delta: number) => {
    const s = store.get();
    const n = s.step + delta;
    if (n >= 0 && n < byId.get(s.feature)!.steps.length) select(s.feature, n);
  };
  picks.forEach((b) => b.addEventListener('click', () => select(b.dataset['pick'] as FeatureId, 0)));
  stepBtns.forEach((b) => b.addEventListener('click', () => select(store.get().feature, Number(b.dataset['stepBtn']))));
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  // Arrow keys step through screens while focus is inside the showcase (never a global handler).
  root.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      go(e.key === 'ArrowRight' ? 1 : -1);
    }
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
      const screensFor = Object.fromEntries(
        features.map((f) => [f.id, f.steps.map((st) => ({ url: st.image, pins: st.pins }))]),
      ) as Record<FeatureId, { url: string; pins: Pin[] }[]>;
      const s = store.get();
      const created = await createPhoneScene({
        host,
        stage,
        screens: screensFor,
        initial: { feature: s.feature, step: s.step },
        reducedMotion: () => mq('(prefers-reduced-motion: reduce)'),
        mobile: () => mq('(max-width: 860px)') || mq('(pointer: coarse)'),
        onFailure: (reason) => fail(reason),
        onPoseChange: (moved) => {
          resetView.hidden = !moved;
        },
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
      fail('3D couldn’t start, so the same screen is shown in 2D.');
    }
  };

  viewBtns.forEach((b) =>
    b.addEventListener('click', () => {
      const want = b.dataset['view'];
      const s = store.get();
      if (want === '2d' && (s.mode === '3d' || s.status === 'error')) {
        teardown();
        store.set({ mode: '2d', status: 'idle', message: '' });
      } else if (want === '3d' && s.mode !== '3d') {
        void enable3D();
      }
    }),
  );
  retry.addEventListener('click', () => void enable3D());
  resetView.addEventListener('click', () => scene?.resetView());

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

  document.addEventListener('themechange', () => scene?.setTheme(document.documentElement.dataset['theme'] === 'dark'));

  window.addEventListener('pagehide', () => {
    if (!scene && store.get().status !== 'loading') return;
    teardown();
    store.set({ mode: '2d', status: 'idle', message: '' });
  });

  // Hook for automated tests only.
  (root as HTMLElement & { __viewer?: unknown }).__viewer = { store, enable3D, getScene: () => scene };
}
