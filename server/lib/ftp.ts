import { Client } from "basic-ftp";
import { FtpSrv, FtpServer } from "ftp-srv";
import { storage } from "../storage-manager";
import type { File } from "@shared/schema";
import path from "path";
import fs from "fs/promises";

// FTP Server configuration
const tryPorts = [2121, 2122, 2123, 2124];
let ftpServer: FtpServer;

function createFtpServer(port: number): FtpServer {
  console.log("Creating FTP server with configuration...");
  return new FtpSrv({
    url: `ftp://0.0.0.0:${port}`,
    anonymous: false,
    greeting: ["Welcome to RAG Drive FTP Server"],
    pasv_url: process.env.PASV_URL || "127.0.0.1",
    pasv_min: 1024,
    pasv_max: 2048,
    timeout: 30000,
  });
}

// Start FTP server
export async function startFtpServer(): Promise<FtpServer | null> {
  // Check if FTP server is disabled
  if (process.env.ENABLE_FTP_SERVER === 'false') {
    console.log("FTP server is disabled by configuration");
    return null;
  }

  try {
    // Check for required environment variables
    console.log("Checking FTP environment variables...");
    
    // Set default FTP credentials if not provided
    const ftpUser = process.env.FTP_USER || 'ftpuser';
    const ftpPass = process.env.FTP_PASS || process.env.FTP_PASSWORD || 'password';

    // Set to environment for future use
    process.env.FTP_USER = ftpUser;
    process.env.FTP_PASS = ftpPass;
    
    console.log(`Using FTP credentials: user=${ftpUser}`);

    for (const port of tryPorts) {
      try {
        console.log(`Attempting to start FTP server on port ${port}...`);
        ftpServer = createFtpServer(port);

        // Handle FTP authentication
        ftpServer.on("login", async ({ username, password }, resolve, reject) => {
          try {
            console.log(`Login attempt for user: ${username}`);
            
            if (username === ftpUser && password === ftpPass) {
              const uploadsDir = await ensureUploadsDirectory();
              console.log("Login successful, resolving with uploads directory");
              resolve({ root: uploadsDir });
            } else {
              console.log("Invalid credentials provided");
              reject(new Error("Invalid credentials"));
            }
          } catch (error) {
            console.error("FTP login error:", error);
            reject(new Error("Authentication failed"));
          }
        });

        // Handle client errors
        ftpServer.on("client-error", ({ connection, context, error }) => {
          // Just log the error without crashing
          console.error(`FTP client error [${context}]:`, error);
        });
        
        // Add event listeners for connection and disconnection
        ftpServer.on("disconnect", ({ connection, id }) => {
          console.log(`FTP client disconnected: ${id}`);
        });

        try {
          await ftpServer.listen();
          console.log(`FTP Server is running on port ${port}`);
          return ftpServer;
        } catch (listenError: any) {
          console.error(`Error during FTP server listen on port ${port}:`, listenError);
          if (listenError?.code === 'EADDRINUSE') {
            console.log(`Port ${port} is in use, trying next port...`);
            continue;
          }
          throw listenError;
        }
      } catch (error: any) {
        console.error(`FTP server setup error on port ${port}:`, error);
        
        if (error?.code === 'EADDRINUSE') {
          console.log(`Port ${port} is in use, trying next port...`);
          if (port === tryPorts[tryPorts.length - 1]) {
            console.warn("All FTP ports in use, skipping FTP server startup");
            return null;
          }
          continue;
        }
        
        // For other errors, try next port
        if (port === tryPorts[tryPorts.length - 1]) {
          console.warn("Failed to start FTP server on all ports, continuing without FTP");
          return null;
        }
      }
    }
    
    console.warn("No available ports for FTP server, continuing without FTP");
    return null;
  } catch (error) {
    console.error("Failed to start FTP server:", error);
    // Continue without FTP server
    return null;
  }
}

// Helper function to ensure uploads directory exists
export async function ensureUploadsDirectory() {
  const uploadsDir = path.resolve("./uploads");
  try {
    await fs.access(uploadsDir);
    console.log("Uploads directory exists at:", uploadsDir);
  } catch {
    console.log("Creating uploads directory at:", uploadsDir);
    await fs.mkdir(uploadsDir, { recursive: true });
  }
  return uploadsDir;
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