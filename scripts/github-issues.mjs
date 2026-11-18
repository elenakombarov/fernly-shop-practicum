/**
 * Shared GitHub Issues availability helpers for QA report/metrics.
 * Node 22+, no npm dependencies.
 */
import { execFileSync } from 'node:child_process';

export function isIssuesDisabledError(errOrText) {
  const text = String(
    errOrText?.stderr ?? errOrText?.message ?? errOrText ?? '',
  );
  return /has disabled issues/i.test(text);
}

function defaultRepoApi(repo) {
  const raw = execFileSync('gh', ['api', `repos/${repo}`], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(raw || '{}');
}

/**
 * @param {string} repo owner/name
 * @param {{ fetchRepo?: (repo: string) => { has_issues?: boolean } }} [options]
 * @returns {boolean}
 */
export function repoHasIssuesEnabled(repo, options = {}) {
  const fetchRepo = options.fetchRepo ?? defaultRepoApi;
  try {
    const data = fetchRepo(repo);
    return data?.has_issues !== false;
  } catch (err) {
    if (isIssuesDisabledError(err)) return false;
    throw err;
  }
}

/**
 * Apply duplicate prevention and Issues-availability gating.
 * @param {Array<{ key: string }>} issues
 * @param {Set<string>} existingKeys
 * @param {{ issuesEnabled: boolean }} options
 */
export function filterIssuesToCreate(issues, existingKeys, { issuesEnabled }) {
  if (!issuesEnabled) return [];
  return (issues ?? []).filter((issue) => !existingKeys.has(issue.key));
}
