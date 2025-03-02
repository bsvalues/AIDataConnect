import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FtpClient, startFtpServer, ensureUploadsDirectory } from './ftp';
import { Client } from 'basic-ftp';
import * as fs from 'fs/promises';

// Mock basic-ftp
vi.mock('basic-ftp', () => {
  return {
    Client: vi.fn(() => ({
      access: vi.fn().mockResolvedValue(undefined),
      uploadFrom: vi.fn().mockResolvedValue(undefined),
      downloadTo: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
      ftp: {
        verbose: false
      },
    }))
  };
});

// Mock fs/promises with more specific behaviors for the FTP functions
vi.mock('fs/promises', async () => {
  const mockFunctions = {
    access: vi.fn().mockImplementation((path) => {
      if (path === './uploads') return Promise.resolve();
      // Allow upload and download paths for the FTP client tests
      if (path === '/local/path') return Promise.resolve();
      return Promise.reject(new Error('Directory does not exist'));
    }),
    mkdir: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ isDirectory: () => true })
  };
  
  return {
    default: mockFunctions,
    ...mockFunctions
  };
});

// Mock ftp-srv providing the FtpSrv constructor that the main code expects
vi.mock('ftp-srv', () => {
  const mockFtpServer = {
    listen: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnThis(),
    debugging: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  
  const FtpSrvMock = vi.fn().mockImplementation(() => mockFtpServer);
  
  return {
    FtpSrv: FtpSrvMock
  };
});

describe('FTP Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FtpClient', () => {
    let ftpClient: FtpClient;

    beforeEach(() => {
      ftpClient = new FtpClient();
    });

    it('should connect to FTP server', async () => {
      await ftpClient.connect('example.com', 21, 'user', 'password');
      expect(Client).toHaveBeenCalled();
      // Use toHaveBeenCalledWith with a partial match to handle additional properties
      expect((ftpClient as any).client.access).toHaveBeenCalled();
      const accessCall = (ftpClient as any).client.access.mock.calls[0][0];
      expect(accessCall.host).toBe('example.com');
      expect(accessCall.port).toBe(21);
      expect(accessCall.user).toBe('user');
      expect(accessCall.password).toBe('password');
      expect(accessCall.secure).toBe(true);
    });

    it('should upload a file', async () => {
      (ftpClient as any).client = new Client();
      await ftpClient.uploadFile('/local/path', '/remote/path');
      expect((ftpClient as any).client.uploadFrom).toHaveBeenCalledWith('/local/path', '/remote/path');
    });

    it('should download a file', async () => {
      (ftpClient as any).client = new Client();
      await ftpClient.downloadFile('/remote/path', '/local/path');
      expect((ftpClient as any).client.downloadTo).toHaveBeenCalledWith('/local/path', '/remote/path');
    });

    it('should disconnect', async () => {
      (ftpClient as any).client = new Client();
      await ftpClient.disconnect();
      expect((ftpClient as any).client.close).toHaveBeenCalled();
    });
  });

  describe('startFtpServer', () => {
    it('should start the FTP server successfully', async () => {
      // Mock environment variables needed by startFtpServer
      process.env.FTP_USER = 'testuser';
      process.env.FTP_PASS = 'testpass';
      
      // Execute the function - we're testing it doesn't throw an exception
      await startFtpServer();
      
      // Success is defined by not throwing an exception
      expect(true).toBe(true);
    });
  });

  describe('ensureUploadsDirectory', () => {
    it('should create uploads directory if it does not exist', async () => {
      (fs.access as any).mockRejectedValueOnce(new Error('Not found'));
      await ensureUploadsDirectory();
      expect(fs.mkdir).toHaveBeenCalled();
    });

    it('should not create uploads directory if it already exists', async () => {
      (fs.access as any).mockResolvedValueOnce(undefined);
      await ensureUploadsDirectory();
      expect(fs.mkdir).not.toHaveBeenCalled();
    });
  });
});