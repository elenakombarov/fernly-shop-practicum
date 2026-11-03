describe('Cart page', () => {
  it('CA-01 shows Your cart, Aloe Vera, shipping $6.95, and the free-shipping hint', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/auth/me', { fixture: 'auth-me.json' }).as('me');
    cy.intercept('GET', '/api/cart', { fixture: 'cart-positive.json' }).as('cart');
    cy.visit('/cart', {
      onBeforeLoad(win) {
        win.localStorage.setItem('fernly_token', 'test-token');
      },
    });
    cy.wait('@me');
    cy.wait('@cart');

    cy.findByRole('heading', { name: 'Your cart' });
    cy.findByText('Aloe Vera');
    cy.findByText('$6.95');
    cy.findByText('Add $40.01 more for free shipping.');
  });

  it('CA-02 shows the heading Your cart is empty and a Browse plants link', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/auth/me', { fixture: 'auth-me.json' }).as('me');
    cy.intercept('GET', '/api/cart', { fixture: 'cart-empty.json' }).as('cart');
    cy.visit('/cart', {
      onBeforeLoad(win) {
        win.localStorage.setItem('fernly_token', 'test-token');
      },
    });
    cy.wait('@me');
    cy.wait('@cart');

    cy.findByRole('heading', { name: 'Your cart is empty' });
    cy.findByRole('link', { name: 'Browse plants' });
  });

  it("CA-03 shows an alert that the cart couldn't be loaded and a Try again button", { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/auth/me', { fixture: 'auth-me.json' }).as('me');
    cy.intercept('GET', '/api/cart', {
      statusCode: 500,
      fixture: 'cart-negative.json',
    }).as('cart');
    cy.visit('/cart', {
      onBeforeLoad(win) {
        win.localStorage.setItem('fernly_token', 'test-token');
      },
    });
    cy.wait('@me');
    cy.wait('@cart');

    cy.findByRole('alert').within(() => {
      cy.findByText("Your cart couldn't be loaded.");
      cy.findByRole('button', { name: 'Try again' });
    });
  });

  it('CA-04 sends a signed-out visit to /login?next=/cart', { tags: '@ui' }, () => {
    cy.visit('/cart');

    cy.location().then((location) => {
      expect(location.pathname + location.search, 'signed-out cart address').to.equal('/login?next=/cart');
    });
  });

  it('CA-05 shows Air Plant and the price $0.00', { tags: ['@ui', '@known-bug'] }, () => {
    cy.intercept('GET', '/api/auth/me', { fixture: 'auth-me.json' }).as('me');
    cy.intercept('GET', '/api/cart', { fixture: 'cart-edge.json' }).as('cart');
    cy.visit('/cart', {
      onBeforeLoad(win) {
        win.localStorage.setItem('fernly_token', 'test-token');
      },
    });
    cy.wait('@me');
    cy.wait('@cart');

    cy.findByText('Air Plant');
    cy.findByText('$0.00');
  });
});
