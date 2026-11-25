import type { Locator, Page } from '@playwright/test';

export class BrowsePage {
  readonly sortBy: Locator;
  readonly plantsCountHeading: Locator;
  readonly firstPlantCard: Locator;
  readonly firstPlantCardHeading: Locator;
  readonly searchForm: Locator;
  readonly searchInput: Locator;

  constructor(private readonly page: Page) {
    this.sortBy = page.getByLabel('Sort by');
    this.plantsCountHeading = page.getByRole('heading', { level: 2, name: /\d+ plants/ });
    this.firstPlantCard = page.getByRole('article').first();
    this.firstPlantCardHeading = this.firstPlantCard.getByRole('heading', { level: 3 });
    this.searchForm = page.getByRole('search');
    this.searchInput = this.searchForm.getByRole('searchbox');
  }

  /** Catalog card for a plant by its display name. */
  plantCardByName(name: string): Locator {
    return this.page.getByRole('article').filter({
      has: this.page.getByRole('heading', { level: 3, name }),
    });
  }

  plantsHeading(count: number): Locator {
    return this.page.getByRole('heading', { name: `${count} plants` });
  }

  async open(): Promise<BrowsePage> {
    await this.page.goto('/');
    return this;
  }

  async goto(): Promise<void> {
    await this.open();
  }

  async selectSort(value: string): Promise<BrowsePage> {
    await this.sortBy.selectOption(value);
    return this;
  }

  async sortByPriceHighToLow(): Promise<void> {
    await this.sortBy.selectOption({ label: 'Price: high to low' });
  }

  async searchPlants(query: string): Promise<BrowsePage> {
    await this.searchInput.fill(query);
    await this.searchForm.getByRole('button', { name: 'Search', exact: true }).click();
    return this;
  }
}
