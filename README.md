# 🎬 Splice

**AI-powered video segmentation that runs entirely on your local machine. (optional external LLM API support)**

Splice automatically analyzes your videos and creates intelligent chapter segments using speech recognition and AI. No cloud services, no subscriptions—just your hardware and open-source AI models.

## ✨ Features

- 🎙️ **Local Speech Recognition** - Whisper.cpp with GPU acceleration
- 📄 **VTT Upload Support** - Skip transcription by uploading existing .vtt subtitle files
- 🧠 **AI-Powered Segmentation** - Multiple LLM provider support:
  - **Local (Ollama)** - Default, 100% local, no API costs
  - **OpenAI** - GPT-4, GPT-3.5, configurable via Settings
  - **Anthropic (Claude)** - Claude 3 models, configurable via Settings
- ✂️ **Interactive Timeline** - Visual editor with drag-to-adjust segments
- 📝 **Text-Based Video Editing** - Select transcript text to create, split, or modify segments with precise timestamp mapping
- 📥 **Easy Export** - Download trimmed videos with matching subtitle files
- 🎨 **Modern Interface** - Clean, dark-mode ready UI
- 🔒 **Privacy Focused** - Local-first with optional cloud providers

> **Note:** Splice is designed as an internal tool for single-user or trusted team use. All users share the same job queue, so in multi-user deployments everyone can see each other's jobs. For user isolation, deploy separate instances.

## 🚀 Quick Start

### Prerequisites

**Required for basic operation:**
- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Redis** 6+ ([Installation Guide](https://redis.io/docs/install/))
- **FFmpeg** ([Installation Guide](https://ffmpeg.org/download.html))

**Choose your LLM provider:**
- **Local (Ollama)** - Recommended for privacy ([Installation Guide](https://ollama.ai/))
  - No API costs, fully offline
  - Requires: Ollama + local models (qwen2.5:7b, etc.)
- **OpenAI** - Easy setup, requires API key
  - No local installation needed
  - Pay per use via OpenAI API
- **Anthropic (Claude)** - Advanced models, requires API key
  - No local installation needed
  - Pay per use via Anthropic API

**Required for transcription:**
- **Whisper.cpp** ([Setup Guide](https://github.com/ggerganov/whisper.cpp))
  - Or upload your own VTT files to skip transcription

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/BobFrederick/videosplice-ai.git
   cd videosplice-ai
   ```

2. **Run automated setup**
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```
   
   This will check dependencies and install everything needed.

3. **Configure Whisper**
   - Clone and build [Whisper.cpp](https://github.com/ggerganov/whisper.cpp)
   - Download a model: `bash ./models/download-ggml-model.sh base.en`
   - Update `whisper-server.mjs` with the correct model path

### Running Splice

**Option 1: Use the start script (Recommended)**
```bash
./start-all.sh
```

**Option 2: Docker Compose**
```bash
docker-compose up -d
# Note: Whisper runs outside Docker - start it separately
node whisper-server.mjs
```

**Option 3: Manual start**

Open 4 terminal windows:

```bash
# Terminal 1: Redis
redis-server

# Terminal 2: Ollama
ollama serve

# Terminal 3: Backend
cd server && npm run dev

# Terminal 4: Frontend  
npm run dev
```

Then open your browser to **http://localhost:5001**

## 📖 Usage

1. **Upload a video** - Drag and drop or click to select
2. **Optional: Upload VTT** - If you have an existing transcription, upload it to skip Whisper processing (saves 1-5+ minutes)
3. **Wait for processing** - Watch real-time progress as Splice transcribes and analyzes
4. **Review segments** - Check the AI-generated chapters
5. **Edit as needed** - Use the timeline to adjust segment boundaries
6. **Export** - Download trimmed videos with subtitles

### VTT Upload

When uploading a video, you'll be prompted to optionally upload a `.vtt` (WebVTT) subtitle file:

- **With VTT**: Transcription is skipped, processing is much faster
- **Without VTT**: Whisper will transcribe the audio (slower but automatic)

**VTT Format Example:**
```vtt
WEBVTT

00:00:00.000 --> 00:00:05.000
First subtitle text

00:00:05.000 --> 00:00:10.000
Second subtitle text
```

### LLM Provider Configuration

Splice supports multiple AI providers for segment generation. Configure in **Settings** (gear icon):

**Local (Ollama) - Default**
- Install Ollama: `curl -fsSL https://ollama.ai/install.sh | sh`
- Pull a model: `ollama pull qwen2.5:7b`
- Set endpoint: `http://localhost:11434` (default)
- **Note:** Initial video processing always uses local Ollama

**OpenAI**
- Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
- In Settings: Select "OpenAI" provider
- Enter API key and choose model (gpt-4o, gpt-3.5-turbo, etc.)
- **Use case:** Re-generate segments with cloud models

**Anthropic (Claude)**
- Get API key from [Anthropic Console](https://console.anthropic.com/)
- In Settings: Select "Anthropic" provider  
- Enter API key and choose model (claude-3-sonnet, claude-3-opus, etc.)
- **Use case:** Re-generate segments with Claude models

> **Important:** Initial video upload processing uses local Ollama only. OpenAI/Anthropic can be used when re-generating segments from the project view.

### Timeline Shortcuts

- **Click** - Seek to position
- **Shift + Click** - Add segment split
- **Ctrl + Click** - Remove segment
- **Drag boundary** - Adjust segment timing
- **Hover** - View timestamp

### Text-Based Video Editing

When a video has been transcribed with Whisper or uploaded with a VTT file, you can edit segments directly from the transcript:

- **Select text** - Click and drag to select transcript text; see timestamp range
- **Delete/Backspace** - Press Delete or Backspace to split or trim segments at selection boundaries  
- **Right-click** - Context menu to create new segment from selection or copy timestamp
- **Timestamps** - Text selections are automatically mapped to precise video timestamps

This feature enables intuitive text-based editing where you can:
1. Select the text you want to become a new segment
2. Right-click and choose "Create Segment from Selection"
3. Or delete unwanted text to split existing segments

The transcript maintains tight synchronization with video timestamps for frame-accurate editing.

## 🛠️ Technology Stack

**Frontend**
- React 19, TypeScript, Vite
- Tailwind CSS, shadcn/ui

**Backend**
- Node.js, Express, BullMQ
- Redis, WebSockets

**AI/ML**
- Whisper.cpp (local transcription)
- Ollama (local LLM - default)
- OpenAI API (optional cloud LLM)
- Anthropic API (optional cloud LLM)
- FFmpeg (video processing)

## � Deployment

### For Developers
- **Quick Setup**: Run `./setup.sh` for automated installation
- **Docker**: Use `docker-compose up -d` for containerized deployment
- **PM2**: Production process management with auto-restart

### For Production/Internal Testing
See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for:
- Multi-user production setup with Nginx
- Internal testing environment configuration  
- PM2 process management
- SSL/HTTPS configuration
- Monitoring and logging
- Backup strategies

## �📁 Project Structure

```
splice/
├── src/              # React frontend
├── server/           # Express backend
├── shared/           # Shared utilities
├── docs/             # Documentation
└── whisper-server.mjs # Whisper API server
```

## 📁 Documentation

- [Deployment Guide](./docs/DEPLOYMENT.md) - Production deployment and PM2 setup
- [System Architecture](./docs/ARCHITECTURE.md) - Technical overview and data flow
- [Text-Based Editing](./docs/TEXT_BASED_EDITING.md) - Complete guide to text-based video editing
- [Security](./docs/SECURITY.md) - Security considerations

## 🐛 Troubleshooting

**Whisper transcription fails**
- Ensure your Whisper model path is correct in `whisper-server.mjs`
- Check that the Whisper server is running on port 8000

**Job gets stuck in "Processing"**
- Verify Redis is running
- Check that Ollama is serving the correct model
- Review server logs for errors

**Export downloads fail**
- Ensure FFmpeg is installed and in your PATH
- Check CORS settings in `server/src/app.ts`

For more issues, check [GitHub Issues](https://github.com/BobFrederick/videosplice-ai/issues).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) - Fast local transcription
- [Ollama](https://ollama.ai/) - Local LLM inference
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components

---

Made with ❤️ for internal use at your org!
