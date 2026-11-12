# SearchBox

Approved. No Cypress specs yet. SB-12 and SB-13 stay "assumed — ask" and are not to be implemented until the requirements are clarified.

`SearchBox` is a search form. `value` is the current search. `onSearch` runs when the customer submits or clears. The words "Search plants" are a separate hint, not a label. Submitting trims and searches. A clear button (accessible name "Clear search") shows once there is text. It has no disabled, loading, or error state, so those state techniques have no rows.

Matching a plant's name or Latin name regardless of letter case is the catalog on Browse. This component sends the trimmed text.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| SB-01 | state | `value=""` | Looks at the form | The hint "Search plants" is shown. The field is empty. There is no "Clear search" button. The "Search" button is shown. | the component's purpose (hint when empty; clear shows once there is text) | States: empty |
| SB-02 | render | `value="snake plant"` | Looks at the form | The field shows `snake plant`. The hint is not shown. "Clear search" is shown. | the component's purpose | Equivalence classes over `value`: a search term |
| SB-03 | boundary | `value="a"` | Looks at the form | The field shows `a`. The hint is not shown. "Clear search" is shown. | the component's purpose | Boundaries: 1 character |
| SB-04 | boundary | `value=" "` | Looks at the form | The field shows a space. "Clear search" is shown. "Search plants" is not shown. | the component's purpose (clear shows once there is text) | Boundaries: one past empty |
| SB-05 | interaction | `value=""` | Types `Monstera`, then clicks Search | `onSearch` is not called while typing. It is called once with `Monstera`. | the component's purpose (submitting trims and searches) | Callbacks: called with the submitted text |
| SB-06 | interaction | `value=""` | Types `  fern  ` (leading and trailing spaces) and clicks Search | `onSearch` is called exactly once with `fern` | the component's purpose (submitting trims and searches) | Surrounding whitespace / trimming |
| SB-07 | boundary | `value="   "` | Clicks Search | `onSearch` is called once with `""` | the component's purpose (submitting trims and searches) | Boundaries: trimming leaves nothing |
| SB-08 | interaction | `value=""` | Clicks Search | `onSearch` is called once with `""` | the component's purpose (submitting trims and searches) | Callbacks: submit with nothing |
| SB-09 | interaction | `value="Snake"` | Clicks Search | `onSearch` is called once with `Snake` | the component's purpose (submit trims; letter case stays as typed) | Equivalence classes over `value`: letter case |
| SB-10 | interaction | `value="snake plant"` | Clicks "Clear search" | The field is empty, the hint "Search plants" is shown, "Clear search" is gone, and `onSearch` is called once with `""` | the component's purpose (accessible name "Clear search") | Callbacks: called with an empty search |
| SB-11 | state | `value="snake"`, then `value` becomes `"aloe"` before the user types | Looks at the field | The field shows `aloe` | the component's purpose (`value` is the current search) | Equivalence classes over `value`: replaced by the parent |
| SB-12 | state | `value="snake"`, the user has typed `snake plant` and not submitted, then `value` becomes `""` | Looks at the field | | assumed — ask | Neither document says whether an unsent draft is kept when `value` changes. |
| SB-13 | boundary | `value` is a very long string | Looks at the field and clicks Search | | assumed — ask | Boundaries: the limit and one past it. Neither document states a maximum length. |
| SB-14 | accessibility | `value=""` | Listens to the form | The form is a search landmark. The Search button's accessible name is `Search`. The magnifying character is not announced. | PRODUCT.md Accessibility: every button has a name a screen reader can announce; the component's purpose (the icon is hidden from assistive tech) | Accessibility basics: role and name |
| SB-15 | accessibility | `value="fern"` | Listens to Clear search | The button's accessible name is `Clear search` | the component's purpose (accessible name "Clear search") | Accessibility basics: the control has a name |
| SB-16 | accessibility | `value=""` | Listens to the text field | The field has a name a screen reader can announce | PRODUCT.md Accessibility: every button and form field has a name a screen reader can announce | Accessibility basics: the field has a name |
| SB-18 | accessibility | `value=""` | Tabs to the field, types `fern`, and presses Enter | `onSearch` is called once with `fern`. Focus on the field and on Search is visible. | PRODUCT.md Accessibility: everything works with the keyboard alone, and focus is always visible | Accessibility basics: keyboard |
| SB-19 | accessibility | Search label, white `#fff` on `#2f6b3a` | Looks at Search | Contrast at least 4.5:1 | PRODUCT.md Accessibility: text has enough contrast against its background (4.5:1 for normal text) | Accessibility basics |
| SB-20 | accessibility | Hint and clear control, `#56645a` on white `#fff` | Looks at "Search plants" and at "Clear search" | Contrast at least 4.5:1 | PRODUCT.md Accessibility: text has enough contrast against its background (4.5:1 for normal text) | Accessibility basics |
| SB-21 | accessibility | Field text `#1f2d22` on white `#fff` | Looks at the typed text | Contrast at least 4.5:1 | PRODUCT.md Accessibility: text has enough contrast against its background (4.5:1 for normal text) | Accessibility basics |
