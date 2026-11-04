/**
 * Shared showcase state. The HTML gallery and the Three.js scene both render from this,
 * so feature/step selection survives switching modes or recovering from a 3D failure.
 */
export type FeatureId = 'qr' | 'cards';
export type DisplayMode = '2d' | '3d';
export type Status = 'idle' | 'loading' | 'ready' | 'error';

export interface ViewerState {
  feature: FeatureId;
  step: number;
  mode: DisplayMode;
  status: Status;
  /** Human-readable reason when status is 'error'. */
  message: string;
}

type Listener = (state: ViewerState, prev: ViewerState) => void;

export interface ViewerStore {
  get(): ViewerState;
  set(patch: Partial<ViewerState>): void;
  subscribe(fn: Listener): () => void;
}

export function createViewerStore(initial: ViewerState): ViewerStore {
  let state = { ...initial };
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(patch) {
      const prev = state;
      const next = { ...state, ...patch };
      if ((Object.keys(next) as (keyof ViewerState)[]).every((k) => next[k] === prev[k])) return;
      state = next;
      listeners.forEach((fn) => fn(state, prev));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
