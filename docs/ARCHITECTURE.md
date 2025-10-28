# System Architecture

## Overview

Splice is a local-first video segmentation system that uses AI to automatically analyze and chapter videos. It consists of a React frontend, Express backend, BullMQ job queue, and integration with local AI models.

**Key Design Principles:**
- **Local-First**: All processing happens on the user's machine
- **Real-Time Feedback**: WebSocket updates for job progress
- **Asynchronous Processing**: BullMQ handles video processing jobs
- **Modular Design**: Separate frontend, backend, and workers

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
│         │  │         │  │         │  │              │
│Transcrib│  │Segment  │  │  Trim   │  │Video Storage │
└─────────┘  └─────────┘  └─────────┘  └──────────────┘
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
- `POST /api/upload` - Video upload
- `GET /api/jobs` - List all jobs
- `GET /api/jobs/:id` - Get job details
- `POST /api/jobs/:id/trim` - Trim video segment
- `DELETE /api/jobs/:id` - Delete job
- `POST /api/llm/generate` - Proxy to Ollama

### 3. Worker (Background Process)

**Location**: `server/src/workers/videoProcessor.ts`

**Responsibilities:**
- Process jobs from BullMQ queue
- Call Whisper for transcription
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

**Ollama** (Port 11434)
- Content analysis
- Chapter detection
- Title generation
- Models: qwen2.5:7b, mistral:7b

**FFmpeg**
- Video trimming
- Format conversion
- Subtitle generation

---

## Data Flow

### Upload → Process → Complete

1. **User uploads video**
   - Frontend POSTs to `/api/upload`
   - Backend saves file to `/server/uploads`
   - Backend creates BullMQ job
   - Returns job ID to frontend

2. **Worker processes job**
   - Worker pulls job from Redis queue
   - Extracts audio with FFmpeg
   - Calls Whisper API for transcription
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

### Re-Generate Segments (Frontend Only)

1. User clicks "Re-Generate Segments"
2. Frontend calls `/api/llm/generate` (backend proxy)
3. Backend forwards request to local Ollama
4. Frontend receives new segments
5. User can edit and save

**Why proxy?** Remote browsers can't access `localhost:11434` directly.

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

## File Structure

```
/server/uploads/          # Video files
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
- Whisper.cpp (transcription)
- Ollama (LLM segmentation)
- FFmpeg (video processing)

**Deployment:**
- PM2 (process management)
- Nginx (optional reverse proxy)
