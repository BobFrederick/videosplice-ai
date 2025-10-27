#!/bin/bash

# Splice Production Deploy Script
set -e

echo "🚀 Deploying Splice to Production"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create logs directory if it doesn't exist
mkdir -p logs

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production
cd server && npm install --production && cd ..

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Build backend
echo "🔨 Building backend..."
cd server && npm run build && cd ..

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠ PM2 not found. Installing globally...${NC}"
    npm install -g pm2
fi

# Check if serve is installed (for frontend)
if ! command -v serve &> /dev/null; then
    echo -e "${YELLOW}⚠ serve not found. Installing globally...${NC}"
    npm install -g serve
fi

# Stop existing processes
echo "⏹️  Stopping existing processes..."
pm2 stop ecosystem.config.js || true

# Start services
echo "▶️  Starting services..."
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📊 Service Status:"
pm2 status

echo ""
echo "📝 View logs:"
echo "  pm2 logs"
echo ""
echo "🔄 Restart services:"
echo "  pm2 restart all"
echo ""
echo "🌐 Access Splice:"
echo "  http://localhost:5001"
echo ""
