# Test plan: p72-scratch

Source: `git branch --show-current`, `git status --short`, `git diff`, `git diff --cached`, `git diff --name-status`, `git diff --cached --name-status`, and `git ls-files --others --exclude-standard` (untracked files). Branch confirmed as `p72-scratch`.
Base: working tree
Every row is **not yet tested**.

The only application hunk is unstaged `web/src/components/PetSafeTag.tsx`: the `petSafe: true` text changes, and the `petSafe: false` text does not. `git diff --cached` is empty. No untracked application files.

## Cypress component tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| CT-01 | `web/src/components/PetSafeTag.tsx` | Prop `petSafe: true` is one equivalence class of the boolean prop. The component has no numeric boundary, no disabled / loading / empty / error state, and no callback. PRODUCT.md and OpenAPI do not state the words this class must show, so this row has no expected result. | assumed — ask | `web/cypress/component/PetSafeTag.cy.tsx` |
| CT-02 | `web/src/components/PetSafeTag.tsx` | Prop `petSafe: false` is the other equivalence class of the boolean prop. Same limits as CT-01: no numeric boundary, no disabled / loading / empty / error state, and no callback. PRODUCT.md and OpenAPI do not state the words this class must show, so this row has no expected result. | assumed — ask | `web/cypress/component/PetSafeTag.cy.tsx` |

## Cypress UI tests

None.

## Playwright E2E tests

None.

## Playwright API tests

None.

`GET /openapi.json` was not fetched. The uncommitted diff does not change an API route, so there are no status codes or `rule` values to take from the contract.

## Accessibility tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| A11Y-01 | `web/src/components/PetSafeTag.tsx` | The changed text is the tag's accessible name. The tag is on Browse (`/`, inside `PlantCard`) and Plant (`/plants/:plantId`). PRODUCT.md Accessibility requires WCAG 2.1 AA: a name for every button and field, alternative text for a meaningful image, contrast 4.5:1, keyboard only, and visible focus. It does not state this tag's words, so this row has no expected name. | assumed — ask | `tests/a11y/pages.spec.ts` |

## Seen, no test

| Path | Why no test |
| --- | --- |
| `.cursor/agents/change-triage.md` | Cursor agent instructions. Not customer-visible shop behavior. |
| `.cursor/skills/diff-to-test-plan/SKILL.md` | This skill. Not customer-visible shop behavior. |
| `docs/test-plans/init.md` | A test-plan document. Not customer-visible shop behavior. |
