import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import express from 'express';
import { registerRoutes } from './routes';
import { storage } from './storage-manager';

// Mock dependencies
vi.mock('./storage-manager', () => ({
  storage: {
    getUserByUsername: vi.fn(),
    createUser: vi.fn(),
    getUser: vi.fn(),
    getFilesByUser: vi.fn(),
    getFile: vi.fn(),
    deleteFile: vi.fn(),
    getDataSourcesByUser: vi.fn(),
    getDataSource: vi.fn(),
    deleteDataSource: vi.fn(),
    getAllEmbeddings: vi.fn(),
    getPipelinesByUser: vi.fn(),
    getPipeline: vi.fn(),
    updatePipeline: vi.fn(),
    deletePipeline: vi.fn(),
  }
}));

vi.mock('./lib/openai', () => ({
  analyzeFile: vi.fn().mockResolvedValue({ summary: 'Test summary', category: 'Test category' }),
  searchFiles: vi.fn().mockResolvedValue([]),
  suggestTransformations: vi.fn().mockResolvedValue([]),
  processDocumentForRag: vi.fn().mockResolvedValue([]),
  findSimilarChunks: vi.fn().mockResolvedValue([]),
  generateRagResponse: vi.fn().mockResolvedValue('Test response'),
  analyzeRagPerformance: vi.fn().mockResolvedValue({ score: 0 }),
}));

vi.mock('fs/promises', async () => {
  return {
    default: {
      readFile: vi.fn().mockResolvedValue('Test content'),
      access: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
    },
    readFile: vi.fn().mockResolvedValue('Test content'),
    access: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('./lib/ftp', () => ({
  FtpClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    uploadFile: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  })),
  startFtpServer: vi.fn().mockResolvedValue(undefined),
  ensureUploadsDirectory: vi.fn().mockResolvedValue('./uploads'),
}));

vi.mock('crypto', () => ({
  randomBytes: vi.fn().mockReturnValue(Buffer.from('salt')),
  pbkdf2Sync: vi.fn().mockReturnValue(Buffer.from('hashedpassword')),
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('hashedvalue'),
  }),
}));

describe('Authentication Routes', () => {
  let app: express.Express;
  let server: Server;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    app = express();
    server = new Server();
    app.use(express.json());

    mockRequest = {
      session: {
        id: 'test-session-id',
        cookie: {
          maxAge: 86400000,
          originalMaxAge: 86400000
        },
        regenerate: vi.fn((cb) => cb()),
        destroy: vi.fn((cb) => cb()),
        reload: vi.fn((cb) => cb()),
        save: vi.fn((cb) => cb()),
        touch: vi.fn((cb) => cb()),
        userId: undefined
      },
      body: {},
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      end: vi.fn(),
    };
    nextFunction = vi.fn();

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('User Authentication', () => {
    it('should register a new user successfully', async () => {
      // Mock storage.getUserByUsername to return null (user doesn't exist)
      (storage.getUserByUsername as any).mockResolvedValue(null);
      
      // Mock storage.createUser to return a new user
      (storage.createUser as any).mockResolvedValue({
        id: 1,
        username: 'testuser',
        password: 'hashedpassword',
        createdAt: new Date(),
      });

      // Set up request body
      mockRequest.body = {
        username: 'testuser',
        password: 'password123',
      };

      // Mock route registration
      await registerRoutes(app, server);

      // Get the route handler
      const registerHandler = app._router.stack
        .find((layer: any) => 
          layer.route && 
          layer.route.path === '/api/auth/register' && 
          layer.route.methods.post
        )?.route.stack[0].handle;

      if (!registerHandler) {
        throw new Error('Register route handler not found');
      }

      // Call the handler
      await registerHandler(mockRequest as Request, mockResponse as Response, nextFunction);

      // Verify response
      expect(storage.createUser).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should return 400 if username already exists during registration', async () => {
      // Mock storage.getUserByUsername to return an existing user
      (storage.getUserByUsername as any).mockResolvedValue({
        id: 1,
        username: 'testuser',
        password: 'hashedpassword',
      });

      // Set up request body
      mockRequest.body = {
        username: 'testuser',
        password: 'password123',
      };

      // Mock route registration
      await registerRoutes(app, server);

      // Get the route handler
      const registerHandler = app._router.stack
        .find((layer: any) => 
          layer.route && 
          layer.route.path === '/api/auth/register' && 
          layer.route.methods.post
        )?.route.stack[0].handle;

      if (!registerHandler) {
        throw new Error('Register route handler not found');
      }

      // Call the handler
      await registerHandler(mockRequest as Request, mockResponse as Response, nextFunction);

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: "Username already exists" });
    });

    it('should log in a user successfully', async () => {
      // Mock storage.getUserByUsername to return a user with a valid password
      const mockUser = {
        id: 1,
        username: 'testuser',
        password: 'salt:hashedpassword', // Format used by the verifyPassword function
      };
      
      (storage.getUserByUsername as any).mockResolvedValue(mockUser);
      
      // Mock the crypto.pbkdf2Sync function to make verifyPassword return true
      vi.mock('crypto', async () => {
        return {
          default: {
            randomBytes: vi.fn().mockReturnValue(Buffer.from('salt')),
            pbkdf2Sync: vi.fn().mockReturnValue(Buffer.from('hashedpassword')),
            createHash: vi.fn().mockReturnValue({
              update: vi.fn().mockReturnThis(),
              digest: vi.fn().mockReturnValue('hashedvalue'),
            }),
          },
          randomBytes: vi.fn().mockReturnValue(Buffer.from('salt')),
          pbkdf2Sync: vi.fn().mockReturnValue(Buffer.from('hashedpassword')),
          createHash: vi.fn().mockReturnValue({
            update: vi.fn().mockReturnThis(),
            digest: vi.fn().mockReturnValue('hashedvalue'),
          }),
        };
      });

      // Set up request body and session
      mockRequest.body = {
        username: 'testuser',
        password: 'password123',
      };
      mockRequest.session = {
        id: 'test-session-id',
        cookie: {
          maxAge: 86400000,
          originalMaxAge: 86400000
        },
        regenerate: vi.fn((cb) => cb()),
        destroy: vi.fn((cb) => cb()),
        reload: vi.fn((cb) => cb()),
        save: vi.fn((cb) => cb()),
        touch: vi.fn((cb) => cb()),
        userId: undefined
      };

      // Mock route registration
      await registerRoutes(app, server);

      // Get the login route handler
      const loginHandler = app._router.stack
        .find((layer: any) => 
          layer.route && 
          layer.route.path === '/api/auth/login' && 
          layer.route.methods.post
        )?.route.stack[0].handle;

      if (!loginHandler) {
        throw new Error('Login route handler not found');
      }

      // Call the handler
      await loginHandler(mockRequest as Request, mockResponse as Response, nextFunction);

      // Verify that userId was set in the session
      expect(mockRequest.session.userId).toBe(1);
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });

  describe('Authentication Middleware', () => {
    it('should allow access to protected routes with valid session', async () => {
      // Mock an authenticated session
      mockRequest.session = {
        id: 'test-session-id',
        cookie: {
          maxAge: 86400000,
          originalMaxAge: 86400000
        },
        regenerate: vi.fn((cb) => cb()),
        destroy: vi.fn((cb) => cb()),
        reload: vi.fn((cb) => cb()),
        save: vi.fn((cb) => cb()),
        touch: vi.fn((cb) => cb()),
        userId: 1
      };
      
      // Mock route registration
      await registerRoutes(app, server);

      // Get the isAuthenticated middleware
      const middlewareLayers = app._router.stack.filter((layer: any) => 
        !layer.route && layer.name === 'isAuthenticated'
      );
      
      if (middlewareLayers.length === 0) {
        throw new Error('isAuthenticated middleware not found');
      }
      
      const isAuthenticated = middlewareLayers[0].handle;

      // Call the middleware
      isAuthenticated(mockRequest as Request, mockResponse as Response, nextFunction);

      // Verify that next() was called
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should deny access to protected routes without valid session', async () => {
      // Mock an unauthenticated session
      mockRequest.session = {
        id: 'test-session-id',
        cookie: {
          maxAge: 86400000,
          originalMaxAge: 86400000
        },
        regenerate: vi.fn((cb) => cb()),
        destroy: vi.fn((cb) => cb()),
        reload: vi.fn((cb) => cb()),
        save: vi.fn((cb) => cb()),
        touch: vi.fn((cb) => cb())
      };
      
      // Mock route registration
      await registerRoutes(app, server);

      // Get the isAuthenticated middleware
      const middlewareLayers = app._router.stack.filter((layer: any) => 
        !layer.route && layer.name === 'isAuthenticated'
      );
      
      if (middlewareLayers.length === 0) {
        throw new Error('isAuthenticated middleware not found');
      }
      
      const isAuthenticated = middlewareLayers[0].handle;

      // Call the middleware
      isAuthenticated(mockRequest as Request, mockResponse as Response, nextFunction);

      // Verify that status and json were called with correct error message
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: "Unauthorized" });
      // Verify that next() was not called
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Protected Routes with Permissions', () => {
    it('should allow access to own files', async () => {
      // Mock an authenticated session
      mockRequest.session = {
        id: 'test-session-id',
        cookie: {
          maxAge: 86400000,
          originalMaxAge: 86400000
        },
        regenerate: vi.fn((cb) => cb()),
        destroy: vi.fn((cb) => cb()),
        reload: vi.fn((cb) => cb()),
        save: vi.fn((cb) => cb()),
        touch: vi.fn((cb) => cb()),
        userId: 1
      };
      mockRequest.params = { id: '1' };
      
      // Mock storage.getFile to return a file owned by the user
      (storage.getFile as any).mockResolvedValue({
        id: 1,
        userId: 1,
        name: 'test.txt',
        path: '/path/to/test.txt',
      });
      
      // Mock route registration
      await registerRoutes(app, server);

      // Get the file access route handler
      const fileHandler = app._router.stack
        .find((layer: any) => 
          layer.route && 
          layer.route.path === '/api/files/:id' && 
          layer.route.methods.get
        )?.route.stack[1].handle;

      if (!fileHandler) {
        throw new Error('File access route handler not found');
      }

      // Call the handler
      await fileHandler(mockRequest as Request, mockResponse as Response, nextFunction);

      // Verify that json was called with the file
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should deny access to files owned by others', async () => {
      // Mock an authenticated session
      mockRequest.session = {
        id: 'test-session-id',
        cookie: {
          maxAge: 86400000,
          originalMaxAge: 86400000
        },
        regenerate: vi.fn((cb) => cb()),
        destroy: vi.fn((cb) => cb()),
        reload: vi.fn((cb) => cb()),
        save: vi.fn((cb) => cb()),
        touch: vi.fn((cb) => cb()),
        userId: 1
      };
      mockRequest.params = { id: '2' };
      
      // Mock storage.getFile to return a file owned by another user
      (storage.getFile as any).mockResolvedValue({
        id: 2,
        userId: 2, // Different user
        name: 'other.txt',
        path: '/path/to/other.txt',
      });
      
      // Mock route registration
      await registerRoutes(app, server);

      // Get the file access route handler
      const fileHandler = app._router.stack
        .find((layer: any) => 
          layer.route && 
          layer.route.path === '/api/files/:id' && 
          layer.route.methods.get
        )?.route.stack[1].handle;

      if (!fileHandler) {
        throw new Error('File access route handler not found');
      }

      // Call the handler
      await fileHandler(mockRequest as Request, mockResponse as Response, nextFunction);

      // Verify that status and json were called with correct error message
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ 
        message: "You don't have permission to access this file" 
      });
    });
  });
});