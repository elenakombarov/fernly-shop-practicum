describe('Plant page', () => {
  it('PL-01 shows heading Aloe Vera, price $9.99, and 18 in stock', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants-empty.json' }).as('catalog');
    cy.intercept('GET', '/api/plants/pl-aloe', { fixture: 'plant-positive.json' }).as('plant');
    cy.visit('/plants/pl-aloe');
    cy.wait('@plant');
    cy.wait('@catalog');

    cy.findByRole('heading', { name: 'Aloe Vera' });
    cy.findByText('$9.99');
    cy.findByText('18 in stock');
  });

  it("PL-02 shows the heading We couldn't find that plant and a Back to the shop link", { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants-empty.json' }).as('catalog');
    cy.intercept('GET', '/api/plants/no-such-plant', {
      statusCode: 404,
      fixture: 'plant-empty.json',
    }).as('plant');
    cy.visit('/plants/no-such-plant');
    cy.wait('@plant');
    cy.wait('@catalog');

    cy.findByRole('heading', { name: "We couldn't find that plant" });
    cy.findByRole('link', { name: 'Back to the shop' });
  });

  it("PL-03 shows an alert that the plant couldn't be loaded and a Try again button", { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants-empty.json' }).as('catalog');
    cy.intercept('GET', '/api/plants/pl-aloe', {
      statusCode: 500,
      fixture: 'plant-negative.json',
    }).as('plant');
    cy.visit('/plants/pl-aloe');
    cy.wait('@plant');
    cy.wait('@catalog');

    cy.findByRole('alert').within(() => {
      cy.findByText("The plant couldn't be loaded.");
      cy.findByRole('button', { name: 'Try again' });
    });
  });

  it('PL-04 sends a signed-out shopper to /login?next=/plants/pl-aloe', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants-empty.json' }).as('catalog');
    cy.intercept('GET', '/api/plants/pl-aloe', { fixture: 'plant-positive.json' }).as('plant');
    cy.visit('/plants/pl-aloe');
    cy.wait('@plant');
    cy.wait('@catalog');

    cy.findByRole('button', { name: 'Add to cart' }).click();
    cy.location().then((location) => {
      expect(location.pathname + location.search, 'sign-in address').to.equal('/login?next=/plants/pl-aloe');
    });
  });

  it('PL-05 shows heading Air Plant and the price $0.00', { tags: ['@ui', '@known-bug'] }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants-empty.json' }).as('catalog');
    cy.intercept('GET', '/api/plants/pl-free', { fixture: 'plant-edge.json' }).as('plant');
    cy.visit('/plants/pl-free');
    cy.wait('@plant');
    cy.wait('@catalog');

    cy.findByRole('heading', { name: 'Air Plant' });
    cy.findByText('$0.00');
  });

  it(
    'UI-03 shows the notify form only for an out-of-stock plant',
    { tags: '@ui' },
    () => {
      cy.intercept('GET', '/api/plants?*', { fixture: 'plants-empty.json' }).as('catalog');
      cy.intercept('GET', '/api/plants/pl-pilea', { fixture: 'plant-out-of-stock.json' }).as('plant');
      cy.visit('/plants/pl-pilea');
      cy.wait('@plant');
      cy.wait('@catalog');

      cy.findByLabelText("Email me when it's back");
      cy.findByRole('button', { name: 'Notify me' });

      cy.intercept('GET', '/api/plants/pl-aloe', { fixture: 'plant-positive.json' }).as('inStock');
      cy.visit('/plants/pl-aloe');
      cy.wait('@inStock');
      cy.wait('@catalog');

      cy.findAllByLabelText("Email me when it's back").should('have.length', 0);
      cy.findAllByRole('button', { name: 'Notify me' }).should('have.length', 0);
    },
  );

  it(
    'UI-04 confirms the submitted address after a successful notify sign-up',
    { tags: '@ui' },
    () => {
      cy.intercept('GET', '/api/plants?*', { fixture: 'plants-empty.json' }).as('catalog');
      cy.intercept('GET', '/api/plants/pl-pilea', { fixture: 'plant-out-of-stock.json' }).as('plant');
      cy.intercept('POST', '/api/plants/*/notify', {
        statusCode: 201,
        fixture: 'notify-positive.json',
      }).as('notify');
      cy.visit('/plants/pl-pilea');
      cy.wait('@plant');
      cy.wait('@catalog');

      cy.findByLabelText("Email me when it's back").type('name@example.com');
      cy.findByRole('button', { name: 'Notify me' }).click();
      cy.wait('@notify');

      cy.findByText("We'll email name@example.com when Chinese Money Plant is back.");
    },
  );

  it(
    'UI-05 shows You\'re already on the list for a 409 and no success confirmation',
    { tags: '@ui' },
    () => {
      cy.intercept('GET', '/api/plants?*', { fixture: 'plants-empty.json' }).as('catalog');
      cy.intercept('GET', '/api/plants/pl-pilea', { fixture: 'plant-out-of-stock.json' }).as('plant');
      cy.intercept('POST', '/api/plants/*/notify', {
        statusCode: 409,
        fixture: 'notify-already.json',
      }).as('notify');
      cy.visit('/plants/pl-pilea');
      cy.wait('@plant');
      cy.wait('@catalog');

      cy.findByLabelText("Email me when it's back").type('name@example.com');
      cy.findByRole('button', { name: 'Notify me' }).click();
      cy.wait('@notify');

      cy.findByRole('alert').then(($el) => {
        expect($el.text().trim(), 'already subscribed').to.equal("You're already on the list");
      });
      cy.findAllByText(/We'll email .+ when .+ is back\./).should('have.length', 0);
    },
  );

  it(
    'UI-06 refuses invalid emails without a success confirmation for a signed-out customer',
    { tags: '@ui' },
    () => {
      cy.intercept('GET', '/api/plants?*', { fixture: 'plants-empty.json' }).as('catalog');
      cy.intercept('GET', '/api/plants/pl-pilea', { fixture: 'plant-out-of-stock.json' }).as('plant');
      cy.intercept('POST', '/api/plants/*/notify', {
        statusCode: 400,
        fixture: 'notify-invalid.json',
      }).as('notify');
      cy.visit('/plants/pl-pilea');
      cy.wait('@plant');
      cy.wait('@catalog');

      cy.findByLabelText("Email me when it's back").type('a@b');
      cy.findByRole('button', { name: 'Notify me' }).click();
      cy.wait('@notify');

      cy.findByRole('alert');
      cy.findAllByText(/We'll email .+ when .+ is back\./).should('have.length', 0);
      cy.findByLabelText("Email me when it's back");
      cy.findByRole('button', { name: 'Notify me' });
    },
  );
});
