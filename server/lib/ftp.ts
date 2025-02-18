import { Client } from "basic-ftp";
import { FtpSrv, FtpServer } from "ftp-srv";
import { storage } from "../storage";
import type { File } from "@shared/schema";
import path from "path";
import fs from "fs/promises";

// FTP Server configuration
const tryPorts = [2121, 2122, 2123, 2124];
let ftpServer: FtpServer;

function createFtpServer(port: number): FtpServer {
  return new FtpSrv({
    url: `ftp://0.0.0.0:${port}`,
    anonymous: false,
    greeting: ["Welcome to RAG Drive FTP Server"],
    pasv_url: process.env.PASV_URL || "127.0.0.1",
    pasv_min: 1024,
    pasv_max: 2048,
    tls: {
      key: process.env.FTP_TLS_KEY || '',
      cert: process.env.FTP_TLS_CERT || ''
    },
    timeout: 30000,
  });
}

// Start FTP server
export async function startFtpServer() {
  try {
    // Check for required environment variables
    if (!process.env.FTP_USER || !process.env.FTP_PASS) {
      throw new Error("FTP_USER and FTP_PASS environment variables are required");
    }

    for (const port of tryPorts) {
      try {
        ftpServer = createFtpServer(port);

        // Handle FTP authentication
        ftpServer.on("login", async ({ username, password }, resolve, reject) => {
          try {
            if (username === process.env.FTP_USER && password === process.env.FTP_PASS) {
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

        await ftpServer.listen();
        console.log(`FTP Server is running on port ${port}`);
        return;
      } catch (error: any) {
        if (error?.code === 'EADDRINUSE') {
          if (port === tryPorts[tryPorts.length - 1]) {
            console.warn("All FTP ports in use, skipping FTP server startup");
            return;
          }
          continue;
        }
        console.error("Error starting FTP server:", error);
        throw error;
      }
    }
  } catch (error) {
    console.error("Failed to start FTP server:", error);
    throw error;
  }
}

// Enhanced FTP Client for uploading/downloading files
export class FtpClient {
  private client: Client;

  constructor() {
    this.client = new Client();
    this.client.ftp.verbose = true;
  }

  async connect(host: string, port: number, user: string, password: string, secure = true): Promise<void> {
    try {
      const config = {
        host,
        port,
        user,
        password,
        secure,
        secureOptions: secure ? {
          rejectUnauthorized: process.env.NODE_ENV === 'production'
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
      await fs.access(localPath);
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
      await fs.access(localPath);
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
  const uploadsDir = path.resolve("./uploads");
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}