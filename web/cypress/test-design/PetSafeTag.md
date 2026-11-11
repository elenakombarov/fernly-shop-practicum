# PetSafeTag

Approved. Spec: `web/cypress/component/PetSafeTag.cy.tsx`.

`PetSafeTag` says whether one plant is safe for pets. `petSafe` true shows "Pet safe". `petSafe` false shows "Not pet safe". The paw and the warning mark are decorative.

The browse filter "Pet-safe plants only" is Browse. This component only labels one plant.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| PS-01 | render | `petSafe` true | Looks at the tag | "Pet safe" | the component's purpose | Equivalence classes over `petSafe`: true |
| PS-02 | render | `petSafe` false | Looks at the tag | "Not pet safe" | the component's purpose | Equivalence classes over `petSafe`: false |
| PS-03 | accessibility | `petSafe` true | Listens to the tag | The announced text is "Pet safe". The paw is not announced | the component's purpose (the paw is decorative) | Accessibility basics: the decorative mark is hidden |
| PS-04 | accessibility | `petSafe` false | Listens to the tag | The announced text is "Not pet safe". The warning mark is not announced | the component's purpose (the warning mark is decorative) | Accessibility basics: the decorative mark is hidden |
| PS-05 | accessibility | "Not pet safe", color `#5b5446` on `#f2efe8` | Looks at the tag | Contrast at least 4.5:1 | PRODUCT.md Accessibility: text has enough contrast against its background (4.5:1 for normal text). The tag text is `0.78rem` | Accessibility basics |
