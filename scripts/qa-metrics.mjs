#!/usr/bin/env node
/**
 * QA pipeline metrics from GitHub (read-only via gh) + optional PR metrics comment.
 * Node 22+, no npm dependencies. Never creates GitHub issues.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isIssuesDisabledError,
  repoHasIssuesEnabled,
} from './github-issues.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = path.join(ROOT, 'docs/QA-METRICS.md');
const REPORT_DIR = path.join(ROOT, 'qa-report');
const QA_REPORT_MARKER = '<!-- fernly-qa-report -->';
const METRICS_MARKER = '<!-- fernly-qa-metrics -->';
const PLAN_REVIEW_RE = /^Plan review:\s*(\d+)\s*\/\s*(\d+)/i;
const TRIAGE_WORKFLOW = 'pr-triage.yml';
const TESTS_WORKFLOW = 'tests.yml';

function env(name, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

function gh(args, { input } = {}) {
  const result = execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    input,
  });
  return result.trim();
}

function ghJson(args) {
  const text = gh(args);
  return JSON.parse(text || 'null');
}

function ghApiJson(route) {
  return JSON.parse(gh(['api', route]));
}

function resolveRepo() {
  const fromEnv = env('GITHUB_REPOSITORY');
  if (fromEnv) return fromEnv;
  return ghJson(['repo', 'view', '--json', 'nameWithOwner']).nameWithOwner;
}

function isBotLogin(login) {
  if (!login) return true;
  if (login === 'github-actions' || login === 'github-actions[bot]') return true;
  return login.endsWith('[bot]');
}

function bodyStartsWithMarker(body, marker) {
  return String(body ?? '').trimStart().startsWith(marker);
}

function minutesBetween(isoStart, isoEnd) {
  if (!isoStart || !isoEnd) return null;
  const ms = new Date(isoEnd).getTime() - new Date(isoStart).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  return ms / 60_000;
}

function round1(n) {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n * 10) / 10;
}

function fmtMin(n) {
  const r = round1(n);
  return r == null ? '—' : String(r);
}

function fmtInt(n) {
  return n == null ? '—' : String(n);
}

function fmtRatio(num, den) {
  if (den == null || den === 0) return '—';
  const pct = (100 * num) / den;
  return `${num}/${den} (${pct.toFixed(1)}%)`;
}

function escapeMdCell(text) {
  return String(text ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function stableIso(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** @param {string} repo @param {number} prNumber */
function fetchIssueComments(repo, prNumber) {
  const out = [];
  let page = 1;
  for (;;) {
    const chunk = ghApiJson(
      `repos/${repo}/issues/${prNumber}/comments?per_page=100&page=${page}`,
    );
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    for (const c of chunk) {
      out.push({
        id: c.id,
        login: c.user?.login ?? '',
        createdAt: c.created_at,
        body: c.body ?? '',
      });
    }
    if (chunk.length < 100) break;
    page += 1;
  }
  out.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return out;
}

function parsePlanReview(comments) {
  const human = comments.filter((c) => !isBotLogin(c.login));
  for (let i = human.length - 1; i >= 0; i--) {
    const trimmed = human[i].body.trimStart();
    const m = PLAN_REVIEW_RE.exec(trimmed);
    if (m) {
      return { rowsRight: Number(m[1]), rowsReviewed: Number(m[2]) };
    }
  }
  return { rowsRight: null, rowsReviewed: null };
}

function firstPlanCommentAt(comments) {
  for (const c of comments) {
    if (!isBotLogin(c.login)) continue;
    if (bodyStartsWithMarker(c.body, QA_REPORT_MARKER)) continue;
    if (bodyStartsWithMarker(c.body, METRICS_MARKER)) continue;
    return c.createdAt;
  }
  return null;
}

function firstQaReportAt(comments) {
  for (const c of comments) {
    if (bodyStartsWithMarker(c.body, QA_REPORT_MARKER)) return c.createdAt;
  }
  return null;
}

function workflowMinutesForBranch(repo, workflowFile, branch) {
  const runs = ghJson([
    'run',
    'list',
    '--repo',
    repo,
    '--workflow',
    workflowFile,
    '--branch',
    branch,
    '--limit',
    '200',
    '--json',
    'status,conclusion,createdAt,updatedAt,databaseId,url,name',
  ]);
  let totalMin = 0;
  let completed = 0;
  let failed = 0;
  let latest = null;
  for (const run of runs ?? []) {
    if (!latest) latest = run;
    if (run.status !== 'completed') continue;
    completed += 1;
    if (run.conclusion === 'failure') failed += 1;
    const d = minutesBetween(run.createdAt, run.updatedAt);
    if (d != null) totalMin += d;
  }
  return {
    totalMin: round1(totalMin),
    completed,
    failed,
    latest,
  };
}

function artifactNamesForRun(repo, runId) {
  if (!runId) return [];
  try {
    const data = ghApiJson(
      `repos/${repo}/actions/runs/${runId}/artifacts?per_page=100`,
    );
    return (data.artifacts ?? []).map((a) => a.name).sort();
  } catch {
    return [];
  }
}

function loadQaFindings(repo) {
  try {
    if (!repoHasIssuesEnabled(repo)) {
      console.log(
        'GitHub Issues are disabled for this repository — skipping qa-finding issue metrics.',
      );
      return [];
    }
  } catch (err) {
    if (isIssuesDisabledError(err)) {
      console.log(
        'GitHub Issues are disabled for this repository — skipping qa-finding issue metrics.',
      );
      return [];
    }
    throw err;
  }

  try {
    return ghJson([
      'issue',
      'list',
      '--repo',
      repo,
      '--label',
      'qa-finding',
      '--state',
      'all',
      '--limit',
      '500',
      '--json',
      'number,body,state,stateReason',
    ]);
  } catch (err) {
    if (isIssuesDisabledError(err)) {
      console.log(
        'GitHub Issues are disabled for this repository — skipping qa-finding issue metrics.',
      );
      return [];
    }
    throw err;
  }
}

function issueLinksToPr(body, repo, prNumber) {
  const text = String(body ?? '');
  const full = `https://github.com/${repo}/pull/${prNumber}`;
  if (text.includes(full)) return true;
  if (new RegExp(`/pull/${prNumber}(?:\\D|$)`).test(text)) return true;
  return false;
}

function findingsForPr(allIssues, repo, prNumber) {
  const linked = (allIssues ?? []).filter((i) =>
    issueLinksToPr(i.body, repo, prNumber),
  );
  const falseAlarms = linked.filter(
    (i) =>
      i.state === 'CLOSED' &&
      String(i.stateReason ?? '').toUpperCase() === 'NOT_PLANNED',
  ).length;
  return { findings: linked.length, falseAlarms };
}

function readLocalRunJson() {
  const p = path.join(REPORT_DIR, 'run.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function buildMarkdown(repo, rows, generatedAt) {
  let sumRight = 0;
  let sumReviewed = 0;
  let sumFindings = 0;
  let sumFalse = 0;

  for (const r of rows) {
    if (r.rowsRight != null) sumRight += r.rowsRight;
    if (r.rowsReviewed != null) sumReviewed += r.rowsReviewed;
    sumFindings += r.findings;
    sumFalse += r.falseAlarms;
  }

  const lines = [];
  lines.push('# QA pipeline metrics', '');
  lines.push(
    `Repo: \`${repo}\`. Generated ${generatedAt} by \`node scripts/qa-metrics.mjs\` (read-only collection; uses \`gh\` only; never opens issues).`,
    '',
  );
  lines.push(
    `**Totals:** routing accuracy = ${fmtRatio(sumRight, sumReviewed)}; false-alarm rate = ${fmtRatio(sumFalse, sumFindings)}.`,
    '',
  );
  lines.push(
    '**Spend:** agent cost is not available in GitHub; see the [Cursor dashboard](https://cursor.com/dashboard) for usage and billing.',
    '',
  );

  lines.push(
    '| PR | Branch | Plan review | CI status | Tests min | Triage min | Artifacts | Findings | False alarms |',
    '| --- | --- | --- | --- | ---: | ---: | --- | ---: | ---: |',
  );

  for (const r of rows) {
    const prCell = `[#${r.number}](${r.url})`;
    const planCell =
      r.rowsRight != null && r.rowsReviewed != null
        ? `${r.rowsRight}/${r.rowsReviewed}`
        : '—';
    const artifacts = r.artifacts?.length ? r.artifacts.join(', ') : '—';
    lines.push(
      `| ${prCell} | ${escapeMdCell(r.branch)} | ${planCell} | ${escapeMdCell(r.ciStatus)} | ${fmtMin(r.testsMin)} | ${fmtMin(r.agentMin)} | ${escapeMdCell(artifacts)} | ${fmtInt(r.findings)} | ${fmtInt(r.falseAlarms)} |`,
    );
  }

  if (!rows.length) {
    lines.push('| — | — | — | — | — | — | — | — | — |');
  }

  lines.push('', '## How each number is measured', '');
  lines.push(
    '- **Pull requests:** every open or closed PR with the `plan-approved` label (`gh pr list --label plan-approved --state all`).',
    '- **Plan review:** the last issue comment on that PR from a human (non-bot) author whose body starts with `Plan review: N/M` (shown as `N/M`).',
    '- **CI status:** conclusion of the latest `tests.yml` run on the PR head branch (`success` / `failure` / `cancelled` / `—`).',
    '- **Tests min:** sum of wall-clock minutes for completed `tests.yml` runs on the PR head branch.',
    `- **Triage min:** sum of wall-clock minutes for completed \`${TRIAGE_WORKFLOW}\` runs on the PR head branch.`,
    '- **Artifacts:** artifact names attached to the latest `tests.yml` run when available.',
    '- **Findings:** open or closed issues labeled `qa-finding` whose body links to that pull request.',
    '- **False alarms:** those findings that are closed with GitHub state reason **not planned** (`NOT_PLANNED`).',
    '- **Routing accuracy:** Σ plan rows right ÷ Σ plan rows reviewed across labeled PRs.',
    '- **False-alarm rate:** Σ false alarms ÷ Σ findings across labeled PRs.',
    '',
  );

  return `${lines.join('\n')}\n`;
}

function buildPrComment({ repo, row, localRun, runUrl, generatedAt }) {
  const lines = [METRICS_MARKER, '', '## QA pipeline metrics', ''];
  if (runUrl) lines.push(`[Workflow run](${runUrl})`, '');

  const plan =
    row.rowsRight != null && row.rowsReviewed != null
      ? `${row.rowsRight}/${row.rowsReviewed}`
      : '—';
  lines.push(`Plan review: ${plan}`, '');

  lines.push(
    '| Metric | Value |',
    '| --- | --- |',
    `| PR | [#${row.number}](${row.url}) |`,
    `| Branch | \`${row.branch}\` |`,
    `| CI status (latest tests.yml) | ${row.ciStatus} |`,
    `| Tests workflow minutes (sum) | ${fmtMin(row.testsMin)} |`,
    `| Triage workflow minutes (sum) | ${fmtMin(row.agentMin)} |`,
    `| Min to first plan comment | ${fmtMin(row.minToPlan)} |`,
    `| Min to first QA report | ${fmtMin(row.minToQaReport)} |`,
    `| Artifacts | ${row.artifacts?.length ? row.artifacts.join(', ') : '—'} |`,
    `| Findings linked to PR | ${fmtInt(row.findings)} |`,
    `| False alarms | ${fmtInt(row.falseAlarms)} |`,
  );

  if (localRun?.totals) {
    lines.push('', '### Current run test totals', '');
    lines.push(
      '| Suite | Passed | Failed | Known bugs | Skipped | Status |',
      '| --- | ---: | ---: | ---: | ---: | --- |',
    );
    for (const [name, t] of Object.entries(localRun.totals)) {
      lines.push(
        `| ${name} | ${t.passed ?? '—'} | ${t.failed ?? '—'} | ${t.knownBugs ?? '—'} | ${t.skipped ?? '—'} | ${t.status} |`,
      );
    }
    lines.push('');
    lines.push(
      `Failed: **${localRun.failed ?? 0}** | Known bugs: **${localRun.knownBugs ?? 0}** | Visual changes: **${localRun.visualChanges ?? 0}** | Findings in branch: **${localRun.findings ?? 0}**`,
      '',
    );
  }

  lines.push(
    '_Generated by `scripts/qa-metrics.mjs`. This comment is updated in place and does not create issues._',
    '',
    `Repo: \`${repo}\` | ${generatedAt}`,
    '',
  );
  return lines.join('\n');
}

function collectLiveRows(repo) {
  const prs = ghJson([
    'pr',
    'list',
    '--repo',
    repo,
    '--label',
    'plan-approved',
    '--state',
    'all',
    '--limit',
    '200',
    '--json',
    'number,title,url,createdAt,headRefName',
  ]);

  const allFindings = loadQaFindings(repo);

  const rows = (prs ?? []).map((pr) => {
    const comments = fetchIssueComments(repo, pr.number);
    const { rowsRight, rowsReviewed } = parsePlanReview(comments);
    const planAt = firstPlanCommentAt(comments);
    const qaAt = firstQaReportAt(comments);
    const { findings, falseAlarms } = findingsForPr(
      allFindings,
      repo,
      pr.number,
    );
    const triage = workflowMinutesForBranch(repo, TRIAGE_WORKFLOW, pr.headRefName);
    const tests = workflowMinutesForBranch(repo, TESTS_WORKFLOW, pr.headRefName);
    const latestTests = tests.latest;
    const artifacts = artifactNamesForRun(repo, latestTests?.databaseId);

    return {
      number: pr.number,
      title: pr.title,
      url: pr.url,
      branch: pr.headRefName,
      rowsRight,
      rowsReviewed,
      minToPlan: round1(minutesBetween(pr.createdAt, planAt)),
      minToQaReport: round1(minutesBetween(pr.createdAt, qaAt)),
      agentMin: triage.totalMin,
      testsMin: tests.totalMin,
      ciStatus: latestTests?.conclusion ?? latestTests?.status ?? '—',
      artifacts,
      findings,
      falseAlarms,
    };
  });

  rows.sort((a, b) => a.number - b.number);
  return rows;
}

function loadFixture(fixtureDir) {
  const data = JSON.parse(
    readFileSync(path.join(fixtureDir, 'metrics-source.json'), 'utf8'),
  );
  return {
    repo: data.repo,
    generatedAt: data.generatedAt ?? '2026-01-01T00:00:00Z',
    rows: data.rows,
    localRun: data.localRun ?? null,
    runUrl: data.runUrl ?? '',
    focusPr: data.focusPr ?? data.rows?.[0]?.number ?? null,
  };
}

function writeOutputs({ repo, rows, generatedAt, localRun, runUrl, focusPr }) {
  const md = buildMarkdown(repo, rows, generatedAt);
  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, md, 'utf8');

  mkdirSync(REPORT_DIR, { recursive: true });
  const focus =
    rows.find((r) => r.number === Number(focusPr)) ?? rows[0] ?? null;
  const comment = focus
    ? buildPrComment({ repo, row: focus, localRun, runUrl, generatedAt })
    : `${METRICS_MARKER}\n\n## QA pipeline metrics\n\n_No plan-approved PRs found._\n`;
  writeFileSync(path.join(REPORT_DIR, 'metrics-comment.md'), comment, 'utf8');

  const metricsJson = {
    repo,
    generatedAt,
    focusPr: focus?.number ?? null,
    planReview:
      focus?.rowsRight != null && focus?.rowsReviewed != null
        ? `Plan review: ${focus.rowsRight}/${focus.rowsReviewed}`
        : 'Plan review: —',
    rows,
    localRun,
  };
  writeFileSync(
    path.join(REPORT_DIR, 'metrics.json'),
    JSON.stringify(metricsJson, null, 2),
    'utf8',
  );

  console.log(`Wrote ${OUT_PATH} (${rows.length} PR(s))`);
  console.log(`Wrote ${path.join(REPORT_DIR, 'metrics-comment.md')}`);
  console.log(`Wrote ${path.join(REPORT_DIR, 'metrics.json')}`);
  return { comment, metricsJson };
}

function publishMetricsComment({ dryRun = false } = {}) {
  const repo = env('GITHUB_REPOSITORY') || resolveRepo();
  const pr = env('PR_NUMBER');
  if (!pr) {
    console.log('No PR_NUMBER — skipping metrics publish (docs-only run).');
    return;
  }

  const commentPath = path.join(REPORT_DIR, 'metrics-comment.md');
  if (!existsSync(commentPath)) {
    console.error('Missing qa-report/metrics-comment.md — run build first');
    process.exit(2);
  }
  const commentBody = readFileSync(commentPath, 'utf8');
  if (!commentBody.trimStart().startsWith(METRICS_MARKER)) {
    console.error('metrics-comment.md missing metrics marker');
    process.exit(2);
  }

  // Never touch issues — only PR comments, and never the QA report marker.
  const listArgs = [
    'api',
    `repos/${repo}/issues/${pr}/comments?per_page=100`,
  ];
  if (dryRun) {
    console.log('[dry-run] gh', listArgs.join(' '));
  }
  const listed = dryRun
    ? { stdout: '[]', status: 0 }
    : spawnSync('gh', listArgs, { encoding: 'utf8' });
  if (!dryRun && listed.status !== 0) {
    process.exit(listed.status ?? 1);
  }

  const comments = JSON.parse(listed.stdout || '[]');
  const existing = comments.find((c) =>
    bodyStartsWithMarker(c.body, METRICS_MARKER),
  );
  const qaReport = comments.find((c) =>
    bodyStartsWithMarker(c.body, QA_REPORT_MARKER),
  );

  if (existing) {
    const editArgs = [
      'api',
      '--method',
      'PATCH',
      '-H',
      'Accept: application/vnd.github+json',
      `/repos/${repo}/issues/comments/${existing.id}`,
      '--input',
      '-',
    ];
    if (dryRun) {
      console.log(`[dry-run] update metrics comment ${existing.id}`);
    } else {
      const r = spawnSync('gh', editArgs, {
        input: JSON.stringify({ body: commentBody }),
        encoding: 'utf8',
        stdio: ['pipe', 'inherit', 'inherit'],
      });
      if (r.status !== 0) process.exit(r.status ?? 1);
    }
  } else {
    const createArgs = [
      'pr',
      'comment',
      pr,
      '--repo',
      repo,
      '--body-file',
      commentPath,
    ];
    if (dryRun) {
      console.log('[dry-run] gh', createArgs.join(' '));
    } else {
      const r = spawnSync('gh', createArgs, {
        encoding: 'utf8',
        stdio: 'inherit',
      });
      if (r.status !== 0) process.exit(r.status ?? 1);
    }
  }

  console.log(
    qaReport
      ? 'Preserved existing QA report comment; metrics comment updated separately.'
      : 'No QA report comment present yet; metrics comment published alone.',
  );
}

function usage() {
  console.error(
    'Usage: node scripts/qa-metrics.mjs build [--fixture <dir>] | publish [--dry-run]',
  );
  process.exit(2);
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  if (cmd !== 'build' && cmd !== 'publish') usage();

  if (cmd === 'publish') {
    publishMetricsComment({ dryRun: args.includes('--dry-run') });
    return;
  }

  const fixtureIdx = args.indexOf('--fixture');
  if (fixtureIdx !== -1) {
    const fixtureDir = path.resolve(args[fixtureIdx + 1] || '');
    if (!fixtureDir || !existsSync(fixtureDir)) {
      console.error('Missing --fixture directory');
      process.exit(2);
    }
    const data = loadFixture(fixtureDir);
    writeOutputs({
      repo: data.repo,
      rows: data.rows,
      generatedAt: data.generatedAt,
      localRun: data.localRun,
      runUrl: data.runUrl,
      focusPr: data.focusPr,
    });
    return;
  }

  const repo = resolveRepo();
  const generatedAt = stableIso();
  const rows = collectLiveRows(repo);
  const localRun = readLocalRunJson();
  const runUrl =
    env('GITHUB_REPOSITORY') && env('GITHUB_RUN_ID')
      ? `https://github.com/${env('GITHUB_REPOSITORY')}/actions/runs/${env('GITHUB_RUN_ID')}`
      : '';
  const focusPr = env('PR_NUMBER') ? Number(env('PR_NUMBER')) : null;
  writeOutputs({
    repo,
    rows,
    generatedAt,
    localRun,
    runUrl,
    focusPr,
  });
}

main();
