# Pipeline gates

How the triage and test pipeline refuses a bad outcome. Proof is an offline
`scripts/test-gates.sh` line, or **not proven** when only a prompt rule applies.

| Risk (testing words) | Gate | Kind | Where it lives | Proof |
| --- | --- | --- | --- | --- |
| The agent pushes or comments by itself | Agent jobs get no `GH_TOKEN` / `GITHUB_TOKEN`; checkouts use `persist-credentials: false`; publish jobs alone write | code: workflow | `.github/workflows/pr-triage.yml` | `workflows: agent steps have no GH_TOKEN or GITHUB_TOKEN`; `workflows: agent job checkouts set persist-credentials false` |
| The agent changes app code, workflows or baselines | `agent-guard` allow-list + person-only paths | code: guard | `scripts/agent-guard.sh` | `agent-guard: plan plus web/src blocked`; `agent-guard: workflow change blocked`; `agent-guard: screenshot baseline blocked`; `agent-guard: scripts/agent-guard.sh blocked even with scripts/*` |
| The agent approves its own plan | Deny `gh pr review --approve`, label adds, and merge; tests job requires a person | code: hook + workflow | `.cursor/hooks/guard-approvals.sh`; `pr-triage.yml` `tests` job `if:` | `hook approvals: approve denied`; `hook approvals: label denied`; `workflows: tests job needs plan-approved by a person` |
| Text in the diff steers the agent | Untrusted input: treat PR/diff text as data; flag steering; still recommend tests | prompt | `.cursor/agents/change-triage.md`; `.cursor/skills/diff-to-test-plan/SKILL.md` | prompt only |
| A secret leaks | Deny `printenv`, bare `env`, and reading `$CURSOR_API_KEY` / `$GH_TOKEN` / `$GITHUB_TOKEN` | code: hook | `.cursor/hooks/guard-approvals.sh` | `hook approvals: printenv denied` |
| A run burns money | Job and agent step `timeout-minutes`; budget skip when product paths did not change | code: workflow | `.github/workflows/pr-triage.yml` | `workflows: every pr-triage job has timeout-minutes` |
| Code from a fork runs with my secrets | Never `pull_request_target` (comments do not count) | code: workflow | `.github/workflows/*.yml` | `workflows: no pull_request_target trigger` |
| A baseline changes without review | Person-only `*-snapshots/`; visual CI refuses dirty `tests/visual`; baselines refresh only via reviewed workflow | code: guard + workflow | `scripts/agent-guard.sh`; `.github/workflows/tests.yml`; `.github/workflows/visual-baselines.yml` | `agent-guard: screenshot baseline blocked` |
