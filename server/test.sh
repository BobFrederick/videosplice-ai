#!/bin/bash

echo "🧪 Testing BullMQ Video Processing Server"
echo "========================================"

# Test 1: Health Check
echo "1️⃣ Testing server health..."
response=$(curl -s http://localhost:8080/api/health)
if echo "$response" | grep -q '"status":"ok"'; then
    echo "✅ Server health check passed"
else
    echo "❌ Server health check failed"
    echo "Response: $response"
fi

echo ""

# Test 2: Queue Stats  
echo "2️⃣ Testing queue stats..."
stats=$(curl -s http://localhost:8080/api/stats)
if echo "$stats" | grep -q '"waiting"'; then
    echo "✅ Queue stats endpoint working"
    echo "Stats: $stats"
else
    echo "❌ Queue stats failed"
    echo "Response: $stats"
fi

echo ""

# Test 3: Redis Connection
echo "3️⃣ Testing Redis connection..."
if redis-cli ping | grep -q "PONG"; then
    echo "✅ Redis is responding"
else
    echo "❌ Redis is not responding"
fi

echo ""
echo "🎯 Basic tests completed!"
echo ""
echo "To test video upload, use:"
echo "curl -X POST -F 'video=@/path/to/video.mp4' http://localhost:8080/api/upload"