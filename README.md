# VideoSplice AI

> 🎬 An AI-powered video segmentation platform that automatically transcribes, analyzes, and splits videos into logical chapters using intelligent content understanding.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/BobFrederick/videosplice-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## 🌟 Overview

VideoSplice AI is a self-hosted video segmentation platform designed to make video content organization effortless. Upload a video, and the platform automatically:

- **Transcribes** the audio using advanced speech-to-text
- **Analyzes** the content with AI to detect logical topic boundaries
- **Segments** the video into chapters with descriptive titles
- **Exports** individual segments ready for distribution

Built with privacy and flexibility in mind, VideoSplice AI works with both local LLMs (Ollama, LM Studio) for air-gapped deployments and cloud APIs (OpenAI, Anthropic) for convenience.

## ✨ Features

### Currently Implemented (Frontend)

- ✅ **Video Upload & Preview** - Drag-and-drop interface with format validation
- ✅ **Custom Transcript Support** - Upload existing transcripts (.srt, .vtt, .txt)
- ✅ **Interactive Timeline Editor** - Visual timeline with draggable segment boundaries
- ✅ **AI-Powered Chapter Detection** - Real LLM integration for intelligent segmentation
- ✅ **Segment Review & Editing** - Edit titles, adjust boundaries, add/remove segments
- ✅ **Video Player** - Custom HTML5 player with timeline synchronization
- ✅ **LLM Configuration** - Flexible model selection and prompt customization
- ✅ **Job Queue UI** - Progress tracking with status badges and retry functionality
- ✅ **Export Interface** - Download individual or batch segments

### Planned Features (Backend Integration Required)

- 🚧 Real video file storage and processing
- 🚧 Automatic transcription with Whisper
- 🚧 Actual video splitting with FFmpeg
- 🚧 User authentication and team management
- 🚧 Project organization and quota management
- 🚧 WebSocket-based real-time updates
- 🚧 Batch processing capabilities

See [TODO.md](TODO.md) for detailed implementation progress.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Modern web browser (Chrome, Firefox, Edge, Safari)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/BobFrederick/videosplice-ai.git
   cd videosplice-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:5000
   ```

### Building for Production

```bash
npm run build
npm run preview
```

The production build will be in the `dist/` directory.

## 🏗️ Architecture

### Frontend Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 4 with custom design system
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Icons**: Phosphor Icons
- **State Management**: 
  - React Query for server state
  - useKV (Spark SDK) for persistence
  - React Context for global UI state
- **Forms**: react-hook-form with Zod validation
- **Notifications**: Sonner for toast messages

### Design System

The application uses a carefully crafted design system with:

- **Color Palette**: Triadic scheme with deep violet (brand), vibrant green (success), and amber (warning)
- **Typography**: Inter for UI, JetBrains Mono for technical content
- **Spacing**: 4px base unit with consistent component padding
- **Animations**: Purposeful motion under 300ms for responsiveness feedback

See [PRD.md](PRD.md) for complete design specifications.

### Backend (Planned)

- **Framework**: Node.js with Express/Fastify
- **Database**: PostgreSQL for relational data
- **Storage**: S3-compatible for video files
- **Queue**: BullMQ with Redis for job processing
- **Video Processing**: FFmpeg for transcoding and splitting
- **Transcription**: Whisper (local) or cloud APIs
- **LLM Integration**: LangChain abstraction layer

## 📁 Project Structure

```
videosplice-ai/
├── src/
│   ├── components/           # React components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── VideoPlayer.tsx  # Custom video player
│   │   ├── Timeline.tsx     # Interactive timeline editor
│   │   ├── SegmentEditor.tsx
│   │   └── ...
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities and types
│   ├── App.tsx              # Main application component
│   └── main.tsx             # Application entry point
├── PRD.md                   # Product Requirements Document
├── TODO.md                  # Implementation progress tracker
├── TIMELINE_IMPLEMENTATION.md # Technical documentation
└── package.json
```

## 🎯 Usage

### Basic Workflow

1. **Upload Video** - Drag and drop your video file or click to browse
2. **Preview & Confirm** - Review the video and optionally upload a transcript
3. **AI Analysis** - Click "Auto-Generate Segments" to analyze with LLM
4. **Review Segments** - Adjust boundaries, edit titles, add/remove segments
5. **Export** - Generate and download individual or all segments

### LLM Configuration

Click the settings icon to configure:

- **Model Selection**: Choose from GPT-4o, GPT-4o-mini, or other supported models
- **Custom Prompts**: Customize the system prompt for chapter detection
- **Test Connection**: Verify LLM connectivity before processing

### Timeline Interactions

- **Click** - Seek to position in video
- **Shift+Click** - Split segment at position
- **Drag Boundary** - Adjust segment boundaries
- **Ctrl+Click Segment** - Delete segment (merges adjacent)

See [TIMELINE_IMPLEMENTATION.md](TIMELINE_IMPLEMENTATION.md) for technical details.

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run optimize` - Optimize dependencies

### Development Guidelines

- **Code Style**: Follow existing patterns, use TypeScript strictly
- **Components**: Use functional components with hooks
- **Styling**: Use Tailwind utility classes, follow design system
- **State**: Prefer local state, use Context sparingly
- **Types**: Export types from `lib/types.ts`
- **Testing**: Add tests for critical business logic (when test infrastructure is added)

## 🤝 Contributing

Contributions are welcome! Here are some ways you can help:

### Areas for Contribution

1. **Backend Implementation**
   - RESTful API with Express/Fastify
   - Video processing pipeline with FFmpeg
   - Job queue system with BullMQ
   - Database schema and migrations

2. **Features**
   - Waveform visualization on timeline
   - Keyboard shortcuts for editor
   - Undo/redo functionality
   - Multi-language support

3. **Testing**
   - Unit tests for components
   - E2E tests for critical workflows
   - Performance benchmarks

4. **Documentation**
   - API documentation
   - Deployment guides
   - User tutorials

### Contribution Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run linter and tests (`npm run lint`)
5. Commit with descriptive messages
6. Push to your fork
7. Open a Pull Request

## 📋 Roadmap

### Phase 1: Core Functionality (In Progress)
- [x] Frontend UI complete
- [x] LLM integration
- [ ] Backend API implementation
- [ ] Real video processing

### Phase 2: Essential Features
- [ ] User authentication
- [ ] Transcription with Whisper
- [ ] Video splitting with FFmpeg
- [ ] Job queue system

### Phase 3: Advanced Features
- [ ] Multi-user support
- [ ] Project organization
- [ ] Quota management
- [ ] Waveform visualization

### Phase 4: Polish & Scale
- [ ] Performance optimization
- [ ] Comprehensive testing
- [ ] Docker deployment
- [ ] Documentation completion

See [TODO.md](TODO.md) for detailed progress tracking.

## 📖 Documentation

- **[PRD.md](PRD.md)** - Complete product requirements and design specifications
- **[TODO.md](TODO.md)** - Implementation progress and feature checklist
- **[TIMELINE_IMPLEMENTATION.md](TIMELINE_IMPLEMENTATION.md)** - Technical deep-dive on timeline component
- **[SECURITY.md](SECURITY.md)** - Security policy and vulnerability reporting

## 🐛 Known Issues

- Video processing is currently mocked (requires backend implementation)
- Export functionality generates placeholder files
- Real-time updates use polling (WebSocket integration planned)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [GitHub Spark](https://githubnext.com/projects/github-spark)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Phosphor Icons](https://phosphoricons.com/)
- Design inspired by Vercel and Linear

## 📞 Support

For questions, issues, or feature requests:

- Open an [issue](https://github.com/BobFrederick/videosplice-ai/issues)
- Check existing [discussions](https://github.com/BobFrederick/videosplice-ai/discussions)

---

**Status**: 🚧 Active Development - Frontend Complete, Backend In Progress

Built with ❤️ using React, TypeScript, and AI
