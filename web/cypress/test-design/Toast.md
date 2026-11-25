# Toast

Approved. Spec: `web/cypress/component/Toast.cy.tsx`.

`Toast` shows `message` as a status. `tone` is `success` or `error` and defaults to `success`. `onClose` runs from Dismiss, and also when the toast closes itself. `duration` defaults to 4000 milliseconds. `duration={0}` stays open.

The success background is `#24532d`. The error background is `#7a1f14`.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| TO-01 | render | `message="Added 1 × Aloe Vera to your cart."` | Reads the toast | That message is a status | the component's purpose. Seen when a plant is added | Equivalence classes over `message` |
| TO-02 | state | `tone` omitted | Looks at the toast | The background is `#24532d` | the component's purpose (`tone` defaults to `success`) | Equivalence classes over `tone`: default |
| TO-03 | state | `tone="error"` | Looks at the toast | The background is `#7a1f14` | the component's purpose | Equivalence classes over `tone`: error |
| TO-04 | interaction | `duration={0}` | Clicks Dismiss | The button's name is "Dismiss". `onClose` is called once | the component's purpose | Callbacks: called from Dismiss |
| TO-05 | state | `duration` omitted | Waits | `onClose` is called once, after 4 seconds | the component's purpose (`duration` defaults to 4000) | Equivalence classes over `duration`: default |
| TO-06 | boundary | `duration={0}` | Waits | `onClose` is not called | the component's purpose (`0` stays open) | Boundaries: 0 |
| TO-07 | accessibility | `duration={0}` | Tabs to Dismiss and presses Enter | Focus is visible on Dismiss. `onClose` is called once | PRODUCT.md Accessibility: every button has a name, everything works with the keyboard alone, and focus is always visible. The component's purpose (the name is "Dismiss") | Accessibility basics: keyboard |
