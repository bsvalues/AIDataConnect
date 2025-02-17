import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataSourceForm } from './data-source-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Mock API request
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn()
}));

// Test query client setup
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    }
  },
});

const renderForm = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <DataSourceForm />
    </QueryClientProvider>
  );
};

describe('DataSourceForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('renders basic form fields', () => {
    renderForm();

    expect(screen.getByTestId('data-source-form')).toBeInTheDocument();
    expect(screen.getByTestId('name-input')).toBeInTheDocument();
    expect(screen.getByTestId('type-select')).toBeInTheDocument();
  });

  it('shows validation errors on empty submission', async () => {
    const user = userEvent.setup();
    renderForm();

    const submitButton = screen.getByTestId('submit-button');
    await user.click(submitButton);

    // Check for the specific validation error message
    const nameError = await screen.findByText('Source name is required', {}, { timeout: 2000 });
    expect(nameError).toBeInTheDocument();
  });

  it('shows SQL-specific fields by default', () => {
    renderForm();

    expect(screen.getByTestId('dialect-select')).toBeInTheDocument();
    expect(screen.getByTestId('host-input')).toBeInTheDocument();
    expect(screen.getByTestId('port-input')).toBeInTheDocument();
    expect(screen.getByTestId('database-input')).toBeInTheDocument();
  });

  it('submits form with correct data', async () => {
    const mockApiResponse = { ok: true, json: () => Promise.resolve({ id: 1 }) };
    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

    const user = userEvent.setup();
    renderForm();

    // Fill required fields
    await user.type(screen.getByTestId('name-input'), 'Test DB');
    await user.type(screen.getByTestId('host-input'), 'localhost');
    await user.type(screen.getByTestId('database-input'), 'testdb');

    // Set username and password since trustedConnection is false by default
    await user.type(screen.getByTestId('username-input'), 'testuser');
    await user.type(screen.getByTestId('password-input'), 'testpass');

    // Handle port input
    const portInput = screen.getByTestId('port-input');
    await user.clear(portInput);
    await user.type(portInput, '5432');

    // Submit form
    const submitButton = screen.getByTestId('submit-button');
    await user.click(submitButton);

    // Wait for and verify API call
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        'POST',
        '/api/data-sources',
        expect.objectContaining({
          name: 'Test DB',
          type: 'sql',
          config: {
            type: 'sql',
            config: expect.objectContaining({
              host: 'localhost',
              database: 'testdb',
              port: 5432,
              username: 'testuser',
              password: 'testpass',
              trustedConnection: false
            })
          }
        })
      );
    });

    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});