function openBrowse(fixture: string, options: { statusCode?: number } = {}) {
  if (options.statusCode) {
    cy.intercept('GET', '/api/plants*', {
      statusCode: options.statusCode,
      fixture,
    }).as('plants');
  } else {
    cy.intercept('GET', '/api/plants*', { fixture }).as('plants');
  }
  cy.visit('/');
  cy.wait('@plants');
}

function expectBadgeUnderNameNotOverPhotoOrSave(plantName: string, badgeText: string) {
  cy.findByRole('heading', { name: plantName }).closest('article').within(() => {
    cy.findByText(badgeText).then(($badge) => {
      cy.findByRole('heading', { name: plantName }).then(($name) => {
        cy.findByRole('img', { name: plantName }).then(($img) => {
          const badgeBox = $badge[0].getBoundingClientRect();
          const nameBox = $name[0].getBoundingClientRect();
          const photoBox = $img[0].getBoundingClientRect();
          expect(badgeBox.top, `${badgeText} sits under the plant name`).to.be.greaterThan(nameBox.bottom - 1);
          const overlapsPhoto =
            badgeBox.left < photoBox.right &&
            badgeBox.right > photoBox.left &&
            badgeBox.top < photoBox.bottom &&
            badgeBox.bottom > photoBox.top;
          expect(overlapsPhoto, `${badgeText} does not cover the photo`).to.equal(false);
        });
      });
      cy.findAllByRole('button').then(($buttons) => {
        const save = Array.from($buttons).find((button) => button.hasAttribute('aria-pressed'));
        if (!save) return;
        const badgeBox = $badge[0].getBoundingClientRect();
        const saveBox = save.getBoundingClientRect();
        const overlapsSave =
          badgeBox.left < saveBox.right &&
          badgeBox.right > saveBox.left &&
          badgeBox.top < saveBox.bottom &&
          badgeBox.bottom > saveBox.top;
        expect(overlapsSave, `${badgeText} does not cover the save control`).to.equal(false);
      });
    });
  });
}

describe('Browse stock badge', () => {
  it(
    'UI-01 shows Only N left for stock 1–3 under the name, Out of stock alone at 0, and no low-stock badge above 3',
    { tags: '@ui' },
    () => {
      openBrowse('plants/browse-stock-levels.json');

      cy.findByRole('heading', { name: '5 plants' });
      expectBadgeUnderNameNotOverPhotoOrSave('Low Stock One', 'Only 1 left');
      expectBadgeUnderNameNotOverPhotoOrSave('Low Stock Two', 'Only 2 left');
      expectBadgeUnderNameNotOverPhotoOrSave('Low Stock Three', 'Only 3 left');

      cy.findByRole('heading', { name: 'Plenty In Stock' })
        .closest('article')
        .within(() => {
          cy.findAllByText(/Only \d+ left/).should('have.length', 0);
          cy.findAllByText('Out of stock').should('have.length', 0);
        });

      cy.findByRole('heading', { name: 'Chinese Money Plant' })
        .closest('article')
        .within(() => {
          cy.findByText('Out of stock');
          cy.findAllByText('Only 0 left').should('have.length', 0);
        });

      openBrowse('plants/browse-empty.json');
      cy.findByRole('heading', { name: 'No plants match your filters' });

      openBrowse('plants/browse-server-error.json', { statusCode: 500 });
      cy.findByRole('alert').within(() => {
        cy.findByRole('button', { name: 'Try again' });
      });
    },
  );
});
