import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricsCards } from './metrics-cards';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

describe('MetricsCards', () => {
  it('renders metrics cards with initial values', () => {
    renderWithProviders(<MetricsCards />);

    // Check if all metric cards are rendered with correct titles
    expect(screen.getByText('Processed Files')).toBeInTheDocument();
    expect(screen.getByText('Avg RAG Score')).toBeInTheDocument();
    expect(screen.getByText('Transformations')).toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    renderWithProviders(<MetricsCards />);

    // Check initial values using test IDs
    expect(screen.getByTestId('processed-files-value')).toHaveTextContent('0');
    expect(screen.getByTestId('rag-score-value')).toHaveTextContent('0.00');
    expect(screen.getByTestId('transformations-value')).toHaveTextContent('0');
  });

  it('handles API error gracefully', () => {
    // Mock console.error to prevent error logging in test output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock fetch to simulate an error
    global.fetch = vi.fn().mockRejectedValue(new Error('API Error'));

    renderWithProviders(<MetricsCards />);

    // Verify that default values are shown when API fails
    expect(screen.getByTestId('processed-files-value')).toHaveTextContent('0');
    expect(screen.getByTestId('rag-score-value')).toHaveTextContent('0.00');
    expect(screen.getByTestId('transformations-value')).toHaveTextContent('0');

    consoleSpy.mockRestore();
  });
});