# CareLevelBadge

Approved. Spec: `web/cypress/component/CareLevelBadge.cy.tsx`.

`CareLevelBadge` shows how much care one plant needs. `level` is 1, 2, or 3. The badge is titled "How much care this plant needs". It shows that many filled dots, then Easy, Moderate, or Expert, followed by the word "care". The dots are decorative.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| CB-01 | render | `level={1}` | Looks at the badge | "Easy care", with one filled dot | PRODUCT.md: care level 1 is Easy. The component's purpose (the badge reads "{label} care" and shows one dot per level) | Equivalence classes over `level`: 1 |
| CB-02 | render | `level={2}` | Looks at the badge | "Moderate care", with two filled dots | PRODUCT.md: care level 2 is Moderate. The component's purpose | Equivalence classes over `level`: 2 |
| CB-03 | boundary | `level={3}` | Looks at the badge | "Expert care", with three filled dots | PRODUCT.md: care level 3 is Expert. The component's purpose | Boundaries: 3, the last step |
| CB-04 | accessibility | `level={1}` | Listens to the badge | The announced text is "Easy care". The dot is not announced | the component's purpose (the dots are decorative) | Accessibility basics: the decorative mark is hidden |
| CB-05 | accessibility | `level={2}` | Looks at the badge's description | The badge is titled "How much care this plant needs" | the component's purpose | Accessibility basics: the badge has a description |
