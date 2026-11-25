# CartLine

Approved. Spec: `web/cypress/component/CartLine.cy.tsx`.

`CartLine` is one row in the cart. `line` is that row. `onQuantityChange` runs with the line id and the new quantity. `onRemove` runs with the line id. `busy` defaults to false and disables the stepper and Remove.

The stepper's own limits belong to `QuantityStepper`. The price text belongs to `PriceTag`. This table checks that the row uses this line's name, size, prices, and id. The photo's alternative text is an open question, so there is no row for it.

Unless a row says otherwise, the line is one small Aloe Vera: id `ln-aloe`, name Aloe Vera, size `S`, unit price 9.99, quantity 1, line total 9.99, stock 4.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| LN-01 | render | Aloe Vera, size S | Looks at the row | "Aloe Vera" and "Size S" | the component's purpose | Equivalence classes over `line.name` and `line.size` |
| LN-02 | render | unit price 9.99, line total 9.99 | Reads the prices | The unit price is named "Price each". The line total is named "Line total" | the component's purpose (those are the labels passed for this line) | Equivalence classes over `line.unitPrice` and `line.lineTotal` |
| LN-03 | render | name Aloe Vera | Looks at the quantity | The quantity group is named "Quantity of Aloe Vera" and shows 1 | the component's purpose | Equivalence classes over `line.name` and `line.quantity` |
| LN-04 | interaction | quantity 1, stock 4 | Clicks Increase quantity | `onQuantityChange` is called once with `ln-aloe` and 2. `onRemove` is not called | the component's purpose (the change reports the line id) | Callbacks: called with the line id and the next quantity |
| LN-05 | interaction | Aloe Vera | Clicks Remove | `onRemove` is called once with `ln-aloe` | the component's purpose | Callbacks: called with the line id |
| LN-06 | state | `busy` omitted | Looks at Remove | Remove is enabled | the component's purpose (`busy` defaults to false) | Equivalence classes over `busy`: default |
| LN-07 | state | `busy` true | Looks at the row, then clicks Increase quantity and Remove | The quantity buttons and Remove are disabled. Neither callback is called | the component's purpose (`busy` disables the stepper and Remove) | States: disabled |
| LN-08 | accessibility | Aloe Vera | Listens to Remove, then focuses it and presses Enter | The button's name is "Remove Aloe Vera". Enter calls `onRemove` once with `ln-aloe` | PRODUCT.md Accessibility: every button has a name, and everything works with the keyboard alone. The component's purpose | Accessibility basics: the control has a name, and the keyboard |
