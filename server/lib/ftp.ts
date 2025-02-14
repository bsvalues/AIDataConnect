import { Client } from "basic-ftp";
import { FtpSrv } from "ftp-srv";
import { storage } from "../storage";
import type { File } from "@shared/schema";
import path from "path";
import fs from "fs/promises";

// FTP Server configuration
const ftpServer = new FtpSrv({
  url: "ftp://0.0.0.0:2121", // Change port to avoid conflict with other services
  anonymous: false,
  greeting: ["Welcome to RAG Drive FTP Server"],
  pasv_url: process.env.PASV_URL || "127.0.0.1",
  pasv_min: 1024,
  pasv_max: 2048,
});

// Handle FTP authentication
ftpServer.on("login", async ({ username, password }, resolve, reject) => {
  // TODO: Replace with actual user authentication
  if (username === "admin" && password === "password") {
    const uploadsDir = await ensureUploadsDirectory();
    resolve({ root: uploadsDir });
  } else {
    reject(new Error("Invalid credentials"));
  }
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

// FTP Client for uploading/downloading files
export class FtpClient {
  private client: Client;

  constructor() {
    this.client = new Client();
    this.client.ftp.verbose = true;
  }

  async connect(host: string, port: number, user: string, password: string): Promise<void> {
    try {
      await this.client.access({
        host,
        port,
        user,
        password,
        secure: false // Set to false initially to test basic connectivity
      });
    } catch (error) {
      console.error("FTP connection error:", error);
      throw new Error("Failed to connect to FTP server");
    }
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    try {
      await this.client.uploadFrom(localPath, remotePath);
    } catch (error) {
      console.error("FTP upload error:", error);
      throw new Error("Failed to upload file");
    }
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    try {
      await this.client.downloadTo(localPath, remotePath);
    } catch (error) {
      console.error("FTP download error:", error);
      throw new Error("Failed to download file");
    }
  }

  async disconnect(): Promise<void> {
    this.client.close();
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