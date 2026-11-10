# Test plan: feature-plant-reviews

Source: `untrusted.diff` (produced as `git diff origin/<base>...HEAD`)
Base: origin base from `untrusted.diff` provenance (exact base ref name unknown)
Every row is **not yet tested**.

`GET /openapi.json` was not reachable from this environment (localhost fetch blocked). No status codes or `rule` values were taken from the contract. Do not invent them. `docs/PRODUCT.md` does not describe plant reviews; rows whose expected result would need that behavior or OpenAPI are **assumed — ask** with no expected result. Accessibility rows that only need WCAG 2.1 AA from PRODUCT.md cite that section.

## Cypress component tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| CT-01 | `web/src/components/ReviewList.tsx` | Empty class: `count` 0 (boundary). PRODUCT.md and OpenAPI do not state the empty-copy words, so this row has no expected result. | assumed — ask | `web/cypress/component/ReviewList.cy.tsx` |
| CT-02 | `web/src/components/ReviewList.tsx` | One-review class: `count` 1 (boundary) with one item in `reviews`. PRODUCT.md and OpenAPI do not state average/count copy or singular wording, so this row has no expected result. | assumed — ask | `web/cypress/component/ReviewList.cy.tsx` |
| CT-03 | `web/src/components/ReviewList.tsx` | Many-reviews class: `count` > 1 with multiple items. PRODUCT.md and OpenAPI do not state plural copy or list order, so this row has no expected result. | assumed — ask | `web/cypress/component/ReviewList.cy.tsx` |
| CT-04 | `web/src/components/ReviewForm.tsx` | Valid submit: rating in 1–5 and trimmed text length at the lower bound (10) calls `onSubmit` with `{ rating, text }`. PRODUCT.md and OpenAPI do not state client validation rules, so this row has no expected result. | assumed — ask | `web/cypress/component/ReviewForm.cy.tsx` |
| CT-05 | `web/src/components/ReviewForm.tsx` | Rating boundary: rating still 0 does not call `onSubmit`. PRODUCT.md and OpenAPI do not state the client message, so this row has no expected result. | assumed — ask | `web/cypress/component/ReviewForm.cy.tsx` |
| CT-06 | `web/src/components/ReviewForm.tsx` | Text length one past the lower bound failure: trimmed length 9 does not call `onSubmit`. PRODUCT.md and OpenAPI do not state the client message, so this row has no expected result. | assumed — ask | `web/cypress/component/ReviewForm.cy.tsx` |
| CT-07 | `web/src/components/ReviewForm.tsx` | Text length at the upper bound (500) is accepted by the form when rating is set. PRODUCT.md and OpenAPI do not state the client limit, so this row has no expected result. | assumed — ask | `web/cypress/component/ReviewForm.cy.tsx` |
| CT-08 | `web/src/components/ReviewForm.tsx` | `busy: true` disables the submit control and shows a busy label. PRODUCT.md and OpenAPI do not state the busy words, so this row has no expected result. | assumed — ask | `web/cypress/component/ReviewForm.cy.tsx` |
| CT-09 | `web/src/components/ReviewForm.tsx` | `error` prop (non-null) is shown as an alert-style message; null shows none. PRODUCT.md and OpenAPI do not state how API errors surface in this form, so this row has no expected result. | assumed — ask | `web/cypress/component/ReviewForm.cy.tsx` |
| CT-10 | `web/src/components/StarRatingInput.tsx` | Equivalence: each star value 1–5 calls `onChange` with that number; `value` marks the selected star. PRODUCT.md does not define a star-rating control, so this row has no expected result for selection visuals. | assumed — ask | `web/cypress/component/StarRatingInput.cy.tsx` |
| CT-11 | `web/src/components/StarRatingInput.tsx` | Accessible name and role: the control exposes a radiogroup (or equivalent) with a name a screen reader can announce, and each star option has a name. PRODUCT.md Accessibility requires a name for every button and form field (WCAG 2.1 AA). | PRODUCT.md Accessibility (WCAG 2.1 AA: name for every button and field) | `web/cypress/component/StarRatingInput.cy.tsx` |
| CT-12 | `web/src/components/StarRatingInput.tsx` | Keyboard path: the rating can be changed with the keyboard alone (Tab into the group, arrow keys change the value), and focus stays visible. PRODUCT.md Accessibility requires keyboard-only use and visible focus. | PRODUCT.md Accessibility (WCAG 2.1 AA: keyboard only, visible focus) | `web/cypress/component/StarRatingInput.cy.tsx` |
| CT-13 | `web/src/slots/plant-page/reviews.tsx` | Slot mount with a plant prop: Reviews heading region is present; signed-out vs signed-in write affordance is one of the slot's customer-visible states. PRODUCT.md does not describe reviews on the plant page, so this row has no expected result for copy or when the form appears. | assumed — ask | `web/cypress/component/ReviewsSlot.cy.tsx` |

## Cypress UI tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| UI-01 | `web/src/slots/plant-page/reviews.tsx` (plant page `/plants/:plantId`) | Normal fixture: intercept `GET /api/plants/{plantId}/reviews` with a non-empty list; the Reviews section shows the fixture's average, count, and review bodies. PRODUCT.md and OpenAPI do not state review UI copy or average rounding, so this row has no expected result. | assumed — ask | `web/cypress/ui/plant.cy.ts` |
| UI-02 | `web/src/slots/plant-page/reviews.tsx` (plant page `/plants/:plantId`) | Empty fixture: intercept reviews with `count` 0 / empty `reviews`; the section shows an empty state and does not pretend there are reviews. PRODUCT.md and OpenAPI do not state the empty words, so this row has no expected result. | assumed — ask | `web/cypress/ui/plant.cy.ts` |
| UI-03 | `web/src/slots/plant-page/reviews.tsx` (plant page `/plants/:plantId`) | Error fixture: intercept `GET /api/plants/{plantId}/reviews` → 500; the section reports failure and offers retry. PRODUCT.md does not describe reviews load errors (catalog empty/error rules do not cover this section), so this row has no expected result. | assumed — ask | `web/cypress/ui/plant.cy.ts` |
| UI-04 | `web/src/slots/plant-page/reviews.tsx` (plant page `/plants/:plantId`) | Signed out: Reviews are still readable from the public GET fixture; the write path asks the customer to sign in (link toward login with `next` for this plant). PRODUCT.md does not describe review write gating, so this row has no expected result. | assumed — ask | `web/cypress/ui/plant.cy.ts` |
| UI-05 | `web/src/slots/plant-page/reviews.tsx` (plant page `/plants/:plantId`) | Signed in: Write a review form is available; posting via intercept on `POST /api/plants/{plantId}/reviews` shows thanks and refreshes the list from fixtures. PRODUCT.md does not describe posting reviews, so this row has no expected result. | assumed — ask | `web/cypress/ui/plant.cy.ts` |
| UI-06 | `web/src/slots/plant-page/reviews.tsx` (plant page `/plants/:plantId`) | Extreme / rejection fixture: signed-in POST intercept returns an error body the page surfaces on the form (e.g. conflict or validation). PRODUCT.md and OpenAPI (unreachable) do not supply the expected status or message, so this row has no expected result. | assumed — ask | `web/cypress/ui/plant.cy.ts` |

## Playwright E2E tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| E2E-01 | `web/src/slots/plant-page/reviews.tsx` + `api/src/features/plant-reviews.ts` | Signed-in customer opens a plant on `WEB_URL`, writes a review through the real API, and sees the new review in the Reviews section without a hard-coded localhost. PRODUCT.md does not describe this flow, so this row has no expected result. | assumed — ask | `tests/e2e/plant-reviews.spec.ts` |
| E2E-02 | `web/src/slots/plant-page/reviews.tsx` | Signed-out customer on a plant follows Sign in to write a review and lands on login with a `next` back to that plant (flow leaves the plant page). PRODUCT.md does not describe this reviews entry to login, so this row has no expected result. | assumed — ask | `tests/e2e/plant-reviews.spec.ts` |

## Playwright API tests

`GET /openapi.json` could not be fetched. Status codes and `rule` values below are not asserted from the contract.

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| API-01 | `api/src/features/plant-reviews.ts` | Positive success for `GET /api/plants/{plantId}/reviews` on a known plant. Expected status and body shape unknown without OpenAPI; PRODUCT.md does not describe reviews. | assumed — ask | `tests/api/reviews.spec.ts` |
| API-02 | `api/src/features/plant-reviews.ts` | Unknown plant id on `GET /api/plants/{plantId}/reviews`. Whether 404 is documented cannot be confirmed without OpenAPI; no expected result. | assumed — ask | `tests/api/reviews.spec.ts` |
| API-03 | `api/src/features/plant-reviews.ts` | Positive success for signed-in `POST /api/plants/{plantId}/reviews` with valid rating and text. Expected status and body unknown without OpenAPI; PRODUCT.md does not describe reviews. | assumed — ask | `tests/api/reviews.spec.ts` |
| API-04 | `api/src/features/plant-reviews.ts` | Invalid input on `POST /api/plants/{plantId}/reviews` (e.g. rating or text outside documented bounds). Expected HTTP 400 and `rule` unknown without OpenAPI; no expected result. | assumed — ask | `tests/api/reviews.spec.ts` |
| API-05 | `api/src/features/plant-reviews.ts` | Unauthenticated `POST /api/plants/{plantId}/reviews`. Expected status and `rule` unknown without OpenAPI; no expected result. | assumed — ask | `tests/api/reviews.spec.ts` |
| API-06 | `api/src/features/plant-reviews.ts` | Second review by the same customer for the same plant (duplicate). Expected conflict status and `rule` unknown without OpenAPI; PRODUCT.md does not describe one-review-per-plant; no expected result. | assumed — ask | `tests/api/reviews.spec.ts` |
| API-07 | `api/src/features/plant-reviews.ts` | Positive success for `DELETE /api/reviews/{reviewId}` by the author. Expected status unknown without OpenAPI; PRODUCT.md does not describe review deletion; no expected result. | assumed — ask | `tests/api/reviews.spec.ts` |
| API-08 | `api/src/features/plant-reviews.ts` | `DELETE /api/reviews/{reviewId}` for an unknown id (and non-author case if the contract distinguishes it). Expected status unknown without OpenAPI; no expected result. | assumed — ask | `tests/api/reviews.spec.ts` |

## Accessibility tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| A11Y-01 | `web/src/slots/plant-page/reviews.tsx` (plant page `/plants/:plantId`) | Axe scan of the plant page with the Reviews section mounted: every button and field in Reviews has a name; meaningful images have alt text; contrast meets 4.5:1; keyboard only; visible focus. | PRODUCT.md Accessibility (WCAG 2.1 AA) | `tests/a11y/pages.spec.ts` |
| A11Y-02 | `web/src/components/StarRatingInput.tsx` | Star rating on the plant page: keyboard-only change of rating, announced selected value, and visible focus within the group. | PRODUCT.md Accessibility (WCAG 2.1 AA: keyboard only, visible focus, name for every field) | `tests/a11y/pages.spec.ts` |

## Seen, no test

| Path | Why no test |
| --- | --- |
| `docs/features/plant-reviews.md` | Feature documentation added in the diff. Not the PRODUCT.md / OpenAPI oracle; not customer-visible runtime behavior. |
| `web/src/components/Reviews.module.css` | Stylesheet only. No separate behavioral assertion beyond page a11y contrast covered under A11Y-01. |
| `web/src/components/StarRatingInput.module.css` | Stylesheet only. Contrast/keyboard covered under CT-11/CT-12 and A11Y-02. |
