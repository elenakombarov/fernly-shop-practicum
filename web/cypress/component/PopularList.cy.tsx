import { PopularList, type PopularItem } from '../../src/components/PopularList';
import PopularSlot from '../../src/slots/plant-page/popular';
import type { Plant } from '../../src/types';

const snake: PopularItem = { id: 'pl-snake', name: 'Snake Plant', unitsSold: 128 };
const monstera: PopularItem = { id: 'pl-monstera', name: 'Monstera Deliciosa', unitsSold: 96 };
const aloe: PopularItem = { id: 'pl-aloe', name: 'Aloe Vera', unitsSold: 64 };
const pothos: PopularItem = { id: 'pl-pothos', name: "Pothos 'Golden'", unitsSold: 48 };
const fiddle: PopularItem = { id: 'pl-fiddle', name: 'Fiddle Leaf Fig', unitsSold: 32 };
const rubber: PopularItem = { id: 'pl-rubber', name: 'Rubber Plant', unitsSold: 16 };

const aloePlant: Plant = {
  id: 'pl-aloe',
  name: 'Aloe Vera',
  latinName: 'Aloe barbadensis',
  price: 9.99,
  light: 'bright',
  careLevel: 1,
  petSafe: false,
  stock: 18,
  rating: 4.3,
  imageUrl: '/plants/succulent.svg',
  description: 'A sun-loving succulent with soothing gel inside its leaves.',
  sizes: [
    { label: 'S', priceDelta: 0 },
    { label: 'M', priceDelta: 4 },
  ],
  similar: [],
};

describe('PopularList', () => {
  it('CT-01 renders nothing when items are empty or only the current plant', { tags: '@component' }, () => {
    cy.mount(<PopularList items={[]} />);
    cy.findByRole('heading', { name: 'Popular right now' }).should('not.exist');

    cy.mount(<PopularList items={[aloe]} currentId="pl-aloe" />);
    cy.findByRole('heading', { name: 'Popular right now' }).should('not.exist');
  });

  it('CT-02 shows heading, one plant link, and sold count for a single item', { tags: '@component' }, () => {
    cy.mount(<PopularList items={[snake]} currentId="pl-aloe" />);

    cy.findByRole('heading', { name: 'Popular right now' });
    cy.findByRole('link', { name: 'Snake Plant' }).then(($link) => {
      expect($link, 'Snake Plant link').to.have.attr('href', '/plants/pl-snake');
    });
    cy.findByText('128 sold this month');
  });

  it('CT-03 shows four plants in most-popular-first order from props', { tags: '@component' }, () => {
    cy.mount(<PopularList items={[snake, monstera, aloe, pothos]} />);

    cy.findByRole('heading', { name: 'Popular right now' });
    cy.findByRole('list').within(() => {
      cy.findAllByRole('link').then(($links) => {
        expect(
          $links.toArray().map((link) => link.textContent),
          'popular order',
        ).to.deep.equal(['Snake Plant', 'Monstera Deliciosa', 'Aloe Vera', "Pothos 'Golden'"]);
      });
    });
    cy.findByText('128 sold this month');
    cy.findByText('96 sold this month');
    cy.findByText('64 sold this month');
    cy.findByText('48 sold this month');
  });

  it('CT-04 shows only the first four of five items when currentId is omitted', { tags: '@component' }, () => {
    cy.mount(<PopularList items={[snake, monstera, aloe, pothos, fiddle]} />);

    cy.findByRole('list').within(() => {
      cy.findAllByRole('link').then(($links) => {
        expect($links, 'four popular links').to.have.length(4);
        expect(
          $links.toArray().map((link) => link.textContent),
          'first four only',
        ).to.deep.equal(['Snake Plant', 'Monstera Deliciosa', 'Aloe Vera', "Pothos 'Golden'"]);
      });
    });
    cy.findByRole('link', { name: 'Fiddle Leaf Fig' }).should('not.exist');
    cy.findByText('32 sold this month').should('not.exist');
  });

  it('CT-05 leaves out currentId and still caps the list at four', { tags: '@component' }, () => {
    cy.mount(
      <PopularList
        items={[snake, monstera, aloe, pothos, fiddle, rubber]}
        currentId="pl-aloe"
      />,
    );

    cy.findByRole('link', { name: 'Aloe Vera' }).should('not.exist');
    cy.findByRole('list').within(() => {
      cy.findAllByRole('link').then(($links) => {
        expect($links, 'four after excluding current').to.have.length(4);
        expect(
          $links.toArray().map((link) => link.textContent),
          'order after exclude and cap',
        ).to.deep.equal(['Snake Plant', 'Monstera Deliciosa', "Pothos 'Golden'", 'Fiddle Leaf Fig']);
      });
    });
    cy.findByRole('link', { name: 'Rubber Plant' }).should('not.exist');
  });

  it('CT-06 slot shows Popular right now and excludes the plant id', { tags: '@component' }, () => {
    cy.intercept('GET', '/api/popular*', { fixture: 'popular-positive.json' }).as('popular');
    cy.mount(<PopularSlot plant={aloePlant} />);
    cy.wait('@popular');

    cy.findByRole('heading', { name: 'Popular right now' });
    cy.findByRole('link', { name: 'Aloe Vera' }).should('not.exist');
    cy.findByRole('link', { name: 'Snake Plant' });
    cy.findByRole('link', { name: 'Monstera Deliciosa' });
    cy.findByRole('link', { name: "Pothos 'Golden'" });
    cy.findByRole('link', { name: 'Fiddle Leaf Fig' });
  });
});
