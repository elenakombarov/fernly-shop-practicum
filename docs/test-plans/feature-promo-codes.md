Approved.

# Test plan: feature-promo-codes

Source: `git diff origin/<base>...HEAD` (from `untrusted.diff`)
Base: `origin/<base>` (base ref not recorded alongside the diff)
Every row is **not yet tested**.

`GET /openapi.json` could not be fetched (localhost OpenAPI is unreachable from this environment; no checked-in OpenAPI document). API rows do not invent HTTP status codes or `rule` values.

`docs/PRODUCT.md` does not describe promo codes. Promo-specific expected results that are not in PRODUCT.md or a fetched OpenAPI document are marked **assumed — ask** with no expected result. PRODUCT.md still binds shipping, money formatting, checkout/order emptying, and accessibility where those apply.

## Cypress component tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| CT-01 | `web/src/components/PromoCodeInput.tsx` | Equivalence: render with no `appliedCode` vs with `appliedCode` set (apply form vs applied state). | assumed — ask | `web/cypress/component/PromoCodeInput.cy.tsx` |
| CT-02 | `web/src/components/PromoCodeInput.tsx` | Boundary / disabled: Apply when the input is empty, whitespace-only, or `busy`; Remove when `busy`. | assumed — ask | `web/cypress/component/PromoCodeInput.cy.tsx` |
| CT-03 | `web/src/components/PromoCodeInput.tsx` | Callback: submit with a non-empty code invokes `onApply` (including trim of leading/trailing spaces). | assumed — ask | `web/cypress/component/PromoCodeInput.cy.tsx` |
| CT-04 | `web/src/components/PromoCodeInput.tsx` | Callback: Remove invokes `onRemove`. | assumed — ask | `web/cypress/component/PromoCodeInput.cy.tsx` |
| CT-05 | `web/src/components/PromoCodeInput.tsx` | Error vs empty: with `error` set vs `error` null/omitted. | assumed — ask | `web/cypress/component/PromoCodeInput.cy.tsx` |
| CT-06 | `web/src/components/OrderSummary.tsx` | Boundary: `discount` omitted or `0` vs `discount` greater than 0 (whether a discount row appears). | assumed — ask | `web/cypress/component/OrderSummary.cy.tsx` |
| CT-07 | `web/src/components/OrderSummary.tsx` | When a discount row is shown, amounts use two decimal places in dollars (e.g. `$4.00`, never `$4`). | PRODUCT.md “Every price is shown in dollars with **two decimals**” | `web/cypress/component/OrderSummary.cy.tsx` |
| CT-08 | `web/src/components/OrderSummary.tsx` | Shipping display: `$6.95` when charged; the word Free when shipping is `0` and `itemCount` > 0; free-shipping hint when subtotal is under `$50.00`. | PRODUCT.md “**Shipping costs $6.95, and is free when the subtotal is $50.00 or more.**” | `web/cypress/component/OrderSummary.cy.tsx` |
| CT-09 | `web/src/slots/cart-summary/promo-code.tsx` | Slot mounts `PromoCodeInput` from cart props and wires apply/remove/busy/error. | assumed — ask | `web/cypress/component/PromoCodeSlot.cy.tsx` |

## Cypress UI tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| UI-01 | `web/src/pages/CartPage.tsx` | Signed-in cart, normal `GET /api/cart` fixture with lines and no discount: order summary shows subtotal, shipping, and total; promo UI is present under the summary. Intercept only `/api/*`. | APP-MAP.md Cart; promo UI assumed — ask | `web/cypress/ui/cart.cy.ts` |
| UI-02 | `web/src/pages/CartPage.tsx` | Fixture with `discount` > 0 and `promoCode` set: summary and applied-promo UI reflect the fixture; money uses two decimals. | PRODUCT.md two-decimal prices; promo layout assumed — ask | `web/cypress/ui/cart.cy.ts` |
| UI-03 | `web/src/pages/CartPage.tsx` | Empty cart fixture: empty cart copy; no shipping charged for an empty cart. | PRODUCT.md “An empty cart has no shipping.”; APP-MAP.md Cart empty | `web/cypress/ui/cart.cy.ts` |
| UI-04 | `web/src/pages/CartPage.tsx` | `GET /api/cart` returns 500: cart error with Try again. | APP-MAP.md Cart error | `web/cypress/ui/cart.cy.ts` |
| UI-05 | `web/src/pages/CartPage.tsx` | Signed out / `GET /api/cart` 401: redirect toward sign-in for the cart. | APP-MAP.md Cart signed out | `web/cypress/ui/cart.cy.ts` |
| UI-06 | `web/src/pages/CartPage.tsx` | Extreme fixture: large `discount` and/or `shipping` 0 with items; money still two decimals; Free shipping wording when shipping is 0. | PRODUCT.md two-decimal prices; PRODUCT.md free shipping when shipping is free | `web/cypress/ui/cart.cy.ts` |
| UI-07 | `web/src/pages/CartPage.tsx`, `web/src/slots/cart-summary/promo-code.tsx` | Intercepted `POST /api/cart/promo` success vs failure: how the cart summary and promo UI update from the intercepted response/error. | assumed — ask | `web/cypress/ui/cart.cy.ts` |
| UI-08 | `web/src/pages/CartPage.tsx`, `web/src/slots/cart-summary/promo-code.tsx` | Intercepted `DELETE /api/cart/promo` success: how applied code and discount clear from the response fixture. | assumed — ask | `web/cypress/ui/cart.cy.ts` |
| UI-09 | `web/src/pages/CheckoutPage.tsx` | Signed-in checkout with cart fixture including `discount` and `promoCode`: Paid/order summary area shows discount money with two decimals. | PRODUCT.md two-decimal prices; promo label assumed — ask | `web/cypress/ui/checkout.cy.ts` |
| UI-10 | `web/src/pages/OrdersPage.tsx` (`OrderPage`) | One-order fixture with `discount` and `promoCode`: summary titled Paid shows discount money with two decimals. | PRODUCT.md two-decimal prices; APP-MAP.md One order; promo label assumed — ask | `web/cypress/ui/order.cy.ts` |

## Playwright E2E tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| E2E-01 | `web/src/pages/CartPage.tsx`, `web/src/slots/cart-summary/promo-code.tsx`, `api/src/features/promo-codes.ts` | Signed-in browser path on `WEB_URL`: add a plant, open `/cart`, apply a promo, continue to `/checkout`, place the order, open the order; confirm cart empties after place-order. | assumed — ask (promo retention on order); PRODUCT.md “Placing an order charges the cart as it is, lowers the stock, and empties the cart.” | `tests/e2e/promo-checkout.spec.ts` |
| E2E-02 | `web/src/pages/CartPage.tsx`, `web/src/slots/cart-summary/promo-code.tsx` | Signed-in path: apply a code on `/cart`, then Remove; confirm shipping/subtotal still obey PRODUCT cart shipping rules for the resulting cart. | assumed — ask (promo remove); PRODUCT.md “**Shipping costs $6.95, and is free when the subtotal is $50.00 or more.**” | `tests/e2e/promo-checkout.spec.ts` |

## Playwright API tests

`GET /openapi.json` was not fetched. Do not invent HTTP statuses or `rule` values. Rows name the changed contract surface; expected status/`rule`/body fields that depend on OpenAPI are **assumed — ask**.

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| API-01 | `api/src/features/promo-codes.ts` | `POST /api/cart/promo` positive success for a signed-in customer with a non-empty cart. | assumed — ask | `tests/api/cart-promo.spec.ts` |
| API-02 | `api/src/features/promo-codes.ts` | `POST /api/cart/promo` one invalid input case (whichever the contract documents). | assumed — ask | `tests/api/cart-promo.spec.ts` |
| API-03 | `api/src/features/promo-codes.ts` | `POST /api/cart/promo` without authentication. | assumed — ask | `tests/api/cart-promo.spec.ts` |
| API-04 | `api/src/features/promo-codes.ts` | `DELETE /api/cart/promo` positive success for a signed-in customer. | assumed — ask | `tests/api/cart-promo.spec.ts` |
| API-05 | `api/src/features/promo-codes.ts` | `DELETE /api/cart/promo` without authentication. | assumed — ask | `tests/api/cart-promo.spec.ts` |
| API-06 | `api/src/store.ts`, `api/src/schemas.ts` | After promo apply (once the contract is known), `GET /api/cart` still obeys PRODUCT shipping: `$6.95` when the plant subtotal is under `$50.00` and shipping is not free; free when the subtotal is `$50.00` or more; empty cart has no shipping. Do not invent a weaker shipping rule than PRODUCT.md. | PRODUCT.md “**Shipping costs $6.95, and is free when the subtotal is $50.00 or more.** An empty cart has no shipping.”; promo field shapes assumed — ask | `tests/api/cart-promo.spec.ts` |
| API-07 | `api/src/store.ts`, `api/src/schemas.ts` | `POST /api/orders` with a promo on the cart: cart is empty afterward; whether order/cart retain discount/promo fields once OpenAPI is known. | PRODUCT.md “Placing an order charges the cart as it is … and empties the cart.”; promo persistence assumed — ask | `tests/api/cart-promo.spec.ts` |

## Accessibility tests

| ID | changed path | what to prove | source | spec |
| --- | --- | --- | --- | --- |
| A11Y-01 | `web/src/pages/CartPage.tsx`, `web/src/slots/cart-summary/promo-code.tsx`, `web/src/components/PromoCodeInput.tsx` | Axe scan of `/cart` with the promo UI mounted (apply form and applied-code state): WCAG 2.1 AA — named controls, contrast 4.5:1, keyboard operable, visible focus. | PRODUCT.md Accessibility | `tests/a11y/pages.spec.ts` |
| A11Y-02 | `web/src/components/PromoCodeInput.tsx` | The promo code field has a name a screen reader can announce; Apply and Remove have accessible names. | PRODUCT.md “every button and form field has a name a screen reader can announce” | `tests/a11y/pages.spec.ts` |
| A11Y-03 | `web/src/components/PromoCodeInput.tsx` | Promo apply and remove work with the keyboard alone, and focus stays visible. | PRODUCT.md “everything works with the keyboard alone, and focus is always visible” | `tests/a11y/pages.spec.ts` |
| A11Y-04 | `web/src/components/PromoCodeInput.tsx` | Behavior when a refused code’s error message appears for screen-reader users. | assumed — ask | `tests/a11y/pages.spec.ts` |
| A11Y-05 | `web/src/pages/CheckoutPage.tsx`, `web/src/pages/OrdersPage.tsx` | Axe scan of checkout and one-order views when the summary includes a discount line: contrast and named content still meet WCAG 2.1 AA. | PRODUCT.md Accessibility | `tests/a11y/pages.spec.ts` |

## Seen, no test

| Path | Why no test |
| --- | --- |
| `docs/features/promo-codes.md` | Feature write-up. Not a runtime surface; PRODUCT.md / OpenAPI remain the oracles for expected results. |
| `docs/test-plans/feature-promo-codes.md` | This plan file; not customer-facing runtime behavior. |
| `web/src/components/OrderSummary.module.css` | Style-only; covered by OrderSummary component and page UI rows. |
| `web/src/components/PromoCodeInput.module.css` | Style-only; covered by PromoCodeInput component, cart UI, and a11y contrast rows. |
| `web/src/types.ts` | Type-only shapes for `discount` / `promoCode`; behavior covered by UI and API rows. |
| `api/src/promos.ts` | Promo catalog helpers; exercised through Playwright API / E2E once the contract is known. |
