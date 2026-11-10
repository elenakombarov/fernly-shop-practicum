import { isInaccessible } from 'dom-accessibility-api';
import { CareLevelBadge } from '../../src/components/CareLevelBadge';

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

function badge() {
  return cy.findByText(
    (_content, element) =>
      !!element && element.getAttribute('title') === 'How much care this plant needs',
  );
}

describe('CareLevelBadge', () => {
  it('CB-01 shows Easy care with one filled dot', { tags: '@component' }, () => {
    cy.mount(<CareLevelBadge level={1} />);

    badge().then(($el) => {
      expect(directText($el[0]), 'care label').to.equal('Easy care');
      const dots = Array.from($el[0].children).find((child) => child.textContent?.includes('●'));
      expect(dots?.textContent, 'filled dots').to.equal('●');
    });
  });

  it('CB-02 shows Moderate care with two filled dots', { tags: '@component' }, () => {
    cy.mount(<CareLevelBadge level={2} />);

    badge().then(($el) => {
      expect(directText($el[0]), 'care label').to.equal('Moderate care');
      const dots = Array.from($el[0].children).find((child) => child.textContent?.includes('●'));
      expect(dots?.textContent, 'filled dots').to.equal('●●');
    });
  });

  it('CB-03 shows Expert care with three filled dots', { tags: ['@component', '@known-bug'] }, () => {
    cy.mount(<CareLevelBadge level={3} />);

    badge().then(($el) => {
      expect(directText($el[0]), 'care label').to.equal('Expert care');
      const dots = Array.from($el[0].children).find((child) => child.textContent?.includes('●'));
      expect(dots?.textContent, 'filled dots').to.equal('●●●');
    });
  });

  it('CB-04 announces Easy care and hides the dot', { tags: '@component' }, () => {
    cy.mount(<CareLevelBadge level={1} />);

    cy.findByText(hasOwnText('Easy care')).then(($el) => {
      expect(announcedText($el[0]), 'badge').to.equal('Easy care');
      const dot = Array.from($el[0].children).find((child) => child.textContent?.includes('●'));
      expect(dot, 'dot').to.exist;
      expect(isInaccessible(dot as Element), 'dot').to.equal(true);
    });
  });

  it('CB-05 titles the badge How much care this plant needs', { tags: '@component' }, () => {
    cy.mount(<CareLevelBadge level={2} />);

    cy.findByText(hasOwnText('Moderate care')).then(($el) => {
      expect($el.attr('title'), 'badge').to.equal('How much care this plant needs');
    });
  });
});
