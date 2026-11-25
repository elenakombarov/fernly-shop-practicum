# QA pipeline metrics

Repo: `elenakombarov/fernly-shop-practicum`. Generated 2026-11-13T19:38:54Z by `node scripts/qa-metrics.mjs` (read-only collection; uses `gh` only; never opens issues).

**Totals:** routing accuracy = 32/44 (72.7%); false-alarm rate = 0/4 (0.0%).

**Spend:** agent cost is not available in GitHub; see the [Cursor dashboard](https://cursor.com/dashboard) for usage and billing.

| PR | Branch | Plan review | CI status | Tests min | Triage min | Artifacts | Findings | False alarms |
| --- | --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| [#1](https://github.com/elenakombarov/fernly-shop-practicum/pull/1) | feature/promo-codes | 4/10 | failure | 1024.6 | 22 | cypress-results, cypress-screenshots, playwright-reports, playwright-test-results, qa-metrics-doc, qa-report | 0 | 0 |
| [#2](https://github.com/elenakombarov/fernly-shop-practicum/pull/2) | feature/plant-reviews | 5/8 | failure | 16.7 | 16.5 | cypress-results, cypress-screenshots, playwright-reports, playwright-test-results, qa-metrics-doc, qa-report | 0 | 0 |
| [#5](https://github.com/elenakombarov/fernly-shop-practicum/pull/5) | feature/back-in-stock | 23/26 | action_required | 2798.2 | 3527.2 | — | 4 | 0 |

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

