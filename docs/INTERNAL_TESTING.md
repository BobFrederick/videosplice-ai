# Internal Testing Deployment Guide

This guide explains how to deploy Splice for internal employee testing while keeping your development environment running.

## Architecture

- **Development** (for you): 
  - Frontend: `http://localhost:5001`
  - Backend: `http://localhost:8080`
  
- **Production/Testing** (for internal employees):
  - Frontend: `http://YOUR_SERVER_IP:3000`
  - Backend: `http://YOUR_SERVER_IP:4000`

Both run simultaneously on the same server using PM2.

## Prerequisites

1. Your server must be accessible on the internal network/VPN
2. Find your server's internal IP: `hostname -I`
3. Ensure firewall allows internal network traffic on ports 3000, 4000

## Quick Deployment

### Step 1: Update Production Configuration

Edit `.env.production` and replace `localhost` with your server's internal IP:

```bash
# Get your server IP
hostname -I
# Example output: 192.168.1.100

# Edit .env.production
nano .env.production

# Update to:
VITE_API_URL=http://192.168.1.100:4000
VITE_WS_URL=ws://192.168.1.100:4001
```

### Step 2: Update Backend Configuration

Edit `server/src/app.ts` CORS settings to allow internal network access:

```typescript
// Around line 30-40, update CORS origin to:
const corsOptions = {
  origin: [
    'http://localhost:5001',  // Dev frontend
    'http://YOUR_SERVER_IP:3000',  // Production frontend
    /^http:\/\/192\.168\.\d+\.\d+:3000$/,  // Allow all internal IPs
  ],
  credentials: true
}
```

### Step 3: Run Deployment Script

```bash
./deploy-production.sh
```

This will:
- Build optimized production bundles
- Start production services on ports 3000/4000
- Keep development environment untouched
- Configure PM2 for auto-restart

### Step 4: Configure Firewall (if needed)

```bash
# Allow internal network access (adjust subnet to match your network)
sudo ufw allow from 192.168.0.0/16 to any port 3000
sudo ufw allow from 192.168.0.0/16 to any port 4000

# Or allow specific VPN subnet
sudo ufw allow from 10.0.0.0/8 to any port 3000
sudo ufw allow from 10.0.0.0/8 to any port 4000

# Check status
sudo ufw status
```

### Step 5: Share Access Details with Employees

Send your team:

```
Access Splice at: http://YOUR_SERVER_IP:3000

Requirements:
- Must be connected to company VPN/internal network
- Modern browser (Chrome, Firefox, Edge, Safari)
- No additional setup needed

Note: This is a shared instance - all users see the same job queue.
```

## Managing the Deployment

### View Status

```bash
pm2 status
```

Expected output:
```
┌─────┬─────────────────────────┬─────┬────────┐
│ id  │ name                    │ status │ cpu   │
├─────┼─────────────────────────┼────────┼───────┤
│ 0   │ splice-prod-frontend    │ online │ 0%    │
│ 1   │ splice-prod-backend     │ online │ 5%    │
│ 2   │ splice-prod-whisper     │ online │ 0%    │
│ 3   │ splice-prod-worker      │ online │ 10%   │
└─────┴─────────────────────────┴────────┴───────┘
```

**Note:** The worker is critical - without it, videos will upload but never process!

### View Logs

```bash
# All production logs
pm2 logs

# Specific service
pm2 logs splice-prod-backend
pm2 logs splice-prod-frontend
pm2 logs splice-prod-whisper
pm2 logs splice-prod-worker

# Last 100 lines
pm2 logs --lines 100
```

### Restart Services

```bash
# Restart all production services
pm2 restart splice-prod-frontend splice-prod-backend splice-prod-whisper splice-prod-worker

# Restart just backend (after code changes)
pm2 restart splice-prod-backend

# Restart worker (if jobs are stuck)
pm2 restart splice-prod-worker

# Restart just frontend
pm2 restart splice-prod-frontend
```

### Stop Services (Maintenance)

```bash
# Stop all production services
pm2 stop splice-prod-frontend splice-prod-backend splice-prod-whisper splice-prod-worker
pm2 stop splice-prod-frontend splice-prod-backend splice-prod-whisper

# Start them again
pm2 start splice-prod-frontend splice-prod-backend splice-prod-whisper
```

### Monitor Resources

```bash
pm2 monit
```

## Updating the Deployment

When you make changes and want to update production:

```bash
# Option 1: Quick update (re-run deployment)
./deploy-production.sh

# Option 2: Manual update
npm run build
cd server && npm run build && cd ..
pm2 restart splice-prod-frontend splice-prod-backend
```

## Development Workflow

Your development environment is unaffected:

```bash
# Continue developing with:
./start-all.sh

# Or manually:
# Terminal 1: Frontend dev server (port 5001)
npm run dev

# Terminal 2: Backend dev server (port 8080)
cd server && npm run dev
```

Both dev and production run side-by-side.

## Troubleshooting

### Employees Can't Access

1. **Check firewall**:
   ```bash
   sudo ufw status
   # Should show ports 3000, 4000 allowed from internal network
   ```

2. **Check services are running**:
   ```bash
   pm2 status
   # All should show "online"
   ```

3. **Test from server**:
   ```bash
   curl http://localhost:3000
   # Should return HTML
   
   curl http://localhost:4000/api/stats
   # Should return JSON
   ```

4. **Check CORS**:
   ```bash
   pm2 logs splice-prod-backend --lines 50
   # Look for CORS errors
   ```

### Videos Not Processing

**Symptom:** Videos upload successfully but never complete processing

1. **Check Worker is running** (MOST COMMON ISSUE):
   ```bash
   pm2 status | grep worker
   # Should show splice-prod-worker as "online"
   
   # If not running, start it:
   pm2 start ecosystem.config.cjs --only splice-prod-worker
   pm2 save
   ```

2. **Check Whisper is running**:
   ```bash
   pm2 logs splice-prod-whisper
   curl http://localhost:8000/health
   ```

3. **Check Ollama**:
   ```bash
   # Verify Ollama is running
   systemctl status ollama
   
   # Verify model is installed
   ollama list
   # Should show qwen2.5:7b (4.7 GB)
   
   # If model missing, download it:
   ollama pull qwen2.5:7b
   ```

4. **Check Redis**:
   ```bash
   redis-cli ping
   # Should return "PONG"
   ```

5. **Check job queue**:
   ```bash
   curl http://localhost:4000/api/stats
   # Should show job counts
   
   # If jobs stuck in waiting with no active:
   pm2 restart splice-prod-worker
   ```

### "Re-Generate Segments" Gets Stuck

**Symptom:** Clicking "Re-Generate Segments" button hangs forever

**Cause:** Ollama not running or model not loaded

**Fix:**
```bash
# 1. Check if Ollama is running
systemctl status ollama

# 2. Start if not running
sudo systemctl start ollama
sudo systemctl enable ollama  # Auto-start on boot

# 3. Verify model is downloaded
ollama list

# 4. If model missing:
ollama pull qwen2.5:7b

# 5. Test the LLM proxy endpoint
curl -X POST http://localhost:4000/api/llm/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Say hello","model":"qwen2.5:7b","provider":"local"}'
# Should return: {"text":"Hi!","model":"qwen2.5:7b","provider":"ollama"}
```

**Why this happens:**
- The frontend calls `/api/llm/generate` on the backend
- Backend proxies the request to local Ollama at `localhost:11434`
- If Ollama isn't running, the request hangs or times out

### Segments Show "Part 1, Part 2, Part 3"

**Symptom:** Videos process successfully but segments are generic instead of AI-generated

**Cause:** Ollama wasn't running when the video was processed

**Fix:**
1. Ensure Ollama is running (see above)
2. Click "Re-Generate Segments" button in the project view
3. Wait for AI analysis (may take 30-60 seconds for long videos)
4. New intelligent segments will replace generic ones

### Port Conflicts

If ports 3000/4000 are already in use:

1. Edit `deploy-production.sh`:
   ```bash
   PROD_FRONTEND_PORT=5000  # Change this
   PROD_BACKEND_PORT=6000   # Change this
   ```

2. Update `.env.production` with new backend port

3. Re-run deployment

## Security Considerations

⚠️ **Important for Internal Testing:**

- This is a **shared instance** - all users see the same job queue
- No user authentication - anyone on internal network can access
- Uploaded videos are visible to all users
- For production use, implement user isolation (see main DEPLOYMENT.md)

## Network Configuration Examples

### Common Internal Network Subnets

```bash
# Most home/office networks
sudo ufw allow from 192.168.0.0/16 to any port 3000
sudo ufw allow from 192.168.0.0/16 to any port 4000

# Corporate networks
sudo ufw allow from 10.0.0.0/8 to any port 3000
sudo ufw allow from 10.0.0.0/8 to any port 4000

# Specific subnet
sudo ufw allow from 172.16.0.0/12 to any port 3000
sudo ufw allow from 172.16.0.0/12 to any port 4000

# Only specific IPs (most secure)
sudo ufw allow from 192.168.1.50 to any port 3000
sudo ufw allow from 192.168.1.51 to any port 3000
```

## Scaling Notes

Current setup limitations:
- Single server
- Shared job queue (all users see all jobs)
- GPU limited to one job at a time
- No load balancing

For more users or isolation, see `docs/DEPLOYMENT.md` for advanced options.

## Getting Help

If you encounter issues:
1. Check PM2 logs: `pm2 logs`
2. Verify services: `pm2 status`
3. Test locally: `curl http://localhost:3000`
4. Check firewall: `sudo ufw status`
5. Review main deployment docs: `docs/DEPLOYMENT.md`
