# Contributing to x402 Boilerplate

Thank you for your interest in contributing to the x402 Boilerplate! This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Contributions](#making-contributions)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Community](#community)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold this code.

**In summary:**
- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Assume good intentions

## Getting Started

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 20+ | JavaScript runtime |
| PHP | 8.4+ | Backend middleware |
| PostgreSQL | 16+ | Database (optional) |
| Composer | 2.x | PHP dependencies |

### Quick Start

```bash
# Clone the repository
git clone https://github.com/confluxarena/x402-boilerplate.git
cd x402-boilerplate

# Install dependencies
npm install
composer install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start development server
npm run dev
```

## Development Setup

### Environment Configuration

Required environment variables:

```bash
# Conflux eSpace Configuration
CONFLUX_RPC_URL=https://evm.confluxrpc.com
CONFLUX_CHAIN_ID=1030

# x402 Facilitator (for testing, use a test wallet)
X402_FACILITATOR_KEY=your_test_private_key
X402_TREASURY_ADDRESS=your_treasury_address

# API Settings
X402_API_PRICE=100  # Price in token smallest unit
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- middleware.test.js

# Run with coverage
npm run test:coverage
```

## Making Contributions

### Types of Contributions

| Type | Description | Label |
|------|-------------|-------|
| 🐛 Bug Fix | Fix existing functionality | `bug` |
| ✨ Feature | Add new functionality | `enhancement` |
| 📚 Documentation | Improve docs | `documentation` |
| 🧪 Tests | Add or improve tests | `testing` |
| ♻️ Refactor | Code improvements | `refactor` |

### Before You Start

1. **Check existing issues** - Your idea might already be discussed
2. **Open an issue first** - For significant changes, discuss before coding
3. **Fork the repository** - Work in your own fork
4. **Create a feature branch** - Never commit directly to `main`

## Coding Standards

### PHP (PSR-12)

```php
<?php

declare(strict_types=1);

namespace X402\Middleware;

class PaymentVerifier
{
    private const SUPPORTED_TOKENS = ['USDT0'];
    
    public function verify(array $payment): bool
    {
        // Implementation
    }
}
```

### JavaScript (ES6+)

```javascript
// Use ES modules
import { ethers } from 'ethers';

// Use async/await
async function verifyPayment(signature) {
    const result = await contract.verify(signature);
    return result;
}

// Use const/let, never var
const config = loadConfig();
let attempts = 0;
```

### General Guidelines

- **Comments**: Write self-documenting code; add comments only for complex logic
- **Functions**: Keep functions small and focused (< 50 lines)
- **Error Handling**: Always handle errors appropriately
- **Security**: Never log sensitive data; validate all inputs

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting, semicolons) |
| `refactor` | Code refactoring |
| `test` | Adding tests |
| `chore` | Maintenance tasks |

### Examples

```bash
feat(middleware): add request timeout configuration

fix(payment): handle expired signatures gracefully

docs(readme): add deployment instructions

test(verifier): add edge case tests for EIP-712
```

## Pull Request Process

### Checklist

Before submitting a PR, ensure:

- [ ] Code follows project style guidelines
- [ ] Tests pass locally (`npm test`)
- [ ] New code has appropriate test coverage
- [ ] Documentation is updated if needed
- [ ] Commit messages follow conventions
- [ ] PR description explains the changes

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Checklist
- [ ] Tests pass
- [ ] Docs updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. Submit PR against `main` branch
2. Automated checks run (linting, tests)
3. Maintainer reviews code
4. Address feedback if any
5. Maintainer merges after approval

## Community

### Getting Help

- **Questions**: Open a [Discussion](https://github.com/confluxarena/x402-boilerplate/discussions)
- **Bugs**: Open an [Issue](https://github.com/confluxarena/x402-boilerplate/issues)
- **Security**: Email security@confluxarena.org

### Recognition

Contributors are recognized in:
- GitHub Contributors page
- Release notes for significant contributions

---

Thank you for contributing to x402 Boilerplate! 🎉
