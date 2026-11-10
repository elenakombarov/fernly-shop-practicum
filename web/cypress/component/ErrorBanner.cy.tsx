import { ErrorBanner } from '../../src/components/Feedback';
import { pressEnter } from '../support/press-enter';

type FocusRing = { style: string; width: string; color: string };

function readFocusRing(element: Element): FocusRing {
  const style = getComputedStyle(element);
  return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
}

function ringVisible(ring: FocusRing | undefined): boolean {
  if (!ring) return false;
  const width = Number.parseFloat(ring.width);
  const color = ring.color.replace(/\s/g, '');
  const transparent = color === 'transparent' || color === 'rgba(0,0,0,0)';
  return ring.style !== 'none' && width > 0 && !transparent;
}

function ringText(ring: FocusRing | undefined): string {
  if (!ring) return 'missing';
  return `${ring.style} ${ring.width} ${ring.color}`;
}

function expectFocused(element: Element, what: string) {
  expect(element.ownerDocument.activeElement, `${what} has focus`).to.equal(element);
  const ring = readFocusRing(element);
  expect(ringVisible(ring), `${what} focus ring ${ringText(ring)}`).to.equal(true);
}

const message = "Your cart couldn't be loaded.";

describe('ErrorBanner', () => {
  it('EB-01 shows the message as an alert', { tags: '@component' }, () => {
    cy.mount(<ErrorBanner message={message} />);

    cy.findByRole('alert').within(() => {
      cy.findByText(message);
    });
  });

  it('EB-02 shows Try again when onRetry is set', { tags: '@component' }, () => {
    cy.mount(<ErrorBanner message={message} onRetry={cy.spy()} />);

    cy.findByRole('button', { name: 'Try again' });
  });

  it('EB-03 calls onRetry once', { tags: '@component' }, () => {
    const onRetry = cy.spy().as('onRetry');
    cy.mount(<ErrorBanner message={message} onRetry={onRetry} />);

    cy.findByRole('button', { name: 'Try again' }).click();
    cy.get('@onRetry').should('have.been.calledOnce');
  });

  it('EB-04 shows the message and no button when onRetry is omitted', { tags: '@component' }, () => {
    cy.mount(<ErrorBanner message={message} />);

    cy.findByRole('alert').within(() => {
      cy.findByText(message);
    });
    cy.findAllByRole('button').should('have.length', 0);
  });

  it('EB-05 keeps focus visible and retries with Enter', { tags: '@component' }, () => {
    const onRetry = cy.spy().as('onRetry');
    cy.mount(<ErrorBanner message={message} onRetry={onRetry} />);

    cy.findByRole('button', { name: 'Try again' }).focus();
    cy.findByRole('button', { name: 'Try again' }).then(($button) => {
      expectFocused($button[0], 'Try again');
    });
    pressEnter();
    cy.get('@onRetry').should('have.been.calledOnce');
  });
});
