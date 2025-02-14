import { Client } from "basic-ftp";
import { FtpSrv } from "ftp-srv";
import { storage } from "../storage";
import type { File } from "@shared/schema";
import path from "path";
import fs from "fs/promises";

// FTP Server configuration
const ftpServer = new FtpSrv({
  url: process.env.FTP_URL || "ftp://0.0.0.0:2121",
  anonymous: false,
  greeting: ["Welcome to RAG Drive FTP Server"],
  pasv_url: process.env.PASV_URL || "127.0.0.1",
  pasv_min: 1024,
  pasv_max: 2048,
  tls: process.env.NODE_ENV === "production" ? {
    key: process.env.FTP_TLS_KEY,
    cert: process.env.FTP_TLS_CERT
  } : undefined,
  timeout: 30000,
});

// Handle FTP authentication
ftpServer.on("login", async ({ username, password }, resolve, reject) => {
  try {
    // TODO: Replace with actual user authentication
    if (username === "admin" && password === "password") {
      const uploadsDir = await ensureUploadsDirectory();
      resolve({ root: uploadsDir });
    } else {
      reject(new Error("Invalid credentials"));
    }
  } catch (error) {
    console.error("FTP login error:", error);
    reject(new Error("Authentication failed"));
  }
});

ftpServer.on("client-error", ({ connection, context, error }) => {
  console.error(`FTP client error [${context}]:`, error);
});

// Start FTP server
export async function startFtpServer() {
  try {
    await ftpServer.listen();
    console.log("FTP Server is running on port 2121");
  } catch (err) {
    console.error("Error starting FTP server:", err);
    throw err;
  }
}

// Enhanced FTP Client for uploading/downloading files
export class FtpClient {
  private client: Client;

  constructor() {
    this.client = new Client();
    this.client.ftp.verbose = true;
  }

  async connect(host: string, port: number, user: string, password: string, secure = false): Promise<void> {
    try {
      const config = {
        host,
        port,
        user,
        password,
        secure,
        secureOptions: secure ? {
          rejectUnauthorized: false // Allow self-signed certificates in development
        } : undefined,
      };

      console.log(`Connecting to FTP server ${host}:${port} (secure: ${secure})`);
      await this.client.access(config);
      console.log("FTP connection established successfully");
    } catch (error: unknown) {
      console.error("FTP connection error:", error);
      throw new Error(`Failed to connect to FTP server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    try {
      console.log(`Uploading file from ${localPath} to ${remotePath}`);
      await this.client.uploadFrom(localPath, remotePath);
      console.log("File uploaded successfully");
    } catch (error: unknown) {
      console.error("FTP upload error:", error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    try {
      console.log(`Downloading file from ${remotePath} to ${localPath}`);
      await this.client.downloadTo(localPath, remotePath);
      console.log("File downloaded successfully");
    } catch (error: unknown) {
      console.error("FTP download error:", error);
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.close();
      console.log("FTP connection closed");
    } catch (error) {
      console.error("Error closing FTP connection:", error);
    }
  }
}

// Helper function to ensure uploads directory exists
export async function ensureUploadsDirectory() {
  const uploadsDir = "./uploads";
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir);
  }
  return uploadsDir;
}