import { NotifyForm } from '../../src/components/NotifyForm';

describe('NotifyForm', () => {
  it(
    'CT-05 names the email field and disables Notify me until the email is non-empty',
    { tags: '@component' },
    () => {
      cy.mount(<NotifyForm plantName="Chinese Money Plant" onSubmit={cy.spy()} />);

      cy.findByLabelText("Email me when it's back");
      cy.findByRole('button', { name: 'Notify me' }).then(($el) => {
        expect($el, 'Notify me with empty email').to.be.disabled;
      });

      cy.findByLabelText("Email me when it's back").type('   ');
      cy.findByRole('button', { name: 'Notify me' }).then(($el) => {
        expect($el, 'Notify me with whitespace-only email').to.be.disabled;
      });

      cy.findByLabelText("Email me when it's back").clear().type('name@example.com');
      cy.findByRole('button', { name: 'Notify me' }).then(($el) => {
        expect($el, 'Notify me with a non-empty email').to.not.be.disabled;
      });
    },
  );

  it(
    'CT-06 submits the trimmed email, disables Notify me while busy, and shows error in an alert',
    { tags: '@component' },
    () => {
      const onSubmit = cy.spy().as('onSubmit');
      cy.mount(
        <NotifyForm
          plantName="Chinese Money Plant"
          onSubmit={onSubmit}
          error="You're already on the list"
        />,
      );

      cy.findByRole('alert').then(($el) => {
        expect($el.text().trim(), 'error').to.equal("You're already on the list");
      });
      cy.findByLabelText("Email me when it's back").type('  name@example.com  ');
      cy.findByRole('button', { name: 'Notify me' }).click();
      cy.get('@onSubmit').should('have.been.calledOnceWith', 'name@example.com');

      cy.mount(
        <NotifyForm
          plantName="Chinese Money Plant"
          onSubmit={cy.spy()}
          busy
          error="You're already on the list"
        />,
      );
      cy.findByLabelText("Email me when it's back").type('busy@example.com');
      cy.findByRole('button', { name: 'Notify me' }).then(($el) => {
        expect($el, 'Notify me while busy').to.be.disabled;
      });
    },
  );

  it(
    'CT-07 replaces the form with confirmation when subscribedEmail is set',
    { tags: '@component' },
    () => {
      cy.mount(
        <NotifyForm
          plantName="Chinese Money Plant"
          onSubmit={cy.spy()}
          subscribedEmail="name@example.com"
        />,
      );

      cy.findByText("We'll email name@example.com when Chinese Money Plant is back.");
      cy.findAllByLabelText("Email me when it's back").should('have.length', 0);
      cy.findAllByRole('button', { name: 'Notify me' }).should('have.length', 0);
    },
  );
});
