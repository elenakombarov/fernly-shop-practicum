# QuantityStepper

Approved. Spec: `web/cypress/component/QuantityStepper.cy.tsx`.

`QuantityStepper` is the quantity control on the plant page and in the cart. `value` is the current quantity. `onChange` runs with the next quantity. `max` is the highest allowed value, usually the stock left. `min` defaults to 1. The group is named "Quantity". The buttons are "Decrease quantity" and "Increase quantity".

This table documents the three scenarios already in the spec. It does not add cases. `min`, `disabled`, and `label` have no rows because the spec does not set them.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| QS-01 | interaction | `value={2}` `max={5}` | Clicks Increase quantity, then Decrease quantity | `onChange` is called with 3, then with 1 | the component's purpose (`onChange` reports the next quantity) | Callbacks: called with the next value |
| QS-02 | boundary | `value={1}` `max={5}` | Looks at Decrease quantity | Decrease quantity is disabled | PRODUCT.md: the quantity starts at 1. The component's purpose (`min` defaults to 1, and Decrease is disabled at that minimum) | Boundaries: 1, the minimum |
| QS-03 | boundary | `value={3}` `max={3}` | Looks at Increase quantity | Increase quantity is disabled | PRODUCT.md: at the stock limit, the + button is disabled | Boundaries: the stock limit, `value` equal to `max` |
