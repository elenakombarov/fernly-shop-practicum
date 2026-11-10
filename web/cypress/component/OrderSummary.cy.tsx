import { OrderSummary } from '../../src/components/OrderSummary';

describe('OrderSummary', () => {
  it('OS-01 defaults the heading to Order summary and that heading names the region', { tags: '@component' }, () => {
    cy.mount(
      <OrderSummary itemCount={1} subtotal={9.99} shipping={6.95} total={16.94} />,
    );

    cy.findByRole('heading', { name: 'Order summary' });
    cy.findByRole('region', { name: 'Order summary' });
  });

  it('OS-02 shows the Paid heading when title is Paid', { tags: '@component' }, () => {
    cy.mount(
      <OrderSummary
        title="Paid"
        itemCount={1}
        subtotal={9.99}
        shipping={6.95}
        total={16.94}
      />,
    );

    cy.findByRole('heading', { name: 'Paid' });
  });

  it('OS-03 labels the subtotal as Subtotal (1 item) when itemCount is 1', { tags: '@component' }, () => {
    cy.mount(
      <OrderSummary itemCount={1} subtotal={9.99} shipping={6.95} total={16.94} />,
    );

    cy.findByText('Subtotal (1 item)');
  });

  it('OS-04 labels the subtotal as Subtotal (2 items) when itemCount is 2', { tags: '@component' }, () => {
    cy.mount(
      <OrderSummary itemCount={2} subtotal={19.98} shipping={6.95} total={26.93} />,
    );

    cy.findByText('Subtotal (2 items)');
  });

  it('OS-05 shows shipping $6.95 and total $16.94 for the charged shipping amounts', { tags: '@component' }, () => {
    cy.mount(
      <OrderSummary itemCount={1} subtotal={9.99} shipping={6.95} total={16.94} />,
    );

    cy.findByText('$6.95');
    cy.findByText('$16.94');
  });

  it('OS-06 says Free for shipping and hides the free-shipping hint at subtotal $50', { tags: '@component' }, () => {
    cy.mount(
      <OrderSummary itemCount={1} subtotal={50} shipping={0} total={50} />,
    );

    cy.findByText('Free');
    cy.findByText(/more for free shipping/).should('not.exist');
  });

  it('OS-07 shows Add $40.01 more for free shipping when subtotal is under $50', { tags: '@component' }, () => {
    cy.mount(
      <OrderSummary itemCount={1} subtotal={9.99} shipping={6.95} total={16.94} />,
    );

    cy.findByText('Add $40.01 more for free shipping.');
  });

  it('OS-08 shows the shipping price and hides Free and the hint when the cart is empty', { tags: '@component' }, () => {
    cy.mount(
      <OrderSummary itemCount={0} subtotal={0} shipping={0} total={0} />,
    );

    cy.findByText('$0.00');
    cy.findByText('Free').should('not.exist');
    cy.findByText(/more for free shipping/).should('not.exist');
  });
});
