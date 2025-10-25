# 🎬 VideoSplice AI

Intelligent video segmentation powered by local AI. Upload your videos and let our system automatically create meaningful chapters using advanced speech-to-text and content analysis.

## ✨ Features

- **🎙️ Local Whisper Transcription**: High-quality speech-to-text using Whisper.cpp with GPU acceleration
- **🧠 Ollama LLM Integration**: Local AI-powered content analysis with Qwen2.5 7B and Mistral 7B models  
- **⚡ Real-time Queue System**: Sequential job processing with live progress tracking
- **📱 Modern UI**: Clean, responsive interface built with React 19 and Tailwind CSS
- **💾 Local Storage**: No external dependencies - everything runs locally
- **🔄 Progress Tracking**: Real-time updates with detailed status messages

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Whisper Server**
   ```bash
   node whisper-server.mjs
   ```

3. **Launch Development Server**
   ```bash
   npm run dev
   ```

4. **Open Browser**
   Navigate to `http://localhost:5001`

## 📁 Project Structure

```
videosplice-ai/
├── src/
│   ├── components/          # React UI components
│   ├── hooks/              # Custom React hooks (useLocalStorage)
│   ├── lib/                # Core services (whisper, types, utilities)
│   └── styles/             # CSS and theme files
├── docs/                   # Project documentation
├── whisper-server.mjs      # Whisper.cpp API server
└── package.json           # Dependencies and scripts
```

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js Express server for Whisper processing  
- **AI Models**: Whisper.cpp (transcription), Ollama (LLM analysis)
- **Storage**: localStorage for offline-first experience

📄 License For Spark Template Resources 

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.
