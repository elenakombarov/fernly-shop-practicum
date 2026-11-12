import type { Page } from '@playwright/test';

const TOKEN_KEY = 'fernly_token';

export async function signOutInBrowser(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.removeItem(key);
  }, TOKEN_KEY);
}
