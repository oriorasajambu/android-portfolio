import { writeStore } from './storage';

type Theme = 'light' | 'dark';

const current = (): Theme => (document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light');

export function initThemeToggle(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]');
  const sync = () => buttons.forEach((b) => b.setAttribute('aria-pressed', String(current() === 'dark')));
  sync();
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      const next: Theme = current() === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset['theme'] = next;
      writeStore('theme', next); // override persists only when storage is available
      sync();
      document.dispatchEvent(new CustomEvent('themechange', { detail: next }));
    }),
  );
}
