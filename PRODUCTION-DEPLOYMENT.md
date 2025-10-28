# Production Deployment Guide

## Overview
Splice is deployed with **two separate environments**:
- **Development**: Ports 5001 (frontend) / 8080 (backend)  
- **Production**: Ports 3000 (frontend) / 4000 (backend)

Both can run simultaneously on the same server.

## Production Architecture

The production deployment consists of **4 PM2 processes**:

1. **splice-prod-backend** (port 4000)
   - REST API server
   - WebSocket server (port 4001)
   - Manages job queue (BullMQ)

2. **splice-prod-frontend** (port 3000)
   - Static web application
   - Serves the React UI

3. **splice-prod-worker**
   - Processes video jobs from the queue
   - **CRITICAL**: Without this, jobs stay in queue forever
   - Handles video transcription and AI analysis

4. **splice-prod-whisper** (port 8000)
   - Whisper transcription service
   - Called by the worker for audio extraction

## Access URLs

- **Production**: http://10.10.20.38:3000 (Internal network / VPN only)
- **Development**: http://localhost:5001 (Local only)

## Deployment

### Quick Deploy
```bash
./deploy-production.sh
```

This script:
1. Builds frontend and backend
2. Starts all 4 production services via PM2
3. Saves PM2 configuration for auto-restart

### Manual Deployment
```bash
# Build
npm run build
cd server && npm run build && cd ..

# Start services
npx pm2 start ecosystem.config.cjs --only splice-prod-backend
npx pm2 start ecosystem.config.cjs --only splice-prod-whisper
npx pm2 start ecosystem.config.cjs --only splice-prod-worker
npx pm2 start ecosystem.config.cjs --only splice-prod-frontend

# Save configuration
npx pm2 save
```

## Common Commands

```bash
# View status
npx pm2 status

# View logs
npx pm2 logs splice-prod-worker
npx pm2 logs splice-prod-backend

# Restart all production services
npx pm2 restart splice-prod-backend splice-prod-whisper splice-prod-worker splice-prod-frontend

# Stop production (keep dev running)
npx pm2 stop splice-prod-backend splice-prod-whisper splice-prod-worker splice-prod-frontend

# Monitor real-time
npx pm2 monit
```

## Troubleshooting

### Jobs not processing
**Symptom**: Videos upload successfully but never complete

**Check**: Is the worker running?
```bash
npx pm2 status | grep worker
```

**Fix**: Start the worker
```bash
npx pm2 start ecosystem.config.cjs --only splice-prod-worker
```

### Can't connect from other machines
**Check**: Are firewall ports open?
```bash
sudo firewall-cmd --list-ports
```

**Expected**: Should show `3000/tcp 4000/tcp 4001/tcp`

**Fix**: Open ports
```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=4000/tcp
sudo firewall-cmd --permanent --add-port=4001/tcp
sudo firewall-cmd --reload
```

### Check job queue status
```bash
curl http://10.10.20.38:4000/api/stats
```

Expected output:
```json
{
  "waiting": 0,
  "active": 1,
  "completed": 5,
  "failed": 0,
  "total": 6,
  "connectedClients": 1,
  "uptime": 11640.6
}
```

### Check Redis for stuck jobs
```bash
# List all jobs in queue
redis-cli ZRANGE "bull:video-processing:prioritized" 0 -1

# Check specific job state
redis-cli HGETALL "bull:video-processing:<job-id>"
```

## Environment Variables

Production uses different environment variables than development:

### Backend (`ecosystem.config.cjs`)
- `NODE_ENV=production`
- `PORT=4000`
- `WS_PORT=4001`
- `WHISPER_API_URL=http://localhost:8000`
- `OLLAMA_API_URL=http://localhost:11434`

### Frontend (`.env.production`)
- `VITE_API_URL=http://10.10.20.38:4000/api`
- `VITE_WS_URL=ws://10.10.20.38:4001`

## Auto-Start on Reboot

PM2 can auto-start processes on server reboot:

```bash
# Generate startup script
npx pm2 startup

# Follow the instructions it provides (will need sudo)

# Save current process list
npx pm2 save
```

## Architecture Notes

### Why separate worker process?
The **backend** manages the API and queue, but the **worker** does the actual video processing. This separation allows:
- Scaling workers independently
- Isolating heavy CPU/memory usage
- Running workers on separate machines if needed

### Job Flow
1. User uploads video → **backend** receives it
2. **Backend** creates job in BullMQ queue
3. **Worker** picks up job from queue
4. **Worker** calls **whisper** service for transcription
5. **Worker** calls Ollama for AI analysis
6. **Worker** marks job complete
7. **Backend** sends WebSocket update to user

## Logs

All production logs are in `./logs/`:
- `prod-backend-out.log` - Backend API logs
- `prod-worker-out.log` - Video processing logs
- `prod-whisper-out.log` - Whisper service logs
- `prod-frontend-out.log` - Frontend server logs

View real-time:
```bash
tail -f logs/prod-worker-out.log
```
