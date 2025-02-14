import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { analyzeFile, searchFiles, suggestTransformations } from "./lib/openai";
import { insertFileSchema, insertDataSourceSchema } from "@shared/schema";
import { ZodError } from "zod";
import fs from "fs/promises";
import path from 'path';
import { FtpClient } from "./lib/ftp"; // Import from our FTP service module

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

export async function registerRoutes(app: Express): Promise<Server> {
  await ensureUploadsDirectory();
  const handleError = (error: unknown) => {
    if (error instanceof ZodError) {
      return error.errors[0].message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return "An unexpected error occurred";
  };

  app.post("/api/files", upload.single("file"), async (req, res) => {
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
      const ftpConfig = req.body.ftpConfig ? JSON.parse(req.body.ftpConfig) : null;

      const fileData = insertFileSchema.parse({
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        userId: 1, 
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

  app.get("/api/files", async (req, res) => {
    try {
      const files = await storage.getFilesByUser(1); 
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

  app.post("/api/search", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }
      const files = await storage.getFilesByUser(1); 
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

  app.post("/api/data-sources", async (req, res) => {
    try {
      const sourceData = insertDataSourceSchema.parse({
        ...req.body,
        userId: 1, 
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
      const sources = await storage.getDataSourcesByUser(1); 
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

async function ensureUploadsDirectory() {
  const uploadsDir = "./uploads";
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir);
  }
  return uploadsDir;
}