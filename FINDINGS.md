# Findings

A suspicion is not a finding until a test proves it. Confirmed findings are listed first, in severity order: money and privacy, then broken flows, then everything else.

### A plant priced at zero is shown as $0, not $0.00

- **Where:** Browse product card (`PriceTag` via `formatPrice` in `web/src/money.ts`)
- **Category:** Money
- **Impact:** A free plant is not shown with two decimal places, so the price does not match the shop's dollar format.
- **Evidence:** **Executed:** `web/cypress/ui/browse.cy.ts`, test "shows $0.00 for a plant priced at zero", fails. The mocked Air Plant has price 0. The card renders `$0`. The test looks for `$0.00` and does not find it. The failure output shows the price element text `$0`.
- **Contradicts:** `docs/PRODUCT.md` line 31 (every price is dollars with two decimals: `$12.50`, never `$12.5`)
- **Suggested fix:** Format every amount with two decimal places, so 0 is `$0.00`.

### The + button stays enabled when the quantity equals the stock left

- **Where:** `QuantityStepper` (`web/src/components/QuantityStepper.tsx`), on the plant page and in the cart
- **Category:** Components
- **Impact:** A customer can raise the quantity above the number of plants left in stock.
- **Evidence:** `web/cypress/component/QuantityStepper.cy.tsx`, test "disables + at the stock limit", fails. It mounts the stepper at `value={3}` and `max={3}` and expects Increase quantity to be disabled. The failure screenshot shows − 3 + with + still enabled, and the command log asserts that button should be disabled.
- **Contradicts:** `docs/PRODUCT.md` line 34 (at the stock limit, the + button is disabled)
- **Suggested fix:** Disable increase when `value >= max`, not only when `value > max`.

### A catalog load failure looks like an empty search

- **Where:** Browse page (`web/src/pages/BrowsePage.tsx`)
- **Category:** Browse
- **Impact:** When the catalog cannot be loaded, the shop says no plants match the filters and does not offer a way to try again. A customer cannot tell a failure from an empty search.
- **Evidence:** **Executed:** `web/cypress/ui/browse.cy.ts`, test "offers Try again when the catalog cannot be loaded", fails. `GET /api/plants?*` is stubbed with status 500 and `plants-negative.json`. The page has no `role="alert"` and no "Try again" button. It shows the heading "0 plants", the heading "No plants match your filters", and the message "Try another search or clear a filter."
- **Contradicts:** `docs/PRODUCT.md` line 27 (if the catalog can't be loaded, the page says so and offers Try again, and never pretends there are no plants)
- **Suggested fix:** When the plants request fails, show an alert and a Try again button, and do not use the empty-filter copy.

## Suspicions

A failing test is evidence. These are not confirmed findings.

### PriceTag omits trailing zeros unless the amount already has two decimals

- **Where:** `PriceTag` (`web/src/components/PriceTag.tsx`) through `formatPrice` in `web/src/money.ts`
- **Category:** Money
- **Impact:** A price such as twelve dollars and fifty cents is shown as `$12.5`, and a whole-dollar price is shown as `$22` or `$1`. The amounts are harder to compare, and they do not match the shop's dollar format.
- **Evidence:** **Executed:** `web/cypress/component/PriceTag.cy.tsx`. PT-01 mounts `amount={12.5}` and the price text is `$12.5`, not `$12.50`. PT-02 mounts `amount={22}` and the text is `$22`, not `$22.00`. PT-05 mounts `amount={1}` and the text is `$1`, not `$1.00`. PT-04 mounts `amount={0}` and the text is `$0`, not `$0.00`; that zero case is already the confirmed finding above, from the browse card. Screenshots: `web/cypress/screenshots/PriceTag.cy.tsx/PriceTag -- PT-01 shows $12.50 for an amount with one decimal place (failed).png`, `web/cypress/screenshots/PriceTag.cy.tsx/PriceTag -- PT-02 shows $22.00 for whole dollars (failed).png`, `web/cypress/screenshots/PriceTag.cy.tsx/PriceTag -- PT-05 shows $1.00 for one dollar (failed).png`, `web/cypress/screenshots/PriceTag.cy.tsx/PriceTag -- PT-04 shows $0.00 for a zero amount (failed).png`. **Inspected only:** `formatPrice` returns `` `$${Math.round(amount * 100) / 100}` ``, which drops trailing zeros. PT-03 (`$9.99`), PT-06 (`$0.01`), and PT-16 (`$0.99`) passed in the same run.
- **Contradicts:** `docs/PRODUCT.md` line 31 (every price is dollars with two decimals: `$12.50`, never `$12.5`)
- **Suggested fix:** Format every amount with two decimal places.

### The price color is below 4.5:1 on the shop background

- **Where:** `PriceTag` color `#8dbb8a` (`web/src/components/PriceTag.module.css`) on the shop background `#f6faf3` (`--paper` in `web/src/styles/global.css`)
- **Category:** Accessibility
- **Impact:** The price is pale green on the pale shop background, so it is harder to read than the shop's contrast rule allows.
- **Evidence:** **Executed:** `web/cypress/component/PriceTag.cy.tsx`, test "PT-14 keeps the price at a 4.5:1 contrast on the shop background", fails. The computed color is `rgb(141, 187, 138)` (`#8dbb8a`). Against `#f6faf3` the contrast is about 2.07:1, and the test requires at least 4.5:1. Screenshot: `web/cypress/screenshots/PriceTag.cy.tsx/PriceTag -- PT-14 keeps the price at a 4.51 contrast on the shop background (failed).png`.
- **Contradicts:** `docs/PRODUCT.md` line 63 (text has enough contrast against its background, 4.5:1 for normal text). The row also cites the component's purpose: default size, shop background `#f6faf3`, price color `#8dbb8a`.
- **Suggested fix:** Darken the price color until it reaches 4.5:1 on `#f6faf3`.

### The search field has no name a screen reader can announce

- **Where:** `SearchBox` (`web/src/components/SearchBox.tsx`), on Browse
- **Category:** Accessibility
- **Impact:** The search field is announced with no name. "Search plants" is only a visual hint, so a customer using a screen reader cannot tell what the field is for.
- **Evidence:** **Executed:** `web/cypress/component/SearchBox.cy.tsx`, test "SB-16 gives the search field a name", fails. It mounts `value=""`. The searchbox accessible name is empty (`expected '' to not equal ''`). Screenshot: `web/cypress/screenshots/SearchBox.cy.tsx/SearchBox -- SB-16 gives the search field a name (failed).png`. **Inspected only:** the input has no `aria-label`, `aria-labelledby`, associated label, or placeholder. "Search plants" is a sibling span.
- **Contradicts:** `docs/PRODUCT.md` line 61 (every button and form field has a name a screen reader can announce)
- **Suggested fix:** Give the search field a name a screen reader can announce.

### Keyboard focus on the search field is not visible

- **Where:** `SearchBox` input (`outline: none` in `web/src/components/SearchBox.module.css`)
- **Category:** Accessibility
- **Impact:** Tabbing to the search field draws no focus ring, so a keyboard user can lose their place. The Search button does show a gold ring.
- **Evidence:** **Executed:** `web/cypress/component/SearchBox.cy.tsx`, test "SB-18 submits with Enter and keeps focus visible", fails. Tab reaches the field, and Enter after `fern` calls `onSearch` once with `fern` (that assertion passed). The field's focus ring is `none 0px rgb(0, 0, 0)`. The Search button's ring is `solid 3px rgb(224, 165, 38)`. The test requires both. Screenshot: `web/cypress/screenshots/SearchBox.cy.tsx/SearchBox -- SB-18 submits with Enter and keeps focus visible (failed).png`.
- **Contradicts:** `docs/PRODUCT.md` line 64 (everything works with the keyboard alone, and focus is always visible)
- **Suggested fix:** Remove `outline: none` from the search field so the focus outline stays visible.

## Suspicions — not yet tested

Each line looked different from `docs/PRODUCT.md` while reading the code or walking the shop. None of these has a failing test yet.

- Browse cards and size deltas showed `$27.5`, `$49`, `+$6`, and `+$4` on screen. Whole-dollar and one-decimal prices now have a failing `PriceTag` component test, recorded under Suspicions above. These browse amounts and size deltas do not have their own page test yet. May contradict `docs/PRODUCT.md` line 31.
- Care level 3 is labeled "Moderate care". `GET /api/plants` says Fiddle Leaf Fig is care level 3, and its badge showed three dots and the words "Moderate care". `CareLevelBadge` picks `LABELS[Math.min(level, 2) - 1]`, which is "Moderate" for level 3. May contradict line 32 (1 Easy, 2 Moderate, 3 Expert).
- Following "Likes the same light" from Fiddle Leaf Fig to Rubber Plant left the address at `/plants/pl-rubber` while the heading still read "Fiddle Leaf Fig". `usePlant` caches every plant under the query key `['plant']`, with no plant id. May contradict line 35 (the plant page always shows the plant in the address bar, including after that link).
- The plant photo has no alternative text (`<img>` with `src` and `className` only) and was missing from the accessibility tree on the plant page. May contradict line 62 (every meaningful image has alternative text).
- The save control on each plant card is a button with no accessible name: the icon is `aria-hidden` and the button has no text or `aria-label`. May contradict line 61 (every button has a name a screen reader can announce).

## Questions — not bugs

Neither `docs/PRODUCT.md` nor the OpenAPI document answers these. They are not suspicions.

- Line 33 describes Small, Medium, and Large. Chinese Money Plant's page showed only Small and Medium. It is open whether every plant must offer all three sizes.
- Line 34 says the quantity starts at 1, and also that it can never go above the stock left. Chinese Money Plant has stock 0 and the stepper showed 1, with both buttons disabled and Add reading "Out of stock". It is open what the stepper should display at stock 0.
- Lines 47 and 53 require a full shipping address and a password of at least 8 characters. Both forms set `noValidate` and do not check those rules in the page. The OpenAPI schemas do (`ShippingAddress` min lengths, `Register.password` minLength 8). It is open whether the page must block the submit or the API may.
- Cart photos use `alt=""`. Line 62 requires alternative text on meaningful images, and it does not say whether a thumbnail beside the plant name counts as meaningful.
