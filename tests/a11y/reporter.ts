import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import {
  classifyElements,
  isBlocking,
  loadBaseline,
  matchingEntry,
  todayStamp,
  type BaselineEntry,
  type BaselineStatus,
  type Impact,
  type ViolationElement,
} from './baseline';

interface A11yReporterOptions {
  outputFolder: string;
  baseline: string;
  title: string;
}

interface Attachment {
  name: string;
  contentType: string;
  path?: string;
  body?: Buffer;
}

interface ParsedNode {
  html: string;
  impact: Impact;
  target: string;
  failureSummary: string;
  screenshot: string | null;
}

interface ParsedViolation {
  id: string;
  help: string;
  helpUrl: string;
  description: string;
  tags: string[];
  nodes: ParsedNode[];
}

interface PageScan {
  page: string;
  url: string;
  scannedAt: string;
  passed: number;
  incomplete: number;
  violations: ParsedViolation[];
}

interface ReportElement {
  page: string;
  url: string;
  target: string;
  html: string;
  impact: Impact;
  failureSummary: string;
  status: BaselineStatus;
  blocking: boolean;
  owner: string | null;
  expires: string | null;
  reason: string | null;
  screenshot: string | null;
  pageIndex: number;
  nodeIndex: number;
}

interface ReportRule {
  id: string;
  help: string;
  helpUrl: string;
  description: string;
  tags: string[];
  impact: Impact;
  elements: ReportElement[];
}

interface ImpactCounts {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

interface StatusCounts {
  new: number;
  baselined: number;
  expired: number;
}

interface ReportPage {
  name: string;
  url: string;
  scannedAt: string;
  elements: number;
  passed: number;
  incomplete: number;
  impacts: ImpactCounts;
}

interface BlockingGroup {
  rule: string;
  help: string;
  impact: Impact;
  page: string;
  count: number;
  example: string;
}

interface Report {
  title: string;
  generatedAt: string;
  baselineFile: string;
  totals: {
    pages: number;
    rules: number;
    elements: number;
    blocking: number;
  };
  byImpact: Record<ImpactName, StatusCounts>;
  pages: ReportPage[];
  rules: ReportRule[];
  blocking: BlockingGroup[];
  unmatchedBaseline: BaselineEntry[];
}

const IMPACTS = ['critical', 'serious', 'moderate', 'minor'] as const;
type ImpactName = (typeof IMPACTS)[number];

const STATUSES: BaselineStatus[] = ['new', 'baselined', 'expired'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function impactName(value: unknown): Impact | undefined {
  if (value === 'minor' || value === 'moderate' || value === 'serious' || value === 'critical') {
    return value;
  }
  return undefined;
}

function impactRank(impact: Impact): number {
  if (impact === 'critical') return 0;
  if (impact === 'serious') return 1;
  if (impact === 'moderate') return 2;
  if (impact === 'minor') return 3;
  return 4;
}

function impactKey(impact: Impact): ImpactName | 'none' {
  if (impact === 'critical' || impact === 'serious' || impact === 'moderate' || impact === 'minor') {
    return impact;
  }
  return 'none';
}

function emptyImpacts(): ImpactCounts {
  return { critical: 0, serious: 0, moderate: 0, minor: 0 };
}

function emptyStatuses(): StatusCounts {
  return { new: 0, baselined: 0, expired: 0 };
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function selectorPart(part: unknown): string {
  if (typeof part === 'string') return part;
  if (Array.isArray(part)) return part.map((item) => selectorPart(item)).join(' >> ');
  if (isRecord(part) && 'fromShadowDom' in part) return selectorPart(part.fromShadowDom);
  return '';
}

function elementTarget(target: unknown): string {
  if (!Array.isArray(target)) return '';
  return target.map((part) => selectorPart(part)).join(' >> ');
}

function wcagTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag): tag is string => typeof tag === 'string' && tag.toLowerCase().startsWith('wcag'));
}

function wcagTitle(tag: string): string {
  const level = /^(wcag2|wcag21|wcag22)(a{1,3})$/i.exec(tag);
  if (level) {
    const version = level[1].toLowerCase() === 'wcag2' ? '2.0' : level[1].toLowerCase() === 'wcag21' ? '2.1' : '2.2';
    return `WCAG ${version} ${level[2].toUpperCase()}`;
  }
  const criterion = /^wcag(\d)(\d)(\d+)$/i.exec(tag);
  if (criterion) return `WCAG ${criterion[1]}.${criterion[2]}.${criterion[3]}`;
  return tag;
}

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.href;
  } catch {
    return null;
  }
}

function attachmentBytes(attachment: Attachment): Buffer {
  if (attachment.body && attachment.body.length > 0) return attachment.body;
  if (attachment.path) return readFileSync(attachment.path);
  if (attachment.body) return attachment.body;
  throw new Error(`Attachment ${attachment.name} has no body`);
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function parseNode(value: unknown, screenshot: string | null, ruleImpact: Impact): ParsedNode {
  const node = isRecord(value) ? value : {};
  return {
    html: stringField(node, 'html'),
    impact: impactName(node.impact) ?? ruleImpact,
    target: elementTarget(node.target),
    failureSummary: stringField(node, 'failureSummary'),
    screenshot,
  };
}

function parseViolation(value: unknown, pageName: string, shots: ReadonlyMap<string, string>): ParsedViolation | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  const ruleImpact = impactName(value.impact) ?? null;
  const nodes = Array.isArray(value.nodes) ? value.nodes : [];
  return {
    id: value.id,
    help: stringField(value, 'help'),
    helpUrl: stringField(value, 'helpUrl'),
    description: stringField(value, 'description'),
    tags: wcagTags(value.tags),
    nodes: nodes.map((node, index) =>
      parseNode(node, shots.get(`${pageName}\n${value.id}\n${index}`) ?? null, ruleImpact),
    ),
  };
}

function parseScan(payload: unknown, shots: ReadonlyMap<string, string>, testTitle: string): PageScan {
  if (!isRecord(payload) || typeof payload.page !== 'string' || !Array.isArray(payload.violations)) {
    throw new Error(`axe-results from "${testTitle}" is missing page or violations`);
  }
  const pageName = payload.page;
  const violations = payload.violations
    .map((violation) => parseViolation(violation, pageName, shots))
    .filter((violation): violation is ParsedViolation => violation !== null);
  const passes = Array.isArray(payload.passes) ? payload.passes.length : 0;
  const incomplete = Array.isArray(payload.incomplete) ? payload.incomplete.length : 0;
  return {
    page: pageName,
    url: stringField(payload, 'url'),
    scannedAt: stringField(payload, 'scannedAt'),
    passed: passes,
    incomplete,
    violations,
  };
}

function shotKey(name: string): { page: string; rule: string; index: number } | null {
  if (!name.startsWith('axe-shot:')) return null;
  const match = /^([\s\S]+):([^:]+):(\d+)$/.exec(name.slice('axe-shot:'.length));
  if (!match) return null;
  return { page: match[1], rule: match[2], index: Number(match[3]) };
}

function readShots(attachments: readonly Attachment[]): Map<string, string> {
  const shots = new Map<string, string>();
  for (const attachment of attachments) {
    const shot = shotKey(attachment.name);
    if (!shot) continue;
    const bytes = attachmentBytes(attachment);
    shots.set(`${shot.page}\n${shot.rule}\n${shot.index}`, `data:image/png;base64,${bytes.toString('base64')}`);
  }
  return shots;
}

function readScans(attachments: readonly Attachment[], testTitle: string): PageScan[] {
  const shots = readShots(attachments);
  const scans: PageScan[] = [];
  for (const attachment of attachments) {
    if (attachment.name !== 'axe-results') continue;
    const payload: unknown = JSON.parse(attachmentBytes(attachment).toString('utf8'));
    scans.push(parseScan(payload, shots, testTitle));
  }
  return scans;
}

function countPageImpacts(scan: PageScan): ImpactCounts {
  const counts = emptyImpacts();
  for (const violation of scan.violations) {
    for (const node of violation.nodes) {
      const key = impactKey(node.impact);
      if (key !== 'none') counts[key] += 1;
    }
  }
  return counts;
}

function assemble(scans: readonly PageScan[], baseline: readonly BaselineEntry[], title: string, baselineFile: string): Report {
  const today = todayStamp();
  const generatedAt = new Date().toISOString();
  const elements: ViolationElement[] = [];
  const details: Array<{ scan: PageScan; violation: ParsedViolation; node: ParsedNode; pageIndex: number; nodeIndex: number }> = [];

  scans.forEach((scan, pageIndex) => {
    for (const violation of scan.violations) {
      violation.nodes.forEach((node, nodeIndex) => {
        elements.push({
          rule: violation.id,
          page: scan.page,
          target: node.target,
          impact: node.impact,
        });
        details.push({ scan, violation, node, pageIndex, nodeIndex });
      });
    }
  });

  const classified = classifyElements(elements, baseline, today);
  const rules = new Map<string, ReportRule>();
  const reportElements: ReportElement[] = [];

  classified.forEach((item, index) => {
    const detail = details[index];
    const source = elements[index];
    if (!detail || !source) return;
    const entry = matchingEntry(source, baseline);
    const reportElement: ReportElement = {
      page: item.page,
      url: detail.scan.url,
      target: item.target,
      html: detail.node.html,
      impact: item.impact,
      failureSummary: detail.node.failureSummary,
      status: item.status,
      blocking: isBlocking(item),
      owner: entry?.owner ?? null,
      expires: entry?.expires ?? null,
      reason: entry?.reason ?? null,
      screenshot: detail.node.screenshot,
      pageIndex: detail.pageIndex,
      nodeIndex: detail.nodeIndex,
    };
    reportElements.push(reportElement);

    const existing = rules.get(item.rule);
    if (!existing) {
      rules.set(item.rule, {
        id: item.rule,
        help: detail.violation.help,
        helpUrl: detail.violation.helpUrl,
        description: detail.violation.description,
        tags: [...detail.violation.tags],
        impact: item.impact,
        elements: [reportElement],
      });
      return;
    }
    if (impactRank(item.impact) < impactRank(existing.impact)) existing.impact = item.impact;
    for (const tag of detail.violation.tags) {
      if (!existing.tags.includes(tag)) existing.tags.push(tag);
    }
    if (!existing.help && detail.violation.help) existing.help = detail.violation.help;
    if (!existing.helpUrl && detail.violation.helpUrl) existing.helpUrl = detail.violation.helpUrl;
    if (!existing.description && detail.violation.description) existing.description = detail.violation.description;
    existing.elements.push(reportElement);
  });

  const ruleList = [...rules.values()];
  for (const rule of ruleList) {
    rule.elements.sort((a, b) => {
      const byImpact = impactRank(a.impact) - impactRank(b.impact);
      if (byImpact !== 0) return byImpact;
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      return a.nodeIndex - b.nodeIndex;
    });
  }
  ruleList.sort((a, b) => {
    const byImpact = impactRank(a.impact) - impactRank(b.impact);
    if (byImpact !== 0) return byImpact;
    if (a.elements.length !== b.elements.length) return b.elements.length - a.elements.length;
    return a.id.localeCompare(b.id);
  });

  const byImpact = {
    critical: emptyStatuses(),
    serious: emptyStatuses(),
    moderate: emptyStatuses(),
    minor: emptyStatuses(),
  };
  for (const element of reportElements) {
    const key = impactKey(element.impact);
    if (key !== 'none') byImpact[key][element.status] += 1;
  }

  const scannedPages = new Set(scans.map((scan) => scan.page));
  const matched = new Set<BaselineEntry>();
  elements.forEach((element) => {
    const entry = matchingEntry(element, baseline);
    if (entry) matched.add(entry);
  });
  const unmatchedBaseline = baseline
    .filter((entry) => scannedPages.has(entry.page) && !matched.has(entry))
    .sort((a, b) => a.page.localeCompare(b.page) || a.rule.localeCompare(b.rule) || a.target.localeCompare(b.target));

  const blockingGroups = new Map<string, BlockingGroup>();
  for (const rule of ruleList) {
    for (const element of rule.elements) {
      if (!element.blocking) continue;
      const key = `${rule.id}\n${element.page}`;
      const group = blockingGroups.get(key);
      if (!group) {
        blockingGroups.set(key, {
          rule: rule.id,
          help: rule.help,
          impact: element.impact,
          page: element.page,
          count: 1,
          example: element.target,
        });
        continue;
      }
      group.count += 1;
      if (impactRank(element.impact) < impactRank(group.impact)) group.impact = element.impact;
    }
  }

  const pages: ReportPage[] = scans.map((scan) => ({
    name: scan.page,
    url: scan.url,
    scannedAt: scan.scannedAt,
    elements: scan.violations.reduce((sum, violation) => sum + violation.nodes.length, 0),
    passed: scan.passed,
    incomplete: scan.incomplete,
    impacts: countPageImpacts(scan),
  }));

  return {
    title,
    generatedAt,
    baselineFile,
    totals: {
      pages: scans.length,
      rules: ruleList.length,
      elements: reportElements.length,
      blocking: reportElements.filter((element) => element.blocking).length,
    },
    byImpact,
    pages,
    rules: ruleList,
    blocking: [...blockingGroups.values()],
    unmatchedBaseline,
  };
}

function inlineCode(value: string): string {
  const runs = value.match(/`+/g);
  const longest = runs ? Math.max(...runs.map((run) => run.length)) : 0;
  const fence = '`'.repeat(longest + 1);
  const body = longest > 0 ? ` ${value} ` : value;
  return `${fence}${body}${fence}`;
}

function mdPlain(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function elementWord(count: number): string {
  return count === 1 ? '1 element' : `${count} elements`;
}

function renderMarkdown(report: Report): string {
  const { totals } = report;
  const lines = [
    `# ${mdPlain(report.title)}`,
    '',
    `- Pages scanned: ${totals.pages}`,
    `- Rules violated: ${totals.rules}`,
    `- Elements affected: ${totals.elements}`,
    `- Blocking: ${totals.blocking}`,
    '',
    '| Impact | New | Baselined | Expired |',
    '| --- | ---: | ---: | ---: |',
  ];
  for (const impact of IMPACTS) {
    const counts = report.byImpact[impact];
    lines.push(`| ${titleCase(impact)} | ${counts.new} | ${counts.baselined} | ${counts.expired} |`);
  }
  lines.push('', '## Blocking', '');
  if (report.blocking.length === 0) {
    lines.push('None.', '');
  } else {
    let currentRule = '';
    for (const group of report.blocking) {
      if (group.rule !== currentRule) {
        if (currentRule) lines.push('');
        currentRule = group.rule;
        const impact = group.impact ? ` (${group.impact})` : '';
        const help = group.help ? ` — ${mdPlain(group.help)}` : '';
        lines.push(`### ${inlineCode(group.rule)}${impact}${help}`, '');
      }
      const example = group.example ? inlineCode(group.example) : '`(no selector)`';
      lines.push(`- ${mdPlain(group.page)} — ${elementWord(group.count)}. Example: ${example}`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function impactLabel(impact: Impact): string {
  return impact ? titleCase(impact) : 'None';
}

function statusLabel(status: BaselineStatus): string {
  if (status === 'baselined') return 'Baselined';
  if (status === 'expired') return 'Expired';
  return 'New';
}

function impactMeters(impacts: ImpactCounts): string {
  const max = Math.max(1, ...IMPACTS.map((impact) => impacts[impact]));
  return IMPACTS.map((impact) => {
    const width = Math.round((impacts[impact] / max) * 100);
    return `<p class="meter"><span class="track" aria-hidden="true"><span class="fill ${impact}" style="width:${width}%"></span></span><span class="meter-label ${impact}">${impacts[impact]} ${impact}</span></p>`;
  }).join('');
}

function pageRows(report: Report): string {
  if (report.pages.length === 0) {
    return '<tr><td colspan="5">No pages were scanned.</td></tr>';
  }
  return report.pages
    .map((page) => {
      const name = escapeHtml(page.name);
      return `<tr>
        <td><button type="button" class="page-jump" data-page="${name}">${name}</button></td>
        <td><code class="url">${escapeHtml(page.url)}</code></td>
        <td class="num">${page.elements}</td>
        <td class="impact-cell">${impactMeters(page.impacts)}</td>
        <td class="num">${page.passed}</td>
      </tr>`;
    })
    .join('');
}

function baselineMeta(element: ReportElement): string {
  if (!element.owner && !element.expires) return '';
  const when = element.status === 'expired' ? 'ended' : 'until';
  const parts = [element.owner, element.expires ? `${when} ${element.expires}` : '', element.reason].filter(
    (part): part is string => Boolean(part),
  );
  return `<p class="who">${parts.map((part) => escapeHtml(part)).join(' · ')}</p>`;
}

function elementCard(element: ReportElement): string {
  const impact = impactKey(element.impact);
  const shot = element.screenshot
    ? `<img src="${element.screenshot}" alt="${escapeHtml(`Failing element on ${element.page}`)}">`
    : '<p class="no-shot">No screenshot</p>';
  const summary = element.failureSummary
    ? `<div><dt>Failure summary</dt><dd><pre>${escapeHtml(element.failureSummary)}</pre></dd></div>`
    : '';
  const html = element.html
    ? `<div><dt>HTML</dt><dd><pre>${escapeHtml(element.html)}</pre></dd></div>`
    : '';
  return `<li class="element" data-impact="${impact}" data-page="${escapeHtml(element.page)}" data-status="${element.status}">
    <div class="shot">${shot}</div>
    <div class="evidence">
      <p class="element-meta">
        <span class="where">${escapeHtml(element.page)}</span>
        <span class="badge ${impact}">${impactLabel(element.impact)}</span>
        <span class="badge ${element.status}">${statusLabel(element.status)}</span>
      </p>
      ${baselineMeta(element)}
      <dl>
        <div><dt>Selector</dt><dd><code>${escapeHtml(element.target)}</code></dd></div>
        ${html}
        ${summary}
      </dl>
    </div>
  </li>`;
}

function ruleCard(rule: ReportRule): string {
  const tags = rule.tags
    .map((tag) => `<li title="${escapeHtml(wcagTitle(tag))}"><code>${escapeHtml(tag)}</code></li>`)
    .join('');
  const href = safeUrl(rule.helpUrl);
  const fix = href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">How to fix it</a>`
    : '';
  const impact = impactKey(rule.impact);
  return `<article class="rule ${impact}">
    <header class="rule-head">
      <p class="rule-kicker"><span class="badge ${impact}">${impactLabel(rule.impact)}</span><code class="rule-id">${escapeHtml(rule.id)}</code></p>
      <h3>${escapeHtml(rule.help || rule.id)}</h3>
      <ul class="tags">${tags}</ul>
      ${fix}
    </header>
    <ol class="elements">${rule.elements.map((element) => elementCard(element)).join('')}</ol>
  </article>`;
}

function unmatchedList(entries: readonly BaselineEntry[]): string {
  if (entries.length === 0) {
    return '<p class="quiet">Every baseline entry matched a violation on a scanned page.</p>';
  }
  const items = entries
    .map((entry) => {
      return `<li><code>${escapeHtml(entry.rule)}</code> on ${escapeHtml(entry.page)}, target <code>${escapeHtml(entry.target)}</code> — ${escapeHtml(entry.owner)}, ${escapeHtml(entry.expires)}. ${escapeHtml(entry.reason)}</li>`;
    })
    .join('');
  return `<p>These entries matched no violation on a page that was scanned. Delete them.</p><ul>${items}</ul>`;
}

function impactFilters(report: Report): string {
  const counts = new Map<string, number>();
  for (const impact of IMPACTS) counts.set(impact, 0);
  let none = 0;
  for (const rule of report.rules) {
    for (const element of rule.elements) {
      const key = impactKey(element.impact);
      if (key === 'none') none += 1;
      else counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const boxes = IMPACTS.map((impact) => {
    return `<label class="check"><input type="checkbox" name="impact" value="${impact}" checked><span class="swatch ${impact}" aria-hidden="true"></span>${titleCase(impact)} <span class="count" data-count-for="${impact}">${counts.get(impact) ?? 0}</span></label>`;
  });
  if (none > 0) {
    boxes.push(
      `<label class="check"><input type="checkbox" name="impact" value="none" checked><span class="swatch none" aria-hidden="true"></span>None <span class="count" data-count-for="none">${none}</span></label>`,
    );
  }
  return boxes.join('');
}

function pageOptions(report: Report): string {
  const options = report.pages
    .map((page) => `<option value="${escapeHtml(page.name)}">${escapeHtml(page.name)} (${page.elements})</option>`)
    .join('');
  return `<option value="">All pages</option>${options}`;
}

const REPORT_STYLE = `
:root {
  color-scheme: light;
  --paper: #f6faf3;
  --ink: #1f2d22;
  --muted: #3e5246;
  --line: #d3e0d4;
  --card: #ffffff;
  --fern: #1f4d32;
  --critical: #9f1239;
  --serious: #c2410c;
  --moderate: #a16207;
  --minor: #3f6212;
  --new: #9f1239;
  --baselined: #1e3a5f;
  --expired: #92400e;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font: 16px/1.5 "Segoe UI", "Helvetica Neue", sans-serif;
}
.skip {
  position: absolute;
  left: 12px;
  top: -40px;
  background: var(--card);
  padding: 8px 12px;
  z-index: 4;
}
.skip:focus { top: 12px; }
.wrap { max-width: 1100px; margin: 0 auto; padding: 32px 20px 64px; }
h1, h2, h3 { font-family: Georgia, "Iowan Old Style", Palatino, serif; font-weight: 600; line-height: 1.25; }
h1 { font-size: 2.4rem; margin: 0 0 8px; }
h2 { font-size: 1.6rem; margin: 36px 0 12px; }
h3 { font-size: 1.35rem; margin: 0; }
p { margin: 0 0 8px; }
a { color: var(--fern); }
a:hover { color: #143824; }
:focus-visible { outline: 3px solid #8a5a00; outline-offset: 2px; }
.lede { max-width: 68ch; color: var(--muted); margin-bottom: 20px; }
.when { color: var(--muted); font-size: 0.92rem; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 20px; }
.stat { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }
.stat .num { display: block; font-size: 2rem; font-variant-numeric: tabular-nums; line-height: 1.1; }
.stat .label { color: var(--muted); font-size: 0.92rem; }
.stat.alert .num { color: var(--critical); }
.stat.calm .num { color: var(--fern); }
.table-scroll { overflow-x: auto; background: var(--card); border: 1px solid var(--line); border-radius: 12px; }
table { width: 100%; border-collapse: collapse; background: var(--card); }
th, td { text-align: left; padding: 10px 12px; vertical-align: top; border-bottom: 1px solid var(--line); }
th { font-size: 0.82rem; letter-spacing: 0.03em; text-transform: uppercase; color: var(--muted); }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
tr:last-child td { border-bottom: 0; }
.url { white-space: nowrap; font-size: 0.88rem; }
.page-jump { background: none; border: 0; padding: 0; color: var(--fern); font: inherit; font-weight: 600; cursor: pointer; text-align: left; }
.page-jump:hover { text-decoration: underline; }
.swatch { width: 0.75rem; height: 0.75rem; border-radius: 999px; display: inline-block; }
.swatch.critical, .fill.critical { background: var(--critical); }
.swatch.serious, .fill.serious { background: var(--serious); }
.swatch.moderate, .fill.moderate { background: var(--moderate); }
.swatch.minor, .fill.minor { background: var(--minor); }
.swatch.none { background: #8a938c; }
.meter { display: grid; grid-template-columns: 108px auto; gap: 8px; align-items: center; margin: 3px 0; }
.track { display: block; height: 8px; background: #e7eee6; border-radius: 999px; overflow: hidden; }
.fill { display: block; height: 100%; }
.meter-label { font-size: 0.82rem; font-variant-numeric: tabular-nums; }
.meter-label.critical { color: #6e1224; }
.meter-label.serious { color: #7c2d12; }
.meter-label.moderate { color: #6b4e00; }
.meter-label.minor { color: #1e4d32; }
.filters { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: end; background: rgba(246, 250, 243, 0.94); border: 1px solid var(--line); border-radius: 12px; padding: 12px; margin: 8px 0 16px; }
fieldset { border: 0; margin: 0; padding: 0; }
legend, .field span { display: block; font-size: 0.78rem; letter-spacing: 0.03em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
.check { display: inline-flex; align-items: center; gap: 6px; margin-right: 12px; }
.count { color: var(--muted); font-variant-numeric: tabular-nums; }
.field select, .field input[type="search"] { font: inherit; color: var(--ink); background: var(--card); border: 1px solid #b7c9b8; border-radius: 8px; padding: 6px 8px; min-width: 11rem; }
.showing { margin-left: auto; color: var(--muted); font-variant-numeric: tabular-nums; }
.rule { background: var(--card); border: 1px solid var(--line); border-left: 6px solid var(--line); border-radius: 12px; padding: 18px 18px 8px; margin: 0 0 16px; }
.rule.critical { border-left-color: var(--critical); }
.rule.serious { border-left-color: var(--serious); }
.rule.moderate { border-left-color: var(--moderate); }
.rule.minor { border-left-color: var(--minor); }
.rule.none { border-left-color: #8a938c; }
.rule-kicker { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.rule-id { font-size: 0.92rem; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; padding: 0; margin: 8px 0; }
.tags li { background: #eef5ee; border-radius: 999px; padding: 2px 8px; }
.tags code, .evidence code { font-family: Consolas, "Cascadia Mono", monospace; font-size: 0.88rem; }
.badge { display: inline-block; border-radius: 999px; padding: 1px 8px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.badge.critical { background: #f8d7dc; color: #6e1224; }
.badge.serious { background: #fde7d4; color: #7c2d12; }
.badge.moderate { background: #f8efc8; color: #6b4e00; }
.badge.minor, .badge.none { background: #e3f0e4; color: #1e4d32; }
.badge.new { background: #f8d7dc; color: #6e1224; }
.badge.baselined { background: #e7eef8; color: #1e3a5f; }
.badge.expired { background: #f8efc8; color: #6b4e00; }
.elements { list-style: none; padding: 0; margin: 12px 0 0; }
.element { display: grid; grid-template-columns: 240px 1fr; gap: 16px; padding: 14px 0; border-top: 1px solid var(--line); }
.shot { background: #f3f7f2; border: 1px solid var(--line); border-radius: 8px; padding: 8px; }
.shot img { display: block; max-width: 100%; height: auto; }
.no-shot { color: var(--muted); font-size: 0.88rem; margin: 0; }
.element-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.where { font-weight: 600; }
.who { color: var(--muted); }
dl { margin: 8px 0 0; }
dl div { margin-bottom: 8px; }
dt { font-size: 0.78rem; letter-spacing: 0.03em; text-transform: uppercase; color: var(--muted); }
dd { margin: 2px 0 0; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 9rem; overflow: auto; background: #f7faf6; border-radius: 8px; padding: 8px; margin: 0; font-family: Consolas, "Cascadia Mono", monospace; font-size: 0.85rem; }
.stale, .empty-note { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; }
.stale { background: #fff8ee; border-color: #efd3a8; }
.quiet { color: var(--muted); margin: 0; }
code { overflow-wrap: anywhere; }
@media (max-width: 800px) {
  .stats { grid-template-columns: 1fr 1fr; }
  .element { grid-template-columns: 1fr; }
  .showing { margin-left: 0; }
}
@media print {
  .filters, .skip { position: static; }
  .rule { break-inside: avoid; }
}
`;

const REPORT_SCRIPT = `
(function () {
  var impacts = document.querySelectorAll('input[name="impact"]');
  var page = document.querySelector('#page-filter');
  var status = document.querySelector('#status-filter');
  var search = document.querySelector('#search-filter');
  var cards = document.querySelectorAll('article.rule');
  var empty = document.querySelector('#filter-empty');
  var showing = document.querySelector('#showing');
  if (!page || !status || !search || !showing || !empty) return;

  function allowedImpacts() {
    var set = {};
    impacts.forEach(function (box) {
      if (box.checked) set[box.value] = true;
    });
    return set;
  }

  function apply() {
    var allowed = allowedImpacts();
    var pageValue = page.value;
    var statusValue = status.value;
    var query = search.value.trim().toLowerCase();
    var visible = 0;
    var total = 0;
    var facet = {};
    cards.forEach(function (card) {
      var head = card.querySelector('.rule-head');
      var headerText = (head && head.textContent ? head.textContent : '').toLowerCase();
      var headerMatch = query !== '' && headerText.indexOf(query) !== -1;
      var any = false;
      card.querySelectorAll('.element').forEach(function (row) {
        total += 1;
        var rowImpact = row.getAttribute('data-impact') || 'none';
        var pageOk = pageValue === '' || row.getAttribute('data-page') === pageValue;
        var statusOk = statusValue === '' || row.getAttribute('data-status') === statusValue;
        var text = (row.textContent || '').toLowerCase();
        var searchOk = query === '' || headerMatch || text.indexOf(query) !== -1;
        if (pageOk && statusOk && searchOk) facet[rowImpact] = (facet[rowImpact] || 0) + 1;
        var show = !!allowed[rowImpact] && pageOk && statusOk && searchOk;
        row.hidden = !show;
        if (show) {
          any = true;
          visible += 1;
        }
      });
      card.hidden = !any;
    });
    document.querySelectorAll('[data-count-for]').forEach(function (node) {
      var key = node.getAttribute('data-count-for');
      node.textContent = String(facet[key] || 0);
    });
    showing.textContent = visible + ' of ' + total + ' elements';
    empty.hidden = visible !== 0 || total === 0;
  }

  impacts.forEach(function (box) { box.addEventListener('change', apply); });
  page.addEventListener('change', apply);
  status.addEventListener('change', apply);
  search.addEventListener('input', apply);
  document.querySelectorAll('.page-jump').forEach(function (button) {
    button.addEventListener('click', function () {
      page.value = button.getAttribute('data-page') || '';
      apply();
      var violations = document.querySelector('#violations');
      if (violations) violations.scrollIntoView();
    });
  });
  apply();
})();
`;

function renderHtml(report: Report): string {
  const blockingClass = report.totals.blocking > 0 ? 'alert' : 'calm';
  const rules = report.rules.map((rule) => ruleCard(rule)).join('');
  const emptyRules =
    report.rules.length === 0 ? '<p class="empty-note">No rule violations on this run.</p>' : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(report.title)}</title>
<style>${REPORT_STYLE}</style>
</head>
<body>
<a class="skip" href="#violations">Skip to violations</a>
<main class="wrap">
  <header>
    <h1>${escapeHtml(report.title)}</h1>
    <p class="when"><time datetime="${escapeHtml(report.generatedAt)}">${escapeHtml(formatWhen(report.generatedAt))}</time></p>
    <p class="lede">A violation is blocking when it is new and serious or critical, or when its baseline entry has expired.</p>
    <section class="stats" aria-label="Totals">
      <div class="stat"><span class="num">${report.totals.pages}</span><span class="label">Pages scanned</span></div>
      <div class="stat"><span class="num">${report.totals.rules}</span><span class="label">Rules violated</span></div>
      <div class="stat"><span class="num">${report.totals.elements}</span><span class="label">Elements affected</span></div>
      <div class="stat ${blockingClass}"><span class="num">${report.totals.blocking}</span><span class="label">Blocking</span></div>
    </section>
  </header>
  <h2>Pages</h2>
  <div class="table-scroll">
  <table>
    <thead>
      <tr>
        <th>Page</th>
        <th>URL</th>
        <th class="num">Elements</th>
        <th>Impact</th>
        <th class="num">Passed</th>
      </tr>
    </thead>
    <tbody>${pageRows(report)}</tbody>
  </table>
  </div>
  <h2 id="violations">Violations</h2>
  <div class="filters">
    <fieldset>
      <legend>Impact</legend>
      ${impactFilters(report)}
    </fieldset>
    <label class="field"><span>Page</span><select id="page-filter">${pageOptions(report)}</select></label>
    <label class="field"><span>Status</span>
      <select id="status-filter">
        <option value="">All statuses</option>
        <option value="new">New</option>
        <option value="baselined">Baselined</option>
        <option value="expired">Expired</option>
      </select>
    </label>
    <label class="field"><span>Search</span><input id="search-filter" type="search" placeholder="Rule, selector, or HTML"></label>
    <p class="showing" id="showing" aria-live="polite"></p>
  </div>
  ${emptyRules}
  ${rules}
  <p class="empty-note" id="filter-empty" hidden>Nothing matches these filters.</p>
  <h2>Baseline entries that matched nothing</h2>
  <section class="stale">${unmatchedList(report.unmatchedBaseline)}</section>
  <p class="when">Baseline file: ${escapeHtml(report.baselineFile)}</p>
</main>
<script>${REPORT_SCRIPT}</script>
</body>
</html>
`;
}

function reportJson(report: Report): string {
  const rules = report.rules.map((rule) => ({
    id: rule.id,
    impact: rule.impact,
    help: rule.help,
    helpUrl: rule.helpUrl,
    description: rule.description,
    tags: rule.tags,
    elements: rule.elements.map((element) => ({
      page: element.page,
      url: element.url,
      target: element.target,
      html: element.html,
      impact: element.impact,
      failureSummary: element.failureSummary,
      status: element.status,
      blocking: element.blocking,
      owner: element.owner,
      expires: element.expires,
      reason: element.reason,
      hasScreenshot: element.screenshot !== null,
    })),
  }));
  return `${JSON.stringify(
    {
      title: report.title,
      generatedAt: report.generatedAt,
      baselineFile: report.baselineFile,
      totals: report.totals,
      byImpact: report.byImpact,
      pages: report.pages,
      rules,
      blocking: report.blocking,
      unmatchedBaseline: report.unmatchedBaseline,
    },
    null,
    2,
  )}\n`;
}

class A11yReporter implements Reporter {
  private readonly outputFolder: string;
  private readonly baselineFile: string;
  private readonly title: string;
  private testOrder: string[] = [];
  private readonly results = new Map<string, { title: string; result: TestResult }>();

  constructor(options: A11yReporterOptions) {
    if (!options?.outputFolder || !options.baseline || !options.title) {
      throw new Error('The accessibility reporter expects outputFolder, baseline, and title.');
    }
    this.outputFolder = options.outputFolder;
    this.baselineFile = options.baseline;
    this.title = options.title;
  }

  onBegin(_config: unknown, suite: Suite): void {
    this.testOrder = suite.allTests().map((test) => test.id);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.results.set(test.id, { title: test.title, result });
  }

  printsToStdio(): boolean {
    return false;
  }

  async onEnd(_result: FullResult): Promise<void> {
    const ordered = [
      ...this.testOrder.filter((id) => this.results.has(id)),
      ...[...this.results.keys()].filter((id) => !this.testOrder.includes(id)),
    ];
    const scans: PageScan[] = [];
    for (const id of ordered) {
      const entry = this.results.get(id);
      if (!entry) continue;
      scans.push(...readScans(entry.result.attachments, entry.title));
    }
    if (scans.length === 0) return;

    const baseline = loadBaseline(path.resolve(process.cwd(), this.baselineFile));
    const report = assemble(scans, baseline, this.title, this.baselineFile);
    const folder = path.resolve(process.cwd(), this.outputFolder);
    await mkdir(folder, { recursive: true });
    const indexPath = path.join(folder, 'index.html');
    await writeFile(indexPath, renderHtml(report));
    await writeFile(path.join(folder, 'summary.md'), renderMarkdown(report));
    await writeFile(path.join(folder, 'results.json'), reportJson(report));

    const { pages, rules, elements, blocking } = report.totals;
    const printed = path.relative(process.cwd(), indexPath).split(path.sep).join('/');
    console.log(
      `${pages} pages scanned, ${rules} rules violated, ${elements} elements affected, ${blocking} blocking. ${printed}`,
    );
  }
}

export default A11yReporter;
