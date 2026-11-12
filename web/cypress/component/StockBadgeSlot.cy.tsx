import StockBadgeSlot from '../../src/slots/plant-card/stock-badge';
import type { PlantSummary } from '../../src/types';

const base: PlantSummary = {
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

describe('StockBadgeSlot', () => {
  it(
    'CT-04 shows Only N left for stock 1–3 and no low-stock badge for stock 0 or stock > 3',
    { tags: '@component' },
    () => {
      cy.mount(
        <>
          <StockBadgeSlot plant={{ ...base, id: 'pl-one', stock: 2 }} />
          <StockBadgeSlot plant={{ ...base, id: 'pl-zero', stock: 0 }} />
          <StockBadgeSlot plant={{ ...base, id: 'pl-many', stock: 9 }} />
        </>,
      );

      cy.findByText('Only 2 left');
      cy.get('body').should(($body) => {
        expect($body.text(), 'only 0 left').not.to.include('Only 0 left');
        const matches = $body.text().match(/Only \d+ left/g) ?? [];
        expect(matches, 'low-stock badges').to.deep.equal(['Only 2 left']);
      });
    },
  );
});
