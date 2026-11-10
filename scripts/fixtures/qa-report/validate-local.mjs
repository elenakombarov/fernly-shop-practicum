import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const testsYml = readFileSync(path.join(root, '.github/workflows/tests.yml'), 'utf8');
const pwConfig = readFileSync(path.join(root, 'playwright.config.ts'), 'utf8');
const reportScript = readFileSync(path.join(root, 'scripts/qa-report.mjs'), 'utf8');
const findings = readFileSync(path.join(root, 'FINDINGS.md'), 'utf8');
const comment = readFileSync(path.join(root, 'qa-report/comment.md'), 'utf8');
const run = JSON.parse(readFileSync(path.join(root, 'qa-report/run.json'), 'utf8'));
const issues = JSON.parse(readFileSync(path.join(root, 'qa-report/issues.json'), 'utf8'));

const checks = [
  ['playwright json reporter', pwConfig.includes("outputFile: 'reports/playwright.json'")],
  ['cypress junit component', testsYml.includes('mochaFile=cypress/results/component-')],
  ['cypress junit ui', testsYml.includes('mochaFile=cypress/results/ui-')],
  ['report build step', testsYml.includes('node scripts/qa-report.mjs build')],
  ['report publish step', testsYml.includes('node scripts/qa-report.mjs publish')],
  ['single comment marker', reportScript.includes('<!-- fernly-qa-report -->')],
  ['duplicate issue avoidance', reportScript.includes('qa-finding') && reportScript.includes('existingKeys')],
  ['FINDINGS F-ids', (findings.match(/^### F-\d+\./gm) || []).length === 12],
  ['fixtures present', existsSync(path.join(root, 'scripts/fixtures/qa-report/playwright.json'))],
  ['comment.md generated', comment.startsWith('<!-- fernly-qa-report -->')],
  ['run.json generated', run.findings === 12 && run.failed === 5],
  ['issues.json generated', issues.length === 12],
  ['a11y included', comment.includes('Accessibility summary')],
  ['known failures visible', comment.includes('### Failed tests')],
  ['cypress self-closing pass counted', run.totals['Cypress component'].passed === 1],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(ok ? 'PASS' : 'FAIL', name);
  if (!ok) failed += 1;
}
process.exit(failed ? 1 : 0);
