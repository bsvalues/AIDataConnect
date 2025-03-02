import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { startFtpServer } from "./lib/ftp";
import logger, { requestLogger, errorLogger } from "./lib/logger";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add request logging middleware
app.use(requestLogger);

// Add error logging middleware
app.use(errorLogger);

(async () => {
  try {
    // Start FTP server first
    logger.info("Starting FTP server...");
    await startFtpServer();
    logger.info("FTP server started successfully on port 2121");

    // Setup Vite or static serving BEFORE API routes in development
    // This ensures Vite serves the client properly but API routes still work
    const server = createServer(app);
    
    if (app.get("env") === "development") {
      logger.info("Setting up Vite middleware...");
      await setupVite(app, server);
      logger.info("Vite middleware setup complete");
    } else {
      serveStatic(app);
    }
    
    // Register API routes after Vite in development
    logger.info("Registering Express routes...");
    await registerRoutes(app, server);
    logger.info("Express routes registered successfully");

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      logger.error("Server error", {
        status,
        message,
        stack: err.stack,
        code: err.code,
      });

      res.status(status).json({ 
        message,
        ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
      });
    });

    // Use port 5000 to match workflow expectations
    const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;

    server.listen(PORT)
      .on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          logger.warn(`Port ${PORT} is in use, trying ${PORT + 1}...`);
          server.listen(PORT + 1);
        } else {
          logger.error("Server startup error", { 
            error: error.message,
            stack: error.stack,
            code: error.code
          });
          process.exit(1);
        }
      })
      .on('listening', () => {
        const addr = server.address();
        const actualPort = typeof addr === 'object' ? addr?.port : PORT;
        logger.info(`Web server started successfully on http://0.0.0.0:${actualPort}`);
      });
  } catch (error: any) {
    logger.error("Server startup error", { 
      error: error.message,
      stack: error.stack,
      code: error.code
    });
    process.exit(1);
  }
})();