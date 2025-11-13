# 🎬 Splice

**AI-powered video segmentation that runs entirely on your local machine. (optional external LLM API support)**

Splice automatically analyzes your videos and creates intelligent chapter segments using speech recognition and AI. No cloud services, no subscriptions—just your hardware and open-source AI models.

## ✨ Features

- 🎙️ **Local Speech Recognition** - Whisper.cpp with GPU acceleration
- 📄 **VTT Upload Support** - Skip transcription by uploading existing .vtt subtitle files
- 🧠 **AI-Powered Segmentation** - Ollama LLM analyzes content for meaningful chapters, with configurable model selection.
- ✂️ **Interactive Timeline** - Visual editor with drag-to-adjust segments
- 📥 **Easy Export** - Download trimmed videos with matching subtitle files
- 🎨 **Modern Interface** - Clean, dark-mode ready UI
- 🔒 **100% Local** - Your videos never leave your computer

> **Note:** Splice is designed as an internal tool for single-user or trusted team use. All users share the same job queue, so in multi-user deployments everyone can see each other's jobs. For user isolation, deploy separate instances.

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Redis** 6+ ([Installation Guide](https://redis.io/docs/install/))
- **FFmpeg** ([Installation Guide](https://ffmpeg.org/download.html))
- **Ollama** ([Installation Guide](https://ollama.ai/))
- **Whisper.cpp** ([Setup Guide](https://github.com/ggerganov/whisper.cpp))

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

### Timeline Shortcuts

- **Click** - Seek to position
- **Shift + Click** - Add segment split
- **Ctrl + Click** - Remove segment
- **Drag boundary** - Adjust segment timing
- **Hover** - View timestamp

## 🛠️ Technology Stack

**Frontend**
- React 19, TypeScript, Vite
- Tailwind CSS, shadcn/ui

**Backend**
- Node.js, Express, BullMQ
- Redis, WebSockets

**AI/ML**
- Whisper.cpp (transcription)
- Ollama (segmentation)
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

Made with ❤️ for internal use
