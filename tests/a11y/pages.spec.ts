import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { ClassifiedElement } from './baseline';
import { scanPage } from './helpers/scan';

function listBlocking(blocking: readonly ClassifiedElement[]): string {
  return blocking
    .map((item) =>
      [item.page, item.status, item.impact ?? 'none', item.rule, item.target].join(' '),
    )
    .join('\n');
}

async function expectNoBlocking(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const { blocking } = await scanPage(page, testInfo, { name });
  expect(blocking, listBlocking(blocking) || 'no blocking accessibility violations').toEqual([]);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(requiredEnv('FERNLY_USER_EMAIL'));
  await page.getByLabel('Password').fill(requiredEnv('FERNLY_USER_PASSWORD'));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

async function emptyCart(page: Page): Promise<void> {
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: /Your cart/ })).toBeVisible();
  const remove = page.getByRole('button', { name: /^Remove / });
  let remaining = await remove.count();
  while (remaining > 0) {
    await remove.first().click();
    await expect(remove).toHaveCount(remaining - 1);
    remaining -= 1;
  }
}

async function signInWithOnePlant(page: Page): Promise<void> {
  await signIn(page);
  await emptyCart(page);
  await page.goto('/plants/pl-monstera');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText(/Added 1 × .+ to your cart\./)).toBeVisible();
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Remove / })).toHaveCount(1);
}

test('Browse has no blocking accessibility violations', { tag: '@a11y' }, async ({ page }, testInfo) => {
  test.fail(true, 'F-08/F-09/F-11: Browse has blocking color-contrast, label, and button-name violations');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /^\d+ plants$/ })).toBeVisible();
  await expectNoBlocking(page, testInfo, 'Browse');
});

test('Plant has no blocking accessibility violations', { tag: '@a11y' }, async ({ page }, testInfo) => {
  test.fail(true, 'F-08/F-12: Plant has blocking color-contrast and image-alt violations');
  await page.goto('/plants/pl-monstera');
  await expect(page.getByRole('button', { name: /^(Add to cart|Out of stock)$/ })).toBeVisible();
  await expectNoBlocking(page, testInfo, 'Plant');
});

test('Sign in has no blocking accessibility violations', { tag: '@a11y' }, async ({ page }, testInfo) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expectNoBlocking(page, testInfo, 'Sign in');
});

test('Cart has no blocking accessibility violations', { tag: '@a11y' }, async ({ page }, testInfo) => {
  await signInWithOnePlant(page);
  await expectNoBlocking(page, testInfo, 'Cart');
});

test('Checkout has no blocking accessibility violations', { tag: '@a11y' }, async ({ page }, testInfo) => {
  test.fail(true, 'F-08: Checkout has blocking color-contrast violations on prices');
  await signInWithOnePlant(page);
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expect(page.getByLabel('Full name')).toBeVisible();
  await expectNoBlocking(page, testInfo, 'Checkout');
});

test(
  'A11Y-01 out-of-stock plant notify form is named, keyboard usable, and has no new blocking violations',
  { tag: '@a11y' },
  async ({ page }, testInfo) => {
    test.fail(true, 'F-08/F-12: Plant has blocking color-contrast and image-alt violations');
    await page.goto('/plants/pl-pilea');
    await expect(page.getByRole('heading', { name: 'Chinese Money Plant' })).toBeVisible();

    const emailField = page.getByLabel("Email me when it's back");
    const notifyButton = page.getByRole('button', { name: 'Notify me' });
    await expect(emailField).toBeVisible();
    await expect(notifyButton).toBeVisible();

    await emailField.focus();
    await expect(emailField).toBeFocused();
    const emailOutline = await emailField.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(emailOutline.style, 'email field focus outline style').not.toBe('none');
    expect(Number.parseFloat(emailOutline.width), 'email field focus outline width').toBeGreaterThan(0);

    await emailField.fill('a11y-notify@fernly.test');
    await emailField.press('Tab');
    await expect(notifyButton).toBeFocused();
    const notifyOutline = await notifyButton.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(notifyOutline.style, 'Notify me focus outline style').not.toBe('none');
    expect(Number.parseFloat(notifyOutline.width), 'Notify me focus outline width').toBeGreaterThan(0);

    await notifyButton.press('Enter');
    await expect(page.getByText(/We'll email a11y-notify@fernly.test when Chinese Money Plant is back/)).toBeVisible();

    await page.goto('/plants/pl-pilea');
    await expect(page.getByLabel("Email me when it's back")).toBeVisible();
    await expectNoBlocking(page, testInfo, 'Plant');
  },
);

test(
  'A11Y-03 low-stock and out-of-stock copy is readable and not only by color',
  { tag: '@a11y' },
  async ({ page, request }, testInfo) => {
    const catalog = await request.get('/api/plants?pageSize=48');
    expect(catalog.status()).toBe(200);
    const body: unknown = await catalog.json();
    if (typeof body !== 'object' || body === null || !('items' in body) || !Array.isArray(body.items)) {
      throw new Error('GET /api/plants did not return items');
    }
    const plants = body.items.filter(
      (item): item is { name: string; stock: number } =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as { name?: unknown }).name === 'string' &&
        typeof (item as { stock?: unknown }).stock === 'number',
    );
    const outOfStock = plants.find((plant) => plant.stock === 0);
    const lowStockPlant = plants.find((plant) => plant.stock >= 1 && plant.stock <= 3);
    expect(outOfStock, 'seed catalog includes an out-of-stock plant').toBeTruthy();

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /^\d+ plants$/ })).toBeVisible();
    await page.getByRole('searchbox').fill(outOfStock!.name);
    await page.getByRole('button', { name: 'Search', exact: true }).click();

    const outOfStockCard = page.getByRole('article').filter({ hasText: 'Out of stock' }).first();
    await expect(outOfStockCard).toBeVisible();
    await expect(outOfStockCard.getByText('Out of stock')).toBeVisible();
    await expect(outOfStockCard.getByText('Only 0 left')).toHaveCount(0);

    if (lowStockPlant) {
      await page.getByRole('searchbox').fill(lowStockPlant.name);
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      const lowStock = page.getByText(`Only ${lowStockPlant.stock} left`);
      await expect(lowStock).toBeVisible();
      const contrast = await lowStock.evaluate((el) => {
        const view = el.ownerDocument.defaultView;
        if (!view) throw new Error('No window');
        let node: Element | null = el;
        let bg = 'transparent';
        while (node) {
          bg = view.getComputedStyle(node).backgroundColor;
          const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
          const alpha = match?.[4] === undefined ? 1 : Number(match[4]);
          if (match && alpha > 0) break;
          node = node.parentElement;
        }
        const fg = view.getComputedStyle(el).color;
        const parse = (color: string) => {
          const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (!m) throw new Error(`Unsupported color: ${color}`);
          return [Number(m[1]), Number(m[2]), Number(m[3])] as const;
        };
        const lum = ([r, g, b]: readonly [number, number, number]) => {
          const channel = (c: number) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        };
        const lFg = lum(parse(fg));
        const lBg = lum(parse(bg));
        const lighter = Math.max(lFg, lBg);
        const darker = Math.min(lFg, lBg);
        return (lighter + 0.05) / (darker + 0.05);
      });
      expect(contrast, 'Only N left contrast').toBeGreaterThanOrEqual(4.5);
    }

    const { blocking } = await scanPage(page, testInfo, { name: 'Browse' });
    // Known Browse blockers F-08/F-09/F-11 stay soft so stock-copy failures remain findings.
    expect.soft(blocking, listBlocking(blocking) || 'no blocking accessibility violations').toEqual([]);
  },
);
