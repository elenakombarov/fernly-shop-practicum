/**
 * Regression: QA report/metrics must tolerate GitHub Issues disabled,
 * while still creating issues (with dedupe) when enabled.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  filterIssuesToCreate,
  isIssuesDisabledError,
  repoHasIssuesEnabled,
} from '../../github-issues.mjs';
import { diffNewFindings, parseFindings } from '../../qa-report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function section(name) {
  console.log(`\n== ${name} ==`);
}

section('Detect Issues-disabled error text');
assert(
  isIssuesDisabledError(
    "the 'elenakombarov/fernly-shop-practicum' repository has disabled issues",
  ),
  'should detect disabled-issues stderr text',
);
assert(
  isIssuesDisabledError({
    stderr: "GraphQL: the 'owner/repo' repository has disabled issues\n",
  }),
  'should detect disabled-issues on stderr object',
);
assert(
  !isIssuesDisabledError('HTTP 403: Resource not accessible'),
  'other errors must not be treated as Issues-disabled',
);
console.log('PASS disabled-issues detection');

section('repoHasIssuesEnabled respects has_issues');
assert(
  repoHasIssuesEnabled('owner/enabled', {
    fetchRepo: () => ({ has_issues: true }),
  }) === true,
  'has_issues:true must enable',
);
assert(
  repoHasIssuesEnabled('owner/disabled', {
    fetchRepo: () => ({ has_issues: false }),
  }) === false,
  'has_issues:false must disable',
);
assert(
  repoHasIssuesEnabled('owner/disabled-error', {
    fetchRepo: () => {
      throw new Error("the 'owner/disabled-error' repository has disabled issues");
    },
  }) === false,
  'API disabled-issues error must disable',
);
console.log('PASS repoHasIssuesEnabled');

section('Issues disabled → create zero GitHub issues, keep candidates for later');
{
  const candidates = [
    { key: 'brand-new-defect', title: 'F-99: Brand new' },
    { key: 'prices-drop-trailing-zeros', title: 'F-01: Prices' },
  ];
  const existing = new Set(['prices-drop-trailing-zeros']);
  const disabled = filterIssuesToCreate(candidates, existing, {
    issuesEnabled: false,
  });
  assert(disabled.length === 0, 'disabled Issues must create nothing');
  console.log('PASS Issues-disabled creates 0 issues');
}

section('Issues enabled → create only unseen keys (duplicate prevention)');
{
  const candidates = [
    { key: 'brand-new-defect', title: 'F-99: Brand new' },
    { key: 'prices-drop-trailing-zeros', title: 'F-01: Prices' },
  ];
  const existing = new Set(['prices-drop-trailing-zeros']);
  const enabled = filterIssuesToCreate(candidates, existing, {
    issuesEnabled: true,
  });
  assert(enabled.length === 1, `expected 1 issue, got ${enabled.length}`);
  assert(enabled[0].key === 'brand-new-defect', 'must keep only unseen key');
  const secondPass = filterIssuesToCreate(candidates, new Set([
    'brand-new-defect',
    'prices-drop-trailing-zeros',
  ]), { issuesEnabled: true });
  assert(secondPass.length === 0, 'repeated publish must create 0');
  console.log('PASS Issues-enabled dedupe');
}

section('Existing 12 findings vs origin/init → zero new issues');
{
  const base = parseFindings(
    execFileSync('git', ['show', 'origin/init:FINDINGS.md'], {
      cwd: ROOT,
      encoding: 'utf8',
    }),
  );
  const branch = parseFindings(readFileSync(path.join(ROOT, 'FINDINGS.md'), 'utf8'));
  const neu = diffNewFindings(branch, base);
  const payload = neu.map((f) => ({
    key: f.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
    title: `${f.id}: ${f.title}`,
  }));
  const toCreateEnabled = filterIssuesToCreate(payload, new Set(), {
    issuesEnabled: true,
  });
  const toCreateDisabled = filterIssuesToCreate(payload, new Set(), {
    issuesEnabled: false,
  });
  assert(neu.length === 0, `expected 0 new findings, got ${neu.length}`);
  assert(
    toCreateEnabled.length === 0,
    `expected 0 issues when enabled, got ${toCreateEnabled.length}`,
  );
  assert(
    toCreateDisabled.length === 0,
    `expected 0 issues when disabled, got ${toCreateDisabled.length}`,
  );
  console.log('CONFIRM first PR vs origin/init would create 0 GitHub issues');
}

console.log('\nAll issues-availability regression tests passed.');
