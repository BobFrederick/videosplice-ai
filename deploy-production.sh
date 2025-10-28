#!/bin/bash

# Splice - Production Deployment Script
# Deploys a production instance on separate ports for internal testing
# Dev environment stays on ports 5001 (frontend) / 8080 (backend)
# Production runs on ports 3000 (frontend) / 4000 (backend)

set -e

echo "🚀 Deploying Splice Production Instance..."

# Configuration
PROD_FRONTEND_PORT=3000
PROD_BACKEND_PORT=4000
PROD_WS_PORT=4001

# Check if PM2 is installed, if not install locally
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 not found globally. Installing locally..."
    npm install pm2
    echo "✅ PM2 installed locally"
fi

# Use npx to run PM2 (works with both global and local installations)
PM2_CMD="npx pm2"

# 1. Build frontend
echo "📦 Building frontend..."
npm run build

# 2. Build backend
echo "📦 Building backend..."
cd server
npm run build
cd ..

# 3. Stop existing production instances (if any)
echo "🛑 Stopping existing production instances..."
$PM2_CMD delete splice-prod-backend splice-prod-whisper splice-prod-frontend splice-prod-worker 2>/dev/null || true

# 4. Start production backend using ecosystem config
echo "🔧 Starting production backend on port $PROD_BACKEND_PORT..."
$PM2_CMD start ecosystem.config.cjs --only splice-prod-backend

# 5. Start production whisper service using ecosystem config
echo "🎙️ Starting production Whisper service..."
$PM2_CMD start ecosystem.config.cjs --only splice-prod-whisper

# 6. Start production video processing worker
echo "⚙️ Starting production video processing worker..."
$PM2_CMD start ecosystem.config.cjs --only splice-prod-worker

# 7. Start production frontend using ecosystem config
echo "🌐 Starting production frontend on port $PROD_FRONTEND_PORT..."
$PM2_CMD start ecosystem.config.cjs --only splice-prod-frontend

# 8. Save PM2 configuration
$PM2_CMD save

# 9. Display status
echo ""
echo "✅ Production deployment complete!"
echo ""
echo "📊 Application Status:"
$PM2_CMD status

echo ""
echo "🌐 Access URLs:"
echo "   Production (Internal Network): http://$(hostname -I | awk '{print $1}'):$PROD_FRONTEND_PORT"
echo "   Development (Local): http://localhost:5001"
echo ""
echo "📝 Notes:"
echo "   - Production backend: port $PROD_BACKEND_PORT"
echo "   - Development backend: port 8080"
echo "   - Both instances can run simultaneously"
echo "   - Employees need VPN/internal network access"
echo ""
echo "🔧 Useful Commands:"
echo "   View logs:    $PM2_CMD logs splice-prod-frontend"
echo "   Restart:      $PM2_CMD restart splice-prod-frontend splice-prod-backend splice-prod-whisper splice-prod-worker"
echo "   Stop:         $PM2_CMD stop splice-prod-frontend splice-prod-backend splice-prod-whisper splice-prod-worker"
echo "   Monitor:      $PM2_CMD monit"
echo ""
echo "🔒 Firewall Configuration:"
echo "   Allow port $PROD_FRONTEND_PORT from internal network:"
echo "   sudo ufw allow from 192.168.0.0/16 to any port $PROD_FRONTEND_PORT"
echo "   sudo ufw allow from 192.168.0.0/16 to any port $PROD_BACKEND_PORT"
