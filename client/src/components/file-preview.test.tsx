import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FilePreview } from './file-preview';

// Create a simplified File type for testing
type TestFile = {
  id: number;
  name: string;
  path: string;
  type: string;
  size: number;
  userId: number;
  metadata: Record<string, any> | null;
  aiSummary: string | null;
  category: string | null;
  createdAt: Date | null;
  transferType: string | null;
  ftpConfig: Record<string, any> | null;
};

describe('FilePreview Component', () => {
  const mockFile: File = {
    id: 1,
    name: 'test-document.pdf',
    path: '/uploads/test-document.pdf',
    type: 'application/pdf',
    size: 1024 * 1024, // 1MB
    userId: 1,
    metadata: { pages: 10, author: 'Test Author' },
    aiSummary: null,
    category: null,
    createdAt: new Date(),
    transferType: 'local',
    ftpConfig: null
  };

  it('renders file details correctly', () => {
    render(<FilePreview file={mockFile} />);
    
    expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
    expect(screen.getByText('PDF Document')).toBeInTheDocument();
    expect(screen.getByText('1.00 MB')).toBeInTheDocument();
  });

  it('renders different file types with correct labels', () => {
    const textFile: File = { 
      ...mockFile, 
      name: 'notes.txt', 
      type: 'text/plain' 
    };
    const { rerender } = render(<FilePreview file={textFile} />);
    expect(screen.getByText('Text File')).toBeInTheDocument();
    
    const imageFile: File = { 
      ...mockFile, 
      name: 'photo.jpg', 
      type: 'image/jpeg' 
    };
    rerender(<FilePreview file={imageFile} />);
    expect(screen.getByText('JPEG Image')).toBeInTheDocument();
    
    const csvFile: File = { 
      ...mockFile, 
      name: 'data.csv', 
      type: 'text/csv' 
    };
    rerender(<FilePreview file={csvFile} />);
    expect(screen.getByText('CSV File')).toBeInTheDocument();
  });

  it('formats file sizes correctly', () => {
    const smallFile: File = { 
      ...mockFile, 
      size: 512 // 512B
    };
    const { rerender } = render(<FilePreview file={smallFile} />);
    expect(screen.getByText('512 B')).toBeInTheDocument();
    
    const mediumFile: File = { 
      ...mockFile, 
      size: 1536 // 1.5KB
    };
    rerender(<FilePreview file={mediumFile} />);
    expect(screen.getByText('1.50 KB')).toBeInTheDocument();
    
    const largeFile: File = { 
      ...mockFile, 
      size: 2.5 * 1024 * 1024 // 2.5MB
    };
    rerender(<FilePreview file={largeFile} />);
    expect(screen.getByText('2.50 MB')).toBeInTheDocument();
    
    const extraLargeFile: File = { 
      ...mockFile, 
      size: 3 * 1024 * 1024 * 1024 // 3GB
    };
    rerender(<FilePreview file={extraLargeFile} />);
    expect(screen.getByText('3.00 GB')).toBeInTheDocument();
  });

  it('displays file status information', () => {
    const processingFile: File = { 
      ...mockFile, 
      metadata: { ...mockFile.metadata, status: 'processing' } 
    };
    const { rerender } = render(<FilePreview file={processingFile} />);
    expect(screen.getByText(/processing/i, { exact: false })).toBeInTheDocument();
    
    const pendingFile: File = { 
      ...mockFile, 
      metadata: { ...mockFile.metadata, status: 'pending' } 
    };
    rerender(<FilePreview file={pendingFile} />);
    expect(screen.getByText(/pending/i, { exact: false })).toBeInTheDocument();
    
    const errorFile: File = { 
      ...mockFile, 
      metadata: { ...mockFile.metadata, status: 'error' } 
    };
    rerender(<FilePreview file={errorFile} />);
    expect(screen.getByText(/error/i, { exact: false })).toBeInTheDocument();
  });

  it('displays file metadata when available', () => {
    const fileWithMetadata: File = { 
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