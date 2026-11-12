import { Toast } from '../../src/components/Feedback';
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

function channel(color: string): [number, number, number] {
  const rgb = color.match(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const value = Number.parseInt(hex[1], 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }
  throw new Error(`unexpected color ${color}`);
}

function toHex(color: string): string {
  const [r, g, b] = channel(color).map((part) => Math.round(part));
  const hex = (part: number) => part.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

const added = 'Added 1 × Aloe Vera to your cart.';

describe('Toast', () => {
  it('TO-01 shows the message as a status', { tags: '@component' }, () => {
    cy.mount(<Toast message={added} onClose={cy.spy()} />);

    cy.findByRole('status').within(() => {
      cy.findByText(added);
    });
  });

  it('TO-02 uses the success background', { tags: '@component' }, () => {
    cy.mount(<Toast message={added} onClose={cy.spy()} />);

    cy.findByRole('status').then(($el) => {
      const background = getComputedStyle($el[0]).backgroundColor;
      expect(toHex(background), 'toast background').to.equal('#24532d');
    });
  });

  it('TO-03 uses the error background', { tags: '@component' }, () => {
    cy.mount(<Toast message={added} tone="error" onClose={cy.spy()} />);

    cy.findByRole('status').then(($el) => {
      const background = getComputedStyle($el[0]).backgroundColor;
      expect(toHex(background), 'toast background').to.equal('#7a1f14');
    });
  });

  it('TO-04 calls onClose from Dismiss', { tags: '@component' }, () => {
    const onClose = cy.spy().as('onClose');
    cy.mount(<Toast message={added} duration={0} onClose={onClose} />);

    cy.findByRole('button', { name: 'Dismiss' }).click();
    cy.get('@onClose').should('have.been.calledOnce');
  });

  it('TO-05 calls onClose once after 4 seconds', { tags: '@component' }, () => {
    const onClose = cy.spy().as('onClose');
    // cy.clock/cy.tick does not flush this React 19 useEffect timeout in component tests.
    // Intercept only the toast's auto-close timer; leave other timers on the real clock.
    const autoClose: { id?: number; delay?: number; handler?: () => void } = {};

    cy.window().then((win) => {
      const nativeSetTimeout = win.setTimeout.bind(win);
      const nativeClearTimeout = win.clearTimeout.bind(win);

      cy.stub(win, 'setTimeout').callsFake((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
        if (handler === onClose) {
          autoClose.delay = delay ?? 0;
          autoClose.handler = handler as () => void;
          autoClose.id = 1;
          return autoClose.id;
        }
        return nativeSetTimeout(handler, delay, ...args);
      });

      cy.stub(win, 'clearTimeout').callsFake((id?: number) => {
        if (id !== undefined && id === autoClose.id) {
          autoClose.handler = undefined;
          autoClose.delay = undefined;
          return;
        }
        return nativeClearTimeout(id);
      });
    });

    cy.mount(<Toast message={added} onClose={onClose} />);

    cy.wrap(autoClose).should((state) => {
      expect(state.delay, 'default duration').to.equal(4000);
      expect(state.handler, 'auto-close handler').to.equal(onClose);
    });
    cy.get('@onClose').should('not.have.been.called');
    cy.then(() => {
      expect(autoClose.handler, 'auto-close still armed').to.equal(onClose);
      autoClose.handler!();
    });
    cy.get('@onClose').should('have.been.calledOnce');
  });

  it('TO-06 stays open when duration is 0', { tags: '@component' }, () => {
    cy.clock();
    const onClose = cy.spy().as('onClose');
    cy.mount(<Toast message={added} duration={0} onClose={onClose} />);

    cy.tick(4000);
    cy.get('@onClose').should('not.have.been.called');
  });

  it('TO-07 keeps focus visible and dismisses with Enter', { tags: '@component' }, () => {
    const onClose = cy.spy().as('onClose');
    cy.mount(<Toast message={added} duration={0} onClose={onClose} />);

    cy.findByRole('button', { name: 'Dismiss' }).focus();
    cy.findByRole('button', { name: 'Dismiss' }).then(($button) => {
      expectFocused($button[0], 'Dismiss');
    });
    pressEnter();
    cy.get('@onClose').should('have.been.calledOnce');
  });
});
