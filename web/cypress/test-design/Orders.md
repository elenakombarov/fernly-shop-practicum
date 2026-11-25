# Orders

Approved for Block 11 Part 4. Spec: `web/cypress/ui/orders.cy.ts`.

Page `/orders`. Signed-in rows save `fernly_token` before load and mock `GET /api/auth/me` with `auth-me.json` (Ava Green, `ava@fernly.test`). The list is `GET /api/orders`. The header badge also calls `GET /api/cart`; signed-in rows answer that with `cart-empty.json`. The signed-out row saves no token. The orders hook still runs, and that call answers 401.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| OR-01 | positive | Signed in as Ava. `GET /api/cart` 200, `cart-empty.json`. `GET /api/orders` 200, fixture `orders-positive.json`: one order `ord-1001`, one line, total 16.94. | Opens `/orders` | Heading "Your orders", a link "Order ord-1001", and the total "$16.94" | APP-MAP: each row is a link "Order {id}" and the total. PRODUCT.md line 31 (two decimals). | Normal answer |
| OR-02 | negative | Signed in as Ava. `GET /api/cart` 200, `cart-empty.json`. `GET /api/orders` 200, fixture `orders-empty.json`: an empty list. | Opens `/orders` | Heading "No orders yet" | APP-MAP: an empty list shows "No orders yet" | Empty answer |
| OR-03 | negative | Signed in as Ava. `GET /api/cart` 200, `cart-empty.json`. `GET /api/orders` 500, fixture `orders-negative.json`. | Opens `/orders` | An alert "Your orders couldn't be loaded." and a "Try again" button | APP-MAP: a load error shows "Your orders couldn't be loaded." and Try again | Error (500) |
| OR-04 | negative | No token. `GET /api/orders` 401, fixture `orders-negative.json`. | Opens `/orders` | The address is `/login?next=/orders` | APP-MAP: signed out, `GET /api/orders` returns 401, then the page redirects to `/login?next=/orders` | Signed out |
| OR-05 | edge | Signed in as Ava. `GET /api/cart` 200, `cart-empty.json`. `GET /api/orders` 200, fixture `orders-edge.json`: one order `ord-zero`, total 0. | Opens `/orders` | A link "Order ord-zero" and the total "$0.00" | PRODUCT.md line 31 (every price is dollars with two decimals) | Extreme value: price 0 |
