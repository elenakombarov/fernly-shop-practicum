import { useState } from 'react';
import { computeAccessibleName, isInaccessible } from 'dom-accessibility-api';
import { PlantCard } from '../../src/components/PlantCard';
import { pressEnter } from '../support/press-enter';
import type { PlantSummary } from '../../src/types';

const snake: PlantSummary = {
  id: 'pl-snake',
  name: 'Snake Plant',
  latinName: 'Dracaena trifasciata',
  price: 22,
  light: 'low',
  careLevel: 1,
  petSafe: false,
  stock: 20,
  rating: 4.8,
  imageUrl: '/plants/snake.svg',
};

const pilea: PlantSummary = {
  id: 'pl-pilea',
  name: 'Chinese Money Plant',
  latinName: 'Pilea peperomioides',
  price: 15,
  light: 'medium',
  careLevel: 1,
  petSafe: true,
  stock: 0,
  rating: 4.7,
  imageUrl: '/plants/succulent.svg',
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

/** The price element is the one whose own text is the dollar amount. */
function hasOwnPriceText(_content: string, element: Element | null): boolean {
  return !!element && /^\$\d/.test(directText(element));
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

function expectSavePressed(pressed: boolean) {
  const value = pressed ? 'true' : 'false';
  cy.findAllByRole('button').then(($buttons) => {
    const save = Array.from($buttons).find((button) => button.hasAttribute('aria-pressed'));
    expect(save, 'save button').to.exist;
    expect(save?.getAttribute('aria-pressed'), 'save button').to.equal(value);
  });
}

function photoLink(links: HTMLElement[]): HTMLElement {
  const photo = links.find((link) =>
    Array.from(link.children).some((child) => child.getAttribute('alt') === 'Snake Plant'),
  );
  expect(photo, 'photo link').to.exist;
  return photo as HTMLElement;
}

/** Parent stand-in: sets `saved` before the customer clicks the heart. */
function ParentSave({
  first,
  next,
  onToggleSave,
}: {
  first: boolean;
  next: boolean;
  onToggleSave: (plantId: string) => void;
}) {
  const [saved, setSaved] = useState(first);
  return (
    <>
      <PlantCard plant={snake} saved={saved} onToggleSave={onToggleSave} />
      <button type="button" onClick={() => setSaved(next)}>
        Replace saved
      </button>
    </>
  );
}

describe('PlantCard', () => {
  it('PC-01 shows Snake Plant as a heading linking to the plant', { tags: '@component' }, () => {
    cy.mount(<PlantCard plant={snake} onToggleSave={cy.spy()} />);

    cy.findByRole('heading', { name: 'Snake Plant' }).within(() => {
      cy.findByRole('link', { name: 'Snake Plant' }).then(($el) => {
        expect($el.attr('href'), 'plant name').to.equal('/plants/pl-snake');
      });
    });
  });

  it('PC-02 shows the Latin name', { tags: '@component' }, () => {
    cy.mount(<PlantCard plant={snake} onToggleSave={cy.spy()} />);

    cy.findByText('Dracaena trifasciata');
  });

  it('PC-03 shows the photo and links it to the plant', { tags: '@component' }, () => {
    cy.mount(<PlantCard plant={snake} onToggleSave={cy.spy()} />);

    cy.findByRole('img', { name: 'Snake Plant' }).then(($img) => {
      expect($img.attr('src'), 'photo').to.equal('/plants/snake.svg');
      expect($img[0].parentElement?.getAttribute('href'), 'photo link').to.equal('/plants/pl-snake');
    });
  });

  it('PC-04 shows $22.00', { tags: ['@component', '@known-bug'] }, () => {
    cy.mount(<PlantCard plant={snake} onToggleSave={cy.spy()} />);

    cy.findByText(hasOwnPriceText).then(($el) => {
      expect($el.text().trim(), 'price').to.equal('$22.00');
    });
  });

  it('PC-05 shows the rating 4.8', { tags: '@component' }, () => {
    cy.mount(<PlantCard plant={snake} onToggleSave={cy.spy()} />);

    cy.findByText(hasOwnText('4.8')).then(($el) => {
      expect(directText($el[0]), 'rating').to.equal('4.8');
    });
  });

  it(
    'PC-06 shows Out of stock while the name still links and the save button stays',
    { tags: '@component' },
    () => {
      cy.mount(<PlantCard plant={pilea} onToggleSave={cy.spy()} />);

      cy.findByText(hasOwnText('Out of stock'));
      cy.findByRole('heading', { name: 'Chinese Money Plant' }).within(() => {
        cy.findByRole('link', { name: 'Chinese Money Plant' }).then(($el) => {
          expect($el.attr('href'), 'plant name').to.equal('/plants/pl-pilea');
        });
      });
      cy.findByRole('button');
    },
  );

  it('PC-07 shows no Out of stock ribbon at stock 1', { tags: '@component' }, () => {
    cy.mount(<PlantCard plant={{ ...snake, stock: 1 }} onToggleSave={cy.spy()} />);

    cy.findAllByText('Out of stock').should('have.length', 0);
  });

  it('PC-08 hides the save button when onToggleSave is omitted', { tags: '@component' }, () => {
    cy.mount(<PlantCard plant={snake} />);

    cy.findAllByRole('button').should('have.length', 0);
  });

  it(
    'PC-09 shows an unpressed save button and does not call onToggleSave',
    { tags: '@component' },
    () => {
      const onToggleSave = cy.spy().as('onToggleSave');
      cy.mount(<PlantCard plant={snake} onToggleSave={onToggleSave} />);

      expectSavePressed(false);
      cy.get('@onToggleSave').should('not.have.been.called');
    },
  );

  it('PC-10 shows a pressed save button when saved', { tags: '@component' }, () => {
    cy.mount(<PlantCard plant={snake} saved onToggleSave={cy.spy()} />);

    expectSavePressed(true);
  });

  it(
    'PC-11 shows the pressed state the parent sets without calling onToggleSave',
    { tags: '@component' },
    () => {
      const onToggleSave = cy.spy().as('onToggleSave');
      cy.mount(<ParentSave first={false} next onToggleSave={onToggleSave} />);

      expectSavePressed(false);
      cy.findByRole('button', { name: 'Replace saved' }).click();
      expectSavePressed(true);
      cy.get('@onToggleSave').should('not.have.been.called');
    },
  );

  it(
    'PC-12 calls onToggleSave with the plant id and stays unpressed',
    { tags: '@component' },
    () => {
      const onToggleSave = cy.spy().as('onToggleSave');
      cy.mount(<PlantCard plant={snake} saved={false} onToggleSave={onToggleSave} />);

      cy.findByRole('button').click();
      cy.get('@onToggleSave').should('have.been.calledOnceWith', 'pl-snake');
      expectSavePressed(false);
    },
  );

  it('PC-13 calls onToggleSave with the plant id and stays pressed', { tags: '@component' }, () => {
    const onToggleSave = cy.spy().as('onToggleSave');
    cy.mount(<PlantCard plant={snake} saved onToggleSave={onToggleSave} />);

    cy.findByRole('button').click();
    cy.get('@onToggleSave').should('have.been.calledOnceWith', 'pl-snake');
    expectSavePressed(true);
  });

  it('PC-14 gives the photo alternative text', { tags: '@component' }, () => {
    cy.mount(<PlantCard plant={snake} onToggleSave={cy.spy()} />);

    cy.findByRole('img', { name: 'Snake Plant' }).then(($img) => {
      expect($img.attr('alt'), 'photo').to.equal('Snake Plant');
    });
  });

  it(
    'PC-15 gives the save button a name and does not announce the heart',
    { tags: ['@component', '@known-bug'] },
    () => {
      cy.mount(<PlantCard plant={snake} onToggleSave={cy.spy()} />);

      cy.findByRole('button').then(($button) => {
        const heart = Array.from($button[0].children).find(
          (child) => child.getAttribute('aria-hidden') === 'true',
        );
        expect(heart, 'heart').to.exist;
        expect(isInaccessible(heart as Element), 'heart').to.equal(true);
        expect(computeAccessibleName($button[0]).trim(), 'save button name').to.not.equal('');
      });
    },
  );

  it('PC-16 reads the rating as 4.8 out of 5 and hides the star', { tags: '@component' }, () => {
    cy.mount(<PlantCard plant={snake} onToggleSave={cy.spy()} />);

    cy.findByText(hasOwnText('4.8')).then(($el) => {
      expect(announcedText($el[0]), 'rating').to.equal('4.8 out of 5');
      const star = Array.from($el[0].children).find((child) => child.textContent?.includes('★'));
      expect(star, 'star').to.exist;
      expect(isInaccessible(star as Element), 'star').to.equal(true);
    });
  });

  it(
    'PC-17 keeps focus visible and saves the plant from the keyboard',
    { tags: '@component' },
    () => {
      const onToggleSave = cy.spy().as('onToggleSave');
      cy.mount(<PlantCard plant={snake} onToggleSave={onToggleSave} />);

      cy.press(Cypress.Keyboard.Keys.TAB);
      cy.findAllByRole('link', { name: 'Snake Plant' }).then(($links) => {
        expectFocused(photoLink(Array.from($links)), 'photo link');
      });

      cy.press(Cypress.Keyboard.Keys.TAB);
      cy.findByRole('button').then(($button) => {
        expectFocused($button[0], 'save button');
      });

      cy.press(Cypress.Keyboard.Keys.TAB);
      cy.findByRole('heading', { name: 'Snake Plant' }).within(() => {
        cy.findByRole('link', { name: 'Snake Plant' }).then(($link) => {
          expectFocused($link[0], 'plant name');
        });
      });

      // cy.press cannot hold Shift, so focus returns to the save button before Enter.
      cy.findByRole('button').focus();
      cy.findByRole('button').then(($button) => {
        expect($button[0].ownerDocument.activeElement, 'save button has focus again').to.equal(
          $button[0],
        );
      });
      pressEnter();
      cy.get('@onToggleSave').should('have.been.calledOnceWith', 'pl-snake');
    },
  );

  it('PC-18 keeps the name at a 4.5 to 1 contrast on white', { tags: '@component' }, () => {
    cy.mount(<PlantCard plant={snake} onToggleSave={cy.spy()} />);

    cy.findByRole('heading', { name: 'Snake Plant' }).within(() => {
      cy.findByRole('link', { name: 'Snake Plant' }).then(($el) => {
        expectContrast($el[0], 'plant name');
      });
    });
  });
});
