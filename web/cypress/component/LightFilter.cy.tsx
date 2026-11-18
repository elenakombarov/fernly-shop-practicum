import { useState } from 'react';
import { computeAccessibleName } from 'dom-accessibility-api';
import { LightFilter } from '../../src/components/LightFilter';
import type { Light } from '../../src/types';

function expectLightChecked(name: string, checked: boolean) {
  cy.findByRole('checkbox', { name }).then(($el) => {
    if (checked) {
      expect($el, name).to.be.checked;
    } else {
      expect($el, name).not.to.be.checked;
    }
  });
}

function expectLights(low: boolean, medium: boolean, bright: boolean) {
  expectLightChecked('Low light', low);
  expectLightChecked('Medium light', medium);
  expectLightChecked('Bright light', bright);
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

function expectFocusVisible(name: string) {
  cy.findByRole('checkbox', { name }).then(($el) => {
    expect($el[0].ownerDocument.activeElement, `${name} has focus`).to.equal($el[0]);
    const ring = readFocusRing($el[0]);
    expect(ringVisible(ring), `${name} focus ring ${ringText(ring)}`).to.equal(true);
  });
}

/** Parent stand-in: swaps `value` before the customer clicks. */
function ParentLight({
  first,
  next,
  onChange,
}: {
  first: Light[];
  next: Light[];
  onChange: (value: Light[]) => void;
}) {
  const [value, setValue] = useState(first);
  return (
    <>
      <LightFilter value={value} onChange={onChange} />
      <button type="button" onClick={() => setValue(next)}>
        Replace value
      </button>
    </>
  );
}

describe('LightFilter', () => {
  it('LF-01 shows Light with every box unchecked and does not call onChange', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<LightFilter value={[]} onChange={onChange} />);

    cy.findByRole('group', { name: 'Light' });
    expectLights(false, false, false);
    cy.get('@onChange').should('not.have.been.called');
  });

  it('LF-02 checks only Low light', { tags: '@component' }, () => {
    cy.mount(<LightFilter value={['low']} onChange={cy.spy()} />);

    expectLights(true, false, false);
  });

  it('LF-03 checks only Medium light', { tags: '@component' }, () => {
    cy.mount(<LightFilter value={['medium']} onChange={cy.spy()} />);

    expectLights(false, true, false);
  });

  it('LF-04 checks only Bright light', { tags: '@component' }, () => {
    cy.mount(<LightFilter value={['bright']} onChange={cy.spy()} />);

    expectLights(false, false, true);
  });

  it('LF-05 checks Low light and Bright light together', { tags: '@component' }, () => {
    cy.mount(<LightFilter value={['low', 'bright']} onChange={cy.spy()} />);

    expectLights(true, false, true);
  });

  it('LF-06 checks Bright light and Low light when the list is reversed', { tags: '@component' }, () => {
    cy.mount(<LightFilter value={['bright', 'low']} onChange={cy.spy()} />);

    expectLights(true, false, true);
  });

  it('LF-07 checks all three lights', { tags: '@component' }, () => {
    cy.mount(<LightFilter value={['low', 'medium', 'bright']} onChange={cy.spy()} />);

    expectLights(true, true, true);
  });

  it('LF-08 calls onChange with low when Low light is clicked', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<LightFilter value={[]} onChange={onChange} />);

    cy.findByRole('checkbox', { name: 'Low light' }).click();
    cy.get('@onChange').should('have.been.calledOnceWith', ['low']);
  });

  it('LF-09 calls onChange with low and bright when Bright light is clicked', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<LightFilter value={['low']} onChange={onChange} />);

    cy.findByRole('checkbox', { name: 'Bright light' }).click();
    cy.get('@onChange').should('have.been.calledOnceWith', ['low', 'bright']);
  });

  it('LF-10 calls onChange with bright when Low light is removed', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<LightFilter value={['low', 'bright']} onChange={onChange} />);

    cy.findByRole('checkbox', { name: 'Low light' }).click();
    cy.get('@onChange').should('have.been.calledOnceWith', ['bright']);
  });

  it('LF-11 calls onChange with an empty list when the last light is removed', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<LightFilter value={['medium']} onChange={onChange} />);

    cy.findByRole('checkbox', { name: 'Medium light' }).click();
    cy.get('@onChange').should('have.been.calledOnceWith', []);
  });

  it('LF-12 calls onChange with low and bright when Medium light is removed', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<LightFilter value={['low', 'medium', 'bright']} onChange={onChange} />);

    cy.findByRole('checkbox', { name: 'Medium light' }).click();
    cy.get('@onChange').should('have.been.calledOnceWith', ['low', 'bright']);
  });

  it('LF-13 shows the lights the parent replaces and does not call onChange', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<ParentLight first={['low']} next={['bright']} onChange={onChange} />);

    expectLights(true, false, false);
    cy.findByRole('button', { name: 'Replace value' }).click();
    expectLights(false, false, true);
    cy.get('@onChange').should('not.have.been.called');
  });

  it('LF-14 names the group Light and names each checkbox', { tags: '@component' }, () => {
    cy.mount(<LightFilter value={[]} onChange={cy.spy()} />);

    cy.findByRole('group', { name: 'Light' }).then(($el) => {
      expect(computeAccessibleName($el[0]), 'Light group').to.equal('Light');
    });
    cy.findByRole('checkbox', { name: 'Low light' }).then(($el) => {
      expect(computeAccessibleName($el[0]), 'Low light').to.equal('Low light');
    });
    cy.findByRole('checkbox', { name: 'Medium light' }).then(($el) => {
      expect(computeAccessibleName($el[0]), 'Medium light').to.equal('Medium light');
    });
    cy.findByRole('checkbox', { name: 'Bright light' }).then(($el) => {
      expect(computeAccessibleName($el[0]), 'Bright light').to.equal('Bright light');
    });
  });

  it('LF-15 keeps focus visible and selects Bright light from the keyboard', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<LightFilter value={[]} onChange={onChange} />);

    cy.press(Cypress.Keyboard.Keys.TAB);
    expectFocusVisible('Low light');
    cy.press(Cypress.Keyboard.Keys.TAB);
    expectFocusVisible('Medium light');
    cy.press(Cypress.Keyboard.Keys.TAB);
    expectFocusVisible('Bright light');
    cy.press(Cypress.Keyboard.Keys.SPACE);
    cy.get('@onChange').should('have.been.calledOnceWith', ['bright']);
  });

  it('LF-16 keeps the legend and options at a 4.5 to 1 contrast', { tags: '@component' }, () => {
    cy.mount(<LightFilter value={[]} onChange={cy.spy()} />);

    cy.findByText('Light').then(($el) => {
      expectContrast($el[0], 'legend');
    });
    cy.findByText('Low light').then(($el) => {
      expectContrast($el[0], 'Low light');
    });
    cy.findByText('Medium light').then(($el) => {
      expectContrast($el[0], 'Medium light');
    });
    cy.findByText('Bright light').then(($el) => {
      expectContrast($el[0], 'Bright light');
    });
  });
});
