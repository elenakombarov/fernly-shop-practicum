describe('Orders page', () => {
  it('OR-01 shows Your orders, the link Order ord-1001, and the total $16.94', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/auth/me', { fixture: 'auth-me.json' }).as('me');
    cy.intercept('GET', '/api/cart', { fixture: 'cart-empty.json' }).as('cart');
    cy.intercept('GET', /\/api\/orders$/, { fixture: 'orders-positive.json' }).as('orders');
    cy.visit('/orders', {
      onBeforeLoad(win) {
        win.localStorage.setItem('fernly_token', 'test-token');
      },
    });
    cy.wait('@me');
    cy.wait('@orders');
    cy.wait('@cart');

    cy.findByRole('heading', { name: 'Your orders' });
    cy.findByRole('link', { name: 'Order ord-1001' });
    cy.findByText('$16.94');
  });

  it('OR-02 shows the heading No orders yet', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/auth/me', { fixture: 'auth-me.json' }).as('me');
    cy.intercept('GET', '/api/cart', { fixture: 'cart-empty.json' }).as('cart');
    cy.intercept('GET', /\/api\/orders$/, { fixture: 'orders-empty.json' }).as('orders');
    cy.visit('/orders', {
      onBeforeLoad(win) {
        win.localStorage.setItem('fernly_token', 'test-token');
      },
    });
    cy.wait('@me');
    cy.wait('@orders');
    cy.wait('@cart');

    cy.findByRole('heading', { name: 'No orders yet' });
  });

  it("OR-03 shows an alert that orders couldn't be loaded and a Try again button", { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/auth/me', { fixture: 'auth-me.json' }).as('me');
    cy.intercept('GET', '/api/cart', { fixture: 'cart-empty.json' }).as('cart');
    cy.intercept('GET', /\/api\/orders$/, {
      statusCode: 500,
      fixture: 'orders-negative.json',
    }).as('orders');
    cy.visit('/orders', {
      onBeforeLoad(win) {
        win.localStorage.setItem('fernly_token', 'test-token');
      },
    });
    cy.wait('@me');
    cy.wait('@orders');
    cy.wait('@cart');

    cy.findByRole('alert').within(() => {
      cy.findByText("Your orders couldn't be loaded.");
      cy.findByRole('button', { name: 'Try again' });
    });
  });

  it('OR-04 sends a signed-out visit to /login?next=/orders', { tags: '@ui' }, () => {
    cy.intercept('GET', /\/api\/orders$/, {
      statusCode: 401,
      fixture: 'orders-negative.json',
    }).as('orders');
    cy.visit('/orders');
    cy.wait('@orders');

    cy.location().then((location) => {
      expect(location.pathname + location.search, 'signed-out orders address').to.equal('/login?next=/orders');
    });
  });

  it('OR-05 shows the link Order ord-zero and the total $0.00', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/auth/me', { fixture: 'auth-me.json' }).as('me');
    cy.intercept('GET', '/api/cart', { fixture: 'cart-empty.json' }).as('cart');
    cy.intercept('GET', /\/api\/orders$/, { fixture: 'orders-edge.json' }).as('orders');
    cy.visit('/orders', {
      onBeforeLoad(win) {
        win.localStorage.setItem('fernly_token', 'test-token');
      },
    });
    cy.wait('@me');
    cy.wait('@orders');
    cy.wait('@cart');

    cy.findByRole('link', { name: 'Order ord-zero' });
    cy.findByText('$0.00');
  });
});
