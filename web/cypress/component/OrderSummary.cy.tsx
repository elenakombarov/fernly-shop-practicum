import { OrderSummary } from '../../src/components/OrderSummary';

function directText(element: Element): string {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasOwnText(expected: string) {
  return (_content: string, element: Element | null): boolean =>
    !!element && directText(element) === expected;
}

/** The amount or word in the row next to a term such as Shipping. */
function valueBeside(term: HTMLElement): string {
  return (term.nextElementSibling?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('OrderSummary', () => {
  it('OS-01 names the region Order summary', { tags: '@component' }, () => {
    cy.mount(<OrderSummary itemCount={1} subtotal={9.99} shipping={6.95} total={16.94} />);

    cy.findByRole('heading', { name: 'Order summary' });
    cy.findByRole('region', { name: 'Order summary' });
  });

  it('OS-02 shows the heading Paid', { tags: '@component' }, () => {
    cy.mount(
      <OrderSummary itemCount={1} subtotal={9.99} shipping={6.95} total={16.94} title="Paid" />,
    );

    cy.findByRole('heading', { name: 'Paid' });
  });

  it('OS-03 reads Subtotal (1 item)', { tags: '@component' }, () => {
    cy.mount(<OrderSummary itemCount={1} subtotal={9.99} shipping={6.95} total={16.94} />);

    cy.findByText('Subtotal (1 item)');
  });

  it('OS-04 reads Subtotal (2 items)', { tags: '@component' }, () => {
    cy.mount(<OrderSummary itemCount={2} subtotal={19.98} shipping={6.95} total={26.93} />);

    cy.findByText('Subtotal (2 items)');
  });

  it('OS-05 shows shipping $6.95 and total $16.94', { tags: '@component' }, () => {
    cy.mount(<OrderSummary itemCount={1} subtotal={9.99} shipping={6.95} total={16.94} />);

    cy.findByText(hasOwnText('Shipping')).then(($term) => {
      expect(valueBeside($term[0]), 'shipping').to.equal('$6.95');
    });
    cy.findByText(hasOwnText('Total')).then(($term) => {
      expect(valueBeside($term[0]), 'total').to.equal('$16.94');
    });
  });

  it('OS-06 says Free and hides the free-shipping hint at $50', { tags: '@component' }, () => {
    cy.mount(<OrderSummary itemCount={1} subtotal={50} shipping={0} total={50} />);

    cy.findByText(hasOwnText('Shipping')).then(($term) => {
      expect(valueBeside($term[0]), 'shipping').to.equal('Free');
    });
    cy.findAllByText(/more for free shipping/).should('have.length', 0);
  });

  it('OS-07 shows how much more would make shipping free', { tags: '@component' }, () => {
    cy.mount(<OrderSummary itemCount={1} subtotal={9.99} shipping={6.95} total={16.94} />);

    cy.findByText('Add $40.01 more for free shipping.');
  });

  it('OS-08 shows a shipping price and no hint when the cart is empty', { tags: '@component' }, () => {
    cy.mount(<OrderSummary itemCount={0} subtotal={0} shipping={0} total={0} />);

    cy.findByText(hasOwnText('Shipping')).then(($term) => {
      const price = valueBeside($term[0]);
      expect(price, 'shipping price').to.match(/^\$\d/);
      expect(price, 'shipping price').to.not.include('Free');
    });
    cy.findAllByText(/more for free shipping/).should('have.length', 0);
  });

  it(
    'CT-04 shows Discount (CODE) and −$X.XX between subtotal and shipping when discount > 0',
    { tags: '@component' },
    () => {
      cy.mount(
        <OrderSummary
          itemCount={1}
          subtotal={40}
          discount={4}
          promoCode="LEAFY10"
          shipping={6.95}
          total={42.95}
        />,
      );

      cy.findByText('Discount (LEAFY10)');
      cy.findByText('\u2212$4.00');
      cy.findByText(hasOwnText('Subtotal (1 item)')).then(($subtotal) => {
        const subtotalRow = $subtotal[0].closest('div');
        const discountRow = Cypress.$('body')
          .find('*')
          .filter((_, el) => (el.textContent ?? '').includes('Discount (LEAFY10)'))
          .first()
          .closest('div')[0];
        const shippingTerm = Cypress.$('body')
          .find('*')
          .filter((_, el) => directText(el) === 'Shipping')
          .first()[0];
        expect(subtotalRow, 'subtotal row').to.exist;
        expect(discountRow, 'discount row').to.exist;
        expect(shippingTerm, 'shipping term').to.exist;
        const order = [subtotalRow!, discountRow!, shippingTerm.closest('div')!].map((el) =>
          el.compareDocumentPosition
            ? Array.from(el.parentElement?.children ?? []).indexOf(el)
            : -1,
        );
        expect(order[0], 'subtotal before discount').to.be.lessThan(order[1]);
        expect(order[1], 'discount before shipping').to.be.lessThan(order[2]);
      });
      cy.findByText(hasOwnText('Shipping')).then(($term) => {
        expect(valueBeside($term[0]), 'shipping').to.equal('$6.95');
      });
      cy.findByText(hasOwnText('Total')).then(($term) => {
        expect(valueBeside($term[0]), 'total').to.equal('$42.95');
      });
      cy.findByText('Add $10.00 more for free shipping.');

      cy.mount(
        <OrderSummary itemCount={1} subtotal={12.5} discount={0} promoCode={null} shipping={6.95} total={19.45} />,
      );
      cy.findAllByText(/^Discount/).should('have.length', 0);

      cy.mount(<OrderSummary itemCount={1} subtotal={50} discount={0} shipping={0} total={50} />);
      cy.findByText(hasOwnText('Shipping')).then(($term) => {
        expect(valueBeside($term[0]), 'shipping').to.equal('Free');
      });
    },
  );
});
