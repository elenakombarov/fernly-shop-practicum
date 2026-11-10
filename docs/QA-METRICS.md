# QA pipeline metrics

Repo: `elenakombarov/fernly-shop-practicum`. Generated 2026-11-09T20:00:00Z by `node scripts/qa-metrics.mjs` (read-only collection; uses `gh` only; never opens issues).

**Totals:** routing accuracy = 6/7 (85.7%); false-alarm rate = 0/1 (0.0%).

**Spend:** agent cost is not available in GitHub; see the [Cursor dashboard](https://cursor.com/dashboard) for usage and billing.

| PR | Branch | Plan review | CI status | Tests min | Triage min | Artifacts | Findings | False alarms |
| --- | --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| [#42](https://github.com/elenakombarov/fernly-shop-practicum/pull/42) | block13-page-objects | 4/5 | failure | 18.3 | 55 | a11y-report, cypress-results, playwright-reports, qa-report | 0 | 0 |
| [#7](https://github.com/elenakombarov/fernly-shop-practicum/pull/7) | sample-plan | 2/2 | success | 10 | 20 | playwright-reports | 1 | 0 |

## How each number is measured

- **Pull requests:** every open or closed PR with the `plan-approved` label (`gh pr list --label plan-approved --state all`).
- **Plan review:** the last issue comment on that PR from a human (non-bot) author whose body starts with `Plan review: N/M` (shown as `N/M`).
- **CI status:** conclusion of the latest `tests.yml` run on the PR head branch (`success` / `failure` / `cancelled` / `—`).
- **Tests min:** sum of wall-clock minutes for completed `tests.yml` runs on the PR head branch.
- **Triage min:** sum of wall-clock minutes for completed `pr-triage.yml` runs on the PR head branch.
- **Artifacts:** artifact names attached to the latest `tests.yml` run when available.
- **Findings:** open or closed issues labeled `qa-finding` whose body links to that pull request.
- **False alarms:** those findings that are closed with GitHub state reason **not planned** (`NOT_PLANNED`).
- **Routing accuracy:** Σ plan rows right ÷ Σ plan rows reviewed across labeled PRs.
- **False-alarm rate:** Σ false alarms ÷ Σ findings across labeled PRs.

