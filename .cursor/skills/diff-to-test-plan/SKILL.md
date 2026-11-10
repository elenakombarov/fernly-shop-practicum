---
name: diff-to-test-plan
description: Analyzes a Git diff or a pull request and writes a test plan for the changed areas. Use when the user asks what to test after a change, a branch, or a pull request, or asks for a test plan from a diff. Recommends Cypress component tests, Cypress UI tests, Playwright E2E tests, Playwright API tests, and accessibility tests. Writes docs/test-plans/<branch>.md. Do NOT write test code.
---

# Diff to test plan

The diff says what changed. `docs/PRODUCT.md` and `GET /openapi.json` say what to prove. `docs/APP-MAP.md` says which page calls which endpoint. When neither document says what should happen, mark the row "assumed — ask", with no expected result.

1. Take the diff the user named.
   - A pull request: `gh pr diff <number>` and `gh pr view <number> --json headRefName,baseRefName,title,url`.
   - A range: `git diff <range>` and `git diff --name-status <range>`.
   - Otherwise the current branch (`git branch --show-current`). If it tracks an upstream, diff `@{upstream}...HEAD`. If it does not, and it is not `init`, diff `init...HEAD` (`init` is the shop's starting branch). On `init`, or when that range is empty, use `git diff` and `git diff --cached`.
   - No branch name: stop and ask. Every diff empty: write the plan saying nothing changed, and stop.

2. Read the name-status list and the hunks. Group files by area: `web/src/components`, `web/src/pages` (and `web/src/App.tsx`, the layout), `web/src/api`, `web/src/slots`, `api/src` (including `api/src/features`), and anything else.

3. Recommend a level only where the change can affect what a customer or the contract does. Use the table below. One change can need more than one row. Leave a level the diff does not touch as "None."

4. For an API row, take status codes and `rule` values from `GET /openapi.json` (the API must be running) and behavior from `docs/PRODUCT.md`. The diff names the endpoint or the screen. Do not read `api/src` or `web/src` to decide the expected result. If `/openapi.json` cannot be fetched, say so, and do not invent statuses.

5. Write `docs/test-plans/<branch>.md`. `<branch>` is the head branch, with `/` replaced by `-`. Every row is **not yet tested**.

## Which level

| Change | Recommend | Where the spec goes | Tag |
| --- | --- | --- | --- |
| `web/src/components/**`, or a component under `web/src/slots/**` | Cypress component. Props in the test. Equivalence classes, boundaries (0, 1, the limit, one past it), disabled / loading / empty / error, and callbacks (called with what). | `web/cypress/component/<Name>.cy.tsx` | `@component` |
| `web/src/pages/**`, `web/src/App.tsx`, the layout, or `web/src/api/**` (the data the page shows) | Cypress UI. One fixture per scenario. Intercept only `/api/*`. Cover a normal answer, an empty answer, an error (500), signed out (401), and an extreme value when this change can affect that state. | `web/cypress/ui/<page>.cy.ts` | `@ui` |
| A flow that leaves the page, or that must show the real API's answer | Playwright E2E. A browser path on `WEB_URL`. No hard-coded localhost. | `tests/e2e/<flow>.spec.ts` | `@e2e` |
| `api/src/**` routes, rules, schemas, or OpenAPI paths, including `api/src/features/**` | Playwright API. Per changed endpoint: a positive success, one invalid input (HTTP 400 and the documented `rule`), and HTTP 404 for an unknown id where the docs list 404. | `tests/api/<area>.spec.ts` | `@api` |
| A name, role, keyboard path, focus, contrast, or image text | Accessibility. WCAG 2.1 AA from `docs/PRODUCT.md`: a name for every button and field, alt text for a meaningful image, contrast 4.5:1, keyboard only, visible focus. Page scans go through the axe helper in `tests/a11y`. A single component's role and name is also a Cypress component row. | `tests/a11y/pages.spec.ts` | a11y project |

A slot component (`web/src/slots/README.md`) is a Cypress component row plus a Cypress UI row for the page that mounts it: plant page, plant card, or cart summary. A feature file (`api/src/features/README.md`) that adds a route is a Playwright API row.

Files that do not change customer-visible behavior (lockfiles, CI, docs other than the oracle, this skill) go under "Seen, no test", with the path and why.

## The plan file

```markdown
# Test plan: <branch>

Source: <the diff command, or the pull request URL>
Base: <base ref, or working tree>
Every row is **not yet tested**.

## Cypress component tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| CT-01 | `web/src/components/PriceTag.tsx` | … | a PRODUCT.md line, or "assumed — ask" | `web/cypress/component/PriceTag.cy.tsx` |

## Cypress UI tests

UI-01 …

## Playwright E2E tests

E2E-01 …

## Playwright API tests

API-01 …

## Accessibility tests

A11Y-01 …

## Seen, no test

| Path | Why no test |
| --- | --- |
```

A heading with no rows says "None."

## Constraints

- Do not write Cypress or Playwright test code.
- Do not modify `web/src` or `api/src`.
- Do not commit or push.
- Do not change an expected result to match the diff. The documents win.
