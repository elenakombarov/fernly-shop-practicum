/**
 * Regression tests for FINDINGS.md new-vs-existing comparison used by qa-report publish.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  diffNewFindings,
  normalizeFindingTitle,
  parseFindings,
} from '../../qa-report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function section(name) {
  console.log(`\n== ${name} ==`);
}

function gitShow(refPath) {
  return execFileSync('git', ['show', refPath], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function issuesThatWouldBeCreated(newFindings, existingKeys) {
  return newFindings.filter((f) => {
    const key = f.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return !existingKeys.has(key);
  });
}

section('normalizeFindingTitle strips F-NN and punctuation');
assert(
  normalizeFindingTitle('F-01. Prices drop trailing zeros') ===
    normalizeFindingTitle('Prices drop trailing zeros'),
  'F-NN prefix should not change the normalized title',
);
assert(
  normalizeFindingTitle('The price color is below 4.5:1 on the shop background') ===
    'the price color is below 4 5 1 on the shop background',
  'punctuation should collapse for comparison',
);

section('Base findings without F-NN identifiers');
{
  const baseMd = gitShow('origin/init:FINDINGS.md');
  const branchMd = readFileSync(path.join(ROOT, 'FINDINGS.md'), 'utf8');
  const base = parseFindings(baseMd);
  const branch = parseFindings(branchMd);
  const neu = diffNewFindings(branch, base);

  assert(base.length >= 12, `expected >=12 base confirmed findings, got ${base.length}`);
  assert(
    base.every((f) => f.id.startsWith('U-')),
    'origin/init confirmed findings should parse without F-NN ids',
  );
  assert(branch.length === 12, `expected 12 branch confirmed findings, got ${branch.length}`);
  assert(
    branch.every((f) => /^F-\d+$/.test(f.id)),
    'branch confirmed findings must keep stable F-NN ids',
  );
  assert(
    neu.length === 0,
    `expected 0 new findings vs origin/init, got ${neu.length}: ${neu.map((f) => f.id).join(', ')}`,
  );
  console.log(`PASS origin/init → ${base.length} base, ${branch.length} branch, ${neu.length} new`);
}

section('Existing findings with F-NN identifiers');
{
  const withIds = `# Findings\n\n### F-01. Prices drop trailing zeros\n\n- body\n\n### F-02. Care level 3 says Moderate care\n\n- body\n\n## Suspicions\n\n### Enter on Try again does not call onRetry\n\n- not a finding\n`;
  const sameIds = `# Findings\n\n### F-01. Prices drop trailing zeros\n\n- body\n\n### F-02. Care level 3 says Moderate care\n\n- body\n`;
  const base = parseFindings(withIds);
  const branch = parseFindings(sameIds);
  const neu = diffNewFindings(branch, base);
  assert(base.every((f) => /^F-\d+$/.test(f.id)), 'base with F-NN must preserve ids');
  assert(neu.length === 0, `expected 0 new when both sides have F-NN, got ${neu.length}`);
  console.log('PASS F-NN vs F-NN → 0 new');
}

section('Genuinely new findings are still reported');
{
  const baseMd = gitShow('origin/init:FINDINGS.md');
  const base = parseFindings(baseMd);
  const branch = [
    ...parseFindings(readFileSync(path.join(ROOT, 'FINDINGS.md'), 'utf8')),
    {
      id: 'F-99',
      title: 'Brand-new checkout total rounding defect',
      body: '- **Where:** Checkout',
      key: normalizeFindingTitle('Brand-new checkout total rounding defect'),
    },
  ];
  const neu = diffNewFindings(branch, base);
  assert(neu.length === 1, `expected exactly 1 new finding, got ${neu.length}`);
  assert(neu[0].id === 'F-99', `expected F-99, got ${neu[0].id}`);
  assert(
    neu[0].title === 'Brand-new checkout total rounding defect',
    'new finding title must be preserved',
  );
  console.log('PASS genuinely new finding → F-99 only');
}

section('Repeated publishing skips keys that already exist');
{
  const neu = [
    {
      id: 'F-99',
      title: 'Brand-new checkout total rounding defect',
    },
    {
      id: 'F-01',
      title: 'Prices drop trailing zeros',
    },
  ];
  const existingKeys = new Set(['prices-drop-trailing-zeros']);
  const toCreate = issuesThatWouldBeCreated(neu, existingKeys);
  assert(toCreate.length === 1, `expected 1 issue after dedupe, got ${toCreate.length}`);
  assert(toCreate[0].id === 'F-99', 'dedupe must keep only the unseen key');
  const secondPass = issuesThatWouldBeCreated(neu, new Set([
    'prices-drop-trailing-zeros',
    'brand-new-checkout-total-rounding-defect',
  ]));
  assert(secondPass.length === 0, 'repeated publishing must create 0 issues');
  console.log('PASS repeated publishing → 0 duplicates');
}

section('First PR against origin/init issue count');
{
  const base = parseFindings(gitShow('origin/init:FINDINGS.md'));
  const branch = parseFindings(readFileSync(path.join(ROOT, 'FINDINGS.md'), 'utf8'));
  const neu = diffNewFindings(branch, base);
  const wouldCreate = issuesThatWouldBeCreated(neu, new Set());
  assert(
    wouldCreate.length === 0,
    `expected 0 GitHub issues on first PR against origin/init, got ${wouldCreate.length}`,
  );
  console.log(`CONFIRM first PR vs origin/init would create ${wouldCreate.length} GitHub issues`);
}

console.log('\nAll findings-diff regression tests passed.');
