import { PriceTag } from '../../src/components/PriceTag';

/** The price element is the one whose own text is the dollar amount. */
function hasOwnPriceText(_content: string, element: Element | null): boolean {
  if (!element) return false;
  const own = Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join('')
    .trim();
  return /^\$\d/.test(own);
}

function expectFontSize(rem: number, what: string) {
  cy.findByText(hasOwnPriceText).then(($el) => {
    const px = parseFloat(getComputedStyle($el[0]).fontSize);
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(px, what).to.be.closeTo(root * rem, 0.05);
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

describe('PriceTag', () => {
  it('PT-01 shows $12.50 for an amount with one decimal place', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={12.5} />);

    cy.findByText(hasOwnPriceText).then(($el) => {
      expect($el.text().trim(), 'price').to.equal('$12.50');
    });
  });

  it('PT-02 shows $22.00 for whole dollars', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={22} />);

    cy.findByText(hasOwnPriceText).then(($el) => {
      expect($el.text().trim(), 'price').to.equal('$22.00');
    });
  });

  it('PT-03 shows $9.99 when the amount already has two decimals', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={9.99} />);

    cy.findByText(hasOwnPriceText).then(($el) => {
      expect($el.text().trim(), 'price').to.equal('$9.99');
    });
  });

  it('PT-04 shows $0.00 for a zero amount', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={0} />);

    cy.findByText(hasOwnPriceText).then(($el) => {
      expect($el.text().trim(), 'price').to.equal('$0.00');
    });
  });

  it('PT-05 shows $1.00 for one dollar', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={1} />);

    cy.findByText(hasOwnPriceText).then(($el) => {
      expect($el.text().trim(), 'price').to.equal('$1.00');
    });
  });

  it('PT-06 shows $0.01 for one cent', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={0.01} />);

    cy.findByText(hasOwnPriceText).then(($el) => {
      expect($el.text().trim(), 'price').to.equal('$0.01');
    });
  });

  it('PT-16 shows $0.99 for one cent under a dollar', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={0.99} />);

    cy.findByText(hasOwnPriceText).then(($el) => {
      expect($el.text().trim(), 'price').to.equal('$0.99');
    });
  });

  it('PT-09 uses a 1.05rem font when size is omitted or md', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={12.5} />);
    expectFontSize(1.05, 'default size');

    cy.mount(<PriceTag amount={12.5} size="md" />);
    expectFontSize(1.05, 'medium size');
  });

  it('PT-10 uses a 0.9rem font for the small size', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={12.5} size="sm" />);
    expectFontSize(0.9, 'small price');
  });

  it('PT-11 uses a 1.6rem font for the large size', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={12.5} size="lg" />);
    expectFontSize(1.6, 'large price');
  });

  it('PT-12 shows $9.99 with no prefix when label is omitted', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={9.99} />);

    cy.findByText(hasOwnPriceText).then(($el) => {
      expect($el.text().trim(), 'price without a prefix').to.equal('$9.99');
    });
  });

  it(
    'PT-13 hides the label and reads Price: before the price',
    { tags: '@component' },
    () => {
      cy.mount(<PriceTag amount={9.99} label="Price" />);

      cy.findByText(hasOwnPriceText).then(($el) => {
        expect($el.text().trim(), 'accessible price').to.equal('Price: $9.99');

        const label = Array.from($el[0].children).find((child) => child.textContent === 'Price: ');
        expect(label, 'screen-reader prefix').to.exist;
        const box = label!.getBoundingClientRect();
        expect(box.width, 'label is not visible').to.be.lt(2);
        expect(box.height, 'label is not visible').to.be.lt(2);
      });
    },
  );

  it(
    'PT-14 keeps the price at a 4.5:1 contrast on the shop background',
    { tags: '@component' },
    () => {
      cy.mount(<PriceTag amount={9.99} />);

      cy.findByText(hasOwnPriceText).then(($el) => {
        const color = getComputedStyle($el[0]).color;
        const ratio = contrastRatio(color, '#f6faf3');
        expect(ratio, `price color ${color} on #f6faf3`).to.be.at.least(4.5);
      });
    },
  );
});
