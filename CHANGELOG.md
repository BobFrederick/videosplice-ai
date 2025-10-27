# Changelog

All notable changes to Splice will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-26

### Added - Initial MVP Release

#### Core Features
- **Intelligent Video Segmentation**: AI-powered automatic video chapter detection using Ollama LLM
- **Local Whisper Transcription**: High-quality speech-to-text with Whisper.cpp GPU acceleration
- **Real-time Processing Queue**: BullMQ-based job queue with live progress tracking via WebSockets
- **Interactive Timeline Editor**: Visual timeline with drag-to-adjust segments, keyboard shortcuts for splitting/removing
- **Video Export**: FFmpeg-based trimming with download progress tracking
- **Subtitle Support**: WebVTT subtitle generation and download for each segment

#### User Interface
- **Modern Purple Branding**: Cohesive purple theme throughout the application
- **Sidebar Navigation**: Clean navigation with Home and Settings views
- **Animated Logo**: CSS-powered Splice logo with hover animation
- **Video Thumbnails**: Canvas-based thumbnail generation for queue job cards
- **Dark Mode Support**: Full dark/light theme support
- **Responsive Design**: Mobile-friendly layout with Tailwind CSS

#### Technical Implementation
- **Local-First Architecture**: Everything runs locally - no external API dependencies
- **WebSocket Updates**: Real-time job status and progress updates
- **Custom Instructions**: User-defined prompts for LLM segmentation
- **Settings Persistence**: LocalStorage-based settings management
- **CORS Configuration**: Proper headers for cross-origin downloads
- **Connection Monitoring**: Server health checks with visual status indicators

#### Developer Experience
- **TypeScript**: Full type safety across frontend and backend
- **Hot Module Replacement**: Fast development with Vite
- **Component Library**: shadcn/ui components with Radix UI primitives
- **Icon System**: Phosphor Icons for consistent iconography

### Technical Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Express.js, BullMQ, Redis
- **AI/ML**: Whisper.cpp, Ollama (Qwen2.5 7B / Mistral 7B)
- **Video Processing**: FFmpeg
- **UI Components**: shadcn/ui, Radix UI, Phosphor Icons

---

## Upcoming Features

See our [GitHub Issues](https://github.com/BobFrederick/videosplice-ai/issues) for planned enhancements and feature requests.

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.
