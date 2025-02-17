import * as z from "zod";

// FTP Configuration Schema
export const ftpConfigSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.number()
    .min(1, "Port must be between 1 and 65535")
    .max(65535, "Port must be between 1 and 65535"),
  user: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  secure: z.boolean().default(true),
  passive: z.boolean().default(true),
});

// File Upload Schema
export const fileUploadSchema = z.object({
  file: z.instanceof(File, { message: "File is required" })
    .refine((file) => file.size <= 10 * 1024 * 1024, "File size must be less than 10MB")
    .refine(
      (file) => [
        'text/plain',
        'text/csv',
        'application/json',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      ].includes(file.type),
      "Invalid file type"
    ),
  transferType: z.enum(["local", "ftp"]),
  ftpConfig: ftpConfigSchema.optional(),
});

// Search Schema
export const searchSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  filters: z.object({
    fileType: z.array(z.string()).optional(),
    dateRange: z.object({
      from: z.date().optional(),
      to: z.date().optional(),
    }).optional(),
  }).optional(),
});

// Pipeline Node Schema
export const pipelineNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["source", "transform", "filter", "join", "output"]),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.object({
    label: z.string().min(1, "Node label is required"),
    config: z.record(z.any()).optional(),
  }),
});

// Transformation Code Schema
export const transformationCodeSchema = z.object({
  code: z.string().min(1, "Transformation code is required")
    .max(5000, "Transformation code is too long")
    .refine(
      (code) => {
        try {
          // Basic syntax check
          new Function(code);
          return true;
        } catch {
          return false;
        }
      },
      "Invalid JavaScript code"
    ),
});
