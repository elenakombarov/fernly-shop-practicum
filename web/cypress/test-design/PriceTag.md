# PriceTag

Component test design for approval. No Cypress specs until this table is approved.

`PriceTag` shows one dollar amount (`amount`), at a size (`sm`, `md`, `lg`; default `md`), with an optional screen-reader prefix (`label`) that is not shown. It has no buttons and no callbacks, so the interaction and state techniques (disabled, loading, empty, error) have no rows.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| PT-01 | render | `amount={12.5}` | Reads the price | `$12.50` | PRODUCT.md: every price is dollars with two decimals (`$12.50`, never `$12.5`) | Equivalence classes over `amount`: one decimal place |
| PT-02 | render | `amount={22}` | Reads the price | `$22.00` | PRODUCT.md: every price is dollars with two decimals | Equivalence classes over `amount`: whole dollars |
| PT-03 | render | `amount={9.99}` | Reads the price | `$9.99` | PRODUCT.md: every price is dollars with two decimals | Equivalence classes over `amount`: already two decimals |
| PT-04 | boundary | `amount={0}` | Reads the price | `$0.00` | PRODUCT.md: every price is dollars with two decimals | Boundaries: 0 |
| PT-05 | boundary | `amount={1}` | Reads the price | `$1.00` | PRODUCT.md: every price is dollars with two decimals | Boundaries: 1 |
| PT-06 | boundary | `amount={0.01}` | Reads the price | `$0.01` | PRODUCT.md: every price is dollars with two decimals | Boundaries: the limit (one cent) |
| PT-16 | boundary | `amount={0.99}` | Reads the price | `$0.99` | PRODUCT.md: every price is dollars with two decimals | Boundaries: one cent under 1 |
| PT-07 | boundary | `amount={0.001}` | Reads the price | | assumed — ask | Boundaries: one past the cent. Neither document says how a fraction of a cent is rounded or shown. |
| PT-08 | boundary | `amount={-0.01}` | Reads the price | | assumed — ask | Boundaries: one past 0. Neither document mentions a negative price. |
| PT-09 | render | `size` omitted or `size="md"`, `amount={12.5}` | Looks at the price | Font size `1.05rem` | the component's purpose (`size` defaults to `md`) | Equivalence classes over `size`: medium |
| PT-10 | render | `size="sm"`, `amount={12.5}` | Looks at the price | Font size `0.9rem` | the component's purpose | Equivalence classes over `size`: small |
| PT-11 | render | `size="lg"`, `amount={12.5}` | Looks at the price | Font size `1.6rem` | the component's purpose | Equivalence classes over `size`: large |
| PT-12 | render | no `label`, `amount={9.99}` | Reads the price | `$9.99`, with no prefix | the component's purpose (the prefix is added only when `label` is set) | Equivalence classes over `label`: absent |
| PT-13 | accessibility | `label="Price"`, `amount={9.99}` | Looks at the price, then listens with a screen reader | The label is not visible. The accessible text is `Price: ` followed by the same price text | the component's purpose (`label` is read before the price and not shown) | Accessibility basics: the price has a name |
| PT-14 | accessibility | default size, shop background `#f6faf3`, price color `#8dbb8a` | Looks at the price | Contrast at least 4.5:1 | PRODUCT.md Accessibility: text has enough contrast against its background (4.5:1 for normal text) | Accessibility basics |
| PT-15 | boundary | `label=""` | Reads the price | | assumed — ask | Equivalence classes over `label`: empty string. Neither document says what an empty label does. |
