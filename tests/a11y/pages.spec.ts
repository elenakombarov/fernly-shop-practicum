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
  'A11Y-01 out-of-stock notify form is named, keyboard usable, and axe-clean',
  { tag: '@a11y' },
  async ({ page, request }, testInfo) => {
    const catalog = await request.get('/api/plants?pageSize=48');
    expect(catalog.status()).toBe(200);
    const body = await catalog.json();
    const outOfStock = (body.items as { id: string; name: string; stock: number }[]).find(
      (plant) => plant.stock === 0,
    );
    expect(outOfStock, 'out-of-stock plant').toBeTruthy();

    await page.goto(`/plants/${outOfStock!.id}`);
    await expect(page.getByRole('heading', { name: outOfStock!.name })).toBeVisible();

    const email = page.getByLabel("Email me when it's back");
    const notifyMe = page.getByRole('button', { name: 'Notify me' });
    await expect(email).toBeVisible();
    await expect(notifyMe).toBeVisible();
    await expect(email).toHaveAccessibleName("Email me when it's back");
    await expect(notifyMe).toHaveAccessibleName('Notify me');

    await email.focus();
    await expect(email).toBeFocused();
    const emailOutline = await email.evaluate((el) => {
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
    });
    const emailWidth = Number.parseFloat(emailOutline.width);
    const emailColor = emailOutline.color.replace(/\s/g, '');
    expect(
      emailOutline.style !== 'none' &&
        emailWidth > 0 &&
        emailColor !== 'transparent' &&
        emailColor !== 'rgba(0,0,0,0)',
      `email focus ring ${JSON.stringify(emailOutline)}`,
    ).toBe(true);

    await email.fill('a11y-notify@example.com');
    await notifyMe.focus();
    await expect(notifyMe).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(
      page.getByText(`We'll email a11y-notify@example.com when ${outOfStock!.name} is back.`),
    ).toBeVisible();

    await page.goto(`/plants/${outOfStock!.id}`);
    await expect(email).toBeVisible();
    await expectNoBlocking(page, testInfo, 'Plant notify');
  },
);

test(
  'A11Y-02 Only N left badge meets contrast and does not block the save control',
  { tag: '@a11y' },
  async ({ page, request }) => {
    const catalog = await request.get('/api/plants?pageSize=48');
    expect(catalog.status()).toBe(200);
    const body = await catalog.json();
    const lowStock = (body.items as { id: string; name: string; stock: number }[]).find(
      (plant) => plant.stock >= 1 && plant.stock <= 3,
    );
    expect(lowStock, 'plant with stock 1–3').toBeTruthy();

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /^\d+ plants$/ })).toBeVisible();

    const card = page.getByRole('article').filter({
      has: page.getByRole('heading', { level: 3, name: lowStock!.name }),
    });
    const badge = card.getByText(`Only ${lowStock!.stock} left`);
    await expect(badge).toBeVisible();

    const contrast = await badge.evaluate((el) => {
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
        const [r, g, b] = channel(color);
        return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
      };
      let current: Element | null = el;
      let background = '';
      while (current) {
        const bg = getComputedStyle(current).backgroundColor;
        const match = bg.match(
          /rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*(\d+(?:\.\d+)?))?\)/,
        );
        if (match) {
          const alpha = match[4] === undefined ? 1 : Number(match[4]);
          if (alpha > 0) {
            background = bg;
            break;
          }
        } else if (bg && bg !== 'transparent') {
          background = bg;
          break;
        }
        current = current.parentElement;
      }
      const color = getComputedStyle(el).color;
      const lighter = Math.max(luminance(color), luminance(background));
      const darker = Math.min(luminance(color), luminance(background));
      return (lighter + 0.05) / (darker + 0.05);
    });
    expect(contrast, 'Only N left contrast').toBeGreaterThanOrEqual(4.5);

    const save = card.getByRole('button').first();
    await expect(save).toBeVisible();
    const geometry = await Promise.all([
      badge.boundingBox(),
      save.boundingBox(),
    ]);
    const [badgeBox, saveBox] = geometry;
    expect(badgeBox, 'badge box').toBeTruthy();
    expect(saveBox, 'save box').toBeTruthy();
    const overlaps =
      badgeBox!.x < saveBox!.x + saveBox!.width &&
      badgeBox!.x + badgeBox!.width > saveBox!.x &&
      badgeBox!.y < saveBox!.y + saveBox!.height &&
      badgeBox!.y + badgeBox!.height > saveBox!.y;
    expect(overlaps, 'badge overlaps save control').toBe(false);

    await save.focus();
    await expect(save).toBeFocused();
  },
);
