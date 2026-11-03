import { SizePicker } from '../../src/components/SizePicker';
import type { SizeLabel } from '../../src/types';

const sizes: { label: SizeLabel; priceDelta: number }[] = [
  { label: 'S', priceDelta: 0 },
  { label: 'M', priceDelta: 6 },
  { label: 'L', priceDelta: 14 },
];

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

/** The price written beside one size, such as "Base price" or "+$6.00". */
function priceBeside(radio: HTMLElement): string[] {
  return Array.from(radio.parentElement?.children ?? []).map((child) => directText(child));
}

describe('SizePicker', () => {
  it('SZ-01 shows a Size group with Small, Medium, and Large', { tags: '@component' }, () => {
    cy.mount(<SizePicker sizes={sizes} value="S" onChange={cy.spy()} />);

    cy.findByRole('group', { name: 'Size' }).within(() => {
      cy.findByRole('radio', { name: /^Small/ });
      cy.findByRole('radio', { name: /^Medium/ });
      cy.findByRole('radio', { name: /^Large/ });
    });
  });

  it('SZ-02 shows Base price for Small', { tags: '@component' }, () => {
    cy.mount(<SizePicker sizes={sizes} value="S" onChange={cy.spy()} />);

    cy.findByRole('radio', { name: /^Small/ }).then(($radio) => {
      expect(priceBeside($radio[0]), 'Small').to.include('Base price');
    });
  });

  it('SZ-03 shows +$6.00 for Medium', { tags: '@component' }, () => {
    cy.mount(<SizePicker sizes={sizes} value="S" onChange={cy.spy()} />);

    cy.findByRole('radio', { name: /^Medium/ }).then(($radio) => {
      expect(priceBeside($radio[0]), 'Medium').to.include('+$6.00');
    });
  });

  it('SZ-04 selects Medium and not Small', { tags: '@component' }, () => {
    cy.mount(<SizePicker sizes={sizes} value="M" onChange={cy.spy()} />);

    cy.findByRole('radio', { name: /^Medium/ }).then(($el) => {
      expect($el, 'Medium size').to.be.checked;
    });
    cy.findByRole('radio', { name: /^Small/ }).then(($el) => {
      expect($el, 'Small size').not.to.be.checked;
    });
  });

  it('SZ-05 calls onChange with L and keeps Small selected', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<SizePicker sizes={sizes} value="S" onChange={onChange} />);

    cy.findByText(hasOwnText('Large')).click();
    cy.get('@onChange').should('have.been.calledOnceWith', 'L');
    cy.findByRole('radio', { name: /^Small/ }).then(($el) => {
      expect($el, 'Small size').to.be.checked;
    });
  });

  it('SZ-06 names each radio size', { tags: '@component' }, () => {
    cy.mount(<SizePicker sizes={sizes} value="S" onChange={cy.spy()} />);

    cy.findAllByRole('radio').then(($radios) => {
      const names = Array.from($radios).map((radio) => (radio as HTMLInputElement).name);
      expect(names, 'radio names').to.deep.equal(['size', 'size', 'size']);
    });
  });

  it('SZ-07 shows only the sizes it is given', { tags: '@component' }, () => {
    cy.mount(
      <SizePicker
        sizes={[
          { label: 'S', priceDelta: 0 },
          { label: 'M', priceDelta: 6 },
        ]}
        value="S"
        onChange={cy.spy()}
      />,
    );

    cy.findByRole('group', { name: 'Size' }).within(() => {
      cy.findByRole('radio', { name: /^Small/ });
      cy.findByRole('radio', { name: /^Medium/ });
    });
    cy.findAllByRole('radio', { name: /^Large/ }).should('have.length', 0);
  });

  it('SZ-08 moves to Medium with Arrow Right and keeps Small selected', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<SizePicker sizes={sizes} value="S" onChange={onChange} />);

    cy.press(Cypress.Keyboard.Keys.TAB);
    cy.findByRole('group', { name: 'Size' }).then(($group) => {
      const active = $group[0].ownerDocument.activeElement;
      expect($group[0].contains(active), 'focus is in the Size group').to.equal(true);
    });
    cy.press(Cypress.Keyboard.Keys.RIGHT);
    cy.get('@onChange').should('have.been.calledOnceWith', 'M');
    cy.findByRole('radio', { name: /^Small/ }).then(($el) => {
      expect($el, 'Small size').to.be.checked;
    });
  });
});
