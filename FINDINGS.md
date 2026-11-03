# Findings

A suspicion is not a finding until a test proves it. Confirmed findings are listed first, in severity order: money and privacy, then broken flows, then everything else.

### Prices drop trailing zeros

- **Where:** `formatPrice` in `web/src/money.ts`, shown by `PriceTag`, `PlantCard`, `SizePicker`, and the browse card
- **Category:** Money
- **Impact:** Whole-dollar and one-decimal prices are shown without two decimal places (`$0`, `$1`, `$12.5`, `$22`, `+$6`). The amounts are harder to compare, and they do not match the shop's dollar format.
- **Evidence:** **Executed:** these tests fail on the price text.
  - `web/cypress/ui/browse.cy.ts`, "shows $0.00 for a plant priced at zero": the mocked Air Plant at price 0 renders `$0`.
  - `web/cypress/component/PriceTag.cy.tsx`: PT-01 `amount={12.5}` is `$12.5`; PT-02 `amount={22}` is `$22`; PT-04 `amount={0}` is `$0`; PT-05 `amount={1}` is `$1`.
  - `web/cypress/component/PlantCard.cy.tsx`, PC-04: Snake Plant at price 22 renders `$22`.
  - `web/cypress/component/SizePicker.cy.tsx`, SZ-03: Medium at a delta of 6 renders `+$6`.
  - `web/cypress/ui/plant.cy.ts`, PL-05: Air Plant at price 0 renders `$0`.
  - `web/cypress/ui/cart.cy.ts`, CA-05: the Air Plant unit price, line total, and subtotal render `$0`.
  - `web/cypress/ui/orders.cy.ts`, OR-05: order `ord-zero` has total 0 and renders `$0`.
  PT-03 (`$9.99`), PT-06 (`$0.01`), and PT-16 (`$0.99`) passed. SZ-02 (Small, "Base price") passed.
- **Contradicts:** `docs/PRODUCT.md` line 31 (every price is dollars with two decimals: `$12.50`, never `$12.5`). SZ-03 also cites line 33 (Medium adds the amount shown).
- **Suggested fix:** Format every amount with two decimal places.

### A catalog load failure looks like an empty search

- **Where:** Browse page (`web/src/pages/BrowsePage.tsx`)
- **Category:** Browse
- **Impact:** When the catalog cannot be loaded, the shop says no plants match the filters and does not offer a way to try again. A customer cannot tell a failure from an empty search.
- **Evidence:** **Executed:** `web/cypress/ui/browse.cy.ts`, test "offers Try again when the catalog cannot be loaded", fails. `GET /api/plants?*` is stubbed with status 500 and `plants-negative.json`. The page has no `role="alert"` and no "Try again" button. It shows the heading "0 plants", the heading "No plants match your filters", and the message "Try another search or clear a filter."
- **Contradicts:** `docs/PRODUCT.md` line 27 (if the catalog can't be loaded, the page says so and offers Try again, and never pretends there are no plants)
- **Suggested fix:** When the plants request fails, show an alert and a Try again button, and do not use the empty-filter copy.

### The + button stays enabled when the quantity equals the stock left

- **Where:** `QuantityStepper` (`web/src/components/QuantityStepper.tsx`), on the plant page and in the cart
- **Category:** Components
- **Impact:** A customer can raise the quantity above the number of plants left in stock.
- **Evidence:** **Executed:** `web/cypress/component/QuantityStepper.cy.tsx`, test "disables + at the stock limit", fails. It mounts the stepper at `value={3}` and `max={3}` and expects Increase quantity to be disabled. The + button stayed enabled.
- **Contradicts:** `docs/PRODUCT.md` line 34 (at the stock limit, the + button is disabled)
- **Suggested fix:** Disable increase when `value >= max`, not only when `value > max`.

### Care level 3 says Moderate care

- **Where:** `CareLevelBadge` (`web/src/components/CareLevelBadge.tsx`)
- **Category:** Components
- **Impact:** A plant that needs expert care is described as moderate, so a customer can underestimate how much attention it needs.
- **Evidence:** **Executed:** `web/cypress/component/CareLevelBadge.cy.tsx`, CB-03 "shows Expert care with three filled dots", fails. `level={3}` renders "Moderate care" and three filled dots. CB-01 (Easy care, one dot) and CB-02 (Moderate care, two dots) passed in the same run.
- **Contradicts:** `docs/PRODUCT.md` line 32 (care level 1 is Easy, 2 is Moderate, 3 is Expert)
- **Suggested fix:** Use the Expert label for level 3.

### The price color is below 4.5:1 on the shop background

- **Where:** `PriceTag` color `#8dbb8a` (`web/src/components/PriceTag.module.css`) on the shop background `#f6faf3` (`--paper` in `web/src/styles/global.css`)
- **Category:** Accessibility
- **Impact:** The price is pale green on the pale shop background, so it is harder to read than the shop's contrast rule allows.
- **Evidence:** **Executed:** `web/cypress/component/PriceTag.cy.tsx`, PT-14 "keeps the price at a 4.5:1 contrast on the shop background", fails. The computed color is `rgb(141, 187, 138)` (`#8dbb8a`). Against `#f6faf3` the contrast is about 2.07:1.
- **Contradicts:** `docs/PRODUCT.md` line 63 (text has enough contrast against its background, 4.5:1 for normal text)
- **Suggested fix:** Darken the price color until it reaches 4.5:1 on `#f6faf3`.

### The search field has no name a screen reader can announce

- **Where:** `SearchBox` (`web/src/components/SearchBox.tsx`), on Browse
- **Category:** Accessibility
- **Impact:** The search field is announced with no name. "Search plants" is only a visual hint, so a customer using a screen reader cannot tell what the field is for.
- **Evidence:** **Executed:** `web/cypress/component/SearchBox.cy.tsx`, SB-16 "gives the search field a name", fails. With `value=""`, the searchbox accessible name is empty.
- **Contradicts:** `docs/PRODUCT.md` line 61 (every button and form field has a name a screen reader can announce)
- **Suggested fix:** Give the search field a name a screen reader can announce.

### Keyboard focus on the search field is not visible

- **Where:** `SearchBox` input (`outline: none` in `web/src/components/SearchBox.module.css`)
- **Category:** Accessibility
- **Impact:** Tabbing to the search field draws no focus ring, so a keyboard user can lose their place. The Search button does show a gold ring.
- **Evidence:** **Executed:** `web/cypress/component/SearchBox.cy.tsx`, SB-18 "submits with Enter and keeps focus visible", fails. Tab reaches the field, and Enter after `fern` calls `onSearch` once with `fern` (that assertion passed). The field's focus ring is `none 0px rgb(0, 0, 0)`. The Search button's ring is `solid 3px rgb(224, 165, 38)`.
- **Contradicts:** `docs/PRODUCT.md` line 64 (everything works with the keyboard alone, and focus is always visible)
- **Suggested fix:** Remove `outline: none` from the search field so the focus outline stays visible.

### The save button on a plant card has no name a screen reader can announce

- **Where:** `PlantCard` save button (`web/src/components/PlantCard.tsx`), on Browse
- **Category:** Accessibility
- **Impact:** The heart is hidden from assistive tech, and the button has no other name. A customer using a screen reader hears an unlabeled button and cannot tell it saves the plant.
- **Evidence:** **Executed:** `web/cypress/component/PlantCard.cy.tsx`, PC-15 "gives the save button a name and does not announce the heart", fails. The heart stays hidden. The button's accessible name is empty.
- **Contradicts:** `docs/PRODUCT.md` line 61 (every button has a name a screen reader can announce)
- **Suggested fix:** Give the save button a name a screen reader can announce, and keep the heart hidden.

## Suspicions

These tests failed, and the recorded evidence does not confirm that the product is wrong. They stay out of Findings until that is settled.

### Enter on the focused save button does not report the plant id

- **Where:** `PlantCard` save button (`web/src/components/PlantCard.tsx`)
- **Category:** Accessibility
- **Impact:** A keyboard user can tab to the heart, see the focus ring, and press Enter without the plant being saved.
- **Evidence:** **Executed:** `web/cypress/component/PlantCard.cy.tsx`, PC-17 "keeps focus visible and saves the plant from the keyboard", fails. Tab lands on the photo link, the save button, and the name link, and each focus ring is visible (those assertions passed). Focus returns to the save button. Enter does not call `onToggleSave`. PC-12 passed in the same run: a click calls `onToggleSave` once with `pl-snake`. **Inspected only:** the control is a native `button` with `onClick`. A native button is supposed to fire that click when Enter is pressed, so the runner's Enter key may be what failed to click, rather than the component ignoring Enter.
- **Contradicts:** `docs/PRODUCT.md` line 64 (everything works with the keyboard alone, and focus is always visible)
- **Suggested fix:** Confirm Enter on the focused save button calls `onToggleSave` with the plant id. If a real Enter already does, the gap is the test runner's key, not the card.

### Enter on Try again does not call onRetry

- **Where:** `ErrorBanner` Try again button (`web/src/components/Feedback.tsx`)
- **Category:** Accessibility
- **Impact:** A keyboard user can focus Try again, see the focus ring, and press Enter without retrying the failed load.
- **Evidence:** **Executed:** `web/cypress/component/ErrorBanner.cy.tsx`, EB-05 "keeps focus visible and retries with Enter", fails. Focus is on Try again and the focus ring is visible (those assertions passed). Typed Enter does not call `onRetry`. EB-03 passed: a click calls `onRetry` once. The control is a native `button` with `onClick`, so the runner's typed Enter may be what failed to click. The same pattern failed for CartLine LN-08 and Toast TO-07.
- **Contradicts:** `docs/PRODUCT.md` line 64 (everything works with the keyboard alone, and focus is always visible)
- **Suggested fix:** Confirm Enter on the focused Try again button calls `onRetry` once. If a real Enter already does, the gap is the test runner's key, not the banner.

### Enter on Remove does not remove the cart line

- **Where:** `CartLine` Remove button (`web/src/components/CartLine.tsx`)
- **Category:** Accessibility
- **Impact:** A keyboard user can focus Remove, and press Enter without the line leaving the cart.
- **Evidence:** **Executed:** `web/cypress/component/CartLine.cy.tsx`, LN-08 "names Remove and removes the line with Enter", fails. The button's name is "Remove Aloe Vera" and it has focus (those assertions passed). Typed Enter does not call `onRemove`. LN-05 passed: a click calls `onRemove` once with `ln-aloe`. The control is a native `button` with `onClick`. The runner's typed Enter may be what failed to click.
- **Contradicts:** `docs/PRODUCT.md` line 64 (everything works with the keyboard alone). The button name matches line 61.
- **Suggested fix:** Confirm Enter on the focused Remove button calls `onRemove` with the line id. If a real Enter already does, the gap is the test runner's key, not the row.

### Enter on Dismiss does not close the toast

- **Where:** `Toast` Dismiss button (`web/src/components/Feedback.tsx`)
- **Category:** Accessibility
- **Impact:** A keyboard user can focus Dismiss, see the focus ring, and press Enter without the toast closing.
- **Evidence:** **Executed:** `web/cypress/component/Toast.cy.tsx`, TO-07 "keeps focus visible and dismisses with Enter", fails. Focus is on Dismiss and the focus ring is visible (those assertions passed). Typed Enter does not call `onClose`. TO-04 passed: a click on Dismiss calls `onClose` once. The control is a native `button` with `onClick`. The runner's typed Enter may be what failed to click.
- **Contradicts:** `docs/PRODUCT.md` line 64 (everything works with the keyboard alone, and focus is always visible)
- **Suggested fix:** Confirm Enter on the focused Dismiss button calls `onClose` once. If a real Enter already does, the gap is the test runner's key, not the toast.

### The toast does not call onClose when the clock reaches 4 seconds

- **Where:** `Toast` (`web/src/components/Feedback.tsx`)
- **Category:** Components
- **Impact:** A success or error message may stay on screen instead of closing itself after 4 seconds. The customer has to dismiss it by hand.
- **Evidence:** **Executed:** `web/cypress/component/Toast.cy.tsx`, TO-05 "calls onClose once after 4 seconds", fails. The clock moves to 3999ms without calling `onClose` (that assertion passed). At 4000ms `onClose` is still not called. TO-04 passed: clicking Dismiss calls `onClose` once. TO-06 passed: `duration={0}` does not call `onClose`. **Inspected only:** the effect calls `window.setTimeout(onClose, duration)`, and `duration` defaults to 4000. A real four-second wait was not used.
- **Contradicts:** the component's purpose (`duration` defaults to 4000, and `onClose` runs when the toast closes itself)
- **Suggested fix:** Confirm the toast calls `onClose` once after 4 real seconds. If it does, the gap is the test clock, not the toast.

### The signed-out cart address was still /cart when it was checked

- **Where:** Cart page (`/cart`)
- **Category:** Pages
- **Impact:** A signed-out customer might stay on the cart instead of being asked to sign in. The failure screenshot shows the Sign in page, so this run does not confirm that the redirect is missing.
- **Evidence:** **Executed:** `web/cypress/ui/cart.cy.ts`, CA-04 "sends a signed-out visit to /login?next=/cart", fails. The assertion read the address as `/cart` and expected `/login?next=/cart`. Screenshot: `web/cypress/screenshots/cart.cy.ts/Cart page -- CA-04 sends a signed-out visit to loginnext=cart (failed).png`. That picture shows `http://localhost:5173/login?next=/cart` and the heading "Sign in". The check reads `cy.location()` once, inside `.then`, so it does not wait for the address to change. OR-04 passed in the same run: a signed-out visit to `/orders` reached `/login?next=/orders`.
- **Contradicts:** `docs/APP-MAP.md` (signed out, `/cart` redirects to `/login?next=/cart`). `docs/PRODUCT.md` lists the cart for signed-in customers.
- **Suggested fix:** Confirm the address after the redirect has settled. This run's check ran while the address was still `/cart`.

## Suspicions — not yet tested

Each line looked different from `docs/PRODUCT.md` while reading the code or walking the shop. None of these has a failing test yet.

- Following "Likes the same light" from Fiddle Leaf Fig to Rubber Plant left the address at `/plants/pl-rubber` while the heading still read "Fiddle Leaf Fig". `usePlant` caches every plant under the query key `['plant']`, with no plant id. May contradict line 35 (the plant page always shows the plant in the address bar, including after that link).
- The plant photo has no alternative text (`<img>` with `src` and `className` only) and was missing from the accessibility tree on the plant page. May contradict line 62 (every meaningful image has alternative text). The card photo is a different image: PC-14 passed, and its alternative text is "Snake Plant".

## Questions — not bugs

Neither `docs/PRODUCT.md` nor the OpenAPI document answers these. They are not suspicions.

- Line 33 describes Small, Medium, and Large. Chinese Money Plant's page showed only Small and Medium. It is open whether every plant must offer all three sizes.
- Line 34 says the quantity starts at 1, and also that it can never go above the stock left. Chinese Money Plant has stock 0 and the stepper showed 1, with both buttons disabled and Add reading "Out of stock". It is open what the stepper should display at stock 0.
- Lines 47 and 53 require a full shipping address and a password of at least 8 characters. Both forms set `noValidate` and do not check those rules in the page. The OpenAPI schemas do (`ShippingAddress` min lengths, `Register.password` minLength 8). It is open whether the page must block the submit or the API may.
- Cart photos use `alt=""`. Line 62 requires alternative text on meaningful images, and it does not say whether a thumbnail beside the plant name counts as meaningful.
