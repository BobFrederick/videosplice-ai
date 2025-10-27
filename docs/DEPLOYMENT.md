# Deployment Guide

This guide covers deploying Splice for production use and internal testing.

## Deployment Options

### Option 1: Docker Compose (Recommended for Testing)

**Pros:** Easy, reproducible, isolated  
**Cons:** Whisper.cpp runs outside Docker (complex GPU passthrough)

```bash
# 1. Clone repository
git clone https://github.com/BobFrederick/videosplice-ai.git
cd videosplice-ai

# 2. Start services (except Whisper)
docker-compose up -d

# 3. Download Ollama model (first time only)
docker exec splice-ollama ollama pull qwen2.5:7b

# 4. Start Whisper separately (on host)
node whisper-server.mjs

# 5. Access Splice
# Open http://your-server-ip:5001
```

**For internal network access:**
```bash
# Update docker-compose.yml ports to bind to all interfaces
# Change "5001:80" to "0.0.0.0:5001:80"
```

### Option 2: PM2 Process Manager (Production)

**Pros:** Production-ready, auto-restart, logging  
**Cons:** Requires manual service setup

#### Quick Start with start-all.sh

The easiest way to get started:

```bash
# 1. Clone and setup
git clone https://github.com/BobFrederick/videosplice-ai.git
cd videosplice-ai
./setup.sh

# 2. Start all services
./start-all.sh
```

This will automatically start Redis, Ollama, Whisper, backend, and frontend. However, these processes will stop when you close the terminal.

#### Production Setup with PM2

For production deployment that persists across terminal sessions and system reboots:

```bash
# 1. Install PM2 globally
npm install -g pm2

# 2. Clone and setup
git clone https://github.com/BobFrederick/videosplice-ai.git
cd videosplice-ai
./setup.sh

# 3. Build frontend
npm run build

# 4. Build backend
cd server && npm run build && cd ..
```

#### Start Services

```bash
# Start Redis
sudo systemctl start redis

# Start Ollama
pm2 start "ollama serve" --name ollama

# Start Whisper
pm2 start whisper-server.mjs --name whisper

# Start Backend
pm2 start server/dist/app.js --name splice-backend

# Start Frontend (with serve)
npm install -g serve
pm2 start "serve -s dist -l 5001" --name splice-frontend

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it gives you
```

#### PM2 Management

```bash
# View status
pm2 status

# View logs
pm2 logs

# Restart all
pm2 restart all

# Stop all
pm2 stop all

# Monitor
pm2 monit
```

### Option 3: Nginx Reverse Proxy (Multi-User Production)

For serving multiple users on your network with proper SSL and domain.

#### Prerequisites

```bash
# Install Nginx
sudo apt install nginx

# Install Certbot (for SSL)
sudo apt install certbot python3-certbot-nginx
```

#### Nginx Configuration

Create `/etc/nginx/sites-available/splice`:

```nginx
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name splice.yourcompany.local;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name splice.yourcompany.local;

    # SSL certificates (use certbot or self-signed for internal)
    ssl_certificate /etc/ssl/certs/splice.crt;
    ssl_certificate_key /etc/ssl/private/splice.key;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Frontend
    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeouts for video processing
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        
        # Increase max body size for video uploads
        client_max_body_size 500M;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

Enable the site:

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/splice /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### Self-Signed SSL for Internal Network

```bash
# Generate self-signed certificate (valid for 1 year)
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/splice.key \
    -out /etc/ssl/certs/splice.crt \
    -subj "/C=US/ST=State/L=City/O=Company/CN=splice.yourcompany.local"

# Set permissions
sudo chmod 600 /etc/ssl/private/splice.key
sudo chmod 644 /etc/ssl/certs/splice.crt
```

Users will need to accept the self-signed certificate in their browser.

## Internal Testing Deployment

For testing with internal users while you continue development:

### Quick Development Setup

For local testing without PM2:

```bash
# Start all services (Redis, Ollama, Whisper, Backend, Frontend)
./start-all.sh

# Services will be accessible at:
# Frontend: http://localhost:5001
# Backend API: http://localhost:8080
# WebSocket: ws://localhost:8081
```

**Note:** This runs in development mode. Services will stop when you close the terminal or press Ctrl+C.

### Development/Staging Setup with PM2

For persistent testing environment:

```bash
# 1. Create a staging branch
git checkout -b staging

# 2. Deploy staging on a different port
# Update vite.config.ts to use port 5002
# Update server/src/app.ts to use ports 8082/8083

# 3. Run staging with PM2
pm2 start server/dist/app.js --name splice-staging -- --port 8082
pm2 start "serve -s dist -l 5002" --name splice-frontend-staging

# 4. Access via:
# Development: http://your-server:5001 (your active work)
# Staging: http://your-server:5002 (for internal testers)
```

### Hot Deployment Strategy

```bash
# On your development machine
git add .
git commit -m "feat: new feature"
git push origin staging

# On server (automate this with a webhook or cron)
cd /path/to/splice
git pull origin staging
npm install
npm run build
cd server && npm install && npm run build && cd ..
pm2 restart splice-staging
```

### Update Script for Testers

Create `update-staging.sh`:

```bash
#!/bin/bash
cd /path/to/videosplice-ai
git pull origin staging
npm install && npm run build
cd server && npm install && npm run build && cd ..
pm2 restart splice-staging
echo "Staging updated to latest version"
```

## Performance Tuning

### For Multiple Concurrent Users

Update `server/src/workers/videoProcessor.ts`:

```typescript
// Increase concurrency (if you have multiple GPUs or want CPU processing)
concurrency: 2, // or 3, 4 depending on your GPU memory
```

### Redis Persistence

Edit `/etc/redis/redis.conf`:

```
# Enable append-only file for durability
appendonly yes
appendfilename "splice.aof"

# Save snapshots
save 900 1
save 300 10
save 60 10000
```

### Nginx Caching (Optional)

Add to your nginx config:

```nginx
# Cache static assets
location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Monitoring

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Web dashboard
pm2 install pm2-server-monit
```

### Log Management

```bash
# View logs
pm2 logs

# Clear logs
pm2 flush

# Rotate logs
pm2 install pm2-logrotate
```

### Health Checks

Create a simple health check endpoint or use:

```bash
# Check if all services are running
curl http://localhost:8080/api/stats
curl http://localhost:3001/api/health
curl http://localhost:11434/api/tags
```

## Backup Strategy

```bash
# Backup Redis data
redis-cli SAVE
cp /var/lib/redis/dump.rdb /backup/splice-redis-$(date +%Y%m%d).rdb

# Backup any uploaded videos (if you keep them)
tar -czf /backup/splice-uploads-$(date +%Y%m%d).tar.gz server/uploads/
```

## Security Checklist for Internal Deployment

- [ ] Change default Redis password
- [ ] Set up firewall rules (only allow internal IPs)
- [ ] Use HTTPS with valid certificates
- [ ] Limit file upload sizes
- [ ] Set up log rotation
- [ ] Regular backups of Redis data
- [ ] Monitor disk usage (uploads directory)
- [ ] Update dependencies regularly (`npm audit`)

## Troubleshooting

### Issue: GPU not being used

```bash
# Check Ollama is using GPU
docker exec splice-ollama nvidia-smi

# Or for host installation
nvidia-smi
```

### Issue: Port already in use

```bash
# Find what's using the port
sudo lsof -i :5001

# Kill the process
kill -9 <PID>
```

### Issue: WebSocket connection failed

Check CORS settings in `server/src/app.ts` - make sure your server IP is allowed.

## Getting Help

- Check logs: `pm2 logs` or `docker-compose logs`
- GitHub Issues: https://github.com/BobFrederick/videosplice-ai/issues
- Documentation: `/docs` folder

---

**Need help?** Open an issue on GitHub with:
- Deployment method used
- Error logs
- System specifications
