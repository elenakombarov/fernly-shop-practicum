# SortSelect

Approved. No Cypress specs yet. SS-16 and SS-17 stay "assumed — ask" and are not to be implemented until the requirements are clarified.

`SortSelect` is the Sort by control on Browse. `value` is the current sort (`featured`, `price-asc`, `price-desc`, `name`, `rating`). `onChange` runs with the sort the customer chooses. The labels are Featured, Price: low to high, Price: high to low, Name: A to Z, and Best rated.

Ordering the catalog — the shop's order, most expensive first, A to Z, highest rated first — is Browse and the API. This component reports the chosen sort. The selection on screen is `value`; choosing an option does not change it until the parent passes a new `value`.

It has no disabled, loading, empty, or error state, so those state techniques have no rows. `value` is always one of the five sorts.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| SS-01 | render | `value="featured"` | Looks at the control | "Sort by" is shown. Featured is selected. | PRODUCT.md: Featured (the shop's order) | Equivalence classes over `value`: featured. Boundaries: the first option |
| SS-02 | render | `value="price-asc"` | Looks at the control | Price: low to high is selected. | PRODUCT.md: Price: low to high | Equivalence classes over `value`: price-asc |
| SS-03 | render | `value="price-desc"` | Looks at the control | Price: high to low is selected. | PRODUCT.md: Price: high to low (most expensive first) | Equivalence classes over `value`: price-desc |
| SS-04 | render | `value="name"` | Looks at the control | Name: A to Z is selected. | PRODUCT.md: Name: A to Z | Equivalence classes over `value`: name |
| SS-05 | render | `value="rating"` | Looks at the control | Best rated is selected. | PRODUCT.md: Best rated (highest first) | Equivalence classes over `value`: rating. Boundaries: the last option |
| SS-06 | boundary | `value="featured"` | Looks at the list | The options, in order, are Featured, Price: low to high, Price: high to low, Name: A to Z, and Best rated. There are five. | PRODUCT.md: Sort by lists those five in that order | Boundaries: the limit (five options) |
| SS-07 | interaction | `value="featured"` | Chooses Price: low to high | `onChange` is called once with `price-asc`. Featured stays selected. | the component's purpose (choosing an option reports that sort; `value` is the selection) | Callbacks: called with `price-asc` |
| SS-08 | interaction | `value="price-asc"` | Chooses Price: high to low | `onChange` is called once with `price-desc`. Price: low to high stays selected. | PRODUCT.md: Price: high to low (most expensive first); the component's purpose | Callbacks: called with `price-desc` |
| SS-09 | interaction | `value="price-desc"` | Chooses Name: A to Z | `onChange` is called once with `name`. Price: high to low stays selected. | the component's purpose | Callbacks: called with `name` |
| SS-10 | interaction | `value="name"` | Chooses Best rated | `onChange` is called once with `rating`. Name: A to Z stays selected. | the component's purpose | Callbacks: called with `rating` |
| SS-11 | interaction | `value="rating"` | Chooses Featured | `onChange` is called once with `featured`. Best rated stays selected. | the component's purpose | Callbacks: called with `featured`. Boundaries: back to the first option |
| SS-12 | state | `value="featured"`, then `value` becomes `"price-desc"` before another choice | Looks at the control | Price: high to low is selected. `onChange` is not called. | the component's purpose (`value` is the selection) | Equivalence classes over `value`: replaced by the parent |
| SS-13 | accessibility | `value="featured"` | Listens to the control | The select is named Sort by. | PRODUCT.md Accessibility: every form field has a name a screen reader can announce | Accessibility basics: role and name |
| SS-14 | accessibility | `value="featured"` | Tabs to Sort by and chooses Price: high to low with the keyboard | Focus is visible on Sort by. `onChange` is called once with `price-desc`. Featured stays selected. | PRODUCT.md Accessibility: everything works with the keyboard alone, and focus is always visible | Accessibility basics: keyboard |
| SS-15 | accessibility | "Sort by" and the select text, `#1f2d22` on white `#fff` | Looks at the label and the selected option | Contrast at least 4.5:1 | PRODUCT.md Accessibility: text has enough contrast against its background (4.5:1 for normal text). The label is `0.9rem`. The select inherits the page font. | Accessibility basics |
| SS-16 | boundary | `value` is empty or not one of the five sorts | Looks at the control | | assumed — ask | Boundaries: one past the five options. Neither document says what an unknown sort shows. |
| SS-17 | interaction | `value="featured"` | Chooses Featured again | | assumed — ask | Neither document says whether `onChange` runs when the chosen sort is the one already selected. |
