import { isInaccessible } from 'dom-accessibility-api';
import { PetSafeTag } from '../../src/components/PetSafeTag';

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

/** Text a screen reader reads, skipping anything hidden from assistive tech. */
function announcedText(element: Element): string {
  const parts: string[] = [];
  element.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? '');
      return;
    }
    if (node instanceof Element && node.getAttribute('aria-hidden') !== 'true') {
      parts.push(node.textContent ?? '');
    }
  });
  return parts.join('').replace(/\s+/g, ' ').trim();
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

describe('PetSafeTag', () => {
  it('PS-01 shows Pet safe', { tags: '@component' }, () => {
    cy.mount(<PetSafeTag petSafe />);

    cy.findByText(hasOwnText('Pet safe'));
  });

  it('PS-02 shows Not pet safe', { tags: '@component' }, () => {
    cy.mount(<PetSafeTag petSafe={false} />);

    cy.findByText(hasOwnText('Not pet safe'));
  });

  it('PS-03 announces Pet safe and hides the paw', { tags: '@component' }, () => {
    cy.mount(<PetSafeTag petSafe />);

    cy.findByText(hasOwnText('Pet safe')).then(($el) => {
      expect(announcedText($el[0]), 'tag').to.equal('Pet safe');
      const paw = Array.from($el[0].children).find((child) => child.textContent?.includes('🐾'));
      expect(paw, 'paw').to.exist;
      expect(isInaccessible(paw as Element), 'paw').to.equal(true);
    });
  });

  it('PS-04 announces Not pet safe and hides the warning mark', { tags: '@component' }, () => {
    cy.mount(<PetSafeTag petSafe={false} />);

    cy.findByText(hasOwnText('Not pet safe')).then(($el) => {
      expect(announcedText($el[0]), 'tag').to.equal('Not pet safe');
      const mark = Array.from($el[0].children).find((child) => child.textContent?.includes('⚠'));
      expect(mark, 'warning mark').to.exist;
      expect(isInaccessible(mark as Element), 'warning mark').to.equal(true);
    });
  });

  it('PS-05 keeps Not pet safe at a 4.5 to 1 contrast', { tags: '@component' }, () => {
    cy.mount(<PetSafeTag petSafe={false} />);

    cy.findByText(hasOwnText('Not pet safe')).then(($el) => {
      expectContrast($el[0], 'Not pet safe');
    });
  });
});
