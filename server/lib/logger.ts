import winston from 'winston';
import { Request, Response } from 'express';

// Custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Custom log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata(),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`
        ),
      ),
    }),
  ],
});

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: Function) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.http({
      message: `${req.method} ${req.url}`,
      metadata: {
        method: req.method,
        url: req.originalUrl || req.url,
        status: res.statusCode,
        duration,
        userAgent: req.get('user-agent'),
        ip: req.ip,
        userId: (req as any).user?.id,
      },
    });
  });

  next();
};

// Error logging middleware
export const errorLogger = (err: Error, req: Request, res: Response, next: Function) => {
  logger.error({
    message: err.message,
    metadata: {
      stack: err.stack,
      method: req.method,
      url: req.originalUrl || req.url,
      body: req.body,
      userId: (req as any).user?.id,
    },
  });

  next(err);
};

// Create logger instance with context
export const createContextLogger = (context: string) => {
  return {
    error: (message: string, meta: any = {}) => 
      logger.error({ message, metadata: { ...meta, context } }),
    warn: (message: string, meta: any = {}) => 
      logger.warn({ message, metadata: { ...meta, context } }),
    info: (message: string, meta: any = {}) => 
      logger.info({ message, metadata: { ...meta, context } }),
    http: (message: string, meta: any = {}) => 
      logger.http({ message, metadata: { ...meta, context } }),
    debug: (message: string, meta: any = {}) => 
      logger.debug({ message, metadata: { ...meta, context } }),
  };
};

export default logger;
