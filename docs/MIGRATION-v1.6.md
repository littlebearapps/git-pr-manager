# Migration Guide: v1.5.x → v1.7.0

**Version**: 1.7.0
**Date**: 2025-11-18
**Status**: Production

---

## Overview

Version 1.7.0 introduces **multi-language support** to `gpm verify`, enabling automatic detection and verification of Python, Node.js, Go, and Rust projects.

### What Changed

- `gpm verify` now auto-detects project language and package manager
- Intelligent command resolution for 4 languages (Python, Node.js, Go, Rust)
- Support for 8+ package managers (poetry, pipenv, uv, pip, npm, yarn, pnpm, bun, go-mod, cargo)
- Makefile integration (prefers Makefile targets when available)
- New `verification` section in `.gpm.yml` configuration

---

## Breaking Changes

**✅ NONE** - This release is fully backward compatible!

- Existing Node.js projects work without any changes
- All existing `.gpm.yml` configurations remain valid
- No changes required to workflows or scripts

---

## New Features

### 1. Automatic Language Detection

`gpm verify` now automatically detects your project language from marker files:

| Language | Detection Files |
|----------|----------------|
| **Python** | `pyproject.toml`, `Pipfile`, `requirements.txt` |
| **Node.js** | `package.json` |
| **Go** | `go.mod` |
| **Rust** | `Cargo.toml` |

**Example**:
```bash
# In a Python project with poetry
gpm verify
# ✓ Detected language: python
# ✓ Package manager: poetry
# ✓ poetry run ruff check .  (lint)
# ✓ poetry run mypy .         (typecheck)
# ✓ poetry run pytest         (test)
```

### 2. Package Manager Detection

Auto-detects package manager from lock files:

**Python**:
- `poetry.lock` → poetry
- `Pipfile.lock` → pipenv
- `uv.lock` → uv
- `requirements.txt` → pip

**Node.js**:
- `pnpm-lock.yaml` → pnpm
- `yarn.lock` → yarn
- `bun.lockb` → bun
- `package-lock.json` → npm

**Go**: `go.sum` → go modules

**Rust**: `Cargo.lock` → cargo

### 3. Makefile Integration

If your project has a `Makefile` with targets like `lint`, `test`, `build`, `gpm` will prefer those:

```makefile
# Makefile
lint:
    ruff check .
    mypy .

test:
    pytest tests/

build:
    python -m build
```

```bash
gpm verify
# Runs:
# ✓ make lint
# ✓ make test
# ✓ make build
```

### 4. Configuration Options

New `verification` section in `.gpm.yml`:

```yaml
verification:
  # Enable/disable auto-detection (default: true)
  detectionEnabled: true

  # Prefer Makefile targets over package manager (default: true)
  preferMakefile: true

  # Override specific commands
  commands:
    lint: "make lint"
    test: "make test"
    typecheck: "mypy src/"
    build: "python -m build"
```

---

## Migration Steps

### For Existing Node.js Projects

**✅ No action required!**

Your existing Node.js projects will continue to work exactly as before:

```bash
gpm verify
# Still runs:
# ✓ npm run lint
# ✓ npx tsc --noEmit
# ✓ npm test
# ✓ npm run build
```

### For Python Projects (New!)

1. **Install verification tools** (if not already installed):
   ```bash
   # Using poetry
   poetry add --group dev ruff mypy pytest

   # Using pip
   pip install ruff mypy pytest
   ```

2. **Run verification**:
   ```bash
   gpm verify
   # Auto-detects Python and runs appropriate commands
   ```

3. **Optional: Customize in `.gpm.yml`** (if needed):
   ```yaml
   verification:
     commands:
       lint: "ruff check . && pylint src/"
       typecheck: "mypy src/"
       test: "pytest tests/ --cov=src"
   ```

### For Go Projects (New!)

1. **Install verification tools** (if not already installed):
   ```bash
   go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
   ```

2. **Run verification**:
   ```bash
   gpm verify
   # Auto-detects Go and runs appropriate commands
   ```

### For Rust Projects (New!)

**No installation needed** - Rust tools are built-in with `cargo`:

```bash
gpm verify
# Auto-detects Rust and runs:
# ✓ cargo clippy   (lint)
# ✓ cargo test     (test)
# ✓ cargo build    (build)
```

---

## Command Resolution Priority

`gpm` resolves verification commands in this order:

1. **Custom commands** from `.gpm.yml` → `verification.commands`
2. **Makefile targets** (if `preferMakefile: true`)
3. **Package manager scripts** (e.g., `npm run lint`, `poetry run ruff`)
4. **Native tools** (e.g., `npx eslint`, `ruff check`)
5. **Not found** (step skipped gracefully)

### Example Resolution

**Python project with Makefile**:
```yaml
# .gpm.yml
verification:
  preferMakefile: true  # default
  commands:
    test: "pytest tests/ --cov=src"  # Override test command
```

```makefile
# Makefile
lint:
    ruff check .
```

```bash
gpm verify
# Resolution:
# lint:      make lint              (from Makefile - step 2)
# typecheck: poetry run mypy .      (from package manager - step 3)
# test:      pytest tests/ --cov=src (from config - step 1)
# build:     <skipped>               (not found - step 5)
```

---

## Troubleshooting

### Issue: "Detected wrong package manager"

**Solution**: Override in `.gpm.yml`:
```yaml
verification:
  detectionEnabled: false
  commands:
    lint: "poetry run ruff check ."
    test: "poetry run pytest"
```

### Issue: "Command not found" (tool not installed)

**Solution**: Install the missing tool:
```bash
# Python
pip install ruff mypy pytest

# Node.js
npm install -D eslint typescript jest

# Go
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
```

Or skip the step:
```bash
gpm verify --skip-lint
gpm verify --skip-typecheck
```

### Issue: "Wrong language detected"

**Rare edge case** - force language in `.gpm.yml`:
```yaml
verification:
  detectionEnabled: false
  commands:
    lint: "npm run lint"
    test: "npm test"
    build: "npm run build"
```

---

## Compatibility

### Supported Platforms

- ✅ macOS
- ✅ Linux
- ✅ Windows (with Git Bash or WSL)

### Node.js Versions

- ✅ Node.js 18.x
- ✅ Node.js 20.x (recommended)
- ✅ Node.js 22.x

### Python Versions

- ✅ Python 3.8+
- ✅ Python 3.9
- ✅ Python 3.10
- ✅ Python 3.11
- ✅ Python 3.12

---

## Testing Your Migration

### 1. Verify Language Detection

```bash
gpm verify --verbose
# Should show:
# Detected language: <your-language>
# Package manager: <your-package-manager>
```

### 2. Test Skip Options

```bash
gpm verify --skip-install --skip-typecheck
# Should skip those steps and run remaining verification
```

### 3. Check JSON Output

```bash
gpm verify --json
# Should include:
# {
#   "language": "...",
#   "packageManager": "...",
#   "steps": [...]
# }
```

---

## Rollback (If Needed)

If you encounter issues and need to rollback:

```bash
# Uninstall v1.7.0
npm uninstall -g @littlebearapps/git-pr-manager

# Reinstall v1.5.0
npm install -g @littlebearapps/git-pr-manager@1.5.0
```

---

## Getting Help

- **Issues**: https://github.com/littlebearapps/git-pr-manager/issues
- **Documentation**: Run `gpm docs`
- **Implementation Plan**: docs/debugging/multi-language-support-implementation-plan.md

---

## What's Next

**Phase 1b** (Future):
- Install step support (auto-run `poetry install`, `npm install`, etc.)
- Monorepo/workspace support
- Enhanced Makefile parsing
- Better error messages with install suggestions

---

**Questions?** Open an issue at https://github.com/littlebearapps/git-pr-manager/issues
