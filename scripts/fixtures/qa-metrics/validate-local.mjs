import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const docs = readFileSync(path.join(root, 'docs/QA-METRICS.md'), 'utf8');
const comment = readFileSync(path.join(root, 'qa-report/metrics-comment.md'), 'utf8');
const metrics = JSON.parse(readFileSync(path.join(root, 'qa-report/metrics.json'), 'utf8'));
const reportScript = readFileSync(path.join(root, 'scripts/qa-report.mjs'), 'utf8');
const metricsScript = readFileSync(path.join(root, 'scripts/qa-metrics.mjs'), 'utf8');
const testsYml = readFileSync(path.join(root, '.github/workflows/tests.yml'), 'utf8');

const checks = [
  ['docs/QA-METRICS.md exists', existsSync(path.join(root, 'docs/QA-METRICS.md'))],
  ['metrics marker distinct from QA report', comment.startsWith('<!-- fernly-qa-metrics -->')],
  ['QA report marker preserved in report script', reportScript.includes('<!-- fernly-qa-report -->')],
  ['Plan review N/M line', /^Plan review:\s*4\/5$/m.test(comment)],
  ['CI status included', comment.includes('CI status (latest tests.yml)')],
  ['artifacts included', comment.includes('a11y-report')],
  ['test totals included', comment.includes('Current run test totals')],
  ['metrics script never creates issues', !/issue\s+create/.test(metricsScript)],
  ['workflow builds metrics', testsYml.includes('node scripts/qa-metrics.mjs build')],
  ['workflow publishes metrics', testsYml.includes('node scripts/qa-metrics.mjs publish')],
  ['deterministic planReview field', metrics.planReview === 'Plan review: 4/5'],
  ['docs table has Plan review column', docs.includes('| Plan review |')],
  ['docs has two fixture PRs', (docs.match(/\]\(https:\/\/github\.com\/[^)]+\/pull\//g) || []).length === 2],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(ok ? 'PASS' : 'FAIL', name);
  if (!ok) failed += 1;
}
process.exit(failed ? 1 : 0);
