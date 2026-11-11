import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const apiURL = process.env.API_URL;
const webURL = process.env.WEB_URL;

if (!apiURL || !webURL) {
  throw new Error('API_URL and WEB_URL must be set. Copy .env.example to .env.');
}

const visualProject =
  process.env.CI || process.env.VISUAL
    ? [
        {
          name: 'visual',
          testDir: 'tests/visual',
          testMatch: /.*\.spec\.ts/,
          dependencies: ['setup' as const],
          use: {
            baseURL: webURL,
            ...devices['Desktop Chrome'],
            viewport: { width: 1280, height: 800 },
          },
        },
      ]
    : [];

export default defineConfig({
  testDir: 'tests',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixels: 0,
    },
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'reports/playwright.json' }],
    [
      './tests/a11y/reporter.ts',
      {
        outputFolder: 'a11y-report',
        baseline: 'a11y-baseline.json',
        title: 'Fernly accessibility',
      },
    ],
  ],
  webServer: [
    {
      command: 'npm run start:api',
      url: `${apiURL}/api/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run start:web',
      url: webURL,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: 'setup',
      testMatch: /reset\.setup\.ts/,
      use: { baseURL: apiURL },
    },
    {
      name: 'api',
      testDir: 'tests/api',
      dependencies: ['setup'],
      use: { baseURL: apiURL },
    },
    {
      name: 'e2e',
      testDir: 'tests/e2e',
      dependencies: ['setup'],
      use: { baseURL: webURL },
    },
    {
      name: 'a11y',
      testDir: 'tests/a11y',
      dependencies: ['setup'],
      use: { baseURL: webURL },
    },
    ...visualProject,
  ],
});
