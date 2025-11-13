# System Architecture

## Overview

Splice is a local-first video segmentation system that uses AI to automatically analyze and chapter videos. It consists of a React frontend, Express backend, BullMQ job queue, and integration with AI models (local or cloud).

**Key Design Principles:**
- **Local-First with Options**: Default to local processing, support cloud LLMs for flexibility
- **Real-Time Feedback**: WebSocket updates for job progress
- **Asynchronous Processing**: BullMQ handles video processing jobs
- **Modular Design**: Separate frontend, backend, and workers
- **Multi-Provider Support**: Local (Ollama), OpenAI, or Anthropic for segmentation

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                          │
│                  React Frontend (:5001/:3000)                │
│  • Job Queue View  • Timeline Editor  • Export Downloads    │
└────────────────┬────────────────────────────┬────────────────┘
                 │ HTTP/REST                  │ WebSocket
                 ↓                            ↓
┌────────────────────────────────┐  ┌──────────────────────┐
│   Express Backend (:8080/:4000) │  │  WebSocket Server    │
│   • REST API                    │  │  (:8081/:4001)       │
│   • File Upload                 │  │  • Live Progress     │
│   • Job Management              │←─┤  • Status Updates    │
└────────────┬───────────────────┘  └──────────────────────┘
             │ BullMQ
             ↓
┌──────────────────────────────────────────────────────────────┐
│                          Redis (:6379)                        │
│           • Job Queue  • State Management  • Caching         │
└────────────┬────────────────────────────────────────────────┘
             │ Worker pulls jobs
             ↓
┌──────────────────────────────────────────────────────────────┐
│                  BullMQ Worker (Background)                   │
│          • Video Processing  • AI Integration                │
└──┬─────────────┬─────────────┬─────────────┬────────────────┘
   │             │             │             │
   ↓             ↓             ↓             ↓
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐
│ Whisper │  │ Ollama  │  │ FFmpeg  │  │ File System  │
│ (:8000) │  │(:11434) │  │         │  │  /uploads    │
│         │  │ (Local) │  │         │  │              │
│Transcrib│  │Segment* │  │  Trim   │  │Video Storage │
└─────────┘  └─────────┘  └─────────┘  └──────────────┘
                                              │
         *Initial processing uses local Ollama│
          Re-generation can use OpenAI/Anthropic
          (configured in Settings)
```

---

## Components

### 1. Frontend (React + TypeScript)

**Ports**: 5001 (dev), 3000 (prod)  
**Location**: `src/`

**Responsibilities:**
- Video upload interface
- Real-time job queue visualization
- Interactive timeline editor
- Export and download management
- Settings (LLM model, custom prompts)

**Key Features:**
- Drag-and-drop upload
- WebSocket real-time updates
- LocalStorage for settings
- Timeline with segment editing

### 2. Backend API (Express)

**Ports**: 8080 (dev), 4000 (prod)  
**Location**: `server/src/app.ts`

**Responsibilities:**
- REST API for job management
- File upload handling
- BullMQ job creation
- Video trimming with FFmpeg
- VTT subtitle generation
- LLM proxy endpoint (for remote browsers)

**Key Endpoints:**
- `POST /api/upload` - Video and optional VTT upload
- `GET /api/jobs` - List all jobs
- `GET /api/jobs/:id` - Get job details
- `POST /api/jobs/:id/trim` - Trim video segment
- `DELETE /api/jobs/:id` - Delete job
- `POST /api/llm/generate` - Proxy to Ollama

### 3. Worker (Background Process)

**Location**: `server/src/workers/videoProcessor.ts`

**Responsibilities:**
- Process jobs from BullMQ queue
- Call Whisper for transcription (or parse VTT if provided)
- Call Ollama for AI segmentation
- Generate intelligent segments
- Update job status

**Why Separate?**
- Independent scaling
- Isolates heavy CPU/memory usage
- Can run on separate machines
- Prevents API blocking

### 4. WebSocket Server

**Ports**: 8081 (dev), 4001 (prod)  
**Location**: `server/src/app.ts`

**Responsibilities:**
- Real-time job status updates
- Progress notifications
- Connection monitoring

### 5. Redis

**Port**: 6379  
**Purpose**: BullMQ job queue backend

**Stores:**
- Job queue (prioritized)
- Job state (waiting, active, completed, failed)
- Job results and metadata

### 6. AI Services

**Whisper.cpp** (Port 8000)
- Audio transcription
- Timestamp alignment
- Language detection
- Required for initial video processing (unless VTT uploaded)

**LLM Providers for Segmentation**

Splice supports multiple LLM providers with different use cases:

**Local (Ollama)** - Port 11434 - Default
- Used for: Initial video processing (required)
- Used for: Re-generation from project view (optional)
- Models: qwen2.5:7b, qwen3-30b, mistral:7b, etc.
- Pros: Free, private, offline-capable
- Cons: Requires local GPU/CPU, model download

**OpenAI API** - Cloud - Optional
- Used for: Re-generation from project view only
- Models: gpt-4o, gpt-4-turbo, gpt-3.5-turbo
- Pros: No local setup, fast, high quality
- Cons: Requires API key, costs per token, internet required
- Configuration: Settings → Provider → OpenAI → Enter API key

**Anthropic API** - Cloud - Optional
- Used for: Re-generation from project view only
- Models: claude-3-opus, claude-3-sonnet, claude-3-haiku
- Pros: No local setup, excellent reasoning
- Cons: Requires API key, costs per token, internet required
- Configuration: Settings → Provider → Anthropic → Enter API key

> **Important Limitation:** Initial video upload processing (transcribe → segment pipeline) **always uses local Ollama**. OpenAI and Anthropic can only be used when manually re-generating segments from the project view. This ensures the core workflow remains local-first.

**FFmpeg**
- Video trimming
- Format conversion
- Subtitle generation

---

## Data Flow

### Upload → Process → Complete

1. **User uploads video**
   - Frontend shows upload dialog
   - User optionally uploads VTT transcription file
   - Frontend POSTs to `/api/upload` (video + optional VTT)
   - Backend saves files to `/server/uploads`
   - Backend creates BullMQ job with VTT path (if provided)
   - Returns job ID to frontend

2. **Worker processes job**
   - Worker pulls job from Redis queue
   - **If VTT provided**: Parses VTT file for transcript and segments
   - **If no VTT**: Extracts audio with FFmpeg → Calls Whisper API for transcription
   - Calls Ollama for intelligent segmentation
   - Saves results to job data

3. **Real-time updates**
   - Worker updates job progress in Redis
   - WebSocket server broadcasts to connected clients
   - Frontend updates UI in real-time

4. **User exports**
   - Frontend POSTs to `/api/jobs/:id/trim`
   - Backend uses FFmpeg to trim segment
   - Generates VTT subtitle file
   - Returns download links

### VTT Upload Flow (Fast Path)

When a user provides a VTT file:

1. **Upload Phase**
   - User selects video → Modal appears
   - User uploads `.vtt` file
   - Both files sent to backend

2. **Processing Phase**
   - Worker detects VTT file
   - Parses VTT format:
     - Extracts timestamps (HH:MM:SS.mmm)
     - Converts to seconds
     - Builds transcript text
     - Creates segments array
   - **Skips Whisper entirely** (saves 1-5+ minutes)
   - Proceeds directly to LLM segmentation

3. **Benefits**
   - Faster processing (no transcription wait)
   - Lower GPU usage
   - Use professional/existing transcriptions
   - Ideal for re-processing videos

### Re-Generate Segments (Frontend Only)

**Supports all LLM providers (Local/OpenAI/Anthropic):**

1. User clicks "Re-Generate Segments" in project view
2. Frontend checks Settings for configured LLM provider
3. **If provider = 'local':**
   - Frontend calls `/api/llm/generate` (backend proxy)
   - Backend forwards request to local Ollama
4. **If provider = 'openai':**
   - Frontend calls OpenAI API directly
   - Uses API key from Settings
5. **If provider = 'anthropic':**
   - Frontend calls Anthropic API directly
   - Uses API key from Settings
6. Frontend receives new segments
7. User can edit and save

**Why different providers work here:** Re-generation happens in the frontend with existing transcript data. No backend worker involved, so any configured provider can be used.

**Why proxy local Ollama?** Remote browsers can't access `localhost:11434` directly when the server is on a different machine.

---

## Environment Separation

### Development Environment

- Frontend: `localhost:5001`
- Backend: `localhost:8080`
- WebSocket: `localhost:8081`
- Process: Foreground (Ctrl+C stops all)
- Started with: `./start-all.sh`

### Production Environment

- Frontend: `YOUR_IP:3000`
- Backend: `YOUR_IP:4000`
- WebSocket: `YOUR_IP:4001`
- Process: PM2 (background daemon)
- Started with: `./deploy-production.sh`

**Both can run simultaneously** on the same server, sharing Redis/Ollama/Whisper.

---

## LLM Provider Summary

| Feature | Local (Ollama) | OpenAI | Anthropic |
|---------|----------------|--------|-----------|
| **Initial Upload Processing** | ✅ Required | ❌ Not supported | ❌ Not supported |
| **Re-Generate Segments** | ✅ Supported | ✅ Supported | ✅ Supported |
| **Setup Required** | Ollama + Models | API Key only | API Key only |
| **Cost** | Free (local compute) | Pay per token | Pay per token |
| **Privacy** | 100% local | Cloud API | Cloud API |
| **Internet Required** | No | Yes | Yes |
| **Configuration** | Default | Settings → OpenAI | Settings → Anthropic |

**Key Takeaway:** All initial video processing requires local Ollama. Cloud providers (OpenAI/Anthropic) can only be used for manual re-generation of segments from the project view.

---

## File Structure

```
/server/uploads/          # Video files
/server/uploads/*.vtt     # VTT transcription files (optional)
/server/uploads/audio/    # Extracted audio
/server/uploads/segments/ # Trimmed segments
/logs/                    # Production PM2 logs
```

---

## Concurrency & Performance

**Worker Concurrency**: 1 (protects GPU from overload)
- Jobs process sequentially
- One video at a time
- Prevents memory exhaustion

**Scaling Options**:
- Increase concurrency if GPU can handle it
- Run multiple workers on separate machines
- Use Redis clustering for larger deployments

---

## Configuration Files

- `ecosystem.config.cjs` - PM2 production configuration
- `.env.production` - Production environment variables
- `vite.config.ts` - Frontend build configuration
- `server/tsconfig.json` - Backend TypeScript config
- `whisper-server.mjs` - Whisper API server

---

## Technology Stack

**Frontend:**
- React 19, TypeScript, Vite
- Tailwind CSS, shadcn/ui
- TanStack Query, WebSockets

**Backend:**
- Node.js, Express, TypeScript
- BullMQ, Redis, WebSockets
- Multer (file uploads)

**AI/ML:**
- Whisper.cpp (local transcription)
- Ollama (local LLM - default, required for initial processing)
- OpenAI API (optional cloud LLM for re-generation)
- Anthropic API (optional cloud LLM for re-generation)
- FFmpeg (video processing)

**Deployment:**
- PM2 (process management)
- Nginx (optional reverse proxy)
