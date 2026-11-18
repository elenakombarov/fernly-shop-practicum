# OrderSummary

Approved. Spec: `web/cypress/component/OrderSummary.cy.tsx`.

`OrderSummary` is the totals region on the cart, checkout, and an order. `itemCount`, `subtotal`, `shipping`, and `total` are the numbers it is given. `title` defaults to "Order summary". Shipping says "Free" when `shipping` is 0 and there is at least one item; otherwise it shows the shipping price. When there is at least one item and the subtotal is under $50, it says how much more would make shipping free. The dollar amounts belong to `PriceTag` and `formatPrice`. This table uses amounts that already have two decimals and does not repeat those cases.

The seen cart totals are one Aloe Vera: 1 item, subtotal 9.99, shipping 6.95, total 16.94.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| OS-01 | accessibility | `title` omitted | Looks at the summary | The heading is "Order summary", and that heading names the region | the component's purpose (`title` defaults to "Order summary") | Equivalence classes over `title`: default |
| OS-02 | render | `title="Paid"` | Looks at the heading | "Paid" | the component's purpose (an order uses the title "Paid") | Equivalence classes over `title`: Paid |
| OS-03 | boundary | `itemCount={1}` | Reads the subtotal | "Subtotal (1 item)" | the component's purpose | Boundaries: 1 item |
| OS-04 | boundary | `itemCount={2}` | Reads the subtotal | "Subtotal (2 items)" | the component's purpose | Boundaries: one past 1 |
| OS-05 | render | shipping 6.95, total 16.94, item count 1 | Reads shipping and the total | Shipping shows $6.95. The total shows $16.94 | PRODUCT.md: shipping costs $6.95. The component's purpose (those rows show the amounts it is given) | Equivalence classes over `shipping` and `total` |
| OS-06 | boundary | shipping 0, item count 1, subtotal 50 | Reads shipping, then looks for the hint | Shipping says "Free". There is no free-shipping hint | PRODUCT.md: shipping is free when the subtotal is $50.00 or more. The component's purpose | Boundaries: $50 |
| OS-07 | render | item count 1, subtotal 9.99 | Reads the hint | "Add $40.01 more for free shipping." | PRODUCT.md: shipping is free at $50.00. The component's purpose. Seen on the cart for one Aloe Vera | Equivalence classes over `subtotal`: under $50 |
| OS-08 | state | item count 0, subtotal 0, shipping 0 | Reads shipping and looks for the hint | Shipping shows its price. There is no free-shipping hint | PRODUCT.md: an empty cart has no shipping. The component's purpose (Free and the hint need at least one item) | States: empty |
