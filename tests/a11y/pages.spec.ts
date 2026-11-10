import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './axe';

async function openPlantPage(page: Page, plantId = 'pl-aloe'): Promise<void> {
  await page.goto(`/plants/${plantId}`);
  await expect(page.getByRole('heading', { name: 'Aloe Vera' })).toBeVisible();
}

async function signInAsSeedCustomer(page: Page): Promise<void> {
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

/** Size is documented on the plant page; the star rating is the other radiogroup. */
async function starRatingGroup(page: Page): Promise<Locator> {
  const groups = page.getByRole('radiogroup');
  await expect(groups.first()).toBeVisible();
  const count = await groups.count();
  for (let i = 0; i < count; i++) {
    const group = groups.nth(i);
    const name = ((await group.getAttribute('aria-label')) ?? '').trim();
    const labelledBy = await group.getAttribute('aria-labelledby');
    let announced = name;
    if (!announced && labelledBy) {
      const label = page.locator(`#${labelledBy}`);
      if (await label.count()) {
        announced = ((await label.first().innerText()) ?? '').trim();
      }
    }
    if (!/^size$/i.test(announced)) {
      return group;
    }
  }
  // Fall back to any radiogroup that is not the Size picker by option names.
  for (let i = 0; i < count; i++) {
    const group = groups.nth(i);
    const radios = group.getByRole('radio');
    const firstName = ((await radios.first().getAttribute('aria-label')) ??
      (await radios.first().textContent()) ??
      '').trim();
    if (!/^(small|medium|large)\b/i.test(firstName)) {
      return group;
    }
  }
  throw new Error('No star-rating radiogroup found on the plant page');
}

async function expectFocusVisible(locator: Locator): Promise<void> {
  await expect(locator).toBeFocused();
  const visible = await locator.evaluate((el) => {
    const style = getComputedStyle(el);
    const outlineVisible =
      style.outlineStyle !== 'none' && style.outlineWidth !== '0px' && style.outlineColor !== 'transparent';
    const ringVisible = style.boxShadow !== 'none' && style.boxShadow !== '';
    return outlineVisible || ringVisible;
  });
  expect(visible, 'focused control has a visible focus indicator').toBe(true);
}

test('A11Y-01 plant page with Reviews mounted has no WCAG 2.1 AA axe violations', async ({
  page,
}) => {
  await openPlantPage(page);
  await expectNoA11yViolations(page, 'plant page including Reviews');
});

test('A11Y-02 star rating on the plant page supports keyboard, announced value, and visible focus', async ({
  page,
}) => {
  await signInAsSeedCustomer(page);
  await openPlantPage(page);

  const group = await starRatingGroup(page);
  const groupName =
    ((await group.getAttribute('aria-label')) ?? '').trim() ||
    (await group.evaluate((el) => {
      const id = el.getAttribute('aria-labelledby');
      if (!id) return '';
      const label = document.getElementById(id);
      return (label?.textContent ?? '').trim();
    }));
  expect(groupName.length, 'star rating group has a name a screen reader can announce').toBeGreaterThan(
    0,
  );

  const radios = group.getByRole('radio');
  await expect(radios.first()).toBeVisible();
  const radioCount = await radios.count();
  expect(radioCount, 'star rating offers more than one value').toBeGreaterThan(1);

  for (let i = 0; i < radioCount; i++) {
    const radio = radios.nth(i);
    const accessibleName = await radio.evaluate((el) => {
      const labelled = el.getAttribute('aria-label');
      if (labelled && labelled.trim()) return labelled.trim();
      return (el.textContent ?? '').trim();
    });
    expect(accessibleName.length, `star option ${i + 1} has a name`).toBeGreaterThan(0);
  }

  await radios.first().focus();
  await expectFocusVisible(radios.first());

  const before = await radios.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLInputElement).checked || node.getAttribute('aria-checked') === 'true'),
  );
  await page.keyboard.press('ArrowRight');
  const after = await radios.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLInputElement).checked || node.getAttribute('aria-checked') === 'true'),
  );
  expect(after, 'arrow keys change the selected star with the keyboard alone').not.toEqual(before);

  const selectedIndex = after.findIndex(Boolean);
  expect(selectedIndex, 'a star value is selected after keyboard change').toBeGreaterThanOrEqual(0);
  const selected = radios.nth(selectedIndex);
  const selectedName = await selected.evaluate((el) => {
    const labelled = el.getAttribute('aria-label');
    if (labelled && labelled.trim()) return labelled.trim();
    return (el.textContent ?? '').trim();
  });
  expect(selectedName.length, 'selected star value is announced').toBeGreaterThan(0);
  await expectFocusVisible(selected);
});
