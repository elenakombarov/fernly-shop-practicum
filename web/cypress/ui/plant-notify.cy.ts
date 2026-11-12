function stubCatalog() {
  cy.intercept('GET', '/api/plants?*', { fixture: 'plants-empty.json' }).as('catalog');
}

function openPlant(fixture: string, plantId: string, options: { statusCode?: number } = {}) {
  stubCatalog();
  if (options.statusCode) {
    cy.intercept('GET', `/api/plants/${plantId}`, {
      statusCode: options.statusCode,
      fixture,
    }).as('plant');
  } else {
    cy.intercept('GET', `/api/plants/${plantId}`, { fixture }).as('plant');
  }
  cy.visit(`/plants/${plantId}`);
  cy.wait('@plant');
  cy.wait('@catalog');
}

describe('Plant page notify', () => {
  it(
    'UI-02 shows the notify form for out-of-stock plants, confirms or errors from the API, and hides it when in stock',
    { tags: '@ui' },
    () => {
      openPlant('plant-out-of-stock.json', 'pl-pilea');

      cy.findByText("Email me when it's back");
      cy.findByLabelText("Email me when it's back");
      cy.findByRole('button', { name: 'Notify me' });

      cy.intercept('POST', '/api/plants/pl-pilea/notify', {
        statusCode: 201,
        fixture: 'notify-subscribed.json',
      }).as('notify');

      cy.findByLabelText("Email me when it's back").type('ava@example.com');
      cy.findByRole('button', { name: 'Notify me' }).click();
      cy.wait('@notify');
      cy.findByText(/We'll email ava@example.com when Chinese Money Plant is back/);
      cy.findByRole('button', { name: 'Notify me' }).should('not.exist');

      openPlant('plant-out-of-stock.json', 'pl-pilea');
      cy.intercept('POST', '/api/plants/pl-pilea/notify', {
        statusCode: 409,
        body: { detail: "You're already on the list", rule: 'already_subscribed' },
      }).as('notifyAgain');
      cy.findByLabelText("Email me when it's back").type('ava@example.com');
      cy.findByRole('button', { name: 'Notify me' }).click();
      cy.wait('@notifyAgain');
      cy.findByText("You're already on the list");

      openPlant('plant-positive.json', 'pl-aloe');
      cy.findByRole('heading', { name: 'Aloe Vera' });
      cy.findByText("Email me when it's back").should('not.exist');
      cy.findByRole('button', { name: 'Notify me' }).should('not.exist');

      openPlant('plant-empty.json', 'no-such-plant', { statusCode: 404 });
      cy.findByRole('heading', { name: "We couldn't find that plant" });
      cy.findByRole('link', { name: 'Back to the shop' });

      openPlant('plant-negative.json', 'pl-aloe', { statusCode: 500 });
      cy.findByRole('alert').within(() => {
        cy.findByText("The plant couldn't be loaded.");
        cy.findByRole('button', { name: 'Try again' });
      });
    },
  );
});
