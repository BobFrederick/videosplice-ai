# Deployment Guide# Deployment Guide



This guide covers deploying Splice for development and production use.This guide covers deploying Splice for production use and internal testing.



## Quick Start## Deployment Options



### Development Mode### Option 1: Docker Compose (Recommended for Testing)

```bash

# Start all services in development mode**Pros:** Easy, reproducible, isolated  

./start-all.sh**Cons:** Whisper.cpp runs outside Docker (complex GPU passthrough)

```

```bash

This starts Redis, Ollama, Whisper, backend, worker, and frontend on development ports (5001/8080). Press Ctrl+C to stop everything.# 1. Clone repository

git clone https://github.com/BobFrederick/videosplice-ai.git

### Production Modecd videosplice-ai

```bash

# Deploy to production (internal network)# 2. Start services (except Whisper)

./deploy-production.shdocker-compose up -d

```

# 3. Download Ollama model (first time only)

This builds and deploys production services on ports 3000/4000 using PM2. Both dev and prod can run simultaneously.docker exec splice-ollama ollama pull qwen2.5:7b



---# 4. Start Whisper separately (on host)

node whisper-server.mjs

## Development vs Production

# 5. Access Splice

| Environment | Frontend | Backend | Process Manager | Use Case |# Open http://your-server-ip:5001

|-------------|----------|---------|----------------|----------|```

| **Development** | :5001 | :8080 | Manual (foreground) | Local coding/testing |

| **Production** | :3000 | :4000 | PM2 (background) | Internal network deployment |**For internal network access:**

```bash

Both environments share the same Redis, Ollama, and Whisper services.# Update docker-compose.yml ports to bind to all interfaces

# Change "5001:80" to "0.0.0.0:5001:80"

---```



## Production Deployment### Option 2: PM2 Process Manager (Production)



### Architecture**Pros:** Production-ready, auto-restart, logging  

**Cons:** Requires manual service setup

Production runs **4 PM2 processes**:

#### Quick Start with start-all.sh

1. **splice-prod-backend** (port 4000) - REST API + WebSocket server

2. **splice-prod-frontend** (port 3000) - Static React appThe easiest way to get started:

3. **splice-prod-worker** - Video processing (CRITICAL - without this, jobs never complete)

4. **splice-prod-whisper** (port 8000) - Whisper transcription service```bash

# 1. Clone and setup

### Prerequisitesgit clone https://github.com/BobFrederick/videosplice-ai.git

cd videosplice-ai

```bash./setup.sh

# Install dependencies

sudo apt install redis-server ffmpeg# 2. Start all services

./start-all.sh

# Install Ollama```

curl -fsSL https://ollama.ai/install.sh | sh

This will automatically start Redis, Ollama, Whisper, backend, and frontend. However, these processes will stop when you close the terminal.

# Download LLM model

ollama pull qwen2.5:7b#### Production Setup with PM2



# Clone and build Whisper.cppFor production deployment that persists across terminal sessions and system reboots:

git clone https://github.com/ggerganov/whisper.cpp

cd whisper.cpp```bash

make# 1. Install PM2 globally

bash ./models/download-ggml-model.sh base.ennpm install -g pm2

```

# 2. Clone and setup

### Deploygit clone https://github.com/BobFrederick/videosplice-ai.git

cd videosplice-ai

```bash./setup.sh

# Clone repository

git clone https://github.com/BobFrederick/videosplice-ai.git# 3. Build frontend

cd videosplice-ainpm run build



# Run deployment script# 4. Build backend

./deploy-production.shcd server && npm run build && cd ..

``````



**Access**: `http://YOUR_SERVER_IP:3000` (internal network only)#### Start Services



### Manual Deployment```bash

# Start Redis

If you need to deploy manually:sudo systemctl start redis



```bash# Start Ollama

# Build frontend and backendpm2 start "ollama serve" --name ollama

npm run build

cd server && npm run build && cd ..# Pull the model (first time only)

ollama pull qwen2.5:7b

# Start all services

npx pm2 start ecosystem.config.cjs --only splice-prod-backend# Start Whisper

npx pm2 start ecosystem.config.cjs --only splice-prod-whisperpm2 start whisper-server.mjs --name whisper

npx pm2 start ecosystem.config.cjs --only splice-prod-worker

npx pm2 start ecosystem.config.cjs --only splice-prod-frontend# Start Backend

pm2 start server/dist/server/src/app.js --name splice-backend

# Save configuration

npx pm2 save# Start Worker (CRITICAL - processes video jobs)

```pm2 start server/dist/server/src/workers/videoProcessor.js --name splice-worker



### Environment Configuration# Start Frontend (with serve)

npm install -g serve

**Backend** (`ecosystem.config.cjs`):pm2 start "serve -s dist -l 5001" --name splice-frontend

- `NODE_ENV=production`

- `PORT=4000`# Save PM2 process list

- `WS_PORT=4001`pm2 save

- `WHISPER_API_URL=http://localhost:8000`

- `OLLAMA_API_URL=http://localhost:11434`# Setup PM2 to start on boot

pm2 startup

**Frontend** (`.env.production`):# Follow the command it gives you

- `VITE_API_URL=http://YOUR_SERVER_IP:4000/api````

- `VITE_WS_URL=ws://YOUR_SERVER_IP:4001`

#### PM2 Management

Replace `YOUR_SERVER_IP` with your actual internal IP (e.g., `10.10.20.38`).

```bash

---# View status

pm2 status

## Management Commands

# View logs

### PM2 Operationspm2 logs



```bash# Restart all

# View statuspm2 restart all

npx pm2 status

# Stop all

# View logs (all services)pm2 stop all

npx pm2 logs

# Monitor

# View specific service logspm2 monit

npx pm2 logs splice-prod-worker```

npx pm2 logs splice-prod-backend

### Option 3: Nginx Reverse Proxy (Multi-User Production)

# Restart all production services

npx pm2 restart splice-prod-backend splice-prod-whisper splice-prod-worker splice-prod-frontendFor serving multiple users on your network with proper SSL and domain.



# Stop production (keeps dev running)#### Prerequisites

npx pm2 stop splice-prod-backend splice-prod-whisper splice-prod-worker splice-prod-frontend

```bash

# Real-time monitoring# Install Nginx

npx pm2 monitsudo apt install nginx

```

# Install Certbot (for SSL)

### Auto-Start on Rebootsudo apt install certbot python3-certbot-nginx

```

```bash

# Generate startup script#### Nginx Configuration

npx pm2 startup

Create `/etc/nginx/sites-available/splice`:

# Follow the sudo command it provides

```nginx

# Save current process list# HTTP -> HTTPS redirect

npx pm2 saveserver {

```    listen 80;

    server_name splice.yourcompany.local;

---    return 301 https://$server_name$request_uri;

}

## Troubleshooting

# HTTPS server

### Jobs Not Processingserver {

    listen 443 ssl http2;

**Symptom**: Videos upload but never complete    server_name splice.yourcompany.local;



**Cause**: Worker not running    # SSL certificates (use certbot or self-signed for internal)

    ssl_certificate /etc/ssl/certs/splice.crt;

**Fix**:    ssl_certificate_key /etc/ssl/private/splice.key;

```bash

# Check if worker is running    # SSL configuration

npx pm2 status | grep worker    ssl_protocols TLSv1.2 TLSv1.3;

    ssl_ciphers HIGH:!aNULL:!MD5;

# Start worker if missing    ssl_prefer_server_ciphers on;

npx pm2 start ecosystem.config.cjs --only splice-prod-worker

```    # Frontend

    location / {

### Re-Generate Segments Stuck        proxy_pass http://localhost:5001;

        proxy_http_version 1.1;

**Symptom**: "Re-Generate Segments" button hangs        proxy_set_header Upgrade $http_upgrade;

        proxy_set_header Connection 'upgrade';

**Cause**: Ollama not running        proxy_set_header Host $host;

        proxy_cache_bypass $http_upgrade;

**Fix**:        proxy_set_header X-Real-IP $remote_addr;

```bash        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

# Check Ollama        proxy_set_header X-Forwarded-Proto $scheme;

curl http://localhost:11434/api/tags    }



# Start if not running    # Backend API

sudo systemctl start ollama    location /api {

        proxy_pass http://localhost:8080;

# Enable auto-start on boot        proxy_http_version 1.1;

sudo systemctl enable ollama        proxy_set_header Host $host;

```        proxy_set_header X-Real-IP $remote_addr;

        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

### Can't Access from Other Machines        proxy_set_header X-Forwarded-Proto $scheme;

        

**Symptom**: Works locally but not from other computers        # Increase timeouts for video processing

        proxy_read_timeout 300s;

**Cause**: Firewall blocking ports        proxy_connect_timeout 300s;

        proxy_send_timeout 300s;

**Fix**:        

```bash        # Increase max body size for video uploads

# Check firewall        client_max_body_size 500M;

sudo firewall-cmd --list-ports    }



# Open required ports    # WebSocket

sudo firewall-cmd --permanent --add-port=3000/tcp    location /ws {

sudo firewall-cmd --permanent --add-port=4000/tcp        proxy_pass http://localhost:8081;

sudo firewall-cmd --permanent --add-port=4001/tcp        proxy_http_version 1.1;

sudo firewall-cmd --reload        proxy_set_header Upgrade $http_upgrade;

        proxy_set_header Connection "Upgrade";

# Or using ufw        proxy_set_header Host $host;

sudo ufw allow from 192.168.0.0/16 to any port 3000    }

sudo ufw allow from 192.168.0.0/16 to any port 4000

sudo ufw allow from 192.168.0.0/16 to any port 4001    # Security headers

```    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    add_header X-Frame-Options "SAMEORIGIN" always;

### Check Queue Status    add_header X-Content-Type-Options "nosniff" always;

    add_header X-XSS-Protection "1; mode=block" always;

```bash}

# API stats```

curl http://localhost:4000/api/stats

Enable the site:

# Redis queue inspection

redis-cli ZRANGE "bull:video-processing:prioritized" 0 -1```bash

```# Create symlink

sudo ln -s /etc/nginx/sites-available/splice /etc/nginx/sites-enabled/

---

# Test configuration

## Deployment Scriptssudo nginx -t



### `start-all.sh` - Development# Reload Nginx

sudo systemctl reload nginx

- **Purpose**: Local development with live logs```

- **Ports**: 5001 (frontend), 8080 (backend)

- **Process Manager**: Foreground (Ctrl+C stops all)#### Self-Signed SSL for Internal Network

- **Services**: Redis, Whisper, Ollama, backend, worker, frontend

- **When**: Coding and testing locally```bash

# Generate self-signed certificate (valid for 1 year)

### `deploy-production.sh` - Productionsudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \

    -keyout /etc/ssl/private/splice.key \

- **Purpose**: Internal network deployment    -out /etc/ssl/certs/splice.crt \

- **Ports**: 3000 (frontend), 4000 (backend)    -subj "/C=US/ST=State/L=City/O=Company/CN=splice.yourcompany.local"

- **Process Manager**: PM2 (background daemon)

- **Services**: 4 PM2 processes (backend, frontend, whisper, worker)# Set permissions

- **When**: Deploying for team testingsudo chmod 600 /etc/ssl/private/splice.key

sudo chmod 644 /etc/ssl/certs/splice.crt

### `deploy.sh` - Deprecated```



⚠️ **Don't use this** - outdated version without worker process.Users will need to accept the self-signed certificate in their browser.



---## Internal Testing Deployment



## Architecture NotesFor testing with internal users while you continue development:



### Why Separate Worker?### Quick Development Setup



The **backend** manages the API and queue, but the **worker** processes videos. This separation allows:For local testing without PM2:

- Independent scaling

- Isolation of heavy CPU/memory usage```bash

- Potential to run workers on separate machines# Start all services (Redis, Ollama, Whisper, Backend, Frontend)

./start-all.sh

### Job Processing Flow

# Services will be accessible at:

1. User uploads video → Backend receives it# Frontend: http://localhost:5001

2. Backend creates job in BullMQ queue# Backend API: http://localhost:8080

3. Worker picks up job from Redis queue# WebSocket: ws://localhost:8081

4. Worker calls Whisper for transcription```

5. Worker calls Ollama for AI analysis

6. Worker marks job complete**Note:** This runs in development mode. Services will stop when you close the terminal or press Ctrl+C.

7. Backend sends WebSocket update to frontend

### Development/Staging Setup with PM2

---

For persistent testing environment:

## Logs

```bash

Production logs are in `./logs/`:# 1. Create a staging branch

- `prod-backend-out.log` - API server logsgit checkout -b staging

- `prod-worker-out.log` - Video processing logs

- `prod-whisper-out.log` - Whisper service logs# 2. Deploy staging on a different port

- `prod-frontend-out.log` - Frontend server logs# Update vite.config.ts to use port 5002

# Update server/src/app.ts to use ports 8082/8083

```bash

# View real-time logs# 3. Run staging with PM2

tail -f logs/prod-worker-out.logpm2 start server/dist/app.js --name splice-staging -- --port 8082

pm2 start "serve -s dist -l 5002" --name splice-frontend-staging

# Or use PM2

npx pm2 logs splice-prod-worker --lines 100# 4. Access via:

```# Development: http://your-server:5001 (your active work)

# Staging: http://your-server:5002 (for internal testers)

---```



## Advanced: Nginx Reverse Proxy### Hot Deployment Strategy



For production deployment with SSL and custom domain:```bash

# On your development machine

### Install Nginxgit add .

git commit -m "feat: new feature"

```bashgit push origin staging

sudo apt install nginx certbot python3-certbot-nginx

```# On server (automate this with a webhook or cron)

cd /path/to/splice

### Configuregit pull origin staging

npm install

Create `/etc/nginx/sites-available/splice`:npm run build

cd server && npm install && npm run build && cd ..

```nginxpm2 restart splice-staging

server {```

    listen 80;

    server_name splice.yourcompany.local;### Update Script for Testers

    return 301 https://$server_name$request_uri;

}Create `update-staging.sh`:



server {```bash

    listen 443 ssl http2;#!/bin/bash

    server_name splice.yourcompany.local;cd /path/to/videosplice-ai

git pull origin staging

    ssl_certificate /etc/ssl/certs/splice.crt;npm install && npm run build

    ssl_certificate_key /etc/ssl/private/splice.key;cd server && npm install && npm run build && cd ..

pm2 restart splice-staging

    # Frontendecho "Staging updated to latest version"

    location / {```

        proxy_pass http://localhost:3000;

        proxy_set_header Host $host;## Performance Tuning

        proxy_set_header X-Real-IP $remote_addr;

    }### For Multiple Concurrent Users



    # Backend APIUpdate `server/src/workers/videoProcessor.ts`:

    location /api {

        proxy_pass http://localhost:4000;```typescript

        client_max_body_size 500M;// Increase concurrency (if you have multiple GPUs or want CPU processing)

        proxy_read_timeout 300s;concurrency: 2, // or 3, 4 depending on your GPU memory

    }```



    # WebSocket### Redis Persistence

    location /ws {

        proxy_pass http://localhost:4001;Edit `/etc/redis/redis.conf`:

        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;```

        proxy_set_header Connection "Upgrade";# Enable append-only file for durability

    }appendonly yes

}appendfilename "splice.aof"

```

# Save snapshots

Enable:save 900 1

```bashsave 300 10

sudo ln -s /etc/nginx/sites-available/splice /etc/nginx/sites-enabled/save 60 10000

sudo nginx -t```

sudo systemctl reload nginx

```### Nginx Caching (Optional)



---Add to your nginx config:



## Multi-User Considerations```nginx

# Cache static assets

⚠️ Splice is designed as an internal tool where all users share:location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf)$ {

- The same job queue (everyone sees all jobs)    expires 1y;

- The same Redis instance    add_header Cache-Control "public, immutable";

- Sequential processing (one video at a time to protect GPU)}

```

For user isolation, deploy separate instances per user/team.

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
