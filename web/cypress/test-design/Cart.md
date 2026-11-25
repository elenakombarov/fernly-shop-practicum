# Cart

Approved for Block 11 Part 4. Spec: `web/cypress/ui/cart.cy.ts`.

Page `/cart`. Signed-in rows save `fernly_token` before load and mock `GET /api/auth/me` with `auth-me.json` (Ava Green, `ava@fernly.test`). The cart is `GET /api/cart`. The signed-out row saves no token, so `/api/auth/me` is not called and the cart query does not run.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| CA-01 | positive | Signed in as Ava. `GET /api/cart` 200, fixture `cart-positive.json`: one small Aloe Vera, unit price 9.99, quantity 1, line total 9.99, item count 1, subtotal 9.99, shipping 6.95, total 16.94. | Opens `/cart` | Heading "Your cart", the name "Aloe Vera", shipping "$6.95", and "Add $40.01 more for free shipping." | PRODUCT.md line 42 (shipping is $6.95, and is free at $50.00). APP-MAP: one small Aloe Vera, shipping $6.95, and the free-shipping hint. | Normal answer |
| CA-02 | negative | Signed in as Ava. `GET /api/cart` 200, fixture `cart-empty.json`: no lines, item count 0, subtotal 0, shipping 0, total 0. | Opens `/cart` | Heading "Your cart is empty" and a link "Browse plants" | APP-MAP: an empty cart shows "Your cart is empty" and "Browse plants". PRODUCT.md line 42 (an empty cart has no shipping). | Empty answer |
| CA-03 | negative | Signed in as Ava. `GET /api/cart` 500, fixture `cart-negative.json`. | Opens `/cart` | An alert "Your cart couldn't be loaded." and a "Try again" button | APP-MAP: a cart load error shows "Your cart couldn't be loaded." and Try again | Error (500) |
| CA-04 | negative | No token. | Opens `/cart` | The address is `/login?next=/cart` | APP-MAP: signed out redirects to `/login?next=/cart`. PRODUCT.md: the cart is for signed-in customers. | Signed out |
| CA-05 | edge | Signed in as Ava. `GET /api/cart` 200, fixture `cart-edge.json`: one Air Plant, unit price 0, quantity 1, line total 0, item count 1, subtotal 0, shipping 6.95, total 6.95. | Opens `/cart` | The name "Air Plant" and a price "$0.00" | PRODUCT.md line 31 (every price is dollars with two decimals) | Extreme value: price 0 |
