import BackInStockSlot from '../../src/slots/plant-page/back-in-stock';
import type { Plant } from '../../src/types';

const base: Plant = {
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
  description: 'A round-leaved plant.',
  sizes: [{ label: 'S', priceDelta: 0 }],
  similar: [],
};

describe('BackInStockSlot', () => {
  it(
    'CT-08 renders nothing when in stock and mounts NotifyForm when stock is 0',
    { tags: '@component' },
    () => {
      cy.mount(<BackInStockSlot plant={{ ...base, stock: 4 }} />);

      cy.findAllByLabelText("Email me when it's back").should('have.length', 0);
      cy.findAllByRole('button', { name: 'Notify me' }).should('have.length', 0);

      cy.mount(<BackInStockSlot plant={{ ...base, stock: 0 }} />);

      cy.findByLabelText("Email me when it's back");
      cy.findByRole('button', { name: 'Notify me' });
    },
  );
});
