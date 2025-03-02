FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-slim AS production

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy necessary files for runtime
COPY .env.example ./.env.example

# Create uploads directory
RUN mkdir -p uploads && chmod 755 uploads

# Create logs directory
RUN mkdir -p logs && chmod 755 logs

# Expose port
EXPOSE 5000

# Start the application
CMD ["node", "dist/index.js"]