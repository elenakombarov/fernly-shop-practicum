import { readFileSync } from 'node:fs';
import path from 'node:path';

export type Impact = 'minor' | 'moderate' | 'serious' | 'critical' | null;

export type BaselineStatus = 'new' | 'baselined' | 'expired';

export interface BaselineEntry {
  rule: string;
  page: string;
  target: string;
  owner: string;
  expires: string;
  reason: string;
}

export interface ViolationElement {
  rule: string;
  page: string;
  target: string;
  impact: Impact;
}

export interface ClassifiedElement extends ViolationElement {
  status: BaselineStatus;
}

const baselinePath = path.resolve(process.cwd(), 'a11y-baseline.json');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isBaselineEntry(value: unknown): value is BaselineEntry {
  return (
    isRecord(value) &&
    typeof value.rule === 'string' &&
    typeof value.page === 'string' &&
    typeof value.target === 'string' &&
    typeof value.owner === 'string' &&
    typeof value.expires === 'string' &&
    isIsoDate(value.expires) &&
    typeof value.reason === 'string'
  );
}

export function loadBaseline(file = baselinePath): BaselineEntry[] {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const label = path.basename(file);
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a list of known violations`);
  }

  return parsed.map((entry, index) => {
    if (!isBaselineEntry(entry)) {
      throw new Error(
        `${label} entry ${index} must have rule, page, target, owner, expires (YYYY-MM-DD), and reason`,
      );
    }
    return entry;
  });
}

export function todayStamp(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function matchingEntry(
  element: ViolationElement,
  baseline: readonly BaselineEntry[],
): BaselineEntry | undefined {
  const sameRuleAndPage = baseline.filter(
    (entry) => entry.rule === element.rule && entry.page === element.page,
  );
  return (
    sameRuleAndPage.find((entry) => entry.target === element.target) ??
    sameRuleAndPage.find((entry) => entry.target === '*')
  );
}

export function classifyElement(
  element: ViolationElement,
  baseline: readonly BaselineEntry[],
  today: string,
): BaselineStatus {
  const entry = matchingEntry(element, baseline);
  if (!entry) return 'new';
  if (entry.expires < today) return 'expired';
  return 'baselined';
}

export function classifyElements(
  elements: readonly ViolationElement[],
  baseline: readonly BaselineEntry[],
  today: string,
): ClassifiedElement[] {
  return elements.map((element) => ({
    ...element,
    status: classifyElement(element, baseline, today),
  }));
}

export function isBlocking(element: ClassifiedElement): boolean {
  if (element.status === 'expired') return true;
  return element.status === 'new' && (element.impact === 'serious' || element.impact === 'critical');
}
