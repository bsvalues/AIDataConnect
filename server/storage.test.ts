import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemStorage } from './storage';
import type { 
  InsertFile, 
  InsertDataSource, 
  InsertEmbedding, 
  InsertPipeline
} from '@shared/schema';

// Import the schemas directly from shared/schema.ts
import {
  insertUserSchema,
  insertFileSchema,
  insertDataSourceSchema,
  ftpConfigSchema
} from '@shared/schema';

describe('MemStorage', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  describe('User Operations', () => {
    it('creates and retrieves a user', async () => {
      const insertUser = {
        username: 'testuser',
        password: 'password123'
      };

      const user = await storage.createUser(insertUser);
      expect(user.id).toBe(1);
      expect(user.username).toBe(insertUser.username);

      const retrieved = await storage.getUser(user.id);
      expect(retrieved).toEqual(user);
    });

    it('finds user by username', async () => {
      const insertUser = {
        username: 'testuser',
        password: 'password123'
      };

      await storage.createUser(insertUser);
      const found = await storage.getUserByUsername('testuser');
      expect(found?.username).toBe(insertUser.username);
    });
  });

  describe('File Operations', () => {
    it('creates and retrieves a file', async () => {
      const insertFile: InsertFile = {
        name: 'test-file.txt',
        type: 'text/plain',
        size: 1024,
        path: '/uploads/test-file.txt',
        userId: 1,
        transferType: 'local',
        ftpConfig: null,
        metadata: null,
        aiSummary: null,
        category: null
      };

      const file = await storage.createFile(insertFile);
      expect(file.id).toBe(1);
      expect(file.name).toBe(insertFile.name);

      const retrieved = await storage.getFile(file.id);
      expect(retrieved).toEqual(file);
    });

    it('lists files by user', async () => {
      const userId = 1;
      const insertFile: InsertFile = {
        name: 'test-file.txt',
        type: 'text/plain',
        size: 1024,
        path: '/uploads/test-file.txt',
        userId,
        transferType: 'local',
        ftpConfig: null,
        metadata: null,
        aiSummary: null,
        category: null
      };

      await storage.createFile(insertFile);
      await storage.createFile({ ...insertFile, name: 'test-file-2.txt' });

      const files = await storage.getFilesByUser(userId);
      expect(files).toHaveLength(2);
    });

    it('updates a file', async () => {
      const insertFile: InsertFile = {
        name: 'test-file.txt',
        type: 'text/plain',
        size: 1024,
        path: '/uploads/test-file.txt',
        userId: 1,
        transferType: 'local',
        ftpConfig: null,
        metadata: null,
        aiSummary: null,
        category: null
      };

      const file = await storage.createFile(insertFile);
      
      const updates = {
        name: 'updated-name.txt',
        aiSummary: 'This is a test file'
      };
      
      const updated = await storage.updateFile(file.id, updates);
      expect(updated.name).toBe(updates.name);
      expect(updated.aiSummary).toBe(updates.aiSummary);
      expect(updated.size).toBe(insertFile.size); // Unchanged field
    });

    it('deletes a file', async () => {
      const insertFile: InsertFile = {
        name: 'test-file.txt',
        type: 'text/plain',
        size: 1024,
        path: '/uploads/test-file.txt',
        userId: 1,
        transferType: 'local',
        ftpConfig: null,
        metadata: null,
        aiSummary: null,
        category: null
      };

      const file = await storage.createFile(insertFile);
      await storage.deleteFile(file.id);
      
      const retrieved = await storage.getFile(file.id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Data Source Operations', () => {
    it('creates and retrieves a data source', async () => {
      const insertDataSource: InsertDataSource = {
        name: 'Test DB',
        type: 'sql',
        userId: 1,
        config: {
          type: 'sql',
          config: {
            dialect: 'postgres',
            host: 'localhost',
            port: 5432,
            database: 'testdb',
            username: 'user',
            password: 'pass',
            encrypt: false,
            trustedConnection: false
          }
        }
      };

      const source = await storage.createDataSource(insertDataSource);
      expect(source.id).toBe(1);
      expect(source.name).toBe(insertDataSource.name);

      const retrieved = await storage.getDataSource(source.id);
      expect(retrieved).toEqual(source);
    });

    it('lists data sources by user', async () => {
      const userId = 1;
      const insertDataSource: InsertDataSource = {
        name: 'Test DB',
        type: 'sql',
        userId,
        config: {
          type: 'sql',
          config: {
            dialect: 'postgres',
            host: 'localhost',
            port: 5432,
            database: 'testdb',
            username: 'user',
            password: 'pass',
            encrypt: false,
            trustedConnection: false
          }
        }
      };

      await storage.createDataSource(insertDataSource);
      await storage.createDataSource({ ...insertDataSource, name: 'Test DB 2' });

      const sources = await storage.getDataSourcesByUser(userId);
      expect(sources).toHaveLength(2);
    });

    it('deletes a data source', async () => {
      const insertDataSource: InsertDataSource = {
        name: 'Test DB',
        type: 'sql',
        userId: 1,
        config: {
          type: 'sql',
          config: {
            dialect: 'postgres',
            host: 'localhost',
            port: 5432,
            database: 'testdb',
            username: 'user',
            password: 'pass',
            encrypt: false,
            trustedConnection: false
          }
        }
      };

      const source = await storage.createDataSource(insertDataSource);
      await storage.deleteDataSource(source.id);
      
      const retrieved = await storage.getDataSource(source.id);
      expect(retrieved).toBeUndefined();
    });
  });
});
