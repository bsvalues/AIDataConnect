import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { analyzeFile, searchFiles, suggestTransformations } from "./lib/openai";
import { insertFileSchema, insertDataSourceSchema } from "@shared/schema";
import { ZodError } from "zod";
import fs from "fs/promises";

declare module 'express-serve-static-core' {
  interface Request {
    file?: Express.Multer.File
  }
}

const upload = multer({ dest: "uploads/" });

export async function registerRoutes(app: Express): Promise<Server> {
  // Error handling helper
  const handleError = (error: unknown) => {
    if (error instanceof ZodError) {
      return error.errors[0].message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return "An unexpected error occurred";
  };

  // File management
  app.post("/api/files", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });

      // Read file content for AI analysis
      const content = await fs.readFile(file.path, 'utf-8');

      const fileData = insertFileSchema.parse({
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        path: file.path,
        userId: 1, // Mock user ID
        metadata: null,
        aiSummary: null,
        category: null
      });

      // Analyze file with AI
      const analysis = await analyzeFile(content);
      fileData.aiSummary = analysis.summary;
      fileData.category = analysis.category;

      const savedFile = await storage.createFile(fileData);
      res.json(savedFile);
    } catch (error) {
      res.status(400).json({ message: handleError(error) });
    }
  });

  app.get("/api/files", async (req, res) => {
    try {
      const files = await storage.getFilesByUser(1); // Mock user ID
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.get("/api/files/:id", async (req, res) => {
    try {
      const file = await storage.getFile(parseInt(req.params.id));
      if (!file) return res.status(404).json({ message: "File not found" });
      res.json(file);
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.delete("/api/files/:id", async (req, res) => {
    try {
      await storage.deleteFile(parseInt(req.params.id));
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  // Search
  app.post("/api/search", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }
      const files = await storage.getFilesByUser(1); // Mock user ID
      const filesWithContent = files.map(f => ({
        name: f.name,
        content: f.aiSummary || "" // Use AI summary as searchable content
      }));
      const results = await searchFiles(query, filesWithContent);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  // Data sources
  app.post("/api/data-sources", async (req, res) => {
    try {
      const sourceData = insertDataSourceSchema.parse({
        ...req.body,
        userId: 1, // Mock user ID
        config: req.body.config || null
      });
      const source = await storage.createDataSource(sourceData);
      res.json(source);
    } catch (error) {
      res.status(400).json({ message: handleError(error) });
    }
  });

  app.get("/api/data-sources", async (req, res) => {
    try {
      const sources = await storage.getDataSourcesByUser(1); // Mock user ID
      res.json(sources);
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  app.delete("/api/data-sources/:id", async (req, res) => {
    try {
      await storage.deleteDataSource(parseInt(req.params.id));
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  // Data transformations
  app.post("/api/suggest-transformations", async (req, res) => {
    try {
      const { data } = req.body;
      if (!data) {
        return res.status(400).json({ message: "Data is required" });
      }
      const suggestions = await suggestTransformations(data);
      res.json(suggestions);
    } catch (error) {
      res.status(500).json({ message: handleError(error) });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}