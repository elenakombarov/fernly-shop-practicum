import type { Locator, Page } from '@playwright/test';

export class PlantPage {
  readonly notifyEmail: Locator;
  readonly notifyMe: Locator;
  readonly alreadySubscribed: Locator;

  constructor(private readonly page: Page) {
    this.notifyEmail = page.getByLabel("Email me when it's back");
    this.notifyMe = page.getByRole('button', { name: 'Notify me' });
    this.alreadySubscribed = page.getByText("You're already on the list");
  }

  heading(name: string): Locator {
    return this.page.getByRole('heading', { name });
  }

  confirmation(email: string, plantName: string): Locator {
    return this.page.getByText(`We'll email ${email} when ${plantName} is back.`);
  }

  async open(plantId: string): Promise<PlantPage> {
    await this.page.goto(`/plants/${plantId}`);
    return this;
  }

  async submitNotifyEmail(email: string): Promise<void> {
    await this.notifyEmail.fill(email);
    await this.notifyMe.click();
  }
}
