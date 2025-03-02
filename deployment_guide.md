# Ultimate AI-Powered RAG Drive FTP Hub - Deployment Guide

## Deployment Prerequisites

Before deploying the application, ensure you have:

1. Node.js 20+ installed
2. PostgreSQL database available
3. Access to required API keys:
   - OpenAI API key for AI functionality
   - (Optional) Slack API credentials for notifications

## Build Process

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the application:
   ```bash
   npm run build
   ```
   This will:
   - Build the React frontend using Vite
   - Compile the TypeScript backend using esbuild
   - Output all files to the `dist` directory

## Database Setup

1. Ensure your PostgreSQL connection is configured through the `DATABASE_URL` environment variable
2. Run migrations using:
   ```bash
   npm run db:push
   ```

## Environment Variables

Configure the following environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| OPENAI_API_KEY | OpenAI API key for AI features | Yes |
| PORT | Server port (default: 5000) | No |
| NODE_ENV | Environment (development/production) | No |
| SLACK_TOKEN | Slack API token for notifications | No |
| SLACK_CHANNEL | Slack channel for notifications | No |

## Starting the Application

In production mode:

```bash
npm run start
```

This will run the optimized production build from the `dist` directory.

## Health Monitoring

The application includes:

1. Winston-based logging to `logs/combined.log` and `logs/error.log`
2. Optional Slack notification integration for critical errors
3. API endpoint for health checks: `/api/health`

## Performance Considerations

1. The application is optimized for high throughput with data processing pipelines
2. Memory usage scales with the size of processed documents and active connections
3. For production deployments with high user loads, consider:
   - Increasing Node.js heap memory if needed
   - Implementing a caching layer
   - Using a load balancer for horizontal scaling

## Deployment Verification

After deployment, verify:

1. User authentication works correctly
2. File uploads and processing complete successfully
3. Data sources connect properly
4. Pipeline operations function as expected
5. AI-powered features respond within acceptable latency

## Rollback Procedure

If issues are encountered:
1. Restore the previous version from your version control system
2. Revert to the previous database schema if schema changes were made
3. Deploy the previous version following the steps above

## Security Considerations

1. All API endpoints are protected by authentication
2. File uploads are validated for size and type
3. SQL injection prevention through parameterized queries
4. Regular security updates should be applied to dependencies

## Troubleshooting

Common issues:
- Database connection failures: Check the DATABASE_URL and database server status
- OpenAI API errors: Verify API key and quota
- Performance issues: Check server resources and connection pool settings