import { StockBadge } from '../../src/components/StockBadge';

describe('StockBadge', () => {
  it('CT-01 shows Only N left for stock 1, 2, and 3', { tags: '@component' }, () => {
    cy.mount(
      <>
        <StockBadge stock={1} />
        <StockBadge stock={2} />
        <StockBadge stock={3} />
      </>,
    );

    cy.findByText('Only 1 left');
    cy.findByText('Only 2 left');
    cy.findByText('Only 3 left');
  });

  it('CT-02 does not show Only 0 left when stock is 0', { tags: ['@component', '@known-bug'] }, () => {
    cy.mount(
      <>
        <StockBadge stock={0} />
        <StockBadge stock={1} />
      </>,
    );

    // Wait for a real paint, then assert stock 0 never adds "Only 0 left".
    cy.findByText('Only 1 left');
    cy.get('body').should(($body) => {
      expect($body.text(), 'body').not.to.include('Only 0 left');
      const badges = $body.text().match(/Only \d+ left/g) ?? [];
      expect(badges, 'low-stock badges').to.deep.equal(['Only 1 left']);
    });
  });

  it('CT-03 renders no badge when stock is greater than 3', { tags: '@component' }, () => {
    cy.mount(<StockBadge stock={4} />);

    cy.get('body').should(($body) => {
      expect($body.text(), 'body').not.to.match(/Only \d+ left/);
    });
  });
});
