import { NotifyForm } from '../../src/components/NotifyForm';

describe('NotifyForm', () => {
  it(
    'CT-02 shows the notify form, submits a trimmed email, confirms, errors, and blocks empty submit',
    { tags: '@component' },
    () => {
      const onSubmit = cy.spy().as('onSubmit');
      cy.mount(
        <NotifyForm plantName="Chinese Money Plant" onSubmit={onSubmit} />,
      );

      cy.findByText("Email me when it's back");
      cy.findByLabelText("Email me when it's back");
      cy.findByRole('button', { name: 'Notify me' }).then(($el) =>
        expect($el, 'Notify me with an empty email').to.be.disabled,
      );

      cy.findByLabelText("Email me when it's back").type('   ');
      cy.findByRole('button', { name: 'Notify me' }).then(($el) =>
        expect($el, 'Notify me with whitespace only').to.be.disabled,
      );
      cy.get('@onSubmit').should('not.have.been.called');

      cy.findByLabelText("Email me when it's back").clear().type('  ava@example.com  ');
      cy.findByRole('button', { name: 'Notify me' }).click();
      cy.get('@onSubmit').should('have.been.calledOnceWithExactly', 'ava@example.com');

      cy.mount(
        <NotifyForm
          plantName="Chinese Money Plant"
          onSubmit={cy.spy()}
          busy
        />,
      );
      cy.findByLabelText("Email me when it's back").type('ava@example.com');
      cy.findByRole('button', { name: 'Notify me' }).then(($el) =>
        expect($el, 'Notify me while busy').to.be.disabled,
      );

      cy.mount(
        <NotifyForm
          plantName="Chinese Money Plant"
          onSubmit={cy.spy()}
          error="You're already on the list"
        />,
      );
      cy.findByText("You're already on the list");

      cy.mount(
        <NotifyForm
          plantName="Chinese Money Plant"
          onSubmit={cy.spy()}
          subscribedEmail="ava@example.com"
        />,
      );
      cy.findByText(/We'll email ava@example.com when Chinese Money Plant is back/);
      cy.findByLabelText("Email me when it's back").should('not.exist');
      cy.findByRole('button', { name: 'Notify me' }).should('not.exist');
    },
  );
});
