import { CartLine } from '../../src/components/CartLine';
import { pressEnter } from '../support/press-enter';
import type { CartLine as CartLineData } from '../../src/types';

const aloe: CartLineData = {
  id: 'ln-aloe',
  plantId: 'pl-aloe',
  name: 'Aloe Vera',
  size: 'S',
  unitPrice: 9.99,
  quantity: 1,
  lineTotal: 9.99,
  stock: 4,
  imageUrl: '/plants/aloe.svg',
};

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

describe('CartLine', () => {
  it('LN-01 shows Aloe Vera and Size S', { tags: '@component' }, () => {
    cy.mount(<CartLine line={aloe} onQuantityChange={cy.spy()} onRemove={cy.spy()} />);

    cy.findByText('Aloe Vera');
    cy.findByText((_content, element) => !!element && directText(element).includes('Size S'));
  });

  it('LN-02 names the unit price Price each and the line total Line total', { tags: '@component' }, () => {
    cy.mount(<CartLine line={aloe} onQuantityChange={cy.spy()} onRemove={cy.spy()} />);

    cy.findByText(hasOwnText('Price each:'));
    cy.findByText(hasOwnText('Line total:'));
  });

  it('LN-03 names the quantity Quantity of Aloe Vera and shows 1', { tags: '@component' }, () => {
    cy.mount(<CartLine line={aloe} onQuantityChange={cy.spy()} onRemove={cy.spy()} />);

    cy.findByRole('group', { name: 'Quantity of Aloe Vera' }).within(() => {
      cy.findByText('1').then(($el) => {
        expect($el.text().trim(), 'quantity').to.equal('1');
      });
    });
  });

  it('LN-04 calls onQuantityChange with the line id and the next quantity', { tags: '@component' }, () => {
    const onQuantityChange = cy.spy().as('onQuantityChange');
    const onRemove = cy.spy().as('onRemove');
    cy.mount(<CartLine line={aloe} onQuantityChange={onQuantityChange} onRemove={onRemove} />);

    cy.findByRole('button', { name: 'Increase quantity' }).click();
    cy.get('@onQuantityChange').should('have.been.calledOnceWith', 'ln-aloe', 2);
    cy.get('@onRemove').should('not.have.been.called');
  });

  it('LN-05 calls onRemove with the line id', { tags: '@component' }, () => {
    const onRemove = cy.spy().as('onRemove');
    cy.mount(<CartLine line={aloe} onQuantityChange={cy.spy()} onRemove={onRemove} />);

    cy.findByRole('button', { name: 'Remove Aloe Vera' }).click();
    cy.get('@onRemove').should('have.been.calledOnceWith', 'ln-aloe');
  });

  it('LN-06 leaves Remove enabled when busy is omitted', { tags: '@component' }, () => {
    cy.mount(<CartLine line={aloe} onQuantityChange={cy.spy()} onRemove={cy.spy()} />);

    cy.findByRole('button', { name: 'Remove Aloe Vera' }).then(($el) => {
      expect($el, 'Remove').not.to.be.disabled;
    });
  });

  it('LN-07 disables the quantity buttons and Remove while the line is busy', { tags: '@component' }, () => {
    const onQuantityChange = cy.spy().as('onQuantityChange');
    const onRemove = cy.spy().as('onRemove');
    cy.mount(
      <CartLine line={aloe} busy onQuantityChange={onQuantityChange} onRemove={onRemove} />,
    );

    cy.findByRole('button', { name: 'Decrease quantity' }).then(($el) => {
      expect($el, 'decrease while busy').to.be.disabled;
    });
    cy.findByRole('button', { name: 'Increase quantity' }).then(($el) => {
      expect($el, 'increase while busy').to.be.disabled;
      // A disabled button ignores this click, so the callback must stay quiet.
      $el[0].click();
    });
    cy.findByRole('button', { name: 'Remove Aloe Vera' }).then(($el) => {
      expect($el, 'Remove while busy').to.be.disabled;
      $el[0].click();
    });
    cy.get('@onQuantityChange').should('not.have.been.called');
    cy.get('@onRemove').should('not.have.been.called');
  });

  it('LN-08 names Remove and removes the line with Enter', { tags: '@component' }, () => {
    const onRemove = cy.spy().as('onRemove');
    cy.mount(<CartLine line={aloe} onQuantityChange={cy.spy()} onRemove={onRemove} />);

    cy.findByRole('button', { name: 'Remove Aloe Vera' }).focus();
    cy.findByRole('button', { name: 'Remove Aloe Vera' }).then(($button) => {
      expect($button[0].ownerDocument.activeElement, 'Remove Aloe Vera has focus').to.equal(
        $button[0],
      );
    });
    pressEnter();
    cy.get('@onRemove').should('have.been.calledOnceWith', 'ln-aloe');
  });
});
