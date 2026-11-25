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

test(
  'A11Y-01 Popular right now is named, linked, keyboard-usable, and sold text meets contrast',
  { tag: '@a11y' },
  async ({ page }) => {
    await page.goto('/plants/pl-aloe');
    const popular = page.getByRole('region', { name: 'Popular right now' });
    await expect(popular).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Popular right now' })).toBeVisible();

    const links = popular.getByRole('link');
    const linkCount = await links.count();
    expect(linkCount).toBeGreaterThan(0);
    expect(linkCount).toBeLessThanOrEqual(4);

    for (let index = 0; index < linkCount; index += 1) {
      const link = links.nth(index);
      const name = (await link.innerText()).trim();
      expect(name.length, `popular link ${index} name`).toBeGreaterThan(0);
      await link.focus();
      const outline = await link.evaluate((el) => getComputedStyle(el).outlineStyle);
      expect(outline, `focus visible on ${name}`).not.toBe('none');
    }

    const sold = popular.getByText(/\d+ sold this month/).first();
    await expect(sold).toBeVisible();
    const contrast = await sold.evaluate((el) => {
      const channel = (color: string): [number, number, number] => {
        const rgb = color.match(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)/);
        if (!rgb) throw new Error(`unexpected color ${color}`);
        return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
      };
      const linear = (value: number) => {
        const s = value / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (color: string) => {
        const [r, g, b] = channel(color).map(linear);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const style = getComputedStyle(el);
      let background = style.backgroundColor;
      let node: Element | null = el;
      while (
        node &&
        (background === 'rgba(0, 0, 0, 0)' || background === 'transparent')
      ) {
        node = node.parentElement;
        if (!node) break;
        background = getComputedStyle(node).backgroundColor;
      }
      const fg = luminance(style.color);
      const bg = luminance(background);
      const lighter = Math.max(fg, bg);
      const darker = Math.min(fg, bg);
      return (lighter + 0.05) / (darker + 0.05);
    });
    expect(contrast, 'sold this month contrast').toBeGreaterThanOrEqual(4.5);
  },
);

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
