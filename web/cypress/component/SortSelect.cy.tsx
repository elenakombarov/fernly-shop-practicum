import { useState } from 'react';
import { computeAccessibleName } from 'dom-accessibility-api';
import { SortSelect } from '../../src/components/SortSelect';
import type { Sort } from '../../src/types';

const SORT_LABELS = [
  'Featured',
  'Price: low to high',
  'Price: high to low',
  'Name: A to Z',
  'Best rated',
] as const;

function expectSelected(value: string, label: string) {
  cy.findByRole('combobox', { name: 'Sort by' }).then(($el) => {
    const select = $el[0] as HTMLSelectElement;
    expect($el, 'sort').to.have.value(value);
    expect(select.selectedOptions[0]?.text, 'selected sort').to.equal(label);
  });
}

function choose(label: string) {
  cy.findByRole('combobox', { name: 'Sort by' }).select(label);
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

/** WCAG 2.1 relative luminance and contrast ratio. */
function contrastRatio(foreground: string, background: string): number {
  const linear = (value: number) => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (color: string) => {
    const [r, g, b] = channel(color);
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

/** The first opaque background behind an element, which is what the text sits on. */
function paintedBackground(element: Element): string {
  let current: Element | null = element;
  while (current) {
    const bg = getComputedStyle(current).backgroundColor;
    const match = bg.match(
      /rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*(\d+(?:\.\d+)?))?\)/,
    );
    if (match) {
      const alpha = match[4] === undefined ? 1 : Number(match[4]);
      if (alpha > 0) return bg;
    } else if (bg && bg !== 'transparent') {
      return bg;
    }
    current = current.parentElement;
  }
  throw new Error('no painted background');
}

function expectContrast(element: Element, what: string) {
  const color = getComputedStyle(element).color;
  const background = paintedBackground(element);
  const ratio = contrastRatio(color, background);
  expect(ratio, `${what} ${color} on ${background}`).to.be.at.least(4.5);
}

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

/** Parent stand-in: swaps `value` before the customer chooses again. */
function ParentSort({
  first,
  next,
  onChange,
}: {
  first: Sort;
  next: Sort;
  onChange: (value: Sort) => void;
}) {
  const [value, setValue] = useState(first);
  return (
    <>
      <SortSelect value={value} onChange={onChange} />
      <button type="button" onClick={() => setValue(next)}>
        Replace value
      </button>
    </>
  );
}

describe('SortSelect', () => {
  it('SS-01 shows Sort by with Featured selected', { tags: '@component' }, () => {
    cy.mount(<SortSelect value="featured" onChange={cy.spy()} />);

    cy.findByText('Sort by');
    expectSelected('featured', 'Featured');
  });

  it('SS-02 selects Price: low to high', { tags: '@component' }, () => {
    cy.mount(<SortSelect value="price-asc" onChange={cy.spy()} />);

    expectSelected('price-asc', 'Price: low to high');
  });

  it('SS-03 selects Price: high to low', { tags: '@component' }, () => {
    cy.mount(<SortSelect value="price-desc" onChange={cy.spy()} />);

    expectSelected('price-desc', 'Price: high to low');
  });

  it('SS-04 selects Name: A to Z', { tags: '@component' }, () => {
    cy.mount(<SortSelect value="name" onChange={cy.spy()} />);

    expectSelected('name', 'Name: A to Z');
  });

  it('SS-05 selects Best rated', { tags: '@component' }, () => {
    cy.mount(<SortSelect value="rating" onChange={cy.spy()} />);

    expectSelected('rating', 'Best rated');
  });

  it('SS-06 lists the five sorts in order', { tags: '@component' }, () => {
    cy.mount(<SortSelect value="featured" onChange={cy.spy()} />);

    cy.findAllByRole('option', { hidden: true }).then(($options) => {
      const labels = [...$options].map((option) => (option.textContent ?? '').trim());
      expect(labels, 'sort options').to.deep.equal([...SORT_LABELS]);
    });
  });

  it('SS-07 calls onChange once with price-asc and keeps Featured selected', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<SortSelect value="featured" onChange={onChange} />);

    choose('Price: low to high');
    cy.get('@onChange').should('have.been.calledOnceWith', 'price-asc');
    expectSelected('featured', 'Featured');
  });

  it('SS-08 calls onChange once with price-desc and keeps Price: low to high selected', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<SortSelect value="price-asc" onChange={onChange} />);

    choose('Price: high to low');
    cy.get('@onChange').should('have.been.calledOnceWith', 'price-desc');
    expectSelected('price-asc', 'Price: low to high');
  });

  it('SS-09 calls onChange once with name and keeps Price: high to low selected', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<SortSelect value="price-desc" onChange={onChange} />);

    choose('Name: A to Z');
    cy.get('@onChange').should('have.been.calledOnceWith', 'name');
    expectSelected('price-desc', 'Price: high to low');
  });

  it('SS-10 calls onChange once with rating and keeps Name: A to Z selected', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<SortSelect value="name" onChange={onChange} />);

    choose('Best rated');
    cy.get('@onChange').should('have.been.calledOnceWith', 'rating');
    expectSelected('name', 'Name: A to Z');
  });

  it('SS-11 calls onChange once with featured and keeps Best rated selected', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<SortSelect value="rating" onChange={onChange} />);

    choose('Featured');
    cy.get('@onChange').should('have.been.calledOnceWith', 'featured');
    expectSelected('rating', 'Best rated');
  });

  it('SS-12 shows the sort the parent passes and does not call onChange', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<ParentSort first="featured" next="price-desc" onChange={onChange} />);

    expectSelected('featured', 'Featured');
    cy.findByRole('button', { name: 'Replace value' }).click();
    expectSelected('price-desc', 'Price: high to low');
    cy.get('@onChange').should('not.have.been.called');
  });

  it('SS-13 names the select Sort by', { tags: '@component' }, () => {
    cy.mount(<SortSelect value="featured" onChange={cy.spy()} />);

    cy.findByRole('combobox').then(($el) => {
      expect(computeAccessibleName($el[0]), 'Sort by').to.equal('Sort by');
    });
  });

  it(
    'SS-14 keeps focus visible and chooses Price: high to low from the keyboard',
    { tags: '@component' },
    () => {
      const onChange = cy.spy().as('onChange');
      cy.mount(<SortSelect value="featured" onChange={onChange} />);

      cy.press(Cypress.Keyboard.Keys.TAB);
      cy.findByRole('combobox', { name: 'Sort by' }).then(($el) => {
        expect($el[0].ownerDocument.activeElement, 'Sort by has focus').to.equal($el[0]);
        const ring = readFocusRing($el[0]);
        expect(ringVisible(ring), `Sort by focus ring ${ringText(ring)}`).to.equal(true);
      });
      // A closed native select commits each arrow as its own choice. Price: high to low
      // is one choice, so select that option while the control still has keyboard focus.
      cy.findByRole('combobox', { name: 'Sort by' }).select('Price: high to low');
      cy.get('@onChange').should('have.been.calledOnceWith', 'price-desc');
      expectSelected('featured', 'Featured');
    },
  );

  it('SS-15 keeps Sort by and the selected sort at a 4.5 to 1 contrast', { tags: '@component' }, () => {
    cy.mount(<SortSelect value="featured" onChange={cy.spy()} />);

    cy.findByText('Sort by').then(($el) => {
      expectContrast($el[0], 'Sort by');
    });
    cy.findByRole('combobox', { name: 'Sort by' }).then(($el) => {
      expectContrast($el[0], 'selected sort');
    });
  });
});
