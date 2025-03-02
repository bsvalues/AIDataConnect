# RAG Drive FTP Hub Deployment Guide

This comprehensive guide provides step-by-step instructions for deploying the RAG Drive FTP Hub application to various environments.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Environment Setup](#environment-setup)
3. [Configuration](#configuration)
4. [Database Setup](#database-setup)
5. [Standard Deployment](#standard-deployment)
6. [Docker Deployment](#docker-deployment)
7. [Scaling Considerations](#scaling-considerations)
8. [Monitoring and Maintenance](#monitoring-and-maintenance)
9. [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements

- **CPU:** 2 cores
- **RAM:** 4GB
- **Storage:** 20GB SSD
- **Operating System:** Ubuntu 20.04 LTS or later, Debian 11 or later
- **Node.js:** v20.x or later
- **PostgreSQL:** v15.x or later

### Recommended for Production

- **CPU:** 4+ cores
- **RAM:** 8GB+
- **Storage:** 50GB+ SSD
- **Operating System:** Ubuntu 22.04 LTS
- **Node.js:** v20.x LTS
- **PostgreSQL:** v16.x
- **Docker:** Latest stable version
- **Docker Compose:** Latest stable version

## Environment Setup

### Required Software

1. **Node.js and npm:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **PostgreSQL:**
   ```bash
   sudo apt-get install postgresql postgresql-contrib
   ```

3. **Docker and Docker Compose (Optional for containerized deployment):**
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # Install Docker Compose
   sudo apt-get install docker-compose-plugin
   ```

4. **Git:**
   ```bash
   sudo apt-get install git
   ```

### Obtaining the Application

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/ragdrive-ftp-hub.git
   cd ragdrive-ftp-hub
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Database
DATABASE_URL=postgres://username:password@localhost:5432/ragdrive

# Server
PORT=5000
NODE_ENV=production
SESSION_SECRET=your-secure-session-secret

# OpenAI API (for AI features)
OPENAI_API_KEY=your-openai-api-key

# Optional: Slack notifications
SLACK_WEBHOOK_URL=your-slack-webhook-url
```

### SSL Certificates (for Production)

For secure FTP connections, generate or obtain SSL certificates:

```bash
# Create directory for certificates
mkdir -p ./certs

# Generate self-signed certificates (for testing only)
openssl req -x509 -newkey rsa:4096 -keyout ./certs/ftp-private.key -out ./certs/ftp-cert.pem -days 365 -nodes
```

For production, replace with proper certificates from a trusted certificate authority.

## Database Setup

### Creating the Database

1. **Log in to PostgreSQL:**
   ```bash
   sudo -u postgres psql
   ```

2. **Create database and user:**
   ```sql
   CREATE USER ragdrive WITH PASSWORD 'secure-password';
   CREATE DATABASE ragdrive OWNER ragdrive;
   \q
   ```

3. **Update the DATABASE_URL in your .env file:**
   ```
   DATABASE_URL=postgres://ragdrive:secure-password@localhost:5432/ragdrive
   ```

### Initializing the Schema

1. **Push the schema to the database:**
   ```bash
   npm run db:push
   ```

## Standard Deployment

### For Development/Testing

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Start the application:**
   ```bash
   npm run dev
   ```

### For Production

1. **Use our automated deployment script:**
   ```bash
   ./scripts/deploy.sh
   ```

   This script will:
   - Run the deployment readiness check
   - Backup the database
   - Build the application
   - Restart the server
   - Verify the deployment

2. **Alternative: Manual deployment:**
   ```bash
   # Run deployment readiness check
   ./scripts/deployment-readiness.sh
   
   # Backup the database
   ./scripts/db-backup.sh pre_deploy
   
   # Build the application
   npm run build
   
   # Start the server
   npm run start
   ```

### Setting Up as a System Service

For long-running production deployments, set up as a systemd service:

1. **Create service file:**
   ```bash
   sudo nano /etc/systemd/system/ragdrive.service
   ```

2. **Add service configuration:**
   ```
   [Unit]
   Description=RAG Drive FTP Hub
   After=network.target postgresql.service
   
   [Service]
   Type=simple
   User=yourusername
   WorkingDirectory=/path/to/ragdrive-ftp-hub
   ExecStart=/usr/bin/npm run start
   Restart=on-failure
   Environment=NODE_ENV=production
   
   [Install]
   WantedBy=multi-user.target
   ```

3. **Enable and start the service:**
   ```bash
   sudo systemctl enable ragdrive
   sudo systemctl start ragdrive
   ```

## Docker Deployment

### Using Docker Compose

1. **Build and start containers:**
   ```bash
   docker-compose up -d
   ```

2. **Alternative: Use our deployment script:**
   ```bash
   ./scripts/deploy.sh
   ```

### Manual Container Management

1. **Build the Docker image:**
   ```bash
   docker build -t ragdrive-app .
   ```

2. **Run the container:**
   ```bash
   docker run -d --name ragdrive \
     -p 5000:5000 -p 21:21 \
     --env-file .env \
     --restart unless-stopped \
     ragdrive-app
   ```

## Scaling Considerations

### Horizontal Scaling

For handling increased load:

1. **Use a load balancer** (like Nginx or HAProxy) in front of multiple application instances
2. **Set up database replication** for read scalability
3. **Use Redis** for session storage and caching

Example Nginx configuration for load balancing:

```nginx
upstream ragdrive {
    server app1.example.com:5000;
    server app2.example.com:5000;
    server app3.example.com:5000;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://ragdrive;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Vertical Scaling

Increase resources on the existing server:

1. **Upgrade CPU and RAM** on the host machine
2. **Optimize PostgreSQL** configuration for larger memory footprint
3. **Increase Node.js memory limits** with `--max-old-space-size` flag

## Monitoring and Maintenance

### Regular Maintenance Tasks

1. **Database backups:**
   ```bash
   # Create a daily backup (consider setting up as a cron job)
   ./scripts/db-backup.sh daily_backup
   ```

2. **Log rotation:**
   ```bash
   # Install logrotate if not already present
   sudo apt-get install logrotate
   
   # Create logrotate configuration
   sudo nano /etc/logrotate.d/ragdrive
   ```
   
   Add configuration:
   ```
   /path/to/ragdrive-ftp-hub/logs/*.log {
       daily
       rotate 14
       compress
       delaycompress
       missingok
       notifempty
       create 0640 yourusername yourusername
   }
   ```

3. **System updates:**
   ```bash
   sudo apt update
   sudo apt upgrade
   ```

### Monitoring

1. **Application logs:**
   ```bash
   # View recent logs
   tail -f ./logs/combined.log
   
   # View error logs
   tail -f ./logs/error.log
   ```

2. **Server status:**
   ```bash
   # For systemd service
   sudo systemctl status ragdrive
   
   # For Docker
   docker ps | grep ragdrive
   docker logs ragdrive
   ```

3. **Database health:**
   ```bash
   # Connect to database
   psql $DATABASE_URL
   
   # Run basic health check
   SELECT version();
   SELECT count(*) FROM users;
   ```

## Troubleshooting

### Common Issues

#### Database Connection Problems

**Symptoms:** Application fails to start with database connection errors

**Solutions:**
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check DATABASE_URL environment variable
- Ensure the database user has proper permissions
- Test connection manually: `psql $DATABASE_URL`

#### Application Crashes

**Symptoms:** Application stops unexpectedly or fails to start

**Solutions:**
- Check application logs in `./logs/error.log`
- Ensure all required environment variables are set
- Verify Node.js version compatibility
- Check for port conflicts: `sudo lsof -i:5000`

#### FTP Connection Issues

**Symptoms:** Unable to connect via FTP client

**Solutions:**
- Verify port 21 is open in firewall: `sudo ufw status`
- Check SSL certificates are correctly configured
- Ensure FTP service is running (check logs)
- Test with a basic FTP client: `ftp localhost 21`

### Getting Help

If you encounter persistent issues:

1. Check the [deployment checklist](./deployment_checklist.md)
2. Review the application logs
3. Contact the development team with:
   - Error logs
   - Environment details (OS, Node.js version, etc.)
   - Steps to reproduce the issue

---

This guide is maintained as part of the RAG Drive FTP Hub project. For the latest updates, refer to the project repository.

*Last updated: March 2, 2025*