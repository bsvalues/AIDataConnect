import { 
  type User, type InsertUser,
  type File, type InsertFile,
  type DataSource, type InsertDataSource 
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // File operations
  getFile(id: number): Promise<File | undefined>;
  getFilesByUser(userId: number): Promise<File[]>;
  createFile(file: InsertFile): Promise<File>;
  updateFile(id: number, updates: Partial<File>): Promise<File>;
  deleteFile(id: number): Promise<void>;

  // Data source operations
  getDataSource(id: number): Promise<DataSource | undefined>;
  getDataSourcesByUser(userId: number): Promise<DataSource[]>;
  createDataSource(source: InsertDataSource): Promise<DataSource>;
  deleteDataSource(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private files: Map<number, File>;
  private dataSources: Map<number, DataSource>;
  private currentIds: { users: number; files: number; dataSources: number };

  constructor() {
    this.users = new Map();
    this.files = new Map();
    this.dataSources = new Map();
    this.currentIds = { users: 1, files: 1, dataSources: 1 };
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentIds.users++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // File operations
  async getFile(id: number): Promise<File | undefined> {
    return this.files.get(id);
  }

  async getFilesByUser(userId: number): Promise<File[]> {
    return Array.from(this.files.values()).filter(
      (file) => file.userId === userId
    );
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const id = this.currentIds.files++;
    const file: File = {
      id,
      ...insertFile,
      metadata: insertFile.metadata || null,
      aiSummary: insertFile.aiSummary || null,
      category: insertFile.category || null,
      createdAt: new Date()
    };
    this.files.set(id, file);
    return file;
  }

  async updateFile(id: number, updates: Partial<File>): Promise<File> {
    const file = await this.getFile(id);
    if (!file) throw new Error("File not found");

    const updated: File = { 
      ...file,
      ...updates,
      metadata: updates.metadata ?? file.metadata,
      aiSummary: updates.aiSummary ?? file.aiSummary,
      category: updates.category ?? file.category
    };
    this.files.set(id, updated);
    return updated;
  }

  async deleteFile(id: number): Promise<void> {
    this.files.delete(id);
  }

  // Data source operations
  async getDataSource(id: number): Promise<DataSource | undefined> {
    return this.dataSources.get(id);
  }

  async getDataSourcesByUser(userId: number): Promise<DataSource[]> {
    return Array.from(this.dataSources.values()).filter(
      (source) => source.userId === userId
    );
  }

  async createDataSource(insertSource: InsertDataSource): Promise<DataSource> {
    const id = this.currentIds.dataSources++;
    const source: DataSource = {
      id,
      ...insertSource,
      config: insertSource.config || null,
      createdAt: new Date()
    };
    this.dataSources.set(id, source);
    return source;
  }

  async deleteDataSource(id: number): Promise<void> {
    this.dataSources.delete(id);
  }
}

export const storage = new MemStorage();