import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { register as registerCypressGrep } from '@cypress/grep';
import '@testing-library/cypress/add-commands';
import { mount, type MountOptions, type MountReturn } from 'cypress/react';
import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import '../../src/styles/global.css';

registerCypressGrep();

declare global {
  namespace Cypress {
    interface Chainable {
      mount(component: ReactNode, options?: MountOptions): Chainable<MountReturn>;
    }
  }
}

Cypress.Commands.add('mount', (component: ReactNode, options?: MountOptions) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return mount(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{component}</MemoryRouter>
    </QueryClientProvider>,
    options,
  );
});
