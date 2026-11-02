import { QuantityStepper } from '../../src/components/QuantityStepper';

describe('QuantityStepper', () => {
  it('calls onChange with the new value when + or − is clicked', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<QuantityStepper value={2} max={5} onChange={onChange} />);

    cy.findByRole('button', { name: 'Increase quantity' }).click();
    cy.get('@onChange').should('have.been.calledOnceWith', 3);

    cy.findByRole('button', { name: 'Decrease quantity' }).click();
    cy.get('@onChange').should('have.been.calledWith', 1);
  });

  it('disables − at the minimum', { tags: '@component' }, () => {
    cy.mount(<QuantityStepper value={1} max={5} onChange={cy.spy()} />);

    cy.findByRole('button', { name: 'Decrease quantity' }).should('be.disabled');
  });

  it('disables + at the stock limit', { tags: '@component' }, () => {
    cy.mount(<QuantityStepper value={3} max={3} onChange={cy.spy()} />);

    cy.findByRole('button', { name: 'Increase quantity' }).should('be.disabled');
  });
});
