# Contributing to Splice

First off, thank you for considering contributing to Splice! It's people like you that make Splice such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct:

- **Be respectful**: Treat everyone with respect and kindness
- **Be collaborative**: Work together and help each other succeed
- **Be inclusive**: Welcome diverse perspectives and experiences
- **Be constructive**: Provide helpful feedback and suggestions

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (screenshots, code snippets, etc.)
- **Describe the behavior you observed** and what you expected
- **Include your environment details** (OS, Node version, browser, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a step-by-step description** of the suggested enhancement
- **Explain why this enhancement would be useful**
- **Include mockups or examples** if applicable

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the coding style** of the project (we use TypeScript, ESLint, and Prettier)
3. **Write clear commit messages** (use conventional commits format)
4. **Include tests** if you're adding functionality
5. **Update documentation** to reflect your changes
6. **Ensure all tests pass** before submitting

#### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(timeline): add hover timestamp tooltip
fix(export): correct VTT file URL construction
docs(readme): update installation instructions
```

## Development Setup

### Prerequisites

- **Node.js** 18+ and npm
- **Redis** 6+
- **FFmpeg** 4.4+
- **Ollama** with Qwen2.5:7b or Mistral:7b model
- **Whisper.cpp** with a model file

### Local Development

1. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/videosplice-ai.git
   cd videosplice-ai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

3. **Start Redis:**
   ```bash
   redis-server
   ```

4. **Start Ollama:**
   ```bash
   ollama serve
   ollama pull qwen2.5:7b
   ```

5. **Start Whisper server:**
   ```bash
   node whisper-server.mjs
   ```

6. **Start backend server:**
   ```bash
   cd server
   npm run dev
   ```

7. **Start frontend dev server:**
   ```bash
   npm run dev
   ```

### Project Structure

```
videosplice-ai/
├── src/                    # Frontend React application
│   ├── components/         # UI components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities and types
│   └── services/          # API services
├── server/                # Backend Express application
│   ├── src/
│   │   ├── services/      # Business logic
│   │   ├── workers/       # BullMQ workers
│   │   └── app.ts         # Express app setup
│   └── uploads/           # Temporary file storage
├── shared/                # Shared code (LLM segmentation)
└── docs/                  # Documentation
```

### Coding Standards

- **TypeScript**: Use strict mode, avoid `any` types
- **React**: Use functional components with hooks
- **Styling**: Use Tailwind CSS utility classes
- **Components**: Follow shadcn/ui patterns for new components
- **API**: RESTful endpoints with proper error handling
- **Async**: Use async/await, handle errors gracefully

### Testing

Currently, the project uses manual testing. We welcome contributions to add automated tests:

- Unit tests (Jest/Vitest)
- Integration tests
- E2E tests (Playwright/Cypress)

## Areas We Need Help

### High Priority
- [ ] Automated test suite
- [ ] Docker containerization
- [ ] Performance optimizations for large videos
- [ ] Batch processing support
- [ ] Additional export formats (SRT, ASS subtitles)

### Medium Priority
- [ ] Keyboard shortcuts documentation
- [ ] Video preview in export view
- [ ] Segment merging functionality
- [ ] Custom color themes
- [ ] Export presets (quality settings)

### Documentation
- [ ] API documentation
- [ ] Architecture diagrams
- [ ] Video tutorials
- [ ] Troubleshooting guide

## Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **Discussions**: For questions and general discussion
- **Documentation**: Check the `/docs` folder for detailed guides

## Recognition

Contributors will be recognized in:
- The project README
- Release notes
- Our Contributors page (coming soon)

Thank you for contributing to Splice! 🎬✨
