describe('Cart', () => {
  const signInAsAva = () => {
    cy.intercept('GET', '/api/auth/me', { fixture: 'auth-me.json' }).as('authMe');
    cy.visit('/cart', {
      onBeforeLoad(win) {
        win.localStorage.setItem('fernly_token', 'test-token');
      },
    });
  };

  it('CA-01 shows Your cart with Aloe Vera, shipping $6.95, and the free-shipping hint', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/cart', { fixture: 'cart-positive.json' }).as('cart');
    signInAsAva();
    cy.wait('@authMe');
    cy.wait('@cart');

    cy.findByRole('heading', { name: 'Your cart' });
    cy.findByText('Aloe Vera');
    cy.findByText('$6.95');
    cy.findByText('Add $40.01 more for free shipping.');
  });

  it('CA-02 shows an empty cart with Browse plants', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/cart', { fixture: 'cart-empty.json' }).as('cart');
    signInAsAva();
    cy.wait('@authMe');
    cy.wait('@cart');

    cy.findByRole('heading', { name: 'Your cart is empty' });
    cy.findByRole('link', { name: 'Browse plants' });
  });

  it('CA-03 offers Try again when the cart cannot be loaded', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/cart', {
      statusCode: 500,
      fixture: 'cart-negative.json',
    }).as('cart');
    signInAsAva();
    cy.wait('@authMe');
    cy.wait('@cart');

    cy.findByRole('alert', { name: /Your cart couldn't be loaded\./ });
    cy.findByRole('button', { name: 'Try again' });
  });

  it('CA-04 redirects signed-out customers to login with next=/cart', { tags: '@ui' }, () => {
    cy.visit('/cart', {
      onBeforeLoad(win) {
        win.localStorage.removeItem('fernly_token');
      },
    });

    cy.location('pathname').should('eq', '/login');
    cy.location('search').should('eq', '?next=/cart');
  });

  it('CA-05 shows Air Plant at $0.00', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/cart', { fixture: 'cart-edge.json' }).as('cart');
    signInAsAva();
    cy.wait('@authMe');
    cy.wait('@cart');

    cy.findByText('Air Plant');
    cy.findByText('$0.00');
  });
});
