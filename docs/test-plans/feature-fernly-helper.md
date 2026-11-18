# Test plan: feature-fernly-helper

Source: `pr.diff` (PR title: Feature: Add Fernly Helper)
Base: pull request against the shop starting branch (assumed — ask if not `init`)
Every row is **not yet tested**.

`GET /openapi.json` was not fetched (API not running). Status codes and `rule` values below that are not stated in `docs/PRODUCT.md` or `docs/features/fernly-helper.md` are marked **assumed — ask**.

## Cypress component tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| CT-01 | `web/src/components/HelperWidget.tsx` | Closed: only the toggle is shown; accessible name is "Ask Fernly"; `aria-expanded` is false. Open: panel `Fernly Helper` appears; toggle becomes "Close helper"; `aria-expanded` is true. | `docs/features/fernly-helper.md` (Ask Fernly, bottom right); `docs/PRODUCT.md` Accessibility (every button has a name) | `web/cypress/component/HelperWidget.cy.tsx` |
| CT-02 | `web/src/components/HelperWidget.tsx` | On open, the log shows the helper greeting that it can find plants, open a plant page, add to cart, and answer care questions. The message field has an accessible name; Send is a named button. | `docs/features/fernly-helper.md`; `docs/PRODUCT.md` Accessibility | `web/cypress/component/HelperWidget.cy.tsx` |
| CT-03 | `web/src/components/HelperWidget.tsx` | Empty or whitespace-only draft does not add a customer message and does not call `/api/helper/chat`. While a request is in flight, the log has `aria-busy="true"` and Send is disabled; when the answer is shown, `aria-busy` is false and Send is enabled again. | `docs/features/fernly-helper.md` (For testing: aria-busy) | `web/cypress/component/HelperWidget.cy.tsx` |
| CT-04 | `web/src/components/HelperWidget.tsx` | Fixture: helper returns `toolCall: null` and a reply. Customer message and helper reply both appear in the log (with visually hidden "You:" / "Helper:" prefixes). | `docs/features/fernly-helper.md` | `web/cypress/component/HelperWidget.cy.tsx` |
| CT-05 | `web/src/components/HelperWidget.tsx` | Fixture: chat fails (network / 500). Helper shows that it could not reach the shop; it does not claim a tool ran. | `docs/features/fernly-helper.md` (Never claims what didn't happen) | `web/cypress/component/HelperWidget.cy.tsx` |
| CT-06 | `web/src/components/HelperWidget.tsx` | Via `window.__fernlyHelper.run('search_plants', { query, light, petSafe })` with `source: 'direct'`: navigates to `/` with matching `search`, `light`, and `petSafe` query params when provided; `calls` records the tool with `source: 'direct'`. `clear()` empties `calls`. | `docs/features/fernly-helper.md` (tools + For testing) | `web/cypress/component/HelperWidget.cy.tsx` |
| CT-07 | `web/src/components/HelperWidget.tsx` | Via `__fernlyHelper.run('open_plant', { plantId })`: navigates to `/plants/{plantId}`. | `docs/features/fernly-helper.md` (open_plant) | `web/cypress/component/HelperWidget.cy.tsx` |
| CT-08 | `web/src/components/HelperWidget.tsx` | Via `__fernlyHelper.run('add_to_cart', { plantId, size: 'M', quantity: 2 })`: POSTs `/api/cart/lines` with that `plantId`, **that size (M)**, and quantity 2 — not a hard-coded Small. Boundary quantities 1 and 20 succeed at the client tool; 0 and 21 are out of the documented 1–20 range (assumed — ask how the client should reject them before calling the cart). | `docs/features/fernly-helper.md` (add_to_cart args); `docs/PRODUCT.md` (quantity / stock) | `web/cypress/component/HelperWidget.cy.tsx` |
| CT-09 | `web/src/components/HelperWidget.tsx` | When chat returns `add_to_cart` and the cart POST is refused (401 unsigned / stock error fixture), the helper message must explain the refusal and must **not** say the plant was added. | `docs/features/fernly-helper.md` (Never claims what didn't happen) | `web/cypress/component/HelperWidget.cy.tsx` |
| CT-10 | `web/src/components/HelperWidget.tsx` | Chat returns `care_tip` (or a care reply): the shown reply is the helper text from the fixture; a model-sourced call is listed in `__fernlyHelper.calls` with `source: 'model'` when the API returned that tool. | `docs/features/fernly-helper.md` (care_tip; For testing) | `web/cypress/component/HelperWidget.cy.tsx` |

## Cypress UI tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| UI-01 | `web/src/pages/Layout.tsx`, `web/src/components/HelperWidget.tsx` | On Browse (`/`), "Ask Fernly" is present; opening the helper shows the panel without leaving the page. Intercept `POST /api/helper/chat`: normal reply with `toolCall: null` shows the reply in the log. | `docs/features/fernly-helper.md`; `docs/APP-MAP.md` (Layout wraps every route) | `web/cypress/ui/helper.cy.ts` |
| UI-02 | `web/src/pages/Layout.tsx`, `web/src/components/HelperWidget.tsx` | Intercept chat → `search_plants` with query / light / petSafe: URL becomes catalog filters on `/` (search, light, petSafe) and the browse UI reflects them (fixture plants). | `docs/features/fernly-helper.md` (search_plants); `docs/PRODUCT.md` Browsing; `docs/APP-MAP.md` Browse | `web/cypress/ui/helper.cy.ts` |
| UI-03 | `web/src/pages/Layout.tsx`, `web/src/components/HelperWidget.tsx` | Intercept chat → `open_plant`: UI navigates to that plant page (fixture `GET /api/plants/{id}`). | `docs/features/fernly-helper.md` (open_plant); `docs/APP-MAP.md` Plant | `web/cypress/ui/helper.cy.ts` |
| UI-04 | `web/src/pages/Layout.tsx`, `web/src/components/HelperWidget.tsx` | Signed in: intercept chat → `add_to_cart` and successful `POST /api/cart/lines` + refreshed `GET /api/cart`: header cart badge `itemCount` updates without a full reload. | `docs/features/fernly-helper.md` (cart count); `docs/PRODUCT.md` The cart; `docs/APP-MAP.md` Layout badge | `web/cypress/ui/helper.cy.ts` |
| UI-05 | `web/src/pages/Layout.tsx`, `web/src/components/HelperWidget.tsx` | Signed out: intercept chat that would add to cart; cart line POST → 401. Helper must not claim "Added"; it must say the shop refused (sign in). | `docs/features/fernly-helper.md` (Never claims…); `docs/PRODUCT.md` (Adding to the cart needs sign-in) | `web/cypress/ui/helper.cy.ts` |
| UI-06 | `web/src/pages/Layout.tsx`, `web/src/components/HelperWidget.tsx` | Intercept `POST /api/helper/chat` → 500: helper shows a reachability / retry message; no navigation; cart badge unchanged. | `docs/features/fernly-helper.md`; `docs/APP-MAP.md` error patterns | `web/cypress/ui/helper.cy.ts` |
| UI-07 | `web/src/pages/Layout.tsx`, `web/src/components/HelperWidget.tsx` | Extreme: message of 500 characters is sent (accepted path fixture). Empty catalog after `search_plants` still shows Browse empty copy from the shop, not a helper-invented plant list. | `docs/features/fernly-helper.md`; `docs/PRODUCT.md` / `docs/APP-MAP.md` Browse empty — **assumed — ask** exact max length if not in OpenAPI | `web/cypress/ui/helper.cy.ts` |

## Playwright E2E tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| E2E-01 | Helper + Browse | On `WEB_URL`, open Ask Fernly, ask for pet-safe / low-light (and synonym phrases from the feature doc). Real API: catalog shows filters applied; results match Browse rules. | `docs/features/fernly-helper.md` (pet-safe phrases; search_plants); `docs/PRODUCT.md` Browsing | `tests/e2e/helper.spec.ts` |
| E2E-02 | Helper + Plant | Ask to open a named catalog plant (e.g. monstera). Land on `/plants/{id}` with that plant’s real name and care data. | `docs/features/fernly-helper.md` (open_plant); `docs/PRODUCT.md` A plant | `tests/e2e/helper.spec.ts` |
| E2E-03 | Helper + Cart | Signed in: ask to add a plant with spoken quantity/size ("two", "a pair of", "large"). Cart and header count update without reload; line shows the size and quantity said (default size Small when omitted). | `docs/features/fernly-helper.md` (Numbers and sizes; cart count); `docs/PRODUCT.md` The cart | `tests/e2e/helper.spec.ts` |
| E2E-04 | Helper care answers | Ask pet safety / light / care for a known plant. Reply matches that plant’s page data (petSafe, light, care level Easy/Moderate/Expert). Ask about a plant the shop does not sell: helper says it does not sell it — never invents a name or price. | `docs/features/fernly-helper.md` (Answers come from the shop's data); `docs/PRODUCT.md` Care level | `tests/e2e/helper.spec.ts` |
| E2E-05 | Helper reliability | Same add/search message repeated (with `HELPER_SEED` when needed to reproduce): right tool and args at least 9 times out of 10. | `docs/features/fernly-helper.md` (Reliable; HELPER_SEED) | `tests/e2e/helper.spec.ts` |
| E2E-06 | Helper refused add | Signed out (or over stock): attempt add via helper; UI does not show a successful add; cart badge does not increase. | `docs/features/fernly-helper.md` (Never claims…); `docs/PRODUCT.md` | `tests/e2e/helper.spec.ts` |

## Playwright API tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| API-01 | `api/src/features/helper.ts` | `POST /api/helper/chat` with a normal in-scope message returns a body with `reply` (string) and `toolCall` (object or null). **Success status assumed — ask** (OpenAPI not fetched). | `docs/features/fernly-helper.md`; OpenAPI **assumed — ask** | `tests/api/helper.spec.ts` |
| API-02 | `api/src/features/helper.ts` | Invalid input: missing / empty / whitespace-only `text`, and `text` longer than 500 characters → client error with documented `rule`. **Status and `rule` assumed — ask** (feature doc does not list them; OpenAPI not fetched). | **assumed — ask** | `tests/api/helper.spec.ts` |
| API-03 | `api/src/features/helper.ts` | Messages that should `search_plants`: optional `query`, `light` in `low`\|`medium`\|`bright`, `petSafe` true for "pet-safe", "safe for pets", "safe for my cat", "safe for dogs", "pet-friendly". | `docs/features/fernly-helper.md` | `tests/api/helper.spec.ts` |
| API-04 | `api/src/features/helper.ts` | Messages that should `open_plant` with a real catalog `plantId`. | `docs/features/fernly-helper.md` | `tests/api/helper.spec.ts` |
| API-05 | `api/src/features/helper.ts` | Messages that should `add_to_cart`: `quantity` from "2", "two", "a pair of" → 2; size from small/medium/large or S/M/L; omitted size → S; quantity in 1–20. | `docs/features/fernly-helper.md` | `tests/api/helper.spec.ts` |
| API-06 | `api/src/features/helper.ts` | Messages that should `care_tip` with `topic` `pets`\|`light`\|`care` and a real `plantId`; reply content must match shop plant data, not invented facts. | `docs/features/fernly-helper.md`; `docs/PRODUCT.md` Care level | `tests/api/helper.spec.ts` |
| API-07 | `api/src/features/helper.ts` | Off-catalog "do you sell …" for something not in the shop: reply must say the shop does not sell it; must not invent a product or price; `toolCall` should not pretend a catalog action succeeded. | `docs/features/fernly-helper.md` (Answers come from the shop's data) | `tests/api/helper.spec.ts` |
| API-08 | `api/src/features/helper.ts` | No 404-for-unknown-id on this route (no id path param). Reliability: same message → correct tool/args ≥ 9/10; `HELPER_SEED` makes misses reproducible. | `docs/features/fernly-helper.md`; 404 N/A | `tests/api/helper.spec.ts` |

## Accessibility tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| A11Y-01 | `web/src/components/HelperWidget.tsx` (via Layout on Browse) | axe WCAG 2.1 AA scan with helper closed and open: named "Ask Fernly" / "Close helper" controls, named message field, named Send; no critical/serious axe violations on the helper chrome. | `docs/PRODUCT.md` Accessibility; `docs/features/fernly-helper.md` | `tests/a11y/pages.spec.ts` |
| A11Y-02 | `web/src/components/HelperWidget.tsx` | Keyboard only: Tab to Ask Fernly, Enter/Space opens panel, focus remains visible; type a message and Submit/Send works without a mouse. Log exposes live updates politely; `aria-busy` toggles while thinking. | `docs/PRODUCT.md` Accessibility; `docs/features/fernly-helper.md` (aria-busy) | `tests/a11y/pages.spec.ts` |
| A11Y-03 | `web/src/components/HelperWidget.tsx` | Text/contrast: helper toggle and Send label text meets 4.5:1 against their backgrounds. | `docs/PRODUCT.md` Accessibility | `tests/a11y/pages.spec.ts` |

## Seen, no test

| Path | Why no test |
| --- | --- |
| `web/src/components/HelperWidget.module.css` | Presentation only; behavior covered via HelperWidget component/UI/a11y rows. |
| `docs/features/fernly-helper.md` | Feature documentation (oracle for rows above), not customer-runtime code. |
