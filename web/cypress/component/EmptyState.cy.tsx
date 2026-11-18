import { isInaccessible } from 'dom-accessibility-api';
import { EmptyState } from '../../src/components/Feedback';

describe('EmptyState', () => {
  it('ES-01 shows the title as a heading', { tags: '@component' }, () => {
    cy.mount(<EmptyState title="Your cart is empty" />);

    cy.findByRole('heading', { name: 'Your cart is empty' });
  });

  it('ES-02 shows the message', { tags: '@component' }, () => {
    cy.mount(
      <EmptyState title="Your cart is empty" message="Add a plant before you check out." />,
    );

    cy.findByText('Add a plant before you check out.');
  });

  it('ES-03 hides the message when it is omitted', { tags: '@component' }, () => {
    cy.mount(
      <EmptyState title="Your cart is empty" action={<a href="/">Browse plants</a>} />,
    );

    cy.findByRole('heading', { name: 'Your cart is empty' }).then(($heading) => {
      const extras = Array.from($heading[0].parentElement?.children ?? []).filter((child) => {
        if (child === $heading[0]) return false;
        if (child.getAttribute('aria-hidden') === 'true') return false;
        if (child.getAttribute('href')) return false;
        return true;
      });
      expect(extras, 'message').to.have.length(0);
    });
  });

  it('ES-04 shows the Browse plants link', { tags: '@component' }, () => {
    cy.mount(
      <EmptyState title="Your cart is empty" action={<a href="/">Browse plants</a>} />,
    );

    cy.findByRole('link', { name: 'Browse plants' });
  });

  it('ES-05 hides the link when the action is omitted', { tags: '@component' }, () => {
    cy.mount(
      <EmptyState title="Your cart is empty" message="Add a plant before you check out." />,
    );

    cy.findByRole('heading', { name: 'Your cart is empty' });
    cy.findAllByRole('link').should('have.length', 0);
  });

  it('ES-06 hides the plant mark from assistive tech', { tags: '@component' }, () => {
    cy.mount(<EmptyState title="Your cart is empty" />);

    cy.findByRole('heading', { name: 'Your cart is empty' }).then(($heading) => {
      const mark = Array.from($heading[0].parentElement?.children ?? []).find((child) =>
        child.textContent?.includes('🌱'),
      );
      expect(mark, 'plant mark').to.exist;
      expect(isInaccessible(mark as Element), 'plant mark').to.equal(true);
    });
  });
});
