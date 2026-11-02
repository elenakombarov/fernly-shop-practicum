const longName =
  'PneumonoultramicroscopicsilicovolcanoconiosisVariegatedThaiConstellationMonsteraCollectorsEditionLimitedGreenhouseBatchNorthFacingWindowsillDisplaySpecimen';

describe('Browse page', () => {
  it('shows two product cards and the heading "2 plants"', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants-positive.json' }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('heading', { name: '2 plants' });
    cy.findByRole('heading', { name: 'Snake Plant' });
    cy.findByRole('heading', { name: 'ZZ Plant' });
    cy.findAllByRole('article').then(($cards) => {
      expect($cards, 'product cards').to.have.length(2);
    });
  });

  it('says no plants match when the catalog is empty', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants-empty.json' }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('heading', { name: 'No plants match your filters' });
  });

  it('keeps a very long plant name inside its card', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants-long-name.json' }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('heading', { name: longName }).then(($name) => {
      const name = $name[0];
      const card = name.closest('article');
      expect(card, 'product card').to.not.equal(null);
      const nameBox = name.getBoundingClientRect();
      const cardBox = card!.getBoundingClientRect();
      expect(name.scrollWidth, 'plant name').to.be.at.most(name.clientWidth);
      expect(nameBox.left, 'plant name left edge').to.be.at.least(cardBox.left);
      expect(nameBox.right, 'plant name right edge').to.be.at.most(cardBox.right);
      expect(nameBox.top, 'plant name top edge').to.be.at.least(cardBox.top);
      expect(nameBox.bottom, 'plant name bottom edge').to.be.at.most(cardBox.bottom);
    });
  });

  it('shows $0.00 for a plant priced at zero', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants-zero-price.json' }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('article').within(() => {
      cy.findByText('$0.00');
    });
  });

  it('offers Try again when the catalog cannot be loaded', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants?*', {
      statusCode: 500,
      fixture: 'plants-negative.json',
    }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('alert').within(() => {
      cy.findByRole('button', { name: 'Try again' });
    });
  });
});
