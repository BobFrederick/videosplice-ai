# Contributing to VideoSplice AI

Thank you for your interest in contributing to VideoSplice AI! This guide will help you get started.

## 🎯 How Can I Contribute?

### Reporting Bugs

If you find a bug, please open an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Your environment (OS, browser, Node version)

### Suggesting Features

Feature suggestions are welcome! Please:
- Check existing issues to avoid duplicates
- Provide clear use cases
- Explain how it aligns with the project goals (see [PRD.md](PRD.md))

### Code Contributions

We welcome pull requests for:
- Bug fixes
- New features (discuss in an issue first)
- Documentation improvements
- Performance optimizations
- Test coverage

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git
- A code editor (VS Code recommended)

### Development Setup

1. **Fork and clone**
   ```bash
   git clone https://github.com/YOUR-USERNAME/videosplice-ai.git
   cd videosplice-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start dev server**
   ```bash
   npm run dev
   ```

4. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 📝 Development Guidelines

### Code Style

- **TypeScript**: Use strict typing, avoid `any`
- **Components**: Functional components with hooks
- **Formatting**: Follow existing code patterns
- **Naming**: 
  - Components: PascalCase (`VideoPlayer.tsx`)
  - Functions: camelCase (`handleUpload`)
  - Constants: UPPER_CASE (`MAX_FILE_SIZE`)

### Component Structure

```typescript
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { YourType } from '@/lib/types'

interface YourComponentProps {
  prop1: string
  prop2?: number
}

export function YourComponent({ prop1, prop2 = 0 }: YourComponentProps) {
  const [state, setState] = useState<YourType>()
  
  const handleAction = () => {
    // Implementation
  }
  
  return (
    <div className="container">
      {/* JSX */}
    </div>
  )
}
```

### Styling Guidelines

- Use Tailwind utility classes
- Follow the design system (see [PRD.md](PRD.md))
- Ensure responsive design (mobile-first)
- Test in multiple browsers

### Git Workflow

1. **Make focused commits**
   ```bash
   git add src/components/YourComponent.tsx
   git commit -m "feat: add YourComponent for X functionality"
   ```

2. **Commit message format**
   ```
   type(scope): description
   
   [optional body]
   ```
   
   Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

3. **Keep branch updated**
   ```bash
   git fetch origin
   git rebase origin/main
   ```

4. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

### Pull Request Process

1. **Before submitting**
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Comments added for complex logic
   - [ ] No console.logs or debugging code
   - [ ] Build passes (`npm run build`)
   - [ ] Lint passes (`npm run lint`)

2. **PR description should include**
   - What changed and why
   - Related issue number (if applicable)
   - Screenshots for UI changes
   - Breaking changes (if any)

3. **Template**
   ```markdown
   ## Description
   Brief description of changes
   
   ## Related Issue
   Closes #123
   
   ## Changes Made
   - Added X feature
   - Fixed Y bug
   - Updated Z documentation
   
   ## Screenshots
   [If applicable]
   
   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-reviewed
   - [ ] Build passes
   - [ ] Lint passes
   ```

## 🏗️ Architecture Notes

### Frontend Structure

```
src/
├── components/        # React components
│   ├── ui/           # Reusable UI primitives (shadcn/ui)
│   ├── VideoPlayer.tsx
│   ├── Timeline.tsx
│   └── ...
├── hooks/            # Custom React hooks
├── lib/              # Utilities and types
│   ├── types.ts     # TypeScript types
│   └── utils.ts     # Helper functions
└── App.tsx           # Main app component
```

### State Management

- **Local state**: `useState` for component-specific state
- **Persistent state**: `useKV` for data that needs to survive refresh
- **Server state**: React Query (when backend is implemented)
- **Global state**: Context API (use sparingly)

### Key Technologies

- **React 19**: Latest features including React Compiler
- **TypeScript**: Strict mode enabled
- **Vite**: Fast dev server and build tool
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: High-quality component primitives

## 🧪 Testing (Coming Soon)

When test infrastructure is added:

- Write tests for new features
- Update tests for bug fixes
- Aim for meaningful coverage, not just numbers
- Test edge cases

## 📖 Documentation

- Update README.md for new features
- Add JSDoc comments for complex functions
- Update PRD.md if changing design/UX
- Keep TODO.md in sync with progress

## 🎨 UI/UX Contributions

For design changes:

- Follow the design system in [PRD.md](PRD.md)
- Ensure accessibility (WCAG 2.1 Level AA)
- Test on mobile and desktop
- Consider dark mode (future feature)
- Include screenshots in PR

## 🔧 Backend Contributions (Future)

When backend development starts:

- Follow Node.js best practices
- Use TypeScript throughout
- Write API documentation
- Add integration tests
- Consider security implications

## ❓ Questions?

- Check [README.md](README.md) first
- Review [PRD.md](PRD.md) for product context
- Search existing issues
- Ask in issue discussions
- Open a new issue for general questions

## 📜 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the project
- Show empathy towards others

## 🙏 Recognition

Contributors will be recognized in:
- GitHub contributors page
- Release notes for significant contributions

Thank you for making VideoSplice AI better! 🎉
