# EmptyState

Approved. Spec: `web/cypress/component/EmptyState.cy.tsx`.

`EmptyState` shows a title, an optional message, and an optional action. The words come from the page that uses it. The plant mark is decorative. It has no callback of its own.

The cart's empty state ("Your cart is empty", and a Browse plants action) is the example below. This component shows the title, message, and action it is given.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| ES-01 | render | `title="Your cart is empty"` | Looks at the title | "Your cart is empty" is a heading | the component's purpose | Equivalence classes over `title` |
| ES-02 | render | `message="Add a plant before you check out."` | Reads the message | That message is shown | the component's purpose | Equivalence classes over `message`: present |
| ES-03 | state | `message` omitted | Looks for a message | The heading is shown and there is no message | the component's purpose (the message is optional) | Equivalence classes over `message`: absent |
| ES-04 | render | `action` is a link "Browse plants" | Looks at the action | The link "Browse plants" is shown | the component's purpose | Equivalence classes over `action`: present |
| ES-05 | state | `action` omitted | Looks for an action | The heading is shown and there is no link | the component's purpose (the action is optional) | Equivalence classes over `action`: absent |
| ES-06 | accessibility | the empty state | Listens to the plant mark | The plant mark is not announced | the component's purpose (the mark is decorative) | Accessibility basics: the decorative mark is hidden |
