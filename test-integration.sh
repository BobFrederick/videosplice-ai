#!/bin/bash

echo "🧪 Testing Complete VideoSplice AI Integration"
echo "=============================================="

echo ""
echo "🔍 Testing service availability..."

# Test Frontend
if curl -s -f http://localhost:5000 > /dev/null; then
    echo "✅ Frontend is accessible at http://localhost:5000"
else
    echo "❌ Frontend is not accessible"
fi

# Test BullMQ API
if curl -s -f http://localhost:8080/api/health > /dev/null; then
    echo "✅ BullMQ API is accessible at http://localhost:8080"
else
    echo "❌ BullMQ API is not accessible"
fi

# Test Whisper Server
if curl -s -f http://localhost:3001 > /dev/null; then
    echo "✅ Whisper server is accessible at http://localhost:3001"
else
    echo "❌ Whisper server is not accessible"
fi

# Test Ollama Server
if curl -s -f http://localhost:11434/api/tags > /dev/null; then
    echo "✅ Ollama server is accessible at http://localhost:11434"
else
    echo "❌ Ollama server is not accessible"
fi

# Test Redis
if redis-cli ping | grep -q "PONG"; then
    echo "✅ Redis is responding"
else
    echo "❌ Redis is not responding"
fi

echo ""
echo "📊 Queue Statistics:"
stats=$(curl -s http://localhost:8080/api/stats)
if [ $? -eq 0 ]; then
    echo "$stats" | jq . 2>/dev/null || echo "$stats"
else
    echo "❌ Could not retrieve queue stats"
fi

echo ""
echo "🎯 Integration test complete!"
echo ""
echo "To test video upload:"
echo "1. Visit http://localhost:5000"
echo "2. Switch to 'BullMQ Queue' tab"
echo "3. Upload a video file"
echo "4. Monitor progress in real-time"