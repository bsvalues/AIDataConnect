import { describe, it, expect, beforeEach } from 'vitest';
import { MemStorage } from './storage';
import type { InsertUser, InsertFile, InsertDataSource } from '@shared/schema';

describe('MemStorage', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  describe('User Operations', () => {
    it('creates and retrieves a user', async () => {
      const insertUser: InsertUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const user = await storage.createUser(insertUser);
      expect(user.id).toBe(1);
      expect(user.username).toBe(insertUser.username);

      const retrieved = await storage.getUser(user.id);
      expect(retrieved).toEqual(user);
    });

    it('finds user by username', async () => {
      const insertUser: InsertUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      await storage.createUser(insertUser);
      const found = await storage.getUserByUsername('testuser');
      expect(found?.username).toBe(insertUser.username);
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
  });
});
