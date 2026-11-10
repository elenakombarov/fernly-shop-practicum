import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Run axe with WCAG 2.1 A/AA tags and assert zero violations. */
export async function expectNoA11yViolations(page: Page, label?: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations, label ?? 'axe violations').toEqual([]);
}
