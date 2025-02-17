import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataSourceForm } from './data-source-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Mock the apiRequest function
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn()
}));

// Set up query client with test configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false
    }
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('DataSourceForm', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('renders all form fields for SQL data source', async () => {
    renderWithProviders(<DataSourceForm />);

    // Wait for form to be rendered
    await waitFor(() => {
      expect(screen.getByTestId('data-source-form')).toBeInTheDocument();
      expect(screen.getByTestId('name-input')).toBeInTheDocument();
      expect(screen.getByTestId('type-select')).toBeInTheDocument();
    });

    // Check SQL specific fields
    await waitFor(() => {
      expect(screen.getByTestId('dialect-select')).toBeInTheDocument();
      expect(screen.getByTestId('host-input')).toBeInTheDocument();
      expect(screen.getByTestId('port-input')).toBeInTheDocument();
      expect(screen.getByTestId('database-input')).toBeInTheDocument();
    });
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DataSourceForm />);

    // Wait for form to be rendered
    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
    });

    // Submit empty form
    await user.click(screen.getByTestId('submit-button'));

    // Check validation message
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('switches form fields when changing source type', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DataSourceForm />);

    // Wait for form to be rendered and verify SQL fields
    await waitFor(() => {
      expect(screen.getByTestId('type-select')).toBeInTheDocument();
      expect(screen.getByTestId('dialect-select')).toBeInTheDocument();
      expect(screen.getByTestId('host-input')).toBeInTheDocument();
    });

    // Change source type to API
    const typeSelect = screen.getByTestId('type-select');
    await user.click(typeSelect);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /REST API/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option', { name: /REST API/i }));

    // Verify SQL fields are hidden
    await waitFor(() => {
      expect(screen.queryByTestId('dialect-select')).not.toBeInTheDocument();
      expect(screen.queryByTestId('host-input')).not.toBeInTheDocument();
    });
  });

  it('successfully submits the form', async () => {
    const mockApiResponse = {
      ok: true,
      json: () => Promise.resolve({ id: 1, name: 'Test DB', type: 'sql' })
    };
    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

    const user = userEvent.setup();
    renderWithProviders(<DataSourceForm />);

    // Wait for all form fields
    await waitFor(() => {
      expect(screen.getByTestId('name-input')).toBeInTheDocument();
      expect(screen.getByTestId('host-input')).toBeInTheDocument();
      expect(screen.getByTestId('database-input')).toBeInTheDocument();
      expect(screen.getByTestId('port-input')).toBeInTheDocument();
    });

    // Fill form fields
    await user.type(screen.getByTestId('name-input'), 'Test DB');
    await user.type(screen.getByTestId('host-input'), 'localhost');
    await user.type(screen.getByTestId('database-input'), 'testdb');

    // Handle port input
    const portInput = screen.getByTestId('port-input');
    await user.clear(portInput);
    await user.type(portInput, '5432');

    // Verify values
    expect(screen.getByTestId('name-input')).toHaveValue('Test DB');
    expect(screen.getByTestId('host-input')).toHaveValue('localhost');
    expect(screen.getByTestId('database-input')).toHaveValue('testdb');
    expect(screen.getByTestId('port-input')).toHaveDisplayValue('5432');

    // Submit form
    await user.click(screen.getByTestId('submit-button'));

    // Verify API call
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "POST",
        "/api/data-sources",
        expect.objectContaining({
          name: 'Test DB',
          type: 'sql',
          config: expect.objectContaining({
            type: 'sql',
            config: expect.objectContaining({
              host: 'localhost',
              database: 'testdb',
              port: 5432
            })
          })
        })
      );
    }, { timeout: 3000 });
  });
});