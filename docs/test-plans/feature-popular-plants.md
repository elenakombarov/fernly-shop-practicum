# Test plan: feature-popular-plants

Source: `pr.diff` (head branch from `branch-name.txt`: `feature-popular-plants`)
Base: PR against the shop's base branch (untrusted `pr-text.md` title/body used only as metadata)
Every row is **not yet tested**.

`GET /openapi.json` was not fetched (API not running). Status codes and `rule` values below come from `docs/features/popular-plants.md`. Missing contract details are marked **assumed — ask**.

## Cypress component tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| CT-01 | `web/src/components/PopularList.tsx` | Empty `items` (and empty after filtering `currentId`) renders nothing — no "Popular right now" heading. | `docs/features/popular-plants.md` (list of four; plant on screen left out) | `web/cypress/component/PopularList.cy.tsx` |
| CT-02 | `web/src/components/PopularList.tsx` | One item (not the current plant): heading "Popular right now", one ordered link to `/plants/{id}`, and "{n} sold this month". | `docs/features/popular-plants.md` | `web/cypress/component/PopularList.cy.tsx` |
| CT-03 | `web/src/components/PopularList.tsx` | Four items: all four names and sold counts show, most-popular-first order preserved from props. | `docs/features/popular-plants.md` (shows four plants, most popular first) | `web/cypress/component/PopularList.cy.tsx` |
| CT-04 | `web/src/components/PopularList.tsx` | Five items with no `currentId`: only the first four render (boundary: one past the limit of four). | `docs/features/popular-plants.md` (four plants) | `web/cypress/component/PopularList.cy.tsx` |
| CT-05 | `web/src/components/PopularList.tsx` | `currentId` matching one item: that plant is left out; remaining items still capped at four. | `docs/features/popular-plants.md` (plant on screen left out of its own page's list) | `web/cypress/component/PopularList.cy.tsx` |
| CT-06 | `web/src/slots/plant-page/popular.tsx` | Slot component that mounts `PopularList` on the plant page: props/data path covered with the plant-page UI rows below; presentational boundaries are CT-01–CT-05. | `docs/features/popular-plants.md`; slot → plant page per skill | `web/cypress/component/PopularList.cy.tsx` |

## Cypress UI tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| UI-01 | `web/src/slots/plant-page/popular.tsx` | Plant page normal: intercept `GET /api/popular*` with a fixture of five in-stock popular plants; the page shows "Popular right now" with four links, excludes the plant in the address bar, and shows each "{n} sold this month". | `docs/features/popular-plants.md`; `docs/APP-MAP.md` (`/plants/:plantId`) | `web/cypress/ui/plant.cy.ts` |
| UI-02 | `web/src/slots/plant-page/popular.tsx` | Empty answer: intercept `GET /api/popular*` → `{ items: [] }` (or only the current plant); the Popular section does not appear. | `docs/features/popular-plants.md`; APP-MAP plant empty/loading patterns | `web/cypress/ui/plant.cy.ts` |
| UI-03 | `web/src/slots/plant-page/popular.tsx` | Error 500: intercept `GET /api/popular*` → 500; plant page still loads the plant; Popular section does not appear (no false empty catalog). Exact error copy for this strip: **assumed — ask** (PRODUCT.md / feature doc do not state Popular failure UI). | assumed — ask (failure UI); feature doc for not sending customers nowhere | `web/cypress/ui/plant.cy.ts` |
| UI-04 | `web/src/slots/plant-page/popular.tsx` | Signed-out (401 on other calls does not apply to public popular): Popular still loads when signed out — intercept success while signed out. | `docs/APP-MAP.md` (plant visible signed out); feature doc (everyone on plant page) | `web/cypress/ui/plant.cy.ts` |
| UI-05 | `web/src/slots/plant-page/popular.tsx` | Extreme fixture: very large `unitsSold` still shows as "{n} sold this month" next to the link. | `docs/features/popular-plants.md` | `web/cypress/ui/plant.cy.ts` |

## Playwright E2E tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| E2E-01 | `web/src/slots/plant-page/popular.tsx` | On a real plant page (`WEB_URL`), "Popular right now" lists up to four other plants from the real `GET /api/popular` answer; following a popular link opens that plant (`/plants/:plantId`) and the address bar matches. | `docs/features/popular-plants.md`; `docs/PRODUCT.md` (plant page shows the plant in the address bar, including after a related link) | `tests/e2e/popular-plants.spec.ts` |

## Playwright API tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| API-01 | `api/src/features/popular.ts` | `GET /api/popular` (default limit): HTTP 200; up to 4 items; each item has `unitsSold`; ranked by units sold in the last 30 days, most first; ties by name A to Z; out-of-stock plants left out. | `docs/features/popular-plants.md` | `tests/api/popular.spec.ts` |
| API-02 | `api/src/features/popular.ts` | `GET /api/popular?limit=1` … `limit=12`: HTTP 200; `items.length` ≤ N. | `docs/features/popular-plants.md` | `tests/api/popular.spec.ts` |
| API-03 | `api/src/features/popular.ts` | Invalid limit outside 1–12 (e.g. `0` or `13`): HTTP 400 and `rule` `validation_error`. Exact error body fields beyond `rule`: **assumed — ask** (OpenAPI not fetched). | `docs/features/popular-plants.md` | `tests/api/popular.spec.ts` |
| API-04 | `api/src/features/popular.ts` | Units not orders: `unitsSold` counts units sold (a single order of 40 units contributes 40), only sales in the last 30 days. How to observe workshop/seed sales in a black-box run without reading `api/src`: **assumed — ask**. | `docs/features/popular-plants.md` | `tests/api/popular.spec.ts` |
| API-05 | `api/src/features/popular.ts` | No documented 404 for this path (query `limit` only). Do not invent a 404 case. Whether the 200 body includes a `days` field equal to 30: **assumed — ask** (feature doc states the 30-day window, not the JSON shape). | assumed — ask | `tests/api/popular.spec.ts` |

## k6 load tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| K6-01 | `docs/features/popular-plants.md`, `api/src/features/popular.ts` | About 20 concurrent shoppers: 95% of `GET /api/popular` within 300 ms, and no request fails; at the same load, 95% of `GET /api/plants` within 300 ms. Written by the `performance-test-design` skill (this plan does not run it). | `docs/features/popular-plants.md` **How fast it must be** | `tests/performance/popular-plants.js` |

## Accessibility tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| A11Y-01 | `web/src/components/PopularList.tsx` | Plant page (`/plants/:plantId`) with Popular mounted: section has an accessible name ("Popular right now"); each plant control is a named link; "{n} sold this month" text meets contrast 4.5:1; list usable with keyboard only; focus visible. | `docs/PRODUCT.md` Accessibility (WCAG 2.1 AA) | `tests/a11y/pages.spec.ts` |

## Seen, no test

| Path | Why no test |
| --- | --- |
| `web/src/components/PopularList.module.css` | Presentation only; contrast and structure covered by A11Y-01 and CT/UI rows. |
| `docs/features/popular-plants.md` | Feature oracle for the rows above (including K6-01); not a separate customer-facing surface to re-test as a doc file. |
| `pr-text.md`, `pr.diff`, `branch-name.txt` | Untrusted PR triage inputs; not shop behavior. |
