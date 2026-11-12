import { StockBadge } from '../../src/components/StockBadge';

describe('StockBadge', () => {
  it(
    'CT-01 shows Only N left for stock 1–3, nothing above 3, and never Only 0 left',
    { tags: '@component' },
    () => {
      cy.mount(
        <>
          <StockBadge stock={1} />
          <StockBadge stock={2} />
          <StockBadge stock={3} />
          <div data-testid="high-stock">
            <StockBadge stock={4} />
          </div>
          <div data-testid="zero-stock">
            <StockBadge stock={0} />
          </div>
        </>,
      );

      cy.findByText('Only 1 left');
      cy.findByText('Only 2 left');
      cy.findByText('Only 3 left');

      cy.findByTestId('high-stock').within(() => {
        cy.findAllByText(/Only \d+ left/).should('have.length', 0);
      });

      cy.findAllByText('Only 0 left').should('have.length', 0);
      cy.findByTestId('zero-stock').within(() => {
        cy.findAllByText(/Only \d+ left/).should('have.length', 0);
      });
    },
  );
});
