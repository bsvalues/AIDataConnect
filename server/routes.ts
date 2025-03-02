import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import multer from "multer";
import { storage } from "./storage-manager";
import { analyzeFile, searchFiles, suggestTransformations, processDocumentForRag, findSimilarChunks, generateRagResponse, analyzeRagPerformance } from "./lib/openai";
import { insertFileSchema, insertDataSourceSchema, insertUserSchema } from "@shared/schema";
import { ZodError } from "zod";
import fs from "fs/promises";
import path from 'path';
import { FtpClient } from "./lib/ftp";
import logger from "./lib/logger";
import crypto from 'crypto';
import session from 'express-session';
import MemoryStore from 'memorystore';

// Create a session store
const SessionStore = MemoryStore(session);

declare module 'express-serve-static-core' {
  interface Request {
    file?: Express.Multer.File
  }
}

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Extend request type to include user and session
declare module 'express-serve-static-core' {
  interface Request {
    user?: any;
  }
}

// Add session userId property
declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

// Helper function to hash passwords
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Helper function to verify passwords
function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Middleware to ensure user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// Ensure a default test user exists for demo purposes
async function ensureDefaultUser() {
  try {
    // Check if any users exist
    const users = await storage.getUserByUsername('admin');
    
    if (!users) {
      // Create a default admin user
      const defaultUser = {
        username: 'admin',
        password: hashPassword('password'),
        email: 'admin@example.com',
        createdAt: new Date(),
      };
      
      await storage.createUser(defaultUser);
      logger.info('Created default admin user for testing');
    }
  } catch (error) {
    logger.error('Error ensuring default user:', error);
  }
}

export async function registerRoutes(app: Express, server: Server): Promise<Server> {
  await ensureUploadsDirectory();
  
  // Ensure test user exists
  await ensureDefaultUser();
  
  // Add a test protected route for authentication testing
  app.get("/api/auth/protected", isAuthenticated, (_req: Request, res: Response) => {
    res.json({ message: "This is a protected route" });
  });
  
  // Set up session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'rag-drive-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    store: new SessionStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    })
  }));
  
  const handleError = (error: unknown) => {
    if (error instanceof ZodError) {
      return error.errors[0].message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return "An unexpected error occurred";
  };
  
  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      // Parse and validate the registration data
      const userData = insertUserSchema.parse({
        ...req.body,
        password: hashPassword(req.body.password)
      });
      
      // Check if username is already taken
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Create the user
      const newUser = await storage.createUser(userData);
      
      // Remove password from response
      const { password, ...userWithoutPassword } = newUser;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ message: handleError(error) });
    }
  });
  
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // Find user by username
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Verify password
      if (!verifyPassword(password, user.password)) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Set user in session and save
      req.session.userId = user.id;
      req.session.save((err) => {
        if (err) {
          logger.error('Session save error:', err);
          return res.status(500).json({ message: "Error saving session" });
        }
        
        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });
  
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.status(200).json({ message: "Logged out successfully" });
    });
  });
  
  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.post("/api/files", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      let content: string;
      try {
        content = await fs.readFile(req.file.path, 'utf-8');
      } catch (error) {
        return res.status(400).json({ message: "Error reading file" });
      }

      const transferType = req.body.transferType || "local";
      let ftpConfig = null;

      if (transferType === "ftp" && req.body.ftpConfig) {
        try {
          ftpConfig = JSON.parse(req.body.ftpConfig);
          if (!ftpConfig.host || !ftpConfig.port || !ftpConfig.user || !ftpConfig.password) {
            return res.status(400).json({ message: "Invalid FTP configuration" });
          }
        } catch (error) {
          return res.status(400).json({ message: "Invalid FTP configuration format" });
        }
      }

      const fileData = insertFileSchema.parse({
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        userId: req.session.userId,
        metadata: null,
        aiSummary: null,
        category: null,
        transferType,
        ftpConfig
      });

      if (transferType === "ftp" && ftpConfig) {
        const ftpClient = new FtpClient();
        try {
          await ftpClient.connect(
            ftpConfig.host,
            ftpConfig.port,
            ftpConfig.user,
            ftpConfig.password
          );
          await ftpClient.uploadFile(
            req.file.path,
            path.basename(req.file.path)
          );
          await ftpClient.disconnect();
          fileData.path = `ftp://${ftpConfig.host}/${path.basename(req.file.path)}`;
        } catch (ftpError) {
          console.error('FTP upload error:', ftpError);
          return res.status(400).json({ message: "FTP upload failed" });
        }
      }

      const analysis = await analyzeFile(content);
      fileData.aiSummary = analysis.summary;
      fileData.category = analysis.category;

      const savedFile = await storage.createFile(fileData);
      res.json(savedFile);
    } catch (error) {
      console.error('File upload error:', error);
      res.status(400).json({ message: handleError(error) });
    }
  });

  app.get("/api/files", isAuthenticated, async (req, res) => {
    try {
      // Ensure userId exists (should be guaranteed by isAuthenticated middleware)
      const userId = req.session.userId;
      if (userId === undefined) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const files = await storage.getFilesByUser(userId);
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.get("/api/files/:id", isAuthenticated, async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const file = await storage.getFile(fileId);
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Ensure the file belongs to the authenticated user
      if (file.userId !== req.session.userId) {
        return res.status(403).json({ message: "You don't have permission to access this file" });
      }
      
      res.json(file);
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.delete("/api/files/:id", isAuthenticated, async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const file = await storage.getFile(fileId);
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Ensure the file belongs to the authenticated user
      if (file.userId !== req.session.userId) {
        return res.status(403).json({ message: "You don't have permission to delete this file" });
      }
      
      await storage.deleteFile(fileId);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.post("/api/search", isAuthenticated, async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }
      
      // Ensure userId exists
      const userId = req.session.userId;
      if (userId === undefined) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const files = await storage.getFilesByUser(userId);
      const filesWithContent = files.map(f => ({
        name: f.name,
        content: f.aiSummary || ""
      }));
      const results = await searchFiles(query, filesWithContent);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.post("/api/data-sources", isAuthenticated, async (req, res) => {
    try {
      const sourceData = insertDataSourceSchema.parse({
        ...req.body,
        userId: req.session.userId,
        config: req.body.config || null
      });
      const source = await storage.createDataSource(sourceData);
      res.json(source);
    } catch (error) {
      res.status(400).json({ message: handleError(error) });
    }
  });

  app.get("/api/data-sources", isAuthenticated, async (req, res) => {
    try {
      // Ensure userId exists
      const userId = req.session.userId;
      if (userId === undefined) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const sources = await storage.getDataSourcesByUser(userId);
      res.json(sources);
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.delete("/api/data-sources/:id", isAuthenticated, async (req, res) => {
    try {
      const sourceId = parseInt(req.params.id);
      const source = await storage.getDataSource(sourceId);
      
      if (!source) {
        return res.status(404).json({ message: "Data source not found" });
      }
      
      // Ensure the data source belongs to the authenticated user
      if (source.userId !== req.session.userId) {
        return res.status(403).json({ message: "You don't have permission to delete this data source" });
      }
      
      await storage.deleteDataSource(sourceId);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.post("/api/suggest-transformations", isAuthenticated, async (req, res) => {
    try {
      const { data } = req.body;
      if (!data) {
        return res.status(400).json({ message: "Data is required for analysis" });
      }

      console.log("Requesting AI suggestions for data:", JSON.stringify(data).slice(0, 100) + "...");
      const suggestions = await suggestTransformations(data);

      console.log(`Generated ${suggestions.length} suggestions`);
      res.json(suggestions);
    } catch (error) {
      console.error("Error generating suggestions:", error);
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.post("/api/rag/process", isAuthenticated, async (req, res) => {
    try {
      const { fileId, config } = req.body;
      if (!fileId) {
        return res.status(400).json({ message: "File ID is required" });
      }

      const file = await storage.getFile(parseInt(fileId));
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Ensure the file belongs to the authenticated user
      if (file.userId !== req.session.userId) {
        return res.status(403).json({ message: "You don't have permission to process this file" });
      }

      let content: string;
      try {
        content = await fs.readFile(file.path, 'utf-8');
      } catch (error) {
        return res.status(400).json({ message: "Error reading file" });
      }

      const embeddings = await processDocumentForRag(content, config);

      for (const embedding of embeddings) {
        await storage.createEmbedding({
          fileId: file.id,
          chunk: embedding.text,
          vector: JSON.stringify(embedding.vector)
        });
      }

      res.json({
        message: "Document processed successfully",
        chunks: embeddings.length
      });
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.get("/api/analytics/metrics", isAuthenticated, async (req, res) => {
    try {
      // Ensure userId exists
      const userId = req.session.userId;
      if (userId === undefined) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const files = await storage.getFilesByUser(userId);
      const embeddings = await storage.getAllEmbeddings();
      const pipelines = await storage.getPipelinesByUser(userId);

      const metrics = {
        totalProcessedFiles: files.length,
        avgRagScore: embeddings.length > 0 ?
          // Assuming embeddings might not have performance data yet
          0 :
          0,
        transformationCount: pipelines.reduce((acc, curr) => {
          // Count nodes instead of transformations
          return acc + (curr.nodes?.length || 0);
        }, 0)
      };

      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.get("/api/analytics/usage", isAuthenticated, async (req, res) => {
    try {
      // Ensure userId exists
      const userId = req.session.userId;
      if (userId === undefined) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const files = await storage.getFilesByUser(userId);
      const now = new Date();
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      const data = last7Days.map(date => ({
        date,
        files: files.filter(f => f.createdAt && f.createdAt.toISOString().startsWith(date)).length,
        queries: Math.floor(Math.random() * 10) // Mock data - replace with actual query tracking
      }));

      res.json(data);
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.post("/api/rag/query", isAuthenticated, async (req, res) => {
    try {
      const { query, fileIds, config } = req.body;
      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }

      // If fileIds are provided, verify that the user has access to these files
      if (fileIds && fileIds.length > 0) {
        for (const id of fileIds) {
          const file = await storage.getFile(parseInt(id));
          if (file && file.userId !== req.session.userId) {
            return res.status(403).json({ 
              message: "You don't have permission to access one or more of the specified files" 
            });
          }
        }
      }

      const fileEmbeddings = await storage.getEmbeddingsByFileIds(fileIds || []);
      const similarChunks = await findSimilarChunks(query, fileEmbeddings, config);
      const response = await generateRagResponse(query, similarChunks, config);

      const performance = await analyzeRagPerformance(query, similarChunks, response);

      res.json({
        response,
        context: similarChunks,
        performance
      });
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.post("/api/pipelines", isAuthenticated, async (req, res) => {
    try {
      const pipelineData = {
        ...req.body,
        userId: req.session.userId
      };
      const pipeline = await storage.createPipeline(pipelineData);
      res.json(pipeline);
    } catch (error) {
      res.status(400).json({ message: handleError(error) });
    }
  });

  app.get("/api/pipelines", isAuthenticated, async (req, res) => {
    try {
      // Ensure userId exists
      const userId = req.session.userId;
      if (userId === undefined) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const pipelines = await storage.getPipelinesByUser(userId);
      res.json(pipelines);
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.get("/api/pipelines/:id", isAuthenticated, async (req, res) => {
    try {
      const pipelineId = parseInt(req.params.id);
      const pipeline = await storage.getPipeline(pipelineId);
      
      if (!pipeline) {
        return res.status(404).json({ message: "Pipeline not found" });
      }
      
      // Ensure the pipeline belongs to the authenticated user
      if (pipeline.userId !== req.session.userId) {
        return res.status(403).json({ message: "You don't have permission to access this pipeline" });
      }
      
      res.json(pipeline);
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.patch("/api/pipelines/:id", isAuthenticated, async (req, res) => {
    try {
      const pipelineId = parseInt(req.params.id);
      const pipeline = await storage.getPipeline(pipelineId);
      
      if (!pipeline) {
        return res.status(404).json({ message: "Pipeline not found" });
      }
      
      // Ensure the pipeline belongs to the authenticated user
      if (pipeline.userId !== req.session.userId) {
        return res.status(403).json({ message: "You don't have permission to modify this pipeline" });
      }
      
      const updatedPipeline = await storage.updatePipeline(pipelineId, req.body);
      res.json(updatedPipeline);
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.delete("/api/pipelines/:id", isAuthenticated, async (req, res) => {
    try {
      const pipelineId = parseInt(req.params.id);
      const pipeline = await storage.getPipeline(pipelineId);
      
      if (!pipeline) {
        return res.status(404).json({ message: "Pipeline not found" });
      }
      
      // Ensure the pipeline belongs to the authenticated user
      if (pipeline.userId !== req.session.userId) {
        return res.status(403).json({ message: "You don't have permission to delete this pipeline" });
      }
      
      await storage.deletePipeline(pipelineId);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  // At this point, all API routes should be defined above
  // Now add the following fallback routes after all API routes
  
  // API 404 handler for all undefined API routes
  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ message: "API endpoint not found" });
  });
  
  // For all other routes, let Vite handle it in development mode
  // and serve static files in production mode
  // Important: This should not attempt to handle any requests directly,
  // but just pass control to the next middleware (Vite) in development
  app.get('*', (_req: Request, _res: Response, next: NextFunction) => {
    next();
  });

  // Add 404 handler - this should be after all other routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.error("404 Not Found", {
      metadata: {
        path: req.originalUrl,
        method: req.method,
        userAgent: req.get('user-agent'),
        ip: req.ip
      }
    });

    // If API request, return JSON
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        message: "API endpoint not found",
        path: req.path
      });
    }

    // For web requests, return the 404 page
    res.status(404).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>404 - Page Not Found</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #f9fafb;
          }
          .container {
            text-align: center;
            padding: 2rem;
          }
          h1 { color: #111827; margin-bottom: 1rem; }
          p { color: #6b7280; margin-bottom: 2rem; }
          a {
            color: #2563eb;
            text-decoration: none;
            font-weight: 500;
          }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>404 Page Not Found</h1>
          <p>The page you're looking for doesn't exist or has been moved.</p>
          <a href="/">Return to Dashboard</a>
        </div>
      </body>
      </html>
    `);
  });

  // Error handler should be the last middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error("Server error", {
      metadata: {
        status,
        message,
        stack: err.stack,
        code: err.code,
      },
    });

    res.status(status).json({
      message,
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    });
  });

  // Return the server that was passed in
  return server;
}

async function ensureUploadsDirectory() {
  const uploadsDir = "./uploads";
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir);
  }
  return uploadsDir;
}