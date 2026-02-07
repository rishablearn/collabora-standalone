# Contributing to Collabora Standalone

Thank you for your interest in contributing to Collabora Standalone! This document provides guidelines and information for contributors.

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all experience levels.

## How to Contribute

### Reporting Issues

1. **Check existing issues** - Search the issue tracker to avoid duplicates
2. **Use the issue template** - Provide detailed information including:
   - Description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Docker version, etc.)
   - Relevant logs

### Submitting Pull Requests

1. **Fork the repository** and create a feature branch
2. **Follow coding standards** - Match the existing code style
3. **Write clear commit messages** - Use conventional commit format
4. **Test your changes** - Ensure all components work together
5. **Update documentation** - If your changes affect usage or setup
6. **Submit a PR** - Reference any related issues

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/collabora-standalone.git
cd collabora-standalone

# Run setup
chmod +x scripts/*.sh
./scripts/setup.sh

# Start development environment
docker compose up -d
```

### Project Structure

```
collabora-standalone/
├── wopi-server/          # Node.js WOPI server
│   └── src/
│       ├── routes/       # API endpoints
│       ├── middleware/   # Auth, validation
│       └── utils/        # Helper functions
├── web-frontend/         # React application
│   └── src/
│       ├── pages/        # Page components
│       └── components/   # Reusable UI
├── nginx/                # Reverse proxy config
└── scripts/              # Deployment scripts
```

### Coding Guidelines

#### JavaScript/Node.js
- Use ES6+ features
- Async/await for asynchronous operations
- Descriptive variable and function names
- Handle errors appropriately

#### React
- Functional components with hooks
- Component files in PascalCase
- Keep components focused and reusable

#### Docker
- Minimize image layers
- Use multi-stage builds where appropriate
- Pin version numbers for reproducibility

## Areas for Contribution

- **Bug fixes** - Check the issue tracker
- **Documentation** - Improvements and translations
- **Testing** - Unit tests, integration tests
- **Features** - Discuss in an issue first
- **Performance** - Optimization improvements
- **Security** - Responsible disclosure for vulnerabilities

## Questions?

Open a discussion or issue for any questions about contributing.
