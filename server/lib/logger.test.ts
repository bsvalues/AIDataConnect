import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestLogger, errorLogger, createContextLogger } from './logger';
import { Request, Response, NextFunction } from 'express';

// Create mocks for winston
vi.mock('winston', async () => {
  const mockFormat = {
    combine: vi.fn().mockReturnThis(),
    timestamp: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    colorize: vi.fn().mockReturnThis(),
    printf: vi.fn().mockReturnThis(),
    errors: vi.fn().mockReturnThis(),
    simple: vi.fn().mockReturnThis(),
    metadata: vi.fn().mockReturnThis(),
  };

  const mockTransports = {
    Console: vi.fn(),
    File: vi.fn(),
  };

  const mockLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    http: vi.fn(),
  };

  return {
    default: {
      format: mockFormat,
      transports: mockTransports,
      createLogger: vi.fn(() => mockLogger),
      addColors: vi.fn(),
    },
    format: mockFormat,
    transports: mockTransports,
    createLogger: vi.fn(() => mockLogger),
    addColors: vi.fn(),
  };
});

describe('Logger Utilities', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest = {
      method: 'GET',
      url: '/test',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
      },
      get: vi.fn((headerName) => {
        if (headerName === 'user-agent') {
          return 'test-agent';
        }
        return null;
      }),
    };
    mockResponse = {
      statusCode: 200,
      on: vi.fn(),
    };
    nextFunction = vi.fn();
  });

  describe('requestLogger', () => {
    it('should log request information', () => {
      // Mock the response.on method to immediately execute the callback
      (mockResponse.on as any).mockImplementation((event: string, callback: Function) => {
        if (event === 'finish') {
          callback();
        }
      });

      // Execute the middleware
      requestLogger(mockRequest as Request, mockResponse as Response, nextFunction);

      // Check if next was called
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('errorLogger', () => {
    it('should log error information', () => {
      const error = new Error('Test error');
      
      // Execute the middleware
      errorLogger(error, mockRequest as Request, mockResponse as Response, nextFunction);

      // Check if next was called with the error
      expect(nextFunction).toHaveBeenCalledWith(error);
    });
  });

  describe('createContextLogger', () => {
    it('should create a logger with a specific context', () => {
      const contextLogger = createContextLogger('test-context');
      
      // Verify that the contextLogger has the expected methods
      expect(contextLogger).toHaveProperty('error');
      expect(contextLogger).toHaveProperty('warn');
      expect(contextLogger).toHaveProperty('info');
      expect(contextLogger).toHaveProperty('debug');
    });
  });
});