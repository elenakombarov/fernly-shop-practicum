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

## Suspicions — not yet tested

Each line looked different from `docs/PRODUCT.md` while reading the code or walking the shop. None of these has a failing test yet.

- Other prices are still shown without two decimals. The browse grid showed `$22`, `$27.5`, and `$49`, and size deltas showed `+$6` and `+$4`. Price 0 on a browse card is a confirmed finding above. These other amounts were seen on screen and do not have their own test yet. May contradict `docs/PRODUCT.md` line 31.
- Care level 3 is labeled "Moderate care". `GET /api/plants` says Fiddle Leaf Fig is care level 3, and its badge showed three dots and the words "Moderate care". `CareLevelBadge` picks `LABELS[Math.min(level, 2) - 1]`, which is "Moderate" for level 3. May contradict line 32 (1 Easy, 2 Moderate, 3 Expert).
- Following "Likes the same light" from Fiddle Leaf Fig to Rubber Plant left the address at `/plants/pl-rubber` while the heading still read "Fiddle Leaf Fig". `usePlant` caches every plant under the query key `['plant']`, with no plant id. May contradict line 35 (the plant page always shows the plant in the address bar, including after that link).
- The plant photo has no alternative text (`<img>` with `src` and `className` only) and was missing from the accessibility tree on the plant page. May contradict line 62 (every meaningful image has alternative text).
- The search field has no accessible name. The words "Search plants" are a sibling span, and the accessibility tree lists an unnamed searchbox. May contradict line 61 (every form field has a name a screen reader can announce).
- The save control on each plant card is a button with no accessible name: the icon is `aria-hidden` and the button has no text or `aria-label`. May contradict line 61 (every button has a name a screen reader can announce).
- The search input's own stylesheet sets `outline: none`. That rule loads after the global `:focus-visible` outline and has the same specificity, so keyboard focus on that field can be invisible. May contradict line 64 (focus is always visible). Not checked with the keyboard.

## Questions — not bugs

Neither `docs/PRODUCT.md` nor the OpenAPI document answers these. They are not suspicions.

- Line 33 describes Small, Medium, and Large. Chinese Money Plant's page showed only Small and Medium. It is open whether every plant must offer all three sizes.
- Line 34 says the quantity starts at 1, and also that it can never go above the stock left. Chinese Money Plant has stock 0 and the stepper showed 1, with both buttons disabled and Add reading "Out of stock". It is open what the stepper should display at stock 0.
- Lines 47 and 53 require a full shipping address and a password of at least 8 characters. Both forms set `noValidate` and do not check those rules in the page. The OpenAPI schemas do (`ShippingAddress` min lengths, `Register.password` minLength 8). It is open whether the page must block the submit or the API may.
- Cart photos use `alt=""`. Line 62 requires alternative text on meaningful images, and it does not say whether a thumbnail beside the plant name counts as meaningful.
