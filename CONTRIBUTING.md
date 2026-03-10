# Contributing to DocEase

First off, thank you for considering contributing to DocEase! 🎉

It's people like you that make DocEase such a great tool for simplifying complex documents for common people.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)

## Code of Conduct

This project and everyone participating in it is governed by our commitment to creating a welcoming and inclusive environment. By participating, you are expected to uphold this code.

### Our Standards

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the behavior
- **Expected vs actual behavior**
- **Screenshots** if applicable
- **Environment details** (OS, browser, Node version)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear title and description**
- **Use case** - why is this enhancement useful?
- **Potential implementation** approach (optional)
- **Alternative solutions** you've considered

### Your First Code Contribution

Unsure where to begin? Look for issues labeled:

- `good-first-issue` - Simple issues for beginners
- `help-wanted` - Issues where we need community help
- `documentation` - Documentation improvements

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following our style guidelines
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Ensure the test suite passes** (`npm run type-check`)
6. **Submit your pull request**

## Development Setup

### Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Git
- Supabase account (for database/auth testing)

### Setup Steps

1. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/DocEase.git
   cd DocEase
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your test credentials
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Verify setup**
   - Open http://localhost:3000
   - Try uploading a test document
   - Check that processing works

### Running Tests

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build test
npm run build
```

## Pull Request Process

### Before Submitting

- [ ] Code follows TypeScript style guidelines
- [ ] Self-review of code completed
- [ ] Comments added for complex logic
- [ ] Documentation updated if needed
- [ ] No new warnings or errors introduced
- [ ] Type checking passes (`npm run type-check`)
- [ ] Tested on local environment

### PR Checklist

1. **Update the README.md** if you've added features
2. **Update FEATURES.md** to reflect implementation status
3. **Add yourself to contributors** if this is your first PR
4. **Update CHANGELOG.md** with your changes
5. **Link related issues** in PR description

### PR Title Format

Use clear, descriptive titles:

```
feat: Add PDF annotation support
fix: Resolve OCR memory leak on large files
docs: Update API documentation for v2
refactor: Simplify LLM service architecture
test: Add unit tests for document classification
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Motivation and Context
Why is this change needed? What problem does it solve?

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update

## How Has This Been Tested?
Describe your testing approach

## Screenshots (if applicable)

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where needed
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
```

## Style Guidelines

### TypeScript

- Use **TypeScript strict mode**
- Prefer **interfaces over types** for object shapes
- Use **meaningful variable names**
- Add **JSDoc comments** for complex functions
- Avoid `any` - use proper types or `unknown`

Example:
```typescript
/**
 * Extract text from a document using OCR
 * @param file - The file to process
 * @returns Promise resolving to OCR result
 */
async function extractText(file: File): Promise<OCRResult> {
  // Implementation
}
```

### React Components

- Use **functional components** with hooks
- Prefer **named exports** over default exports
- Use **TypeScript interfaces** for props
- Keep components **small and focused**
- Extract **reusable logic** into custom hooks

Example:
```typescript
interface DocumentCardProps {
  document: Document;
  onDelete: (id: string) => void;
}

export function DocumentCard({ document, onDelete }: DocumentCardProps) {
  // Component implementation
}
```

### File Organization

```
component-name/
├── ComponentName.tsx      # Main component
├── ComponentName.test.tsx # Tests (if applicable)
├── index.ts               # Barrel export
└── types.ts               # Component-specific types
```

### CSS/Styling

- Use **Tailwind CSS** utility classes
- Follow **mobile-first** approach
- Use **semantic color names** from theme
- Avoid **inline styles** unless necessary

Example:
```tsx
<div className="flex flex-col gap-4 p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
  {/* Content */}
</div>
```

## Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(ocr): Add support for multi-page PDF processing

- Implement page-by-page OCR extraction
- Add progress tracking for long documents
- Update UI to show per-page status

Closes #123
```

```
fix(auth): Resolve session expiry redirect loop

The middleware was causing infinite redirects when sessions expired.
Now properly handles expired sessions and redirects to login.

Fixes #456
```

### Scope

Use the area of code affected:
- `auth` - Authentication
- `ocr` - OCR processing
- `llm` - AI/LLM services
- `ui` - User interface
- `api` - API routes
- `db` - Database
- `docs` - Documentation

## Project Structure

```
DocEase/
├── app/              # Next.js App Router
│   ├── api/         # API routes
│   ├── (auth)/      # Auth pages
│   └── dashboard/   # Protected pages
├── components/       # Reusable components
├── services/         # Business logic
├── lib/             # Utility functions
├── types/           # TypeScript types
├── config/          # Configuration
└── supabase/        # Database scripts
```

## Getting Help

- 💬 Join our [Discussions](https://github.com/jagadishsnaik/DocEase/discussions)
- 📧 Email: jagadishsnaik@example.com
- 🐦 Twitter: [@jagadishsnaik](https://twitter.com/jagadishsnaik)

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for their contributions
- Project documentation

---

## Thank You! ❤️

Your contributions, large or small, make a difference. Thank you for helping make DocEase better for everyone!

**— Jagadish S Naik**
