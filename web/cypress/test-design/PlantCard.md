# PlantCard

Approved. No Cypress specs yet.

`PlantCard` is one plant on Browse. `plant` is the summary. `saved` says whether this plant is saved (default false). `onToggleSave` runs with the plant id when the customer uses the heart; the button is shown only when that callback is passed. The photo and the name go to `/plants/{id}`. Stock 0 adds an "Out of stock" ribbon.

Saving into this browser is Browse. This component reports the id.

Unless a row says otherwise, `plant` is Snake Plant (`pl-snake`, Latin name `Dracaena trifasciata`, price 22, light `low`, care level 1, not pet safe, stock 20, rating 4.8, image `/plants/snake.svg`), `onToggleSave` is set, and `saved` is omitted.

The care badge, the pet-safe tag, and price formatting belong to `CareLevelBadge`, `PetSafeTag`, and `PriceTag`. This table checks that the card shows this plant's price, and does not repeat those components' cases. `light` is not shown on the card. The card has no disabled, loading, or error state. `PlantCardSlot` renders nothing.

Whether the save button's accessible name changes when `saved` changes is not specified, so there is no row for it.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| PC-01 | render | Snake Plant | Looks at the name | "Snake Plant" is a heading and a link to `/plants/pl-snake` | the component's purpose (the name links to the plant) | Equivalence classes over `plant.name` |
| PC-02 | render | Snake Plant | Looks at the Latin name | "Dracaena trifasciata" is shown | the component's purpose | Equivalence classes over `plant.latinName` |
| PC-03 | render | Snake Plant | Looks at the photo | The photo's address is `/plants/snake.svg`, and it links to `/plants/pl-snake` | the component's purpose (the photo opens the plant) | Equivalence classes over `plant.imageUrl` and `plant.id` |
| PC-04 | render | price 22 | Reads the price | `$22.00` | PRODUCT.md: every price is dollars with two decimals (`$12.50`, never `$12.5`) | The card shows this plant's price |
| PC-05 | render | rating 4.8 | Looks at the rating | The card shows 4.8 | the component's purpose (the card shows the rating to one decimal) | Equivalence classes over `plant.rating` |
| PC-06 | boundary | Chinese Money Plant, id `pl-pilea`, stock 0, `onToggleSave` set | Looks at the card | "Out of stock" is shown. The name still links to `/plants/pl-pilea`. The save button is still shown. | the component's purpose (stock 0 adds the ribbon) | Boundaries: 0 |
| PC-07 | boundary | stock 1 | Looks at the card | There is no "Out of stock" ribbon | the component's purpose | Boundaries: 1 |
| PC-08 | state | `onToggleSave` omitted | Looks at the card | There is no save button | the component's purpose (the button is shown when `onToggleSave` is set) | Equivalence classes over `onToggleSave`: absent |
| PC-09 | state | `saved` omitted | Looks at the save button | The button is shown and is not pressed. `onToggleSave` is not called. | the component's purpose (`saved` defaults to false) | Equivalence classes over `saved`: default |
| PC-10 | state | `saved` true | Looks at the save button | The button is pressed | the component's purpose | Equivalence classes over `saved`: true |
| PC-11 | state | `saved` false, then `saved` becomes true before another click | Looks at the save button | The button is pressed. `onToggleSave` is not called. | the component's purpose (`saved` is the current state) | Equivalence classes over `saved`: replaced by the parent |
| PC-12 | interaction | `saved` false | Clicks the save button | `onToggleSave` is called once with `pl-snake`. The button stays not pressed. | the component's purpose (the click reports the plant id; `saved` stays as given) | Callbacks: called with the plant id |
| PC-13 | interaction | `saved` true | Clicks the save button | `onToggleSave` is called once with `pl-snake`. The button stays pressed. | the component's purpose | Callbacks: called with the plant id when it is already saved |
| PC-14 | accessibility | Snake Plant | Listens to the photo | The alternative text is "Snake Plant" | PRODUCT.md Accessibility: every meaningful image has alternative text. The component's purpose (`alt` is the plant name). | Accessibility basics: the image has a text alternative |
| PC-15 | accessibility | `onToggleSave` set | Listens to the save button | The button has a name a screen reader can announce. The heart is not announced. | PRODUCT.md Accessibility: every button has a name a screen reader can announce. The component's purpose (the icon is hidden from assistive tech). | Accessibility basics: the control has a name |
| PC-16 | accessibility | rating 4.8 | Listens to the rating | The text is "4.8 out of 5". The star is not announced. | the component's purpose (the star is decorative; the scale is "out of 5") | Accessibility basics: the rating has a name |
| PC-17 | accessibility | `saved` false | Tabs to the photo link, then the save button, then the name link, returns focus to the save button, and presses Enter | Focus is visible on the photo link, on the save button, and on the name link. With focus back on the save button, `onToggleSave` is called once with `pl-snake`. | PRODUCT.md Accessibility: everything works with the keyboard alone, and focus is always visible | Accessibility basics: keyboard |
| PC-18 | accessibility | Name, `#1f2d22` on white `#fff` | Looks at the name | Contrast at least 4.5:1 | PRODUCT.md Accessibility: text has enough contrast against its background (4.5:1 for normal text). The name is `1.02rem`. The card background is white. | Accessibility basics |
