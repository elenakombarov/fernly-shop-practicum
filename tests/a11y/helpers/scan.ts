import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import type axe from 'axe-core';
import {
  classifyElements,
  isBlocking,
  loadBaseline,
  todayStamp,
  type ClassifiedElement,
  type Impact,
  type ViolationElement,
} from '../baseline';

export interface PageScan {
  elements: ClassifiedElement[];
  blocking: ClassifiedElement[];
}

interface ScanOptions {
  name: string;
}

interface AxeScanReport {
  page: string;
  url: string;
  scannedAt: string;
  violations: axe.Result[];
  passes: axe.Result[];
  incomplete: axe.Result[];
}

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

function readImpact(value: axe.ImpactValue | undefined): Impact | undefined {
  if (value === 'minor' || value === 'moderate' || value === 'serious' || value === 'critical') {
    return value;
  }
  return undefined;
}

function selectorPart(part: axe.CrossTreeSelector): string {
  return typeof part === 'string' ? part : part.join(' >> ');
}

function elementTarget(target: axe.UnlabelledFrameSelector): string {
  return target.map((part) => selectorPart(part)).join(' >> ');
}

function violationElements(pageName: string, violations: readonly axe.Result[]): ViolationElement[] {
  const elements: ViolationElement[] = [];
  for (const violation of violations) {
    for (const node of violation.nodes) {
      elements.push({
        rule: violation.id,
        page: pageName,
        target: elementTarget(node.target),
        impact: readImpact(node.impact) ?? readImpact(violation.impact) ?? null,
      });
    }
  }
  return elements;
}

async function attachShots(
  page: Page,
  testInfo: TestInfo,
  pageName: string,
  violations: readonly axe.Result[],
): Promise<void> {
  for (const violation of violations) {
    const nodes = violation.nodes.slice(0, 3);
    for (const [index, node] of nodes.entries()) {
      const target = elementTarget(node.target);
      if (target.length === 0) continue;
      const shot = await page.locator(target).first().screenshot();
      await testInfo.attach(`axe-shot:${pageName}:${violation.id}:${index}`, {
        body: shot,
        contentType: 'image/png',
      });
    }
  }
}

export async function scanPage(page: Page, testInfo: TestInfo, options: ScanOptions): Promise<PageScan> {
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  const scannedAt = new Date().toISOString();

  await attachShots(page, testInfo, options.name, results.violations);

  const report: AxeScanReport = {
    page: options.name,
    url: page.url(),
    scannedAt,
    violations: results.violations,
    passes: results.passes,
    incomplete: results.incomplete,
  };
  await testInfo.attach('axe-results', {
    body: JSON.stringify(report),
    contentType: 'application/json',
  });

  const elements = classifyElements(
    violationElements(options.name, results.violations),
    loadBaseline(),
    todayStamp(),
  );
  return {
    elements,
    blocking: elements.filter(isBlocking),
  };
}
