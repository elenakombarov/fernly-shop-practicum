# LightFilter

Approved. No Cypress specs yet. LF-17 and LF-18 stay "assumed — ask" and are not to be implemented until the requirements are clarified.

`LightFilter` is the Light group on Browse. `value` is the lights currently selected (`low`, `medium`, `bright`). `onChange` runs with the next list when a box is clicked: that light is added, or removed if it was already selected. The labels are Low light, Medium light, and Bright light.

Showing plants that match either selected light is Browse (the catalog). This component reports the selected lights.

It has no disabled, loading, or error state, so those state techniques have no rows.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| LF-01 | state | `value={[]}` | Looks at the group | The legend is "Light". Low light, Medium light, and Bright light are unchecked. `onChange` is not called. | the component's purpose | States: empty. Boundaries: 0 |
| LF-02 | render | `value={['low']}` | Looks at the group | Low light is checked. Medium light and Bright light are not. | the component's purpose | Equivalence classes over `value`: low |
| LF-03 | render | `value={['medium']}` | Looks at the group | Medium light is checked. The other two are not. | the component's purpose | Equivalence classes over `value`: medium |
| LF-04 | boundary | `value={['bright']}` | Looks at the group | Bright light is checked. The other two are not. | the component's purpose | Boundaries: 1 |
| LF-05 | render | `value={['low','bright']}` | Looks at the group | Low light and Bright light are checked. Medium light is not. | PRODUCT.md: Light filters can be combined: choosing Low and Bright shows plants for either | Equivalence classes over `value`: Low and Bright together |
| LF-06 | render | `value={['bright','low']}` | Looks at the group | Bright light and Low light are checked. Medium light is not. | the component's purpose (a light is selected when it is in `value`) | Equivalence classes over `value`: order of the list |
| LF-07 | boundary | `value={['low','medium','bright']}` | Looks at the group | All three are checked. | the component's purpose | Boundaries: the limit (all three lights) |
| LF-08 | interaction | `value={[]}` | Clicks Low light | `onChange` is called once with `['low']` | the component's purpose (each click adds or removes that value) | Callbacks: called with the added light |
| LF-09 | interaction | `value={['low']}` | Clicks Bright light | `onChange` is called once with `['low','bright']` | PRODUCT.md: Light filters can be combined; the component's purpose (the click adds Bright and leaves Low) | Callbacks: called with both lights |
| LF-10 | interaction | `value={['low','bright']}` | Clicks Low light | `onChange` is called once with `['bright']` | the component's purpose (the click removes that value and leaves the rest) | Callbacks: called with the light removed |
| LF-11 | interaction | `value={['medium']}` | Clicks Medium light | `onChange` is called once with `[]` | the component's purpose | Boundaries: removing the last selected light |
| LF-12 | interaction | `value={['low','medium','bright']}` | Clicks Medium light | `onChange` is called once with `['low','bright']` | the component's purpose | Boundaries: one under the limit |
| LF-13 | state | `value={['low']}`, then `value` becomes `['bright']` before another click | Looks at the group | Low light is unchecked and Bright light is checked. `onChange` is not called. | the component's purpose (`value` is the selection) | Equivalence classes over `value`: replaced by the parent |
| LF-14 | accessibility | `value={[]}` | Listens to the group | The group is named Light. The checkboxes are named Low light, Medium light, and Bright light. | PRODUCT.md Accessibility: every button and form field has a name a screen reader can announce | Accessibility basics: role and name |
| LF-15 | accessibility | `value={[]}` | Tabs to Low light, then Medium light, then Bright light, and presses Space on Bright light | Focus is visible on Low light, then on Medium light, then on Bright light. `onChange` is called exactly once with `['bright']`. | PRODUCT.md Accessibility: everything works with the keyboard alone, and focus is always visible | Accessibility basics: keyboard |
| LF-16 | accessibility | Legend and option labels, `#1f2d22` on white `#fff` | Looks at the labels | Contrast at least 4.5:1 | PRODUCT.md Accessibility: text has enough contrast against its background (4.5:1 for normal text). The legend is `0.9rem` and the options are `0.95rem`. | Accessibility basics |
| LF-17 | boundary | `value={['low','low']}` | Looks at the group, then clicks Low light | | assumed — ask | Neither document says what a repeated light does. |
| LF-18 | boundary | `value` has four entries, or a light other than low, medium, or bright | Looks at the group | | assumed — ask | Boundaries: one past the limit. Neither document describes a fourth light. |
