#!/bin/bash

echo "🚀 Starting VideoSplice AI Queue Server..."

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo "❌ Redis is not running. Starting Redis..."
    sudo systemctl start redis-server
    
    # Wait a moment for Redis to start
    sleep 2
    
    if ! redis-cli ping > /dev/null 2>&1; then
        echo "❌ Failed to start Redis. Please check Redis installation."
        exit 1
    fi
fi

echo "✅ Redis is running"

# Check if required services are running
echo "🔍 Checking dependencies..."

# Check Whisper server
if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Whisper server is running"
else
    echo "⚠️ Whisper server is not running. Please start it first:"
    echo "   cd /home/desops/videosplice-ai && node whisper-server.mjs"
fi

# Check Ollama server  
if curl -s -f http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama server is running"
else
    echo "⚠️ Ollama server is not running. Please start it first:"
    echo "   ollama serve"
fi

echo ""
echo "🏗️ Building server..."
cd /home/desops/videosplice-ai/server
npm run build

echo ""
echo "🔧 Starting worker in background..."
npm run worker &
WORKER_PID=$!

echo ""
echo "🌐 Starting API server..."
npm start &
SERVER_PID=$!

echo ""
echo "✅ Server started!"
echo "📡 API Server: http://localhost:8080"  
echo "🌐 WebSocket: ws://localhost:8081"
echo "📊 Queue Stats: http://localhost:8080/api/stats"
echo ""
echo "🔧 Worker PID: $WORKER_PID"
echo "🌐 Server PID: $SERVER_PID"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $WORKER_PID 2>/dev/null || true
    kill $SERVER_PID 2>/dev/null || true
    wait $WORKER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
    echo "✅ Services stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

# Wait for services to run
wait