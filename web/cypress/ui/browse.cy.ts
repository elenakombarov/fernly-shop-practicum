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

  it('shows $0.00 for a plant priced at zero', { tags: ['@ui', '@known-bug'] }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants-zero-price.json' }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('article').within(() => {
      cy.findByText('$0.00');
    });
  });

  it('offers Try again when the catalog cannot be loaded', { tags: ['@ui', '@known-bug'] }, () => {
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

  it(
    'UI-01 shows Only N left with the tags under the name, not over the photo or save control',
    { tags: '@ui' },
    () => {
      cy.intercept('GET', '/api/plants?*', { fixture: 'plants-low-stock.json' }).as('plants');
      cy.visit('/');
      cy.wait('@plants');

      cy.findByRole('article').within(() => {
        cy.findByRole('heading', { name: 'Snake Plant' }).then(($name) => {
          cy.findByText('Only 2 left').then(($badge) => {
            cy.findByRole('img', { name: 'Snake Plant' }).then(($photo) => {
              cy.findByRole('button').then(($save) => {
                const nameBox = $name[0].getBoundingClientRect();
                const badgeBox = $badge[0].getBoundingClientRect();
                const photoBox = $photo[0].getBoundingClientRect();
                const saveBox = $save[0].getBoundingClientRect();

                expect(badgeBox.top, 'badge below name').to.be.at.least(nameBox.bottom - 1);

                const overlaps = (a: DOMRect, b: DOMRect) =>
                  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

                expect(overlaps(badgeBox, photoBox), 'badge over photo').to.equal(false);
                expect(overlaps(badgeBox, saveBox), 'badge over save').to.equal(false);
              });
            });
          });
        });
      });
    },
  );

  it(
    'UI-02 shows Out of stock without Only 0 left, and no low-stock badge above stock 3',
    { tags: '@ui' },
    () => {
      cy.intercept('GET', '/api/plants?*', { fixture: 'plants-stock-edge.json' }).as('plants');
      cy.visit('/');
      cy.wait('@plants');

      cy.findByRole('heading', { name: 'Chinese Money Plant' })
        .closest('article')
        .then(($card) => {
          expect($card.length, 'out-of-stock card').to.equal(1);
          expect($card.text(), 'out of stock label').to.include('Out of stock');
          expect($card.text(), 'only 0 left').not.to.include('Only 0 left');
        });

      cy.findByRole('heading', { name: 'ZZ Plant' })
        .closest('article')
        .within(() => {
          cy.findAllByText(/^Only \d+ left$/).should('have.length', 0);
        });
    },
  );
});
