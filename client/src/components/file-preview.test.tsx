import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FilePreview } from './file-preview';

describe('FilePreview Component', () => {
  const mockFile = {
    id: 1,
    name: 'test-document.pdf',
    path: '/uploads/test-document.pdf',
    type: 'application/pdf',
    size: 1024 * 1024, // 1MB
    userId: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    processingStatus: 'completed',
    metadata: { pages: 10, author: 'Test Author' }
  };

  it('renders file details correctly', () => {
    render(<FilePreview file={mockFile} />);
    
    expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
    expect(screen.getByText('PDF Document')).toBeInTheDocument();
    expect(screen.getByText('1.00 MB')).toBeInTheDocument();
  });

  it('renders different file types with correct labels', () => {
    const textFile = { ...mockFile, name: 'notes.txt', type: 'text/plain' };
    const { rerender } = render(<FilePreview file={textFile} />);
    expect(screen.getByText('Text File')).toBeInTheDocument();
    
    const imageFile = { ...mockFile, name: 'photo.jpg', type: 'image/jpeg' };
    rerender(<FilePreview file={imageFile} />);
    expect(screen.getByText('JPEG Image')).toBeInTheDocument();
    
    const csvFile = { ...mockFile, name: 'data.csv', type: 'text/csv' };
    rerender(<FilePreview file={csvFile} />);
    expect(screen.getByText('CSV File')).toBeInTheDocument();
  });

  it('formats file sizes correctly', () => {
    const smallFile = { ...mockFile, size: 512 }; // 512B
    const { rerender } = render(<FilePreview file={smallFile} />);
    expect(screen.getByText('512 B')).toBeInTheDocument();
    
    const mediumFile = { ...mockFile, size: 1536 }; // 1.5KB
    rerender(<FilePreview file={mediumFile} />);
    expect(screen.getByText('1.50 KB')).toBeInTheDocument();
    
    const largeFile = { ...mockFile, size: 2.5 * 1024 * 1024 }; // 2.5MB
    rerender(<FilePreview file={largeFile} />);
    expect(screen.getByText('2.50 MB')).toBeInTheDocument();
    
    const extraLargeFile = { ...mockFile, size: 3 * 1024 * 1024 * 1024 }; // 3GB
    rerender(<FilePreview file={extraLargeFile} />);
    expect(screen.getByText('3.00 GB')).toBeInTheDocument();
  });

  it('displays processing status', () => {
    const processingFile = { ...mockFile, processingStatus: 'processing' };
    const { rerender } = render(<FilePreview file={processingFile} />);
    expect(screen.getByText(/Processing/i)).toBeInTheDocument();
    
    const pendingFile = { ...mockFile, processingStatus: 'pending' };
    rerender(<FilePreview file={pendingFile} />);
    expect(screen.getByText(/Pending/i)).toBeInTheDocument();
    
    const errorFile = { ...mockFile, processingStatus: 'error' };
    rerender(<FilePreview file={errorFile} />);
    expect(screen.getByText(/Error/i)).toBeInTheDocument();
  });

  it('displays file metadata when available', () => {
    const fileWithMetadata = { 
      ...mockFile, 
      metadata: { 
        pages: 15, 
        author: 'John Doe', 
        createdDate: '2023-06-15' 
      } 
    };
    
    render(<FilePreview file={fileWithMetadata} />);
    
    // Check if metadata is displayed
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('2023-06-15')).toBeInTheDocument();
  });
});