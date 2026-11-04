import { expect, test, type Page } from '@playwright/test';

const showcase = (page: Page) => page.locator('[data-showcase]');
const activeScreen = (page: Page) => page.locator('.screen[data-active]');
const view3d = (page: Page) => page.locator('[data-view="3d"]');
const view2d = (page: Page) => page.locator('[data-view="2d"]');
const viewToggle = (page: Page) => page.locator('[data-view-toggle]');
const retryBtn = (page: Page) => page.locator('[data-retry]');
const statusMsg = (page: Page) => page.locator('[data-status-msg]');

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function waitFor3D(page: Page) {
  await expect(showcase(page)).toHaveAttribute('data-mode', '3d', { timeout: 20_000 });
  await expect(page.locator('[data-phone-canvas]')).toBeAttached();
}

test.describe('navigation', () => {
  test('home renders hero, sections and study links', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1, name: 'Rio Wirawan' })).toBeVisible();
    for (const id of ['work', 'capabilities', 'experience', 'contact']) await expect(page.locator(`#${id}`)).toBeAttached();
    await page.getByRole('link', { name: 'QR payments and receipt feedback' }).click();
    await expect(page).toHaveURL(/\/android-portfolio\/work\/qr-payments\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('QR payments and receipt feedback');
    expect(errors).toEqual([]);
  });

  for (const slug of ['qr-payments', 'card-management']) {
    test(`direct study URL and refresh: ${slug}`, async ({ page }) => {
      const res = await page.goto(`work/${slug}/`);
      expect(res?.status()).toBe(200);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Illustration · synthetic data · not the production app')).toBeVisible();
      await expect(page.locator('.seq img')).toHaveCount(3);
    });
  }

  test('unknown URL shows recovery links', async ({ page }) => {
    await page.goto('does-not-exist/');
    await expect(page.getByRole('heading', { name: "This page isn't here." })).toBeVisible();
    await page.getByRole('link', { name: 'Card management under partial failure' }).click();
    await expect(page).toHaveURL(/work\/card-management\/$/);
  });

  test('skip link moves focus to main content', async ({ page }) => {
    await page.goto('./');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('every image has alternative text', async ({ page }) => {
    for (const path of ['./', 'work/qr-payments/', 'work/card-management/']) {
      await page.goto(path);
      expect(await page.locator('img:not([alt])').count(), path).toBe(0);
      // Content images need a real description; empty alt is only for decorative previews.
      expect(await page.locator('.screen img[alt=""], .seq img[alt=""], .diagram img[alt=""]').count(), path).toBe(0);
    }
  });
});

test.describe('showcase selection', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } }); // keep 2D for these checks

  test('feature and step controls update screen and caption', async ({ page }) => {
    await page.goto('./');
    await expect(activeScreen(page)).toHaveAttribute('data-feature', 'qr');
    await expect(page.locator('[data-prev]')).toBeDisabled();
    await page.locator('[data-next]').click();
    await expect(page.locator('[data-count]')).toHaveText('QR payments · 02 / 03');
    await expect(page.locator('[data-notice] li')).toHaveCount(2);
    await expect(page.locator('[data-notice]')).toContainText('explicit waiting state');
    await expect(page.locator('[data-step-btn="1"]')).toHaveAttribute('aria-current', 'step');
    await expect(page.locator('[data-title]')).toHaveText('Awaiting confirmation');
    await expect(activeScreen(page)).toHaveAttribute('data-step', '1');
    await page.locator('[data-next]').click();
    await expect(page.locator('[data-next]')).toBeDisabled();

    await page.getByRole('button', { name: 'Card management' }).click();
    await expect(page.getByRole('button', { name: 'Card management' })).toHaveAttribute('aria-pressed', 'true');
    await expect(activeScreen(page)).toHaveAttribute('data-feature', 'cards');
    await expect(activeScreen(page)).toHaveAttribute('data-step', '0');
    await expect(page.locator('[data-title]')).toHaveText('Card information');
    await expect(page.locator('[data-step-btn="0"] [data-step-title]')).toHaveText('Card information');
    await expect(page.locator('[data-study-link]')).toHaveAttribute('href', /work\/card-management\/$/);
    await expect(activeScreen(page).locator('img')).toBeVisible();
  });

  test('step rail jumps directly to a screen', async ({ page }) => {
    await page.goto('./');
    await page.locator('[data-step-btn="2"]').click();
    await expect(page.locator('[data-title]')).toHaveText('Receipt feedback');
    await expect(page.locator('[data-step-btn="0"]')).toHaveAttribute('data-done', '');
    await expect(page.locator('[data-next]')).toBeDisabled();
  });

  test('arrow keys step while focus is in the showcase', async ({ page }) => {
    await page.goto('./');
    await page.locator('[data-pick="qr"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-title]')).toHaveText('Awaiting confirmation');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-title]')).toHaveText('Present the code');
  });

  test('controls work from the keyboard', async ({ page }) => {
    await page.goto('./');
    await page.locator('[data-next]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-title]')).toHaveText('Awaiting confirmation');
  });
});

test.describe('3D enhancement', () => {
  test('desktop auto-loads 3D and preserves selection when switching modes', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('./');
    await waitFor3D(page);
    await page.getByRole('button', { name: 'Card management' }).click();
    await page.locator('[data-next]').click();
    await expect(view3d(page)).toHaveAttribute('aria-pressed', 'true');
    await view2d(page).click();
    await expect(showcase(page)).toHaveAttribute('data-mode', '2d');
    await expect(page.locator('[data-phone-canvas]')).toHaveCount(0);
    await expect(activeScreen(page)).toHaveAttribute('data-feature', 'cards');
    await expect(activeScreen(page)).toHaveAttribute('data-step', '1');
    await expect(activeScreen(page).locator('img')).toBeVisible();
    await view3d(page).click();
    await waitFor3D(page);
    await expect(page.locator('[data-title]')).toHaveText('Partial-data failure');
    expect(errors).toEqual([]);
  });

  test('missing WebGL 2 keeps the 2D view with an explanation', async ({ page }) => {
    await page.addInitScript(() => {
      const proto = HTMLCanvasElement.prototype as unknown as { getContext: (type: string, ...rest: unknown[]) => unknown };
      const orig = proto.getContext;
      proto.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return type === 'webgl2' ? null : orig.call(this, type, ...rest);
      };
    });
    await page.goto('./');
    await expect(statusMsg(page)).toContainText('3D view is not available');
    await expect(viewToggle(page)).toBeHidden();
    await expect(retryBtn(page)).toBeHidden();
    await expect(showcase(page)).toHaveAttribute('data-mode', '2d');
    await expect(activeScreen(page).locator('img')).toBeVisible();
  });

  test('texture failure falls back to 2D, keeps selection, and retry recovers', async ({ page }) => {
    await page.route('**/showcase/*.svg', (route) =>
      route.request().resourceType() === 'fetch' ? route.abort() : route.continue(),
    );
    await page.goto('./');
    await page.locator('[data-next]').click();
    await expect(showcase(page)).toHaveAttribute('data-viewer-status', 'error', { timeout: 20_000 });
    await expect(showcase(page)).toHaveAttribute('data-mode', '2d');
    await expect(statusMsg(page)).toContainText('couldn’t start');
    await expect(activeScreen(page)).toHaveAttribute('data-step', '1');
    await expect(activeScreen(page).locator('img')).toBeVisible();
    await expect(retryBtn(page)).toBeVisible();

    await page.unroute('**/showcase/*.svg');
    await retryBtn(page).click();
    await waitFor3D(page);
    await expect(page.locator('[data-title]')).toHaveText('Awaiting confirmation');
  });

  test('renderer failure during initialization falls back to 2D', async ({ page }) => {
    await page.route('**/_astro/phone-scene.*.js', (route) => route.abort());
    await page.goto('./');
    await expect(showcase(page)).toHaveAttribute('data-viewer-status', 'error', { timeout: 20_000 });
    await expect(activeScreen(page).locator('img')).toBeVisible();
  });

  test('context loss returns to the matching 2D view', async ({ page }) => {
    await page.goto('./');
    await waitFor3D(page);
    await page.getByRole('button', { name: 'Card management' }).click();
    await page.locator('[data-next]').click();
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-phone-canvas]')!;
      canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();
    });
    await expect(showcase(page)).toHaveAttribute('data-mode', '2d');
    await expect(statusMsg(page)).toContainText('lost its graphics context');
    await expect(activeScreen(page)).toHaveAttribute('data-feature', 'cards');
    await expect(activeScreen(page)).toHaveAttribute('data-step', '1');
    await expect(page.locator('[data-phone-canvas]')).toHaveCount(0);
  });

  test('reduced motion requires explicit activation', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1366, height: 860 } });
    const page = await context.newPage();
    await page.goto('./');
    await page.waitForTimeout(3500);
    await expect(showcase(page)).toHaveAttribute('data-mode', '2d');
    await expect(view2d(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-hint]')).toContainText('Reduced motion');
    await view3d(page).click();
    await waitFor3D(page);
    await context.close();
  });

  test('Save-Data requires explicit activation', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', { configurable: true, get: () => ({ saveData: true }) });
    });
    await page.goto('./');
    await page.waitForTimeout(3500);
    await expect(showcase(page)).toHaveAttribute('data-mode', '2d');
    await expect(view2d(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-hint]')).toContainText('Data saver');
  });

  test('narrow touch viewport waits for "Enable 3D" and keeps vertical scrolling', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = trackErrors(page);
    await page.goto('./');
    await page.waitForTimeout(3500);
    await expect(showcase(page)).toHaveAttribute('data-mode', '2d');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await view3d(page).scrollIntoViewIfNeeded();
    await view3d(page).tap();
    await waitFor3D(page);
    const touchAction = await page.locator('[data-phone-canvas]').evaluate((c) => getComputedStyle(c).touchAction);
    expect(touchAction).toBe('pan-y');
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
    expect(errors).toEqual([]);
    await context.close();
  });

  test('viewport changes resize the scene without errors', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('./');
    await waitFor3D(page);
    const w1 = await page.locator('[data-phone-canvas]').evaluate((c: HTMLCanvasElement) => c.width);
    await page.setViewportSize({ width: 700, height: 900 });
    await expect.poll(() => page.locator('[data-phone-canvas]').evaluate((c: HTMLCanvasElement) => c.width)).not.toBe(w1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('theme', () => {
  test('toggle switches theme and persists across reloads', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.locator('[data-theme-toggle]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('[data-theme-toggle]')).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('follows the system preference by default', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('works when browser storage is unavailable', async ({ page }) => {
    const errors = trackErrors(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('./');
    await page.locator('[data-theme-toggle]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(errors).toEqual([]);
  });
});

test.describe('contact and CV', () => {
  test('CV downloads as a PDF', async ({ page }) => {
    await page.goto('./');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download CV' }).first().click()]);
    expect(download.suggestedFilename()).toBe('rio-wirawan-cv.pdf');
    const res = await page.request.get('rio-wirawan-cv.pdf');
    expect(res.status()).toBe(200);
    expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('copy email succeeds when clipboard is available', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('./');
    await page.getByRole('button', { name: 'Copy email' }).click();
    await expect(page.locator('[data-copy-feedback]')).toHaveText('Email address copied.');
  });

  test('copy email falls back to a selected address when clipboard fails', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        get: () => ({ writeText: () => Promise.reject(new Error('denied')) }),
      });
    });
    await page.goto('./');
    await page.getByRole('button', { name: 'Copy email' }).click();
    await expect(page.locator('[data-copy-feedback]')).toContainText('selected');
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('riowirawan19@gmail.com');
    await expect(page.getByRole('link', { name: 'Email me' })).toHaveAttribute('href', 'mailto:riowirawan19@gmail.com');
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('home shows the complete ordered screen sequence and content', async ({ page }) => {
    await page.goto('./');
    const screens = page.locator('.screen');
    await expect(screens).toHaveCount(6);
    for (let i = 0; i < 6; i++) await expect(screens.nth(i).locator('img')).toBeVisible();
    await expect(page.locator('.screen figcaption').first()).toContainText('QR payments · 1/3');
    await expect(page.locator('.screen figcaption').nth(5)).toContainText('Card management · 3/3');
    await expect(page.locator('[data-theme-toggle]')).toBeHidden();
    await expect(page.locator('.caption')).toBeHidden();
    await expect(page.locator('.rail')).toBeHidden();
    await expect(page.locator('.pin').first()).toBeHidden();
    await expect(page.locator('.fc-pins').first()).toContainText('Source account confirmed');
    await expect(page.getByRole('heading', { name: 'Experience', exact: true })).toBeVisible();
    await expect(page.getByText('riowirawan19@gmail.com').first()).toBeVisible();
  });

  test('study pages are complete', async ({ page }) => {
    await page.goto('work/card-management/');
    await expect(page.getByRole('heading', { name: 'Loading, partial failure, and recovery' })).toBeVisible();
    await expect(page.locator('.seq img')).toHaveCount(3);
  });
});

test.describe('3D interaction', () => {
  const pose = (page: Page) =>
    page.evaluate(() => {
      const root = document.querySelector('[data-showcase]') as HTMLElement & { __viewer: { getScene(): { getPose(): { yaw: number; pitch: number } } | null } };
      return root.__viewer.getScene()?.getPose() ?? null;
    });

  test('dragging rotates the phone and Reset view returns it', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('./');
    await waitFor3D(page);
    const box = (await page.locator('[data-phone-canvas]').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 120, cy + 30, { steps: 8 });
    await page.mouse.up();
    const moved = (await pose(page))!;
    expect(moved.yaw).toBeGreaterThan(0.8);
    expect(moved.pitch).toBeGreaterThan(0.1);
    await expect(page.locator('[data-reset-view]')).toBeVisible();

    await page.locator('[data-reset-view]').click();
    await expect.poll(async () => Math.abs((await pose(page))!.yaw % (Math.PI * 2)), { timeout: 5000 }).toBeLessThan(0.01);
    await expect(page.locator('[data-reset-view]')).toBeHidden();
    // Stepping still works after rotating.
    await page.locator('[data-next]').click();
    await expect(page.locator('[data-title]')).toHaveText('Awaiting confirmation');
    expect(errors).toEqual([]);
  });

  test('double-click resets the view', async ({ page }) => {
    await page.goto('./');
    await waitFor3D(page);
    const box = (await page.locator('[data-phone-canvas]').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    expect(Math.abs((await pose(page))!.yaw)).toBeGreaterThan(1);
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(async () => Math.abs((await pose(page))!.pitch), { timeout: 5000 }).toBeLessThan(0.01);
    await expect(page.locator('[data-reset-view]')).toBeHidden();
  });

  test('pitch stays within limits', async ({ page }) => {
    await page.goto('./');
    await waitFor3D(page);
    const box = (await page.locator('[data-phone-canvas]').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 20, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    expect((await pose(page))!.pitch).toBeLessThanOrEqual(0.7 + 1e-6);
  });
});
