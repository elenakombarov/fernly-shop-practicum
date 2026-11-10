import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Accessibility rows from docs/test-plans/feature-promo-codes.md
 * (A11Y-01, A11Y-02, A11Y-03, A11Y-05). A11Y-04 is assumed — ask and is not implemented.
 *
 * Oracle: docs/PRODUCT.md Accessibility (WCAG 2.1 AA).
 * Control names "Apply" and "Remove" come from the approved plan's what-to-prove text.
 * Applied-promo / discount states need a seed promo code — set FERNLY_PROMO_CODE once confirmed.
 */

async function signIn(page: Page) {
  const email = process.env.FERNLY_USER_EMAIL;
  const password = process.env.FERNLY_USER_PASSWORD;
  expect(email, 'FERNLY_USER_EMAIL').toBeTruthy();
  expect(password, 'FERNLY_USER_PASSWORD').toBeTruthy();

  await page.goto('/login');
  await page.getByLabel('Email').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

async function ensureCartHasAPlant(page: Page) {
  await page.goto('/');
  await page.getByRole('link', { name: /Aloe Vera/i }).first().click();
  const add = page.getByRole('button', { name: 'Add to cart' });
  if (await add.isEnabled()) {
    await add.click();
  }
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: /Your cart/i })).toBeVisible();
}

function promoCode(): string {
  const code = process.env.FERNLY_PROMO_CODE;
  expect(
    code,
    'FERNLY_PROMO_CODE is required for applied-promo / discount a11y states (ask which seed promo to use)',
  ).toBeTruthy();
  return code!;
}

async function applyPromoOnCart(page: Page, code: string) {
  await page.getByRole('textbox', { name: /promo|code/i }).fill(code);
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
}

async function expectNoAxeViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations, label).toEqual([]);
}

async function focusLooksVisible(page: Page, locator: ReturnType<Page['getByRole']>) {
  await locator.focus();
  await expect(locator).toBeFocused();
  const appearance = await locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      outlineStyle: s.outlineStyle,
      outlineWidth: s.outlineWidth,
      boxShadow: s.boxShadow,
    };
  });
  const noOutline = appearance.outlineStyle === 'none' || appearance.outlineWidth === '0px';
  const noShadow = appearance.boxShadow === 'none';
  expect(noOutline && noShadow, 'focused control must show a visible focus indicator').toBe(false);
}

async function placeOrderFromCheckout(page: Page) {
  await page.goto('/checkout');
  await page.getByLabel('Full name').fill('Ava Green');
  await page.getByLabel('Street address').fill('1 Fern Lane');
  await page.getByLabel('City').fill('Portland');
  await page.getByLabel('Postal code').fill('97201');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page).toHaveURL(/\/orders\//);
}

test('A11Y-01 axe scan of /cart with promo apply form meets WCAG 2.1 AA', async ({ page }) => {
  await signIn(page);
  await ensureCartHasAPlant(page);
  await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible();
  await expectNoAxeViolations(page, 'cart apply form');
});

test('A11Y-01 axe scan of /cart with applied promo meets WCAG 2.1 AA', async ({ page }) => {
  const code = promoCode();
  await signIn(page);
  await ensureCartHasAPlant(page);
  await applyPromoOnCart(page, code);
  await expectNoAxeViolations(page, 'cart applied promo');
});

test('A11Y-02 promo code field, Apply, and Remove have accessible names', async ({ page }) => {
  const code = promoCode();
  await signIn(page);
  await ensureCartHasAPlant(page);

  // getByRole(..., { name }) fails if the control has no accessible name.
  await expect(page.getByRole('textbox', { name: /promo|code/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible();

  await applyPromoOnCart(page, code);
  await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
});

test('A11Y-03 promo apply and remove work with the keyboard and focus stays visible', async ({ page }) => {
  const code = promoCode();
  await signIn(page);
  await ensureCartHasAPlant(page);

  const field = page.getByRole('textbox', { name: /promo|code/i });
  await focusLooksVisible(page, field);
  await field.fill(code);

  const apply = page.getByRole('button', { name: 'Apply' });
  await focusLooksVisible(page, apply);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();

  const remove = page.getByRole('button', { name: 'Remove' });
  await focusLooksVisible(page, remove);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible();
});

test('A11Y-05 axe scan of checkout with a discount line meets WCAG 2.1 AA', async ({ page }) => {
  const code = promoCode();
  await signIn(page);
  await ensureCartHasAPlant(page);
  await applyPromoOnCart(page, code);
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expectNoAxeViolations(page, 'checkout with discount');
});

test('A11Y-05 axe scan of one-order view with a discount line meets WCAG 2.1 AA', async ({ page }) => {
  const code = promoCode();
  await signIn(page);
  await ensureCartHasAPlant(page);
  await applyPromoOnCart(page, code);
  await placeOrderFromCheckout(page);
  await expect(page.getByRole('heading', { name: 'Paid' })).toBeVisible();
  await expectNoAxeViolations(page, 'one order with discount');
});
