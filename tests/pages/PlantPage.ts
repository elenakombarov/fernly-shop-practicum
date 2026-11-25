import type { Locator, Page } from '@playwright/test';

export class PlantPage {
  readonly popularHeading: Locator;
  readonly popularLinks: Locator;

  constructor(private readonly page: Page) {
    this.popularHeading = page.getByRole('heading', { name: 'Popular right now' });
    this.popularLinks = page.getByRole('region', { name: 'Popular right now' }).getByRole('link');
  }

  popularLinkByName(name: string): Locator {
    return this.page.getByRole('region', { name: 'Popular right now' }).getByRole('link', { name });
  }

  soldThisMonth(units: number): Locator {
    return this.page.getByText(`${units} sold this month`);
  }

  async open(plantId: string): Promise<PlantPage> {
    await this.page.goto(`/plants/${plantId}`);
    return this;
  }

  async openPopularPlant(name: string): Promise<PlantPage> {
    await this.popularLinkByName(name).click();
    return this;
  }
}
