# SizePicker

Approved. Spec: `web/cypress/component/SizePicker.cy.tsx`.

`SizePicker` is the Size radio group on the plant page. `sizes` is the list it shows. `value` is the selected size (`S`, `M`, or `L`). `onChange` runs with that size letter. `name` defaults to `size`. Small / Medium / Large are the visible names. A delta above 0 is shown as `+` the formatted amount. A delta of 0 is "Base price".

Price formatting belongs to `formatPrice` and `PriceTag`. This table checks one positive delta and does not repeat those cases. A negative delta is not specified, so there is no row for it. `value` is controlled: choosing another size reports it, and the selection stays as given until the parent changes `value`.

Unless a row says otherwise, the sizes are Small at 0, Medium at 6, and Large at 14, `value` is `S`, and `name` is omitted.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| SZ-01 | render | the three sizes | Looks at the group | A group named "Size", with radios for Small, Medium, and Large | the component's purpose | Equivalence classes over `sizes`: three sizes |
| SZ-02 | render | Small at 0 | Reads Small | "Base price" | PRODUCT.md: Small is the base price. The component's purpose | Equivalence classes over `priceDelta`: 0 |
| SZ-03 | render | Medium at 6 | Reads Medium | `+$6.00` | PRODUCT.md: Medium adds the amount shown, and every price uses two decimals | Equivalence classes over `priceDelta`: above 0 |
| SZ-04 | state | `value="M"` | Looks at the radios | Medium is selected. Small is not | the component's purpose (`value` is the current size) | Equivalence classes over `value`: M |
| SZ-05 | interaction | `value="S"` | Clicks Large | `onChange` is called once with `L`. Small stays selected | the component's purpose (`value` stays as given) | Callbacks: called with the size letter |
| SZ-06 | state | `name` omitted | Looks at the radios | Each radio's name is `size` | the component's purpose (`name` defaults to `size`) | Equivalence classes over `name`: default |
| SZ-07 | boundary | only Small at 0 and Medium at 6 | Looks at the group | Small and Medium are shown. Large is not offered | the component's purpose (it shows the sizes it is given). Seen on Chinese Money Plant: Small and Medium only | Boundaries: fewer than three sizes |
| SZ-08 | accessibility | `value="S"` | Tabs to Small and presses Arrow Right | Focus reaches the group. `onChange` is called once with `M`. Small stays selected | PRODUCT.md Accessibility: everything works with the keyboard alone. The component's purpose | Accessibility basics: keyboard |
