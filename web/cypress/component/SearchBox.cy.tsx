import { useState } from 'react';
import { computeAccessibleName, isInaccessible } from 'dom-accessibility-api';
import { SearchBox } from '../../src/components/SearchBox';

const magnifier = '⌕';

function expectSearchValue(value: string) {
  cy.findByRole('searchbox').then(($el) => {
    expect($el, 'search field').to.have.value(value);
  });
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

/** Parent stand-in: swaps `value` before the customer types. */
function ParentSearch({
  first,
  next,
  onSearch,
}: {
  first: string;
  next: string;
  onSearch: (value: string) => void;
}) {
  const [value, setValue] = useState(first);
  return (
    <>
      <SearchBox value={value} onSearch={onSearch} />
      <button type="button" onClick={() => setValue(next)}>
        Replace value
      </button>
    </>
  );
}

describe('SearchBox', () => {
  it('SB-01 shows the hint and Search when the field is empty', { tags: '@component' }, () => {
    cy.mount(<SearchBox value="" onSearch={cy.spy()} />);

    cy.findByText('Search plants');
    expectSearchValue('');
    cy.findAllByRole('button', { name: /^Clear search$/ }).should('have.length', 0);
    cy.findByRole('button', { name: /^Search$/ });
  });

  it('SB-02 shows the search term and Clear search', { tags: '@component' }, () => {
    cy.mount(<SearchBox value="snake plant" onSearch={cy.spy()} />);

    expectSearchValue('snake plant');
    cy.findAllByText('Search plants').should('have.length', 0);
    cy.findByRole('button', { name: /^Clear search$/ });
  });

  it('SB-03 shows Clear search for one character', { tags: '@component' }, () => {
    cy.mount(<SearchBox value="a" onSearch={cy.spy()} />);

    expectSearchValue('a');
    cy.findAllByText('Search plants').should('have.length', 0);
    cy.findByRole('button', { name: /^Clear search$/ });
  });

  it('SB-04 shows Clear search for a single space', { tags: '@component' }, () => {
    cy.mount(<SearchBox value=" " onSearch={cy.spy()} />);

    expectSearchValue(' ');
    cy.findByRole('button', { name: /^Clear search$/ });
    cy.findAllByText('Search plants').should('have.length', 0);
  });

  it('SB-05 calls onSearch once with the typed text', { tags: '@component' }, () => {
    const onSearch = cy.spy().as('onSearch');
    cy.mount(<SearchBox value="" onSearch={onSearch} />);

    cy.findByRole('searchbox').type('Monstera');
    cy.get('@onSearch').should('not.have.been.called');
    cy.findByRole('button', { name: /^Search$/ }).click();
    cy.get('@onSearch').should('have.been.calledOnceWith', 'Monstera');
  });

  it('SB-06 trims spaces around the search', { tags: '@component' }, () => {
    const onSearch = cy.spy().as('onSearch');
    cy.mount(<SearchBox value="" onSearch={onSearch} />);

    cy.findByRole('searchbox').type('  fern  ');
    cy.findByRole('button', { name: /^Search$/ }).click();
    cy.get('@onSearch').should('have.been.calledOnceWith', 'fern');
  });

  it('SB-07 searches for nothing when the text is only spaces', { tags: '@component' }, () => {
    const onSearch = cy.spy().as('onSearch');
    cy.mount(<SearchBox value="   " onSearch={onSearch} />);

    cy.findByRole('button', { name: /^Search$/ }).click();
    cy.get('@onSearch').should('have.been.calledOnceWith', '');
  });

  it('SB-08 searches for nothing when the field is empty', { tags: '@component' }, () => {
    const onSearch = cy.spy().as('onSearch');
    cy.mount(<SearchBox value="" onSearch={onSearch} />);

    cy.findByRole('button', { name: /^Search$/ }).click();
    cy.get('@onSearch').should('have.been.calledOnceWith', '');
  });

  it('SB-09 keeps the typed letter case', { tags: '@component' }, () => {
    const onSearch = cy.spy().as('onSearch');
    cy.mount(<SearchBox value="Snake" onSearch={onSearch} />);

    cy.findByRole('button', { name: /^Search$/ }).click();
    cy.get('@onSearch').should('have.been.calledOnceWith', 'Snake');
  });

  it('SB-10 clears the search and calls onSearch with an empty string', { tags: '@component' }, () => {
    const onSearch = cy.spy().as('onSearch');
    cy.mount(<SearchBox value="snake plant" onSearch={onSearch} />);

    cy.findByRole('button', { name: /^Clear search$/ }).click();
    cy.findByText('Search plants');
    expectSearchValue('');
    cy.findAllByRole('button', { name: /^Clear search$/ }).should('have.length', 0);
    cy.get('@onSearch').should('have.been.calledOnceWith', '');
  });

  it('SB-11 shows the search the parent replaces', { tags: '@component' }, () => {
    cy.mount(<ParentSearch first="snake" next="aloe" onSearch={cy.spy()} />);

    expectSearchValue('snake');
    cy.findByRole('button', { name: 'Replace value' }).click();
    cy.findByRole('searchbox').should(($el) => {
      expect($el, 'search field').to.have.value('aloe');
    });
  });

  it(
    'SB-14 is a search landmark with a Search button and a hidden magnifier',
    { tags: '@component' },
    () => {
      cy.mount(<SearchBox value="" onSearch={cy.spy()} />);

      cy.findByRole('search');
      cy.findByRole('button', { name: /^Search$/ }).then(($el) => {
        expect(computeAccessibleName($el[0]), 'Search button').to.equal('Search');
      });
      cy.findByText(magnifier).then(($el) => {
        expect(isInaccessible($el[0]), 'magnifying character').to.equal(true);
      });
    },
  );

  it('SB-15 names the clear control Clear search', { tags: '@component' }, () => {
    cy.mount(<SearchBox value="fern" onSearch={cy.spy()} />);

    cy.findByRole('button', { name: /^Clear search$/ }).then(($el) => {
      expect(computeAccessibleName($el[0]), 'Clear search').to.equal('Clear search');
    });
  });

  it('SB-16 gives the search field a name', { tags: '@component' }, () => {
    cy.mount(<SearchBox value="" onSearch={cy.spy()} />);

    cy.findByRole('searchbox').then(($el) => {
      expect(computeAccessibleName($el[0]).trim(), 'search field name').to.not.equal('');
    });
  });

  it('SB-18 submits with Enter and keeps focus visible', { tags: '@component' }, () => {
    const onSearch = cy.spy().as('onSearch');
    const rings: { field?: FocusRing; search?: FocusRing } = {};
    cy.mount(<SearchBox value="" onSearch={onSearch} />);

    cy.press(Cypress.Keyboard.Keys.TAB);
    cy.findByRole('searchbox').then(($input) => {
      expect($input[0].ownerDocument.activeElement, 'tab lands on the search field').to.equal($input[0]);
      rings.field = readFocusRing($input[0]);
    });
    cy.focused().type('fern{enter}');
    cy.get('@onSearch').should('have.been.calledOnceWith', 'fern');

    cy.press(Cypress.Keyboard.Keys.TAB);
    cy.press(Cypress.Keyboard.Keys.TAB);
    cy.findByRole('button', { name: /^Search$/ }).then(($button) => {
      expect($button[0].ownerDocument.activeElement, 'tab lands on Search').to.equal($button[0]);
      rings.search = readFocusRing($button[0]);
      expect(
        { field: ringVisible(rings.field), search: ringVisible(rings.search) },
        `search field focus ring ${ringText(rings.field)}; Search focus ring ${ringText(rings.search)}`,
      ).to.deep.equal({ field: true, search: true });
    });
  });

  it('SB-19 keeps Search text at a 4.5 to 1 contrast', { tags: '@component' }, () => {
    cy.mount(<SearchBox value="" onSearch={cy.spy()} />);

    cy.findByRole('button', { name: /^Search$/ }).then(($el) => {
      expectContrast($el[0], 'Search label');
    });
  });

  it('SB-20 keeps the hint and Clear search at a 4.5 to 1 contrast', { tags: '@component' }, () => {
    cy.mount(<SearchBox value="" onSearch={cy.spy()} />);

    cy.findByText('Search plants').then(($el) => {
      expectContrast($el[0], 'hint');
    });
    cy.findByRole('searchbox').type('fern');
    cy.findByRole('button', { name: /^Clear search$/ }).then(($el) => {
      expectContrast($el[0], 'Clear search');
    });
  });

  it('SB-21 keeps the typed text at a 4.5 to 1 contrast', { tags: '@component' }, () => {
    cy.mount(<SearchBox value="fern" onSearch={cy.spy()} />);

    cy.findByRole('searchbox').then(($el) => {
      expectContrast($el[0], 'field text');
    });
  });
});
