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

  it('PL-05 shows heading Air Plant and the price $0.00', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants-empty.json' }).as('catalog');
    cy.intercept('GET', '/api/plants/pl-free', { fixture: 'plant-edge.json' }).as('plant');
    cy.visit('/plants/pl-free');
    cy.wait('@plant');
    cy.wait('@catalog');

    cy.findByRole('heading', { name: 'Air Plant' });
    cy.findByText('$0.00');
  });
});
