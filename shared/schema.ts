import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User and files schemas remain unchanged
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  path: text("path").notNull(),
  userId: integer("user_id").notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  aiSummary: text("ai_summary"),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Enhanced data source schema with specific connector types
export const dataSources = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // sql, api, cloud_storage
  config: jsonb("config").$type<DataSourceConfig>(),
  status: text("status").notNull().default("pending"),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Data source configuration schemas
export const sqlConfigSchema = z.object({
  dialect: z.enum(["postgres", "mysql", "sqlserver"]),
  host: z.string().min(1, "Host is required"),
  port: z.number().int().positive("Port must be a positive number"),
  database: z.string().min(1, "Database name is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  ssl: z.boolean().optional(),
  domain: z.string().optional(), // For Windows authentication
  instanceName: z.string().optional(), // For named SQL Server instances
  trustedConnection: z.boolean().optional(), // For Windows authentication
  encrypt: z.boolean().optional().default(true), // For SQL Server security
});

export const apiConfigSchema = z.object({
  url: z.string().url("Invalid API URL"),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  authType: z.enum(["none", "basic", "bearer", "custom"]),
  authConfig: z.record(z.string()).optional(),
});

export const cloudStorageConfigSchema = z.object({
  provider: z.enum(["s3", "gcs", "azure"]),
  bucket: z.string().min(1, "Bucket name is required"),
  region: z.string().optional(),
  credentials: z.record(z.string()),
  prefix: z.string().optional(),
});

// Union type for all possible configs
export const dataSourceConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sql"), config: sqlConfigSchema }),
  z.object({ type: z.literal("api"), config: apiConfigSchema }),
  z.object({ type: z.literal("cloud_storage"), config: cloudStorageConfigSchema }),
]);

// Type for the config column
export type DataSourceConfig = z.infer<typeof dataSourceConfigSchema>;

// Schema validation
export const insertUserSchema = createInsertSchema(users);
export const insertFileSchema = createInsertSchema(files).omit({ id: true, createdAt: true });
export const insertDataSourceSchema = createInsertSchema(dataSources)
  .omit({ id: true, createdAt: true, status: true })
  .extend({
    config: dataSourceConfigSchema,
  });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;

export type DataSource = typeof dataSources.$inferSelect;
export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;