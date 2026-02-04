# Railway Deployment Guide for ExtensionShield

## Overview
This guide covers deploying ExtensionShield to Railway with proper file storage configuration for extension icons and analysis results.

## Prerequisites
- Railway account
- GitHub repository connected to Railway
- Required API keys (OpenAI, VirusTotal, etc.)

## Environment Variables

Set these in the Railway dashboard under **Variables**:

### Required Variables
```bash
# LLM Provider Configuration
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here

# Optional: VirusTotal for malware scanning
VIRUSTOTAL_API_KEY=your_virustotal_api_key_here

# Storage Configuration (already set in Dockerfile, but can be overridden)
EXTENSION_STORAGE_PATH=/app/extensions_storage

# Database path (already set in Dockerfile)
DATABASE_PATH=/app/data/extension-shield.db
```

### Optional Variables
```bash
# OpenRouter (alternative LLM provider)
OPENROUTER_API_KEY=your_openrouter_key_here

# Other LLM providers
ANTHROPIC_API_KEY=your_anthropic_key_here
TOGETHER_API_KEY=your_together_key_here
```

## Storage Configuration

### How It Works
1. **Extension Storage**: All uploaded extensions and their extracted files are stored in `/app/extensions_storage`
2. **Icons**: Extension icons are served from `{extracted_folder}/icons/{size}.png`
3. **Database**: SQLite database is stored in `/app/data/extension-shield.db`

### Important Notes
- Railway uses **ephemeral storage** by default
- Files in `/app/extensions_storage` will be deleted when the service restarts
- For persistent storage, consider:
  - Railway Volumes (when available)
  - External storage (S3, Cloudinary, etc.)
  - Database storage for critical data

### Persistent Storage Options

#### Option 1: Railway Volumes (Recommended when available)
```toml
# Add to railway.toml
[volumes]
extensions_storage = "/app/extensions_storage"
data = "/app/data"
```

#### Option 2: External Object Storage (Production)
Configure S3-compatible storage:
```bash
# Add these environment variables
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
```

Then update the code to use S3 for icon storage.

## Deployment Steps

### 1. Connect Repository
```bash
# In Railway dashboard:
1. New Project → Deploy from GitHub
2. Select ExtensionShield repository
3. Railway will auto-detect Dockerfile
```

### 2. Configure Environment Variables
```bash
# Set in Railway Variables tab:
- OPENAI_API_KEY
- VIRUSTOTAL_API_KEY (optional)
- LLM_PROVIDER=openai
```

### 3. Deploy
```bash
# Railway will automatically:
1. Build the Docker image
2. Run the frontend build (React + Vite)
3. Install Python dependencies
4. Start the FastAPI server
```

### 4. Verify Deployment
```bash
# Check health endpoint:
curl https://your-app.railway.app/health

# Expected response:
{
  "status": "healthy",
  "service": "project-atlas",
  "version": "1.0.0",
  "storage_path": "/app/extensions_storage",
  "storage_exists": true
}
```

## Icon Serving Architecture

### Local Development
```
extensions_storage/
  ├── extracted_abc123.crx_12345/
  │   ├── icons/
  │   │   ├── 16.png
  │   │   ├── 32.png
  │   │   ├── 64.png
  │   │   └── 128.png
  │   └── manifest.json
  └── abc123_results.json
```

### Railway Deployment
```
/app/extensions_storage/
  ├── extracted_abc123.crx_12345/
  │   ├── icons/
  │   │   └── 128.png  ← Served via /api/scan/icon/abc123
  └── abc123_results.json
```

### API Endpoint
```bash
GET /api/scan/icon/{extension_id}

# Returns:
- 200 OK with PNG image (if found)
- 404 Not Found (triggers fallback to placeholder SVG in frontend)

# Caching:
Cache-Control: public, max-age=86400 (24 hours)
```

## Troubleshooting

### Icons Not Loading
1. **Check health endpoint** to verify storage path:
   ```bash
   curl https://your-app.railway.app/health
   ```

2. **Check logs** in Railway dashboard for icon path errors

3. **Verify extracted files exist**:
   ```bash
   # In Railway shell (if available):
   ls -la /app/extensions_storage/
   ```

### Storage Full / Out of Memory
- Railway's ephemeral storage is limited
- Clean up old extracted extensions periodically
- Consider implementing automatic cleanup for old scans

### Database Errors
- Ensure `/app/data` directory exists and is writable
- Check `DATABASE_PATH` environment variable
- Verify SQLite is properly initialized

## Performance Optimization

### Caching
- Icons are cached for 24 hours
- Use CDN or edge caching for better performance
- Consider pre-generating thumbnails

### Database
- Regular cleanup of old scan results
- Index optimization for frequently queried fields
- Consider PostgreSQL for production (Railway offers free tier)

## Monitoring

### Health Checks
```bash
# Railway automatically monitors:
GET /health (every 30 seconds)

# Manual check:
curl https://your-app.railway.app/health
```

### Logs
```bash
# View in Railway dashboard:
- Build logs: Check for frontend/backend build errors
- Runtime logs: API requests, icon serving, errors
- Health check logs: Service availability
```

## Security Considerations

1. **API Keys**: Never commit API keys to repository
2. **CORS**: Configure properly for production domain
3. **File Upload**: Validate extension files before extraction
4. **Path Traversal**: Sanitize file paths (already implemented)
5. **Rate Limiting**: Consider adding rate limits for icon endpoints

## Cost Optimization

1. **Start with Hobby Plan**: Free tier includes:
   - 500 hours/month execution time
   - Shared CPU/memory
   - Ephemeral storage

2. **Upgrade when needed**:
   - More concurrent scans → Pro plan
   - Persistent storage → Volumes add-on
   - Custom domain → Free with any plan

## Support

- Railway Docs: https://docs.railway.app
- ExtensionShield Issues: https://github.com/Stanzin7/ExtensionShield/issues
- Railway Discord: https://discord.gg/railway

