import React from 'react';
import { render } from '@testing-library/react';
import * as matchers from 'vitest-axe/matchers';
import { axe } from 'vitest-axe';
import { expect, test, describe, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AboutPage } from '../pages/AboutPage';
import { ContactPage } from '../pages/ContactPage';
import { PrivacyPage } from '../pages/PrivacyPage';
import { DocsPage } from '../pages/DocsPage';
import { NotFoundPage } from '../pages/NotFoundPage';

expect.extend(matchers);

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
    requireAuth: vi.fn()
  }),
  AuthProvider: ({ children }: any) => <>{children}</>
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false }
  }
});

describe('Accessibility Checks for Sub-Prompt 4', () => {
  const pages = [
    { name: 'AboutPage', Component: AboutPage },
    { name: 'ContactPage', Component: ContactPage },
    { name: 'PrivacyPage', Component: PrivacyPage },
    { name: 'DocsPage', Component: DocsPage },
    { name: 'NotFoundPage', Component: NotFoundPage }
  ];

  for (const { name, Component } of pages) {
    test(`${name} should have no accessibility violations`, async () => {
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Component />
          </MemoryRouter>
        </QueryClientProvider>
      );
      
      const results = await axe(container);
      (expect(results) as any).toHaveNoViolations();
    });
  }
});
