#!/bin/bash

# Splice - Quick Setup Script
# This script sets up Splice for development

set -e

echo "🎬 Splice - Quick Setup"
echo "======================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}❌ Please do not run this script as root${NC}"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."
echo ""

MISSING_DEPS=0

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}✓${NC} Node.js $(node -v)"
    else
        echo -e "${RED}✗${NC} Node.js version must be 18 or higher (found: $(node -v))"
        MISSING_DEPS=1
    fi
else
    echo -e "${RED}✗${NC} Node.js not found. Install from https://nodejs.org/"
    MISSING_DEPS=1
fi

# Check npm
if command_exists npm; then
    echo -e "${GREEN}✓${NC} npm $(npm -v)"
else
    echo -e "${RED}✗${NC} npm not found"
    MISSING_DEPS=1
fi

# Check Redis
if command_exists redis-server; then
    echo -e "${GREEN}✓${NC} Redis $(redis-server --version | cut -d'v' -f2 | cut -d' ' -f1)"
else
    echo -e "${YELLOW}⚠${NC} Redis not found. Install: sudo apt install redis-server (Ubuntu/Debian)"
    MISSING_DEPS=1
fi

# Check FFmpeg
if command_exists ffmpeg; then
    echo -e "${GREEN}✓${NC} FFmpeg $(ffmpeg -version | head -n1 | cut -d' ' -f3)"
else
    echo -e "${YELLOW}⚠${NC} FFmpeg not found. Install: sudo apt install ffmpeg (Ubuntu/Debian)"
    MISSING_DEPS=1
fi

# Check Ollama
if command_exists ollama; then
    echo -e "${GREEN}✓${NC} Ollama installed"
else
    echo -e "${YELLOW}⚠${NC} Ollama not found. Install from https://ollama.ai/"
    MISSING_DEPS=1
fi

echo ""

if [ $MISSING_DEPS -eq 1 ]; then
    echo -e "${YELLOW}⚠ Some dependencies are missing. Continue anyway? (y/n)${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
echo ""

echo "→ Installing frontend dependencies..."
npm install

echo "→ Installing backend dependencies..."
cd server && npm install && cd ..

echo ""
echo -e "${GREEN}✓${NC} Dependencies installed"

# Download Ollama model
echo ""
echo "🧠 Setting up AI models..."
echo ""

if command_exists ollama; then
    echo "→ Starting Ollama service..."
    ollama serve > /dev/null 2>&1 &
    OLLAMA_PID=$!
    sleep 2
    
    echo "→ Downloading Qwen2.5:7b model (this may take a while)..."
    ollama pull qwen2.5:7b
    
    echo -e "${GREEN}✓${NC} AI model ready"
else
    echo -e "${YELLOW}⚠${NC} Skipping Ollama setup (not installed)"
fi

# Whisper setup instructions
echo ""
echo "🎙️ Whisper Setup"
echo ""
echo "You need to set up Whisper.cpp separately:"
echo "1. Clone: git clone https://github.com/ggerganov/whisper.cpp.git"
echo "2. Build with GPU: make cuda (or make for CPU)"
echo "3. Download model: bash ./models/download-ggml-model.sh base.en"
echo "4. Update whisper-server.mjs with correct paths"
echo ""

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p server/uploads
touch server/uploads/.gitkeep
echo -e "${GREEN}✓${NC} Directories created"

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Set up Whisper.cpp (see instructions above)"
echo "2. Start all services:"
echo "   ./start-all.sh"
echo ""
echo "3. Or start manually:"
echo "   Terminal 1: redis-server"
echo "   Terminal 2: ollama serve"
echo "   Terminal 3: node whisper-server.mjs"
echo "   Terminal 4: cd server && npm run dev"
echo "   Terminal 5: npm run dev"
echo ""
echo "4. Open http://localhost:5001 in your browser"
echo ""
echo "📖 For more info: https://github.com/BobFrederick/videosplice-ai"
echo ""
