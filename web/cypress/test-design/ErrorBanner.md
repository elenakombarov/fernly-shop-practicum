# ErrorBanner

Approved. Spec: `web/cypress/component/ErrorBanner.cy.tsx`.

`ErrorBanner` shows `message` in an alert. `onRetry` adds a "Try again" button and runs when that button is used. With `onRetry` omitted, the alert is the message only.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| EB-01 | render | `message="Your cart couldn't be loaded."` | Looks at the banner | The message is an alert | the component's purpose | Equivalence classes over `message` |
| EB-02 | state | `onRetry` set | Looks at the banner | A button named "Try again" is shown | the component's purpose (`onRetry` adds Try again) | Equivalence classes over `onRetry`: present |
| EB-03 | interaction | `onRetry` set | Clicks Try again | `onRetry` is called once | the component's purpose | Callbacks: called once |
| EB-04 | state | `onRetry` omitted | Looks at the banner | The alert shows the message and has no button | the component's purpose (Try again is added only when `onRetry` is set) | Equivalence classes over `onRetry`: absent |
| EB-05 | accessibility | `onRetry` set | Tabs to Try again and presses Enter | Focus is visible on Try again. `onRetry` is called once | PRODUCT.md Accessibility: every button has a name, everything works with the keyboard alone, and focus is always visible | Accessibility basics: keyboard |
