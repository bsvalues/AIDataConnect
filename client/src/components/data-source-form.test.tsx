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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
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
    (apiRequest as jest.Mock).mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 1, name: "Test DB", type: "sql" })
      })
    );
  });

  it('renders all form fields for SQL data source', () => {
    renderWithProviders(<DataSourceForm />);

    // Check if form is rendered
    expect(screen.getByTestId('data-source-form')).toBeInTheDocument();

    // Check if basic fields are rendered
    expect(screen.getByTestId('name-input')).toBeInTheDocument();
    expect(screen.getByTestId('type-select')).toBeInTheDocument();

    // SQL specific fields should be visible by default
    expect(screen.getByTestId('dialect-select')).toBeInTheDocument();
    expect(screen.getByTestId('host-input')).toBeInTheDocument();
    expect(screen.getByTestId('port-input')).toBeInTheDocument();
    expect(screen.getByTestId('database-input')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DataSourceForm />);

    // Try to submit without filling required fields
    const submitButton = screen.getByTestId('submit-button');
    await user.click(submitButton);

    // Check for validation messages
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });

  it('switches form fields when changing source type', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DataSourceForm />);

    // Find and click the type select trigger
    const typeSelect = screen.getByTestId('type-select');
    await user.click(typeSelect);

    // Select the API option from the dropdown
    const apiOption = screen.getByTestId('type-option-api');
    await user.click(apiOption);

    // SQL specific fields should not be visible
    await waitFor(() => {
      expect(screen.queryByTestId('dialect-select')).not.toBeInTheDocument();
    });
  });

  it('successfully submits the form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DataSourceForm />);

    // Fill out the form
    await user.type(screen.getByTestId('name-input'), 'Test DB');

    // Fill required SQL fields
    await user.type(screen.getByTestId('host-input'), 'localhost');
    await user.type(screen.getByTestId('database-input'), 'testdb');
    await user.type(screen.getByTestId('port-input'), '5432');

    // Submit the form
    const submitButton = screen.getByTestId('submit-button');
    await user.click(submitButton);

    // Verify the API was called with correct data
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("POST", "/api/data-sources", expect.any(Object));
    });
  });
});