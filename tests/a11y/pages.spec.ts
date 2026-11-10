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
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /^\d+ plants$/ })).toBeVisible();
  await expectNoBlocking(page, testInfo, 'Browse');
});

test('Plant has no blocking accessibility violations', { tag: '@a11y' }, async ({ page }, testInfo) => {
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
  await signInWithOnePlant(page);
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expect(page.getByLabel('Full name')).toBeVisible();
  await expectNoBlocking(page, testInfo, 'Checkout');
});
