import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Run an axe WCAG 2.1 AA scan; optionally limit to a CSS/selector or locator string. */
export async function checkA11y(page: Page, include?: string): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']);
  if (include) {
    builder = builder.include(include);
  }
  const results = await builder.analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}
