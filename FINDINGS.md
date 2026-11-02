# Findings

Nothing is a finding yet. The shop was mapped, not tested, and a suspicion is not a finding until a test proves it.

When a test does prove one, add an entry in this shape and keep the list in severity order: money and privacy, then broken flows, then everything else.

### One-line title (what is wrong)

- **Where:** the page, component, or endpoint
- **Category:** Components, Pages, Business rules in the API, The contract, Caching, Authorization, or Accessibility
- **Impact:** what this does to a customer, in one sentence
- **Evidence:** the test that fails, or the exact steps and requests
- **Contradicts:** the line in `docs/PRODUCT.md` or the API contract
- **Suggested fix:** optional, one line

## Suspicions — not yet tested

Each line looked different from `docs/PRODUCT.md` while reading the code or walking the shop. None of these has a failing test yet.

- Prices are shown without two decimals: the browse grid showed `$22`, `$27.5`, and `$49`, and size deltas showed `+$6` and `+$4`. `formatPrice` prefixes `$` to the number after rounding to cents, so `22` is shown as `$22` and `27.5` as `$27.5`. May contradict `docs/PRODUCT.md` line 31 (two decimals everywhere: `$12.50`, never `$12.5`).
- Care level 3 is labeled "Moderate care". `GET /api/plants` says Fiddle Leaf Fig is care level 3, and its badge showed three dots and the words "Moderate care". `CareLevelBadge` picks `LABELS[Math.min(level, 2) - 1]`, which is "Moderate" for level 3. May contradict line 32 (1 Easy, 2 Moderate, 3 Expert).
- The + button stays enabled when the quantity equals stock. `QuantityStepper` disables it only when `value > max`, so the stock-limit value can still be increased. May contradict line 34 (at the stock limit, the + button is disabled, and a line can never go above the stock left).
- Following "Likes the same light" from Fiddle Leaf Fig to Rubber Plant left the address at `/plants/pl-rubber` while the heading still read "Fiddle Leaf Fig". `usePlant` caches every plant under the query key `['plant']`, with no plant id. May contradict line 35 (the plant page always shows the plant in the address bar, including after that link).
- A catalog load failure uses the empty-filter copy. `BrowsePage` renders "No plants match your filters" for both `plants.isError` and an empty item list, and that branch has no Try again. May contradict line 27 (if the catalog can't be loaded, the page says so and offers Try again, and never pretends there are no plants). This branch was not triggered in the browser.
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
