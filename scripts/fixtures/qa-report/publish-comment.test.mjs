/**
 * Regression: QA report comment publish must use REST numeric ids
 * (GraphQL IC_ ids from `gh pr view --json comments` 404 on PATCH).
 */
import {
  commentRestId,
  findCommentWithMarker,
  publishQaReportComment,
} from '../../qa-report.mjs';

const MARKER = '<!-- fernly-qa-report -->';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function section(name) {
  console.log(`\n== ${name} ==`);
}

section('commentRestId accepts REST numeric ids only');
assert(commentRestId({ id: 6755043342 }) === 6755043342, 'numeric id');
assert(commentRestId({ id: '6755043342' }) === 6755043342, 'numeric string id');
assert(
  commentRestId({ id: 'IC_kwDOVgWJuM8AAAABkqHIDg', databaseId: 6755043342 }) ===
    6755043342,
  'databaseId when GraphQL id present',
);
assert(
  commentRestId({ id: 'IC_kwDOVgWJuM8AAAABkqHIDg', databaseId: null }) === null,
  'GraphQL node id alone must not be used for REST PATCH',
);
assert(commentRestId(null) === null, 'null comment');
console.log('PASS commentRestId');

section('findCommentWithMarker');
{
  const comments = [
    { id: 1, body: '<!-- fernly-qa-metrics -->\nmetrics' },
    { id: 2, body: `  ${MARKER}\n## QA report\n` },
  ];
  const hit = findCommentWithMarker(comments, MARKER);
  assert(hit?.id === 2, 'must find QA report marker');
  assert(
    findCommentWithMarker(comments, '<!-- missing -->') == null,
    'missing marker',
  );
  console.log('PASS findCommentWithMarker');
}

section('publish updates existing REST comment (no duplicate create)');
{
  const calls = { list: 0, patch: 0, create: 0 };
  const result = publishQaReportComment({
    repo: 'owner/repo',
    pr: '1',
    commentBody: `${MARKER}\nupdated`,
    commentPath: '/tmp/comment.md',
    listComments: () => {
      calls.list += 1;
      return {
        status: 0,
        stdout: JSON.stringify([
          { id: 42, body: `${MARKER}\nold` },
          { id: 99, body: '<!-- fernly-qa-metrics -->\nm' },
        ]),
        stderr: '',
      };
    },
    patchComment: (repo, id, body) => {
      calls.patch += 1;
      assert(repo === 'owner/repo', 'repo');
      assert(id === 42, `expected REST id 42, got ${id}`);
      assert(body.startsWith(MARKER), 'body keeps marker');
      return { status: 0, stdout: '', stderr: '' };
    },
    createComment: () => {
      calls.create += 1;
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert(result.action === 'updated', `action=${result.action}`);
  assert(calls.list === 1 && calls.patch === 1 && calls.create === 0, 'no create');
  console.log('PASS update existing');
}

section('publish creates when marker missing');
{
  const calls = { create: 0 };
  const result = publishQaReportComment({
    repo: 'owner/repo',
    pr: '1',
    commentBody: `${MARKER}\nnew`,
    commentPath: '/tmp/comment.md',
    listComments: () => ({
      status: 0,
      stdout: JSON.stringify([{ id: 7, body: 'unrelated' }]),
      stderr: '',
    }),
    patchComment: () => {
      throw new Error('patch must not run');
    },
    createComment: () => {
      calls.create += 1;
      return { status: 0, stdout: 'created\n', stderr: '' };
    },
  });
  assert(result.action === 'created', `action=${result.action}`);
  assert(calls.create === 1, 'create once');
  console.log('PASS create when missing');
}

section('publish creates when GraphQL-only id would have 404ed');
{
  const calls = { create: 0, patch: 0 };
  const result = publishQaReportComment({
    repo: 'owner/repo',
    pr: '1',
    commentBody: `${MARKER}\nnew`,
    commentPath: '/tmp/comment.md',
    listComments: () => ({
      status: 0,
      // Mimic unsafe GraphQL payload if it ever reaches publish.
      stdout: JSON.stringify([
        { id: 'IC_kwDOVgWJuM8AAAABkqHIDg', databaseId: null, body: `${MARKER}\nold` },
      ]),
      stderr: '',
    }),
    patchComment: () => {
      calls.patch += 1;
      return { status: 1, stdout: '', stderr: 'gh: Not Found (HTTP 404)' };
    },
    createComment: () => {
      calls.create += 1;
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert(result.action === 'created', 'GraphQL-only id → create, not PATCH');
  assert(calls.patch === 0, 'must not PATCH GraphQL node ids');
  assert(calls.create === 1, 'create once');
  console.log('PASS GraphQL id skipped');
}

section('publish recovers from PATCH 404 by creating once');
{
  const calls = { create: 0 };
  const result = publishQaReportComment({
    repo: 'owner/repo',
    pr: '1',
    commentBody: `${MARKER}\nnew`,
    commentPath: '/tmp/comment.md',
    listComments: () => ({
      status: 0,
      stdout: JSON.stringify([{ id: 55, body: `${MARKER}\nstale` }]),
      stderr: '',
    }),
    patchComment: () => ({
      status: 1,
      stdout: '{"message":"Not Found","status":"404"}',
      stderr: 'gh: Not Found (HTTP 404)\n',
    }),
    createComment: () => {
      calls.create += 1;
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert(result.action === 'created', '404 → create');
  assert(calls.create === 1, 'single create after 404');
  console.log('PASS PATCH 404 fallback create');
}

console.log('\nAll publish-comment regression tests passed.');
