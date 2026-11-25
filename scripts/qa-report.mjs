#!/usr/bin/env node
/**
 * QA report: deterministic build from test artifacts + FINDINGS.md; publish to PR via gh.
 * Node 22+, no npm dependencies.
 */
import { spawnSync, execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  filterIssuesToCreate,
  isIssuesDisabledError,
  repoHasIssuesEnabled,
} from './github-issues.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = '<!-- fernly-qa-report -->';
const FINDING_KEY_MARKER = '<!-- qa-finding-key:';

const PATHS = {
  playwrightJson: path.join(ROOT, 'reports/playwright.json'),
  cypressResults: path.join(ROOT, 'web/cypress/results'),
  a11ySummary: path.join(ROOT, 'a11y-report/summary.md'),
  findings: path.join(ROOT, 'FINDINGS.md'),
  outDir: path.join(ROOT, 'qa-report'),
};

const PLAYWRIGHT_PROJECT_ORDER = ['api', 'e2e', 'a11y', 'visual', 'setup'];

const ANSI_RE =
  // eslint-disable-next-line no-control-regex
  /\u001b\[[0-9;]*m|\u001b\][^\u0007]*\u0007|\u001b\][^\u001b\\]*(?:\\|\u001b\\)/g;

function stripAnsi(text) {
  return String(text ?? '').replace(ANSI_RE, '');
}

function firstLine(text) {
  const line = stripAnsi(text).split(/\r?\n/).find((l) => l.trim());
  return line?.trim() ?? '';
}

function slugTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Normalize a finding title for comparison across branches.
 * Strips optional leading F-NN ids and punctuation so
 * "### Prices drop trailing zeros" matches "### F-01. Prices drop trailing zeros".
 */
export function normalizeFindingTitle(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/^f-\d+\.\s*/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Confirmed findings only — stop before Suspicions / Questions sections. */
function confirmedFindingsMarkdown(md) {
  const cut = String(md ?? '').search(/^##\s+Suspicions\b/m);
  return cut === -1 ? String(md ?? '') : String(md ?? '').slice(0, cut);
}

/**
 * Parse confirmed FINDINGS.md entries.
 * Accepts both `### F-01. Title` and `### Title`.
 * Preserves F-NN ids when present; assigns sequential placeholders otherwise
 * (placeholders are for parsing only — publishing uses branch ids).
 * @returns {Array<{ id: string, title: string, body: string, key: string }>}
 */
export function parseFindings(md) {
  const entries = [];
  const confirmed = confirmedFindingsMarkdown(md);
  // Optional F-NN prefix; title is the rest of the heading.
  const re = /^### (?:(F-\d+)\.\s+)?(.+)$/gm;
  let m;
  const starts = [];
  let unprefixed = 0;
  while ((m = re.exec(confirmed)) !== null) {
    const id = m[1] || `U-${++unprefixed}`;
    starts.push({ index: m.index, id, title: m[2].trim() });
  }
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].index : confirmed.length;
    const slice = confirmed.slice(start.index, end).trim();
    const lines = slice.split(/\r?\n/);
    const bodyLines = lines.slice(1);
    const title = start.title;
    entries.push({
      id: start.id,
      title,
      body: bodyLines.join('\n').trim(),
      key: normalizeFindingTitle(title),
    });
  }
  return entries;
}

export function diffNewFindings(branchFindings, baseFindings) {
  const baseKeys = new Set(
    (baseFindings ?? []).map((f) => f.key ?? normalizeFindingTitle(f.title)),
  );
  return (branchFindings ?? []).filter(
    (f) => !baseKeys.has(f.key ?? normalizeFindingTitle(f.title)),
  );
}

function readFindingsFile(filePath) {
  if (!existsSync(filePath)) return [];
  return parseFindings(readFileSync(filePath, 'utf8'));
}

const ZERO_SHA = '0000000000000000000000000000000000000000';

function readBaseFindings(baseRef) {
  const baseSha = env('BASE_SHA');
  if (baseSha && baseSha !== ZERO_SHA) {
    try {
      const raw = execFileSync('git', ['show', `${baseSha}:FINDINGS.md`], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return readFindingsFileFromString(raw);
    } catch {
      /* fall through to ref */
    }
  }
  if (!baseRef) return [];
  try {
    const raw = execFileSync(
      'git',
      ['show', `origin/${baseRef}:FINDINGS.md`],
      { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return readFindingsFileFromString(raw);
  } catch {
    return [];
  }
}

function readFindingsFileFromString(md) {
  return parseFindings(md);
}

function emptySuite(name) {
  return {
    name,
    status: 'not run',
    passed: 0,
    failed: 0,
    knownBugs: 0,
    skipped: 0,
    failures: [],
    knownBugItems: [],
  };
}

/** Walk Playwright JSON report and bucket by project name on specs. */
function parsePlaywrightJson(filePath) {
  if (!existsSync(filePath)) {
    return Object.fromEntries(
      PLAYWRIGHT_PROJECT_ORDER.map((p) => [p, emptySuite(p)]),
    );
  }
  const report = JSON.parse(readFileSync(filePath, 'utf8'));
  /** @type {Record<string, ReturnType<typeof emptySuite>>} */
  const byProject = Object.fromEntries(
    PLAYWRIGHT_PROJECT_ORDER.map((p) => [p, { ...emptySuite(p), status: 'ok' }]),
  );

  /** @type {Array<{ project: string, title: string, file: string, line: number, error: string, knownFinding?: string, visual?: boolean, attachments?: string[] }>} */
  const allCases = [];

  function specFilePath(spec) {
    const raw = spec.file ?? '';
    if (!raw) return '';
    return raw.startsWith('tests/') ? raw : `tests/${raw}`;
  }

  function walkSuites(suites, titlePath = []) {
    for (const suite of suites ?? []) {
      const nextPath = suite.title ? [...titlePath, suite.title] : titlePath;
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          const bucket = test.projectName ?? 'e2e';
          if (!byProject[bucket]) {
            byProject[bucket] = {
              ...emptySuite(`Playwright ${bucket}`),
              name: `Playwright ${bucket}`,
              status: 'ok',
            };
          }
          const results = test.results ?? [];
          if (!results.length) continue;

          const result = pickResult(results);
          const status = result.status;
          const annotations = [
            ...(spec.annotations ?? []),
            ...(test.annotations ?? []),
            ...(result.annotations ?? []),
          ];
          const failAnn = annotations.find((a) => a.type === 'fail');
          const failDesc = stripAnsi(failAnn?.description ?? '');
          const findingMatch = failDesc.match(/^(F-\d+):\s*(.+)$/);

          const errors = (result.errors ?? [])
            .map((e) => stripAnsi(e.message ?? e.stack ?? ''))
            .filter(Boolean);
          const errText = errors.join('\n');
          const isVisual =
            bucket === 'visual' || /toHaveScreenshot|screenshot/i.test(errText);

          const file = specFilePath(spec) || test.location?.file || '';
          const line = spec.line ?? test.location?.line ?? 0;

          const row = {
            project: bucket,
            title: spec.title ?? nextPath.join(' › '),
            file,
            line,
            error: firstLine(errText),
            knownFinding: findingMatch
              ? `${findingMatch[1]}: ${findingMatch[2]}`
              : undefined,
            visual: isVisual,
            attachments: (result.attachments ?? []).map(
              (a) => a.name ?? a.path ?? '',
            ),
          };

          if (status === 'skipped') {
            byProject[bucket].skipped += 1;
          } else if (status === 'expected' || (findingMatch && status === 'failed')) {
            byProject[bucket].knownBugs += 1;
            byProject[bucket].knownBugItems.push(row);
          } else if (status === 'passed') {
            byProject[bucket].passed += 1;
          } else if (
            status === 'failed' ||
            status === 'timedOut' ||
            status === 'interrupted'
          ) {
            if (isVisual) {
              byProject[bucket].failed += 1;
              byProject[bucket].failures.push(row);
            } else {
              byProject[bucket].failed += 1;
              byProject[bucket].failures.push(row);
            }
          } else {
            byProject[bucket].passed += 1;
          }
          allCases.push(row);
        }
      }
      walkSuites(suite.suites, nextPath);
    }
  }

  walkSuites(report.suites ?? []);
  for (const p of PLAYWRIGHT_PROJECT_ORDER) {
    if (!byProject[p]) {
      byProject[p] = emptySuite(`Playwright ${p}`);
    } else {
      byProject[p].name = `Playwright ${p}`;
      const used =
        byProject[p].passed +
        byProject[p].failed +
        byProject[p].knownBugs +
        byProject[p].skipped;
      if (used === 0) byProject[p].status = 'not run';
    }
  }
  return { byProject, allCases, report };
}

function pickResult(results) {
  if (!results?.length) return undefined;
  return results[results.length - 1];
}

/** Parse JUnit XML (Cypress mocha-junit-reporter) without dependencies. */
function parseJUnitXml(xml) {
  const cases = [];
  // Match both <testcase .../> and <testcase ...>...</testcase>.
  const testcaseRe = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
  const fileFromSuites = [...xml.matchAll(/<testsuite\b[^>]*\bfile="([^"]+)"/g)].map(
    (m) => m[1],
  );
  const defaultFile = fileFromSuites.find((f) => f.includes('.cy.')) ?? '';
  let m;
  while ((m = testcaseRe.exec(xml)) !== null) {
    const attrs = m[1];
    const body = m[2] ?? '';
    const name = attrs.match(/\bname="([^"]*)"/)?.[1] ?? '';
    const classname = attrs.match(/\bclassname="([^"]*)"/)?.[1] ?? '';
    const skipped = /<skipped\b/.test(body);
    const failureMatch = body.match(/<failure[^>]*message="([^"]*)"/);
    const failureBody = body.match(/<failure[^>]*>([\s\S]*?)<\/failure>/);
    const err = failureMatch
      ? firstLine(stripAnsi(decodeXml(failureMatch[1])))
      : failureBody
        ? firstLine(stripAnsi(decodeXml(failureBody[1])))
        : '';
    cases.push({
      classname,
      name,
      skipped,
      failure: Boolean(failureMatch || failureBody),
      error: err,
      file: defaultFile ? `web/${defaultFile}` : guessFileFromClassname(classname),
      line: 0,
    });
  }
  return cases;
}

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function guessFileFromClassname(classname) {
  const parts = classname.split('.');
  const last = parts[parts.length - 1];
  if (last?.endsWith('.cy.tsx') || last?.endsWith('.cy.ts')) return `cypress/${last}`;
  return classname.replace(/\./g, '/') + '.cy.tsx';
}

function parseCypressResults(dir, suiteLabel) {
  if (!existsSync(dir)) {
    return emptySuite(suiteLabel);
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.xml'));
  if (!files.length) {
    return emptySuite(suiteLabel);
  }
  const suite = { ...emptySuite(suiteLabel), status: 'ok' };
  for (const file of files) {
    const kind = file.startsWith('component-')
      ? 'Cypress component'
      : file.startsWith('ui-')
        ? 'Cypress UI'
        : null;
    if (kind && kind !== suiteLabel) continue;
    const xml = readFileSync(path.join(dir, file), 'utf8');
    for (const tc of parseJUnitXml(xml)) {
      if (tc.skipped) {
        suite.skipped += 1;
      } else if (tc.failure) {
        suite.failed += 1;
        suite.failures.push({
          title: tc.name,
          file: tc.file.startsWith('cypress/') ? `web/${tc.file}` : tc.file,
          line: tc.line,
          error: tc.error,
        });
      } else {
        suite.passed += 1;
      }
    }
  }
  if (suite.passed + suite.failed + suite.skipped === 0) {
    return emptySuite(suiteLabel);
  }
  return suite;
}

function env(name, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

function buildRunUrls() {
  const repo = env('GITHUB_REPOSITORY');
  const runId = env('GITHUB_RUN_ID');
  const pr = env('PR_NUMBER');
  const runUrl =
    repo && runId
      ? `https://github.com/${repo}/actions/runs/${runId}`
      : '';
  const prUrl =
    repo && pr ? `https://github.com/${repo}/pull/${pr}` : '';
  return { runUrl, prUrl };
}

function buildCommentMd(ctx) {
  const { suites, visualFailures, findings, newFindings, a11yBlock, runUrl, prUrl } =
    ctx;
  const lines = [MARKER, '', '## QA report', ''];
  if (runUrl) {
    lines.push(`[Workflow run](${runUrl})${prUrl ? ` · [Pull request](${prUrl})` : ''}`, '');
  }

  lines.push(
    '| Suite | Passed | Failed | Known bugs | Skipped |',
    '| --- | ---: | ---: | ---: | ---: |',
  );
  for (const s of suites) {
    const label = s.status === 'not run' ? `${s.name} _(not run)_` : s.name;
    if (s.status === 'not run') {
      lines.push(`| ${label} | — | — | — | — |`);
    } else {
      lines.push(
        `| ${s.name} | ${s.passed} | ${s.failed} | ${s.knownBugs} | ${s.skipped} |`,
      );
    }
  }
  lines.push('');

  const hardFails = suites.flatMap((s) =>
    s.failures.map((f) => ({ suite: s.name, ...f })),
  );
  if (hardFails.length) {
    lines.push('### Failed tests', '');
    for (const f of hardFails) {
      const loc = f.file ? `${f.file}:${f.line || 1}` : f.suite;
      lines.push(`- **${f.title}** (\`${loc}\`) — ${f.error || '(no message)'}`);
    }
    lines.push('');
  }

  if (visualFailures.length) {
    lines.push(
      '### Visual changes',
      '',
      '_A person decides: defect, intended, or noise._',
      '',
      'Diff images ship in the **playwright-report** workflow artifact (HTML report attachments).',
      '',
    );
    for (const v of visualFailures) {
      const loc = v.file ? `${v.file}:${v.line || 1}` : v.project;
      lines.push(`- **${v.title}** (\`${loc}\`) — ${v.error || 'Screenshot mismatch'}`);
    }
    lines.push('');
  }

  const known = suites.flatMap((s) => s.knownBugItems ?? []);
  if (known.length) {
    lines.push('### Known bugs (expected failures)', '');
    for (const k of known) {
      const loc = k.file ? `${k.file}:${k.line || 1}` : k.project;
      lines.push(
        `- **${k.knownFinding ?? k.title}** — \`${loc}\`${k.error ? ` — ${k.error}` : ''}`,
      );
    }
    lines.push('');
  }

  if (newFindings.length) {
    lines.push('### New findings', '');
    for (const f of newFindings) {
      lines.push(`- **${f.id}. ${f.title}**`);
    }
    lines.push('');
  }

  if (findings.length) {
    lines.push('<details>', '<summary>All findings in this branch</summary>', '');
    for (const f of findings) {
      lines.push(`- ${f.id}. ${f.title}`);
    }
    lines.push('', '</details>', '');
  }

  if (a11yBlock) {
    lines.push('<details>', '<summary>Accessibility summary</summary>', '', a11yBlock, '', '</details>', '');
  }

  return lines.join('\n');
}

function buildIssuesJson(newFindings, runUrl, prUrl) {
  return newFindings.map((f) => {
    const key = slugTitle(f.title);
    const body = [
      `## ${f.id}. ${f.title}`,
      '',
      f.body,
      '',
      prUrl ? `Pull request: ${prUrl}` : '',
      runUrl ? `Workflow run: ${runUrl}` : '',
      `${FINDING_KEY_MARKER} ${key} -->`,
    ]
      .filter(Boolean)
      .join('\n');
    return {
      title: `${f.id}: ${f.title}`,
      body,
      key,
    };
  });
}

function commandMain() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'build') return buildCommand(rest);
  if (cmd === 'publish') return publishCommand(rest);
  console.error('Usage: node scripts/qa-report.mjs build | publish [--dry-run]');
  process.exit(2);
}

function buildCommand(_args) {
  const baseRef = env('BASE_REF', 'main');
  const sha = env('GITHUB_SHA', execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim());
  const prNumber = env('PR_NUMBER');
  const { runUrl, prUrl } = buildRunUrls();

  const pw = parsePlaywrightJson(PATHS.playwrightJson);
  const cypressComponent = parseCypressResults(PATHS.cypressResults, 'Cypress component');
  const cypressUi = parseCypressResults(PATHS.cypressResults, 'Cypress UI');

  const suites = [
    cypressComponent,
    cypressUi,
    ...PLAYWRIGHT_PROJECT_ORDER.filter((p) => pw.byProject[p]).map((p) => ({
      name: `Playwright ${p}`,
      ...pw.byProject[p],
    })),
  ];

  const visualFailures = suites
    .filter((s) => s.name === 'Playwright visual')
    .flatMap((s) => s.failures);

  const findings = readFindingsFile(PATHS.findings);
  const baseFindings = readBaseFindings(baseRef);
  const newFindings = diffNewFindings(findings, baseFindings);

  let a11yBlock = '';
  if (existsSync(PATHS.a11ySummary)) {
    a11yBlock = readFileSync(PATHS.a11ySummary, 'utf8').trim();
  }

  const commentMd = buildCommentMd({
    suites,
    visualFailures,
    findings,
    newFindings,
    a11yBlock,
    runUrl,
    prUrl,
  });

  const runJson = {
    sha,
    pr: prNumber ? Number(prNumber) : null,
    runUrl,
    time: new Date().toISOString(),
    totals: Object.fromEntries(
      suites.map((s) => [
        s.name,
        {
          passed: s.status === 'not run' ? null : s.passed,
          failed: s.status === 'not run' ? null : s.failed,
          knownBugs: s.status === 'not run' ? null : s.knownBugs,
          skipped: s.status === 'not run' ? null : s.skipped,
          status: s.status,
        },
      ]),
    ),
    failed: suites.reduce((n, s) => n + (s.failed ?? 0), 0),
    knownBugs: suites.reduce((n, s) => n + (s.knownBugs ?? 0), 0),
    visualChanges: visualFailures.length,
    findings: findings.length,
    newFindings: newFindings.length,
  };

  const issuesJson = buildIssuesJson(newFindings, runUrl, prUrl);

  mkdirSync(PATHS.outDir, { recursive: true });
  writeFileSync(path.join(PATHS.outDir, 'comment.md'), commentMd);
  writeFileSync(path.join(PATHS.outDir, 'run.json'), JSON.stringify(runJson, null, 2));
  writeFileSync(path.join(PATHS.outDir, 'issues.json'), JSON.stringify(issuesJson, null, 2));
  console.log(`Wrote ${PATHS.outDir}`);
}

function ghSpawn(args, options = {}) {
  return spawnSync('gh', args, {
    encoding: 'utf8',
    stdio: options.dryRun ? 'pipe' : 'inherit',
    input: options.input,
    ...options,
  });
}

function isHttpNotFound(errOrResult) {
  const text = String(
    errOrResult?.stderr ?? errOrResult?.stdout ?? errOrResult?.message ?? errOrResult ?? '',
  );
  return /Not Found \(HTTP 404\)/i.test(text) || /"status"\s*:\s*"404"/i.test(text);
}

/**
 * REST comment id for PATCH /repos/.../issues/comments/{id}.
 * `gh pr view --json comments` returns GraphQL node ids (IC_...) which 404 on REST.
 * Prefer numeric REST `id` / `databaseId`.
 */
export function commentRestId(comment) {
  if (!comment || typeof comment !== 'object') return null;
  if (typeof comment.id === 'number' && Number.isFinite(comment.id)) return comment.id;
  if (typeof comment.databaseId === 'number' && Number.isFinite(comment.databaseId)) {
    return comment.databaseId;
  }
  if (typeof comment.id === 'string' && /^\d+$/.test(comment.id)) return Number(comment.id);
  return null;
}

export function findCommentWithMarker(comments, marker) {
  return (comments ?? []).find((c) =>
    String(c?.body ?? '').trimStart().startsWith(marker),
  );
}

function listPrCommentsRest(repo, pr) {
  return ghSpawn(
    ['api', `repos/${repo}/issues/${pr}/comments?per_page=100`],
    { stdio: 'pipe' },
  );
}

function patchIssueComment(repo, commentId, body) {
  return spawnSync(
    'gh',
    [
      'api',
      '--method',
      'PATCH',
      '-H',
      'Accept: application/vnd.github+json',
      `/repos/${repo}/issues/comments/${commentId}`,
      '--input',
      '-',
    ],
    {
      input: JSON.stringify({ body }),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
}

function createPrComment(repo, pr, commentPath) {
  return ghSpawn(['pr', 'comment', pr, '--repo', repo, '--body-file', commentPath], {
    stdio: 'pipe',
  });
}

/**
 * Idempotent QA report PR comment publish:
 * list via REST (works with Issues disabled), update by numeric id, else create.
 */
export function publishQaReportComment({
  repo,
  pr,
  commentBody,
  commentPath,
  dryRun = false,
  listComments = listPrCommentsRest,
  patchComment = patchIssueComment,
  createComment = createPrComment,
} = {}) {
  if (dryRun) {
    console.log(
      `[dry-run] list/update-or-create QA report comment on ${repo}#${pr} via REST issues/${pr}/comments`,
    );
    return { action: 'dry-run', commentId: null };
  }

  const listed = listComments(repo, pr);
  if (listed.status !== 0) {
    // Listing should work for PRs even when Issues are disabled; fail closed.
    const errText = String(listed.stderr || listed.stdout || '');
    console.error(errText || 'Failed to list PR comments');
    process.exit(listed.status ?? 1);
  }

  let comments = [];
  try {
    comments = JSON.parse(listed.stdout || '[]');
  } catch {
    console.error('Failed to parse PR comments JSON');
    process.exit(1);
  }

  const existing = findCommentWithMarker(comments, MARKER);
  const commentId = commentRestId(existing);

  if (commentId != null) {
    const patched = patchComment(repo, commentId, commentBody);
    if (patched.status === 0) {
      if (patched.stdout) process.stdout.write(patched.stdout);
      if (patched.stderr) process.stderr.write(patched.stderr);
      console.log(`Updated existing QA report comment ${commentId}`);
      return { action: 'updated', commentId };
    }
    // Comment vanished between list and patch — create once instead of failing.
    if (isHttpNotFound(patched)) {
      console.log(
        `Existing QA report comment ${commentId} not found (404); creating a new comment.`,
      );
    } else {
      if (patched.stdout) process.stdout.write(patched.stdout);
      if (patched.stderr) process.stderr.write(patched.stderr);
      process.exit(patched.status ?? 1);
    }
  }

  const created = createComment(repo, pr, commentPath);
  if (created.stdout) process.stdout.write(created.stdout);
  if (created.stderr) process.stderr.write(created.stderr);
  if (created.status !== 0) process.exit(created.status ?? 1);
  console.log('Created QA report comment');
  return { action: 'created', commentId: null };
}

function publishCommand(args) {
  const dryRun = args.includes('--dry-run');
  const repo = env('GITHUB_REPOSITORY');
  const pr = env('PR_NUMBER');
  if (!pr) {
    console.log('No PR_NUMBER — skipping publish (artifact-only run).');
    return;
  }
  if (!repo) {
    console.error('publish requires GITHUB_REPOSITORY');
    process.exit(2);
  }

  const commentPath = path.join(PATHS.outDir, 'comment.md');
  const issuesPath = path.join(PATHS.outDir, 'issues.json');
  if (!existsSync(commentPath)) {
    console.error('Missing qa-report/comment.md — run build first');
    process.exit(2);
  }
  const commentBody = readFileSync(commentPath, 'utf8');
  const issues = existsSync(issuesPath)
    ? JSON.parse(readFileSync(issuesPath, 'utf8'))
    : [];

  let issuesEnabled = true;
  if (!dryRun) {
    try {
      issuesEnabled = repoHasIssuesEnabled(repo);
    } catch (err) {
      if (isIssuesDisabledError(err)) {
        issuesEnabled = false;
      } else {
        throw err;
      }
    }
  }

  const existingKeys = new Set();
  if (issuesEnabled) {
    const listArgs = [
      'issue',
      'list',
      '--repo',
      repo,
      '--label',
      'qa-finding',
      '--state',
      'all',
      '--json',
      'body',
      '--limit',
      '500',
    ];
    if (dryRun) {
      console.log('[dry-run] gh', listArgs.join(' '));
    }
    const listed = dryRun
      ? { stdout: '[]', status: 0, stderr: '' }
      : ghSpawn(listArgs, { stdio: 'pipe' });
    if (!dryRun && listed.status !== 0) {
      if (isIssuesDisabledError(listed)) {
        issuesEnabled = false;
        console.log(
          'GitHub Issues are disabled for this repository — skipping issue lookup/creation; continuing with PR comments.',
        );
      } else {
        process.exit(listed.status ?? 1);
      }
    } else {
      for (const row of JSON.parse(listed.stdout || '[]')) {
        const keyMatch = row.body?.match(
          new RegExp(`${FINDING_KEY_MARKER}\\s+([\\w-]+)\\s*-->`),
        );
        if (keyMatch) existingKeys.add(keyMatch[1]);
      }
    }
  } else {
    console.log(
      'GitHub Issues are disabled for this repository — skipping issue lookup/creation; continuing with PR comments.',
    );
  }

  publishQaReportComment({
    repo,
    pr,
    commentBody,
    commentPath,
    dryRun,
  });

  const toCreate = filterIssuesToCreate(issues, existingKeys, { issuesEnabled });
  if (!issuesEnabled && issues.length) {
    console.log(
      `Skipped creating ${issues.length} finding issue(s) because Issues are disabled.`,
    );
  }

  for (const issue of toCreate) {
    const bodyFile = path.join(PATHS.outDir, `issue-${issue.key}.md`);
    writeFileSync(bodyFile, issue.body);
    const createIssueArgs = [
      'issue',
      'create',
      '--repo',
      repo,
      '--title',
      issue.title,
      '--label',
      'qa-finding',
      '--body-file',
      bodyFile,
    ];
    if (dryRun) {
      console.log('[dry-run] gh', createIssueArgs.join(' '));
    } else {
      const r = ghSpawn(createIssueArgs);
      if (r.status !== 0) {
        if (isIssuesDisabledError(r)) {
          console.log(
            'GitHub Issues became unavailable during create — stopping further issue creation; PR comment already published.',
          );
          break;
        }
        process.exit(r.status ?? 1);
      }
    }
  }
}

function isExecutedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isExecutedDirectly()) {
  commandMain();
}
