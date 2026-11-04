import { expect, test, type Page } from '@playwright/test';

const showcase = (page: Page) => page.locator('[data-showcase]');
const activeScreen = (page: Page) => page.locator('.screen[data-active]');
const modeToggle = (page: Page) => page.locator('[data-mode-toggle]');
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
      const missing = await page.locator('img:not([alt]), img[alt=""]').count();
      expect(missing, path).toBe(0);
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
    await expect(page.locator('[data-count]')).toHaveText('QR payments · Step 2 of 3');
    await expect(page.locator('[data-title]')).toHaveText('Awaiting confirmation');
    await expect(activeScreen(page)).toHaveAttribute('data-step', '1');
    await page.locator('[data-next]').click();
    await expect(page.locator('[data-next]')).toBeDisabled();

    await page.getByRole('button', { name: 'Card management' }).click();
    await expect(page.getByRole('button', { name: 'Card management' })).toHaveAttribute('aria-pressed', 'true');
    await expect(activeScreen(page)).toHaveAttribute('data-feature', 'cards');
    await expect(activeScreen(page)).toHaveAttribute('data-step', '0');
    await expect(page.locator('[data-title]')).toHaveText('Card information');
    await expect(activeScreen(page).locator('img')).toBeVisible();
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
    await expect(modeToggle(page)).toHaveText('Use 2D view');
    await modeToggle(page).click();
    await expect(showcase(page)).toHaveAttribute('data-mode', '2d');
    await expect(page.locator('[data-phone-canvas]')).toHaveCount(0);
    await expect(activeScreen(page)).toHaveAttribute('data-feature', 'cards');
    await expect(activeScreen(page)).toHaveAttribute('data-step', '1');
    await expect(activeScreen(page).locator('img')).toBeVisible();
    await modeToggle(page).click();
    await waitFor3D(page);
    await expect(page.locator('[data-title]')).toHaveText('Partial-data failure');
    expect(errors).toEqual([]);
  });

  test('missing WebGL 2 keeps the 2D view with an explanation', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      // @ts-expect-error test stub
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
        if (type === 'webgl2') return null;
        // @ts-expect-error passthrough
        return orig.call(this, type, ...rest);
      };
    });
    await page.goto('./');
    await expect(statusMsg(page)).toContainText('3D view is not available');
    await expect(modeToggle(page)).toBeHidden();
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
    await expect(statusMsg(page)).toContainText('could not start');
    await expect(activeScreen(page)).toHaveAttribute('data-step', '1');
    await expect(activeScreen(page).locator('img')).toBeVisible();
    await expect(modeToggle(page)).toHaveText('Retry 3D');

    await page.unroute('**/showcase/*.svg');
    await modeToggle(page).click();
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
    await expect(modeToggle(page)).toHaveText('Enable 3D');
    await modeToggle(page).click();
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
    await expect(modeToggle(page)).toHaveText('Enable 3D');
  });

  test('narrow touch viewport waits for "Enable 3D" and keeps vertical scrolling', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = trackErrors(page);
    await page.goto('./');
    await page.waitForTimeout(3500);
    await expect(showcase(page)).toHaveAttribute('data-mode', '2d');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await modeToggle(page).scrollIntoViewIfNeeded();
    await modeToggle(page).tap();
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
    await expect(page.locator('.panel')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Experience', exact: true })).toBeVisible();
    await expect(page.getByText('riowirawan19@gmail.com').first()).toBeVisible();
  });

  test('study pages are complete', async ({ page }) => {
    await page.goto('work/card-management/');
    await expect(page.getByRole('heading', { name: 'Loading, partial failure, and recovery' })).toBeVisible();
    await expect(page.locator('.seq img')).toHaveCount(3);
  });
});
