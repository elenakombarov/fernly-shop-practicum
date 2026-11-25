# Plant

Approved for Block 11 Part 4. Spec: `web/cypress/ui/plant.cy.ts`.

Page `/plants/:plantId`. Everyone can open it. `GET /api/plants/{plantId}` loads the plant. `GET /api/plants?pageSize=48` only names "Likes the same light" links. These rows leave `similar` empty, and that catalog answer is an empty list (`plants-empty.json`). No token is saved, so `/api/auth/me` is not called.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| PL-01 | positive | `GET /api/plants/pl-aloe` 200, fixture `plant-positive.json`: Aloe Vera, price 9.99, stock 18, sizes Small base and Medium +4, `similar` empty. `GET /api/plants?pageSize=48` 200, `plants-empty.json`. | Opens `/plants/pl-aloe` | Heading "Aloe Vera", price "$9.99", and "18 in stock" | PRODUCT.md line 31 (two decimals). APP-MAP: the plant page shows the name, the price for the selected size, and the stock sentence. | Normal answer |
| PL-02 | negative | `GET /api/plants/no-such-plant` 404, fixture `plant-empty.json`. `GET /api/plants?pageSize=48` 200, `plants-empty.json`. | Opens `/plants/no-such-plant` | Heading "We couldn't find that plant" and a link "Back to the shop" | APP-MAP: a 404 shows "We couldn't find that plant" and "Back to the shop" | Empty answer |
| PL-03 | negative | `GET /api/plants/pl-aloe` 500, fixture `plant-negative.json`. `GET /api/plants?pageSize=48` 200, `plants-empty.json`. | Opens `/plants/pl-aloe` | An alert "The plant couldn't be loaded." and a "Try again" button | APP-MAP: any other failure shows "The plant couldn't be loaded." and Try again | Error (500) |
| PL-04 | negative | Same answers as PL-01. No token. | Clicks "Add to cart" | The address is `/login?next=/plants/pl-aloe` | PRODUCT.md line 36 (adding to the cart needs a signed-in customer; otherwise the shop asks you to sign in first). APP-MAP: Add to cart goes to `/login?next=/plants/{plantId}`. | Signed out |
| PL-05 | edge | `GET /api/plants/pl-free` 200, fixture `plant-edge.json`: Air Plant, price 0, stock 8, one size Small. `GET /api/plants?pageSize=48` 200, `plants-empty.json`. | Opens `/plants/pl-free` | Heading "Air Plant" and the price "$0.00" | PRODUCT.md line 31 (every price is dollars with two decimals) | Extreme value: price 0 |
