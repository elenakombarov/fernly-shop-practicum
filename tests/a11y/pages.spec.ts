import { expect, test, type Locator, type Page } from '@playwright/test';
import { checkA11y } from './axe';

/** Known seed plant from the plant-page UI design table and APP-MAP. */
const plantPath = '/plants/pl-aloe';

async function signIn(page: Page): Promise<void> {
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

async function expectFocusVisible(locator: Locator): Promise<void> {
  await expect(locator).toBeFocused();
  const visible = await locator.evaluate((el) => {
    const style = getComputedStyle(el);
    const outlineVisible =
      style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
    const ringVisible = style.boxShadow !== 'none' && style.boxShadow !== '';
    return outlineVisible || ringVisible;
  });
  expect(visible, 'focused control has a visible focus indicator').toBe(true);
}

async function accessibleName(locator: Locator): Promise<string> {
  return locator.evaluate((el) => {
    const label = el.getAttribute('aria-label')?.trim() ?? '';
    if (label) return label;
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      return labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .join(' ')
        .trim();
    }
    return (el.textContent ?? '').trim();
  });
}

test.describe('plant page reviews accessibility', () => {
  test('A11Y-01 plant page with Reviews mounted meets WCAG 2.1 AA via axe', async ({ page }) => {
    await page.goto(plantPath);
    await expect(page.getByRole('heading', { name: 'Aloe Vera' })).toBeVisible();

    // Reviews slot mounts on the plant page; axe covers name, alt, and contrast (WCAG 2.1 AA).
    await checkA11y(page, 'main');
  });

  test('A11Y-02 star rating is keyboard-only, announces value, and shows focus', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(plantPath);
    await expect(page.getByRole('heading', { name: 'Aloe Vera' })).toBeVisible();

    // Plan CT-11 describes this control as a radiogroup (or equivalent) with named options.
    // APP-MAP documents the plant SizePicker as a radiogroup named "Size" — exclude it.
    const groups = page.getByRole('radiogroup');
    const groupCount = await groups.count();
    let ratingGroup: Locator | null = null;
    for (let i = 0; i < groupCount; i++) {
      const group = groups.nth(i);
      const name = (await accessibleName(group)).toLowerCase();
      if (name && name !== 'size') {
        ratingGroup = group;
        break;
      }
    }
    expect(ratingGroup, 'a rating radiogroup distinct from Size').not.toBeNull();
    await expect(ratingGroup!).toBeVisible();
    expect(
      (await accessibleName(ratingGroup!)).length,
      'rating group has a name a screen reader can announce',
    ).toBeGreaterThan(0);

    const stars = ratingGroup!.getByRole('radio');
    const starCount = await stars.count();
    expect(starCount, 'star options').toBeGreaterThanOrEqual(1);

    for (let i = 0; i < starCount; i++) {
      expect(
        (await accessibleName(stars.nth(i))).length,
        `star option ${i} has a name`,
      ).toBeGreaterThan(0);
    }

    await stars.first().focus();
    await expectFocusVisible(stars.first());

    const initialChecked = await stars.evaluateAll((nodes) =>
      nodes.findIndex(
        (n) =>
          n.getAttribute('aria-checked') === 'true' || (n as HTMLInputElement).checked,
      ),
    );

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    const afterChecked = await stars.evaluateAll((nodes) =>
      nodes.findIndex(
        (n) =>
          n.getAttribute('aria-checked') === 'true' || (n as HTMLInputElement).checked,
      ),
    );
    expect(afterChecked, 'arrow keys change the selected rating').not.toBe(initialChecked);
    expect(afterChecked, 'a star remains selected').toBeGreaterThanOrEqual(0);

    const selected = stars.nth(afterChecked);
    await expectFocusVisible(selected);
    expect(
      (await accessibleName(selected)).length,
      'selected rating has an announced value',
    ).toBeGreaterThan(0);
    await expect(selected).toBeChecked();
  });
});
