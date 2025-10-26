#!/bin/bash

echo "🚀 Starting VideoSplice AI with BullMQ Integration"
echo "================================================"

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down all services..."
    
    # Kill background processes (only if they have PIDs from this script)
    [ ! -z "$WHISPER_PID" ] && kill $WHISPER_PID 2>/dev/null || true
    [ ! -z "$OLLAMA_PID" ] && kill $OLLAMA_PID 2>/dev/null || true  
    [ ! -z "$BULLMQ_SERVER_PID" ] && kill $BULLMQ_SERVER_PID 2>/dev/null || true
    
    # Kill worker and its npm parent process
    if [ ! -z "$BULLMQ_WORKER_PID" ]; then
        pkill -P $BULLMQ_WORKER_PID 2>/dev/null || true
        kill $BULLMQ_WORKER_PID 2>/dev/null || true
    fi
    
    [ ! -z "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null || true
    
    # Wait for processes to exit (only if they have PIDs)
    [ ! -z "$WHISPER_PID" ] && wait $WHISPER_PID 2>/dev/null || true
    [ ! -z "$OLLAMA_PID" ] && wait $OLLAMA_PID 2>/dev/null || true
    [ ! -z "$BULLMQ_SERVER_PID" ] && wait $BULLMQ_SERVER_PID 2>/dev/null || true
    [ ! -z "$BULLMQ_WORKER_PID" ] && wait $BULLMQ_WORKER_PID 2>/dev/null || true
    [ ! -z "$FRONTEND_PID" ] && wait $FRONTEND_PID 2>/dev/null || true
    
    echo "✅ Services stopped (only ones started by this script)"
    echo "ℹ️  Note: Services that were already running before this script are still running"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

echo "1️⃣ Starting Redis..."
if ! redis-cli ping > /dev/null 2>&1; then
    sudo systemctl start redis-server
    sleep 2
fi
echo "✅ Redis is running"

echo ""
echo "2️⃣ Checking Whisper server..."
if curl -s -f http://localhost:3001 > /dev/null 2>&1; then
    echo "✅ Whisper server is already running"
    WHISPER_PID=""
else
    echo "🔄 Starting Whisper server..."
    cd /home/desops/videosplice-ai
    node whisper-server.mjs &
    WHISPER_PID=$!
    sleep 3
    
    # Verify Whisper server started (check if process is still running and wait for full startup)
    sleep 3
    if kill -0 $WHISPER_PID 2>/dev/null && curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ Whisper server started (PID: $WHISPER_PID)"
    else
        echo "✅ Whisper server started (PID: $WHISPER_PID) - health endpoint may take a moment"
    fi
fi

echo ""
echo "3️⃣ Checking Ollama server..."
if curl -s -f http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama server is already running"
    OLLAMA_PID=""
else
    echo "🔄 Starting Ollama server..."
    ollama serve &
    OLLAMA_PID=$!
    sleep 3
    
    # Verify Ollama server started
    if curl -s -f http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama server started (PID: $OLLAMA_PID)"
    else
        echo "❌ Ollama server failed to start"
    fi
fi

echo ""
echo "4️⃣ Checking BullMQ server..."
if curl -s -f http://localhost:8080/api/health > /dev/null 2>&1; then
    echo "✅ BullMQ server is already running"
    BULLMQ_SERVER_PID=""
else
    echo "🔄 Starting BullMQ server..."
    cd /home/desops/videosplice-ai/server
    npm start &
    BULLMQ_SERVER_PID=$!
    sleep 3
    
    # Verify BullMQ server started
    if curl -s -f http://localhost:8080/api/health > /dev/null 2>&1; then
        echo "✅ BullMQ server started (PID: $BULLMQ_SERVER_PID)"
    else
        echo "❌ BullMQ server failed to start"
    fi
fi

echo ""
echo "5️⃣ Checking BullMQ worker..."
# Check if worker is already running by looking for the process
if pgrep -f "dist/server/src/workers/videoProcessor.js" > /dev/null 2>&1; then
    echo "✅ BullMQ worker is already running"
    BULLMQ_WORKER_PID=""
else
    echo "🔄 Starting BullMQ worker..."
    cd /home/desops/videosplice-ai/server
    nohup npm run worker > /tmp/bullmq-worker.log 2>&1 &
    BULLMQ_WORKER_PID=$!
    cd /home/desops/videosplice-ai
    sleep 3
    
    # Verify worker actually started
    if pgrep -f "dist/server/src/workers/videoProcessor.js" > /dev/null 2>&1; then
        echo "✅ BullMQ worker started (PID: $BULLMQ_WORKER_PID)"
    else
        echo "❌ BullMQ worker failed to start - check /tmp/bullmq-worker.log"
        tail -10 /tmp/bullmq-worker.log
    fi
fi

echo ""
echo "6️⃣ Checking frontend..."
if curl -s -f http://localhost:5000 > /dev/null 2>&1; then
    echo "✅ Frontend is already running"
    FRONTEND_PID=""
else
    echo "🔄 Starting frontend..."
    cd /home/desops/videosplice-ai
    npm run dev &
    FRONTEND_PID=$!
    sleep 3
    
    # Verify frontend started
    if curl -s -f http://localhost:5000 > /dev/null 2>&1; then
        echo "✅ Frontend started (PID: $FRONTEND_PID)"
    else
        echo "❌ Frontend failed to start"
    fi
fi

echo ""
echo "🎉 All services are running!"
echo ""
echo "📍 Access Points:"
echo "   🌐 Frontend:      http://localhost:5000"
echo "   🔌 BullMQ API:    http://localhost:8080"
echo "   📡 WebSocket:     ws://localhost:8081"
echo "   🎙️ Whisper:      http://localhost:3001"  
echo "   🧠 Ollama:       http://localhost:11434"
echo "   📊 Queue Stats:   http://localhost:8080/api/stats"
echo ""
echo "🔧 Service Status (PIDs for services started by this script):"
echo "   Whisper: ${WHISPER_PID:-'Already running'}"
echo "   Ollama: ${OLLAMA_PID:-'Already running'}"
echo "   BullMQ Server: ${BULLMQ_SERVER_PID:-'Already running'}"
echo "   BullMQ Worker: ${BULLMQ_WORKER_PID:-'Already running'}" 
echo "   Frontend: ${FRONTEND_PID:-'Already running'}"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for services to run
wait