# Repository Security Guide

**Version**: 1.4.0
**Last Updated**: 2025-11-14

---

## Overview

This guide provides comprehensive security recommendations for setting up repositories with `git-pr-manager` (`gpm`), covering branch protection, GitHub Actions security, secrets management, and Claude Code directory security.

## Quick Reference

| Repository Type | gpm Preset | Required Reviews | Status Checks | Use Case |
|----------------|------------|------------------|---------------|----------|
| **Personal/Experimental** | `basic` | 0 | None | Prototypes, learning projects |
| **Team/Open Source** | `standard` | 0-1 (optional) | ci, security | Team projects, OSS libraries |
| **Production/Critical** | `strict` | 1+ | ci, security, tests, lint | Production systems, critical infrastructure |

---

## 1. Repository Types & Security Settings

### 1.1 Personal/Experimental Projects

**Use Case**: Solo development, prototypes, learning projects, quick experiments

**gpm Configuration**:
```bash
# Initialize with basic preset
gpm init --template basic

# Or apply protection manually
gpm protect --preset basic
```

**Settings**:
- ✅ **No required reviews** - Fast iteration
- ✅ **No required status checks** - Minimal friction
- ✅ **No admin enforcement** - Full control
- ⚠️ **Block force pushes** - Prevent accidental history rewrite
- ⚠️ **Block deletions** - Prevent accidental branch deletion

**GitHub Token Security**:
```bash
# Recommended: Use session-based token (no persistence needed)
export GITHUB_TOKEN="ghp_your_token_here"

# Or add to shell profile for convenience
echo 'export GITHUB_TOKEN="ghp_your_token_here"' >> ~/.zshrc
```

**Branch Protection**:
```yaml
# .gpm.yml
branchProtection:
  enabled: true
  requireReviews: 0
  requiredStatusChecks: []
  allowForcePushes: false
  allowDeletions: false
```

---

### 1.2 Team/Open Source Projects

**Use Case**: Team collaboration, open source libraries, shared repositories

**gpm Configuration**:
```bash
# Initialize with standard preset (recommended)
gpm init --template standard

# Or apply protection manually
gpm protect --preset standard
```

**Settings**:
- ✅ **Optional reviews** (0-1) - Balance quality and velocity
- ✅ **Required checks**: ci, security - Ensure basic quality
- ✅ **Strict branch updates** - Require up-to-date branches
- ✅ **Dismiss stale reviews** - Keep reviews current
- ✅ **Require conversation resolution** - No unresolved threads
- ✅ **Block force pushes** - Protect shared history
- ✅ **Block deletions** - Prevent accidental loss

**GitHub Token Security**:
```bash
# Recommended: direnv + .envrc (per-project isolation)
echo 'export GITHUB_TOKEN="ghp_your_token_here"' > .envrc
direnv allow
echo '.envrc' >> .gitignore  # CRITICAL: Prevent token leak
```

**Branch Protection**:
```yaml
# .gpm.yml
branchProtection:
  enabled: true
  requireReviews: 0  # or 1 for mandatory reviews
  requiredStatusChecks:
    - ci
    - security
  strictChecks: true
  dismissStaleReviews: true
  requireConversationResolution: true
  allowForcePushes: false
  allowDeletions: false
```

**Recommended CI Checks**:
```yaml
# .github/workflows/ci.yml
name: CI
on: [pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: npm test

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Security scan
        run: gpm security
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

### 1.3 Production/Critical Systems

**Use Case**: Production applications, critical infrastructure, financial systems

**gpm Configuration**:
```bash
# Initialize with strict preset
gpm init --template strict

# Or apply protection manually
gpm protect --preset strict
```

**Settings**:
- ✅ **1+ required reviews** - Mandatory peer review
- ✅ **Code owner reviews** - Domain expert approval
- ✅ **Required checks**: ci, security, tests, lint - Comprehensive validation
- ✅ **Strict branch updates** - Always up-to-date
- ✅ **Dismiss stale reviews** - Re-review after changes
- ✅ **Linear history** - Clean commit history
- ✅ **Enforce for admins** - No exceptions
- ✅ **Block force pushes** - Immutable history
- ✅ **Block deletions** - Prevent data loss

**GitHub Token Security**:
```bash
# Recommended: direnv + keychain (maximum security)
# 1. Store token in macOS Keychain
security add-generic-password -a "$USER" -s "GITHUB_PAT" -w "ghp_your_token_here"

# 2. Create .envrc with keychain integration
echo 'source ~/bin/kc.sh && export GITHUB_TOKEN=$(kc_get GITHUB_PAT)' > .envrc
direnv allow
echo '.envrc' >> .gitignore

# Run gpm doctor to verify setup
gpm doctor
```

**Branch Protection**:
```yaml
# .gpm.yml
branchProtection:
  enabled: true
  requireReviews: 1  # Minimum 1 reviewer
  requireCodeOwnerReviews: true
  dismissStaleReviews: true
  requiredStatusChecks:
    - ci
    - security
    - tests
    - lint
  strictChecks: true
  requireConversationResolution: true
  requireLinearHistory: true
  enforceForAdmins: true
  allowForcePushes: false
  allowDeletions: false
```

**Comprehensive CI Pipeline**:
```yaml
# .github/workflows/ci.yml
name: CI
on: [pull_request]

permissions:
  contents: read
  pull-requests: write
  checks: read
  statuses: read

jobs:
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Security scan
        run: gpm security
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  tests:
    name: Tests
    runs-on: ubuntu-latest
    needs: security
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: npm test
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  lint:
    name: Lint
    runs-on: ubuntu-latest
    needs: security
    steps:
      - uses: actions/checkout@v4
      - name: Run linter
        run: npm run lint

  ci:
    name: CI Summary
    runs-on: ubuntu-latest
    needs: [security, tests, lint]
    if: always()
    steps:
      - name: Check all passed
        run: |
          if [ "${{ needs.security.result }}" != "success" ] || \
             [ "${{ needs.tests.result }}" != "success" ] || \
             [ "${{ needs.lint.result }}" != "success" ]; then
            exit 1
          fi
```

---

## 2. GitHub Actions Security

### 2.1 Minimal Permissions (Principle of Least Privilege)

**Default workflow permissions** (use the minimum needed):

```yaml
# .github/workflows/ci.yml
permissions:
  contents: read         # Read repository content
  pull-requests: write   # Create/update PRs (if needed)
  checks: read          # Read CI check status
  statuses: read        # Read commit statuses

# If you DON'T need PR comments, use even less:
permissions:
  contents: read
  checks: read
```

**Permission Matrix**:

| Permission | Read | Write | Use Case |
|------------|------|-------|----------|
| `contents` | ✅ | ⚠️ | Read: checkout code. Write: push commits |
| `pull-requests` | ✅ | ⚠️ | Read: view PRs. Write: create/update PRs |
| `checks` | ✅ | ⚠️ | Read: view CI status. Write: create checks |
| `statuses` | ✅ | ⚠️ | Read: view commit status. Write: set status |
| `issues` | ✅ | ⚠️ | Read: view issues. Write: create/comment |

**Best Practices**:
- ✅ Always specify permissions explicitly (don't rely on defaults)
- ✅ Use `read` when possible, only `write` when necessary
- ✅ Grant permissions per-job, not workflow-wide
- ❌ Never use `permissions: write-all` in production

---

### 2.2 Secrets Management

**GITHUB_TOKEN vs Custom Tokens**:

```yaml
# Use built-in GITHUB_TOKEN for basic operations (preferred)
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

# Only create custom token if you need:
# - Cross-repository access
# - Package registry access
# - Higher rate limits
# - Long-lived credentials
env:
  GITHUB_TOKEN: ${{ secrets.CUSTOM_GITHUB_TOKEN }}
```

**Creating Custom Tokens**:

1. **Generate token**: https://github.com/settings/tokens
2. **Required scopes**:
   - `repo` - Full control of private repositories
   - `workflow` - Update GitHub Actions workflows (if needed)
3. **Add as repository secret**:
   - Go to repository → Settings → Secrets and variables → Actions
   - Add secret named `CUSTOM_GITHUB_TOKEN`

**Security Rules**:
- ✅ Use `GITHUB_TOKEN` for 90% of operations
- ✅ Store custom tokens in repository secrets (never in code)
- ✅ Use environment-specific secrets for different deployment stages
- ✅ Rotate tokens regularly (every 90 days recommended)
- ❌ Never commit tokens to `.env` files
- ❌ Never log token values in CI output

---

### 2.3 Third-Party Actions Security

**Trusted Actions** (use specific version tags):

```yaml
# ✅ Good: Pinned to specific SHA (most secure)
- uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608  # v4.1.0

# ✅ Good: Pinned to major version
- uses: actions/checkout@v4

# ⚠️ Okay: Pinned to minor version
- uses: actions/checkout@v4.1

# ❌ Bad: Using latest (security risk)
- uses: actions/checkout@main
```

**Action Vetting Checklist**:
- ✅ Verify author (prefer `actions/*` official actions)
- ✅ Check stars/downloads (popular = more vetted)
- ✅ Review source code (GitHub repository)
- ✅ Check recent updates (actively maintained?)
- ✅ Use specific version (not `@main` or `@latest`)
- ✅ Read permissions required
- ❌ Avoid actions requesting excessive permissions

**Recommended Actions**:
```yaml
# Official GitHub Actions (trusted)
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
- uses: actions/upload-artifact@v4
- uses: actions/cache@v4

# Verified third-party actions
- uses: codecov/codecov-action@v3  # Code coverage
- uses: docker/build-push-action@v5  # Docker builds
```

---

### 2.4 Workflow Security Patterns

**Secure PR Workflow**:

```yaml
name: Secure PR Workflow
on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Security scan
        run: gpm security
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Fail if secrets found
        if: failure()
        run: |
          echo "::error::Security scan failed - secrets or vulnerabilities detected"
          exit 1

  tests:
    runs-on: ubuntu-latest
    needs: security  # Block on security
    steps:
      - uses: actions/checkout@v4
      - run: npm test
```

**Secure Deployment Workflow**:

```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.example.com
    steps:
      - uses: actions/checkout@v4

      - name: Verify all checks passed
        run: |
          # Use gpm to verify CI status
          gpm checks ${{ github.event.pull_request.number }} --json | \
          jq -e '.overallStatus == "success"'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Deploy
        run: ./deploy.sh
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

---

## 3. Claude Code Directory Security

### 3.1 GitHub Token Setup (direnv + Keychain)

**Recommended Setup** (high security):

```bash
# 1. Install prerequisites
brew install direnv  # macOS
# apt install direnv  # Linux

# 2. Configure shell (add to ~/.zshrc or ~/.bashrc)
eval "$(direnv hook zsh)"  # or bash

# 3. Set up keychain helper (if not already done)
# Create ~/bin/kc.sh with keychain functions
# See: https://github.com/littlebearapps/keychain-utils

# 4. Store GitHub token in keychain
security add-generic-password -a "$USER" -s "GITHUB_PAT" -w "ghp_your_token_here"

# 5. Create .envrc in project directory
cd /path/to/project
echo 'source ~/bin/kc.sh && export GITHUB_TOKEN=$(kc_get GITHUB_PAT)' > .envrc
direnv allow

# 6. Add .envrc to .gitignore
echo '.envrc' >> .gitignore

# 7. Verify setup
gpm doctor
```

**Security Levels**:

| Method | Security | Persistence | Use Case |
|--------|----------|-------------|----------|
| **direnv + keychain** | High | Per-directory | Team/production projects |
| **direnv + .envrc** | Medium | Per-directory | Team projects, OSS |
| **Shell profile** | Medium | Global | Personal projects |
| **.env file** | Low | Per-project | Local dev only (add to .gitignore!) |
| **Current session** | Low | Session only | Quick testing |

**Run `gpm doctor` to get context-aware recommendations**:
```bash
gpm doctor  # Shows smart suggestions based on your system
```

---

### 3.2 .gitignore Security Patterns

**Essential Patterns** (add to `.gitignore`):

```gitignore
# Secrets and credentials
.env
.env.local
.env.*.local
.envrc
*.pem
*.key
*.crt
secrets.yml
credentials.json

# gpm specific
.gpm-cache/

# MCP server credentials
.mcp/credentials.json

# macOS Keychain exports
*.keychain-db

# Node.js
node_modules/
npm-debug.log
.npm/

# IDE
.vscode/settings.json  # May contain secrets
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Build artifacts
dist/
build/
*.log
```

**Verify no secrets committed**:
```bash
# Run gpm security scan
gpm security

# Or manually with detect-secrets
detect-secrets scan --baseline .secrets.baseline
```

---

### 3.3 MCP Server Security

**MCP Configuration Security**:

```json
// .mcp.json - DO NOT COMMIT CREDENTIALS
{
  "servers": {
    "zen": {
      "command": "npx",
      "args": ["-y", "@littlebearapps/zen-mcp"],
      "env": {
        // ✅ Good: Reference environment variable
        "OPENAI_API_KEY": "${OPENAI_API_KEY}",

        // ❌ Bad: Hardcoded credential
        "OPENAI_API_KEY": "sk-proj-abc123..."
      }
    }
  }
}
```

**Best Practices**:
- ✅ Store MCP credentials in environment variables
- ✅ Use keychain for API keys
- ✅ Add `.mcp.json` to `.gitignore` if it contains secrets
- ✅ Use separate keys for dev/staging/production
- ❌ Never commit API keys directly in `.mcp.json`

**Example Secure Setup**:
```bash
# Store API keys in keychain
security add-generic-password -a "$USER" -s "OPENAI_API_KEY" -w "sk-proj-..."

# Add to .envrc
echo 'source ~/bin/kc.sh && export OPENAI_API_KEY=$(kc_get OPENAI_API_KEY)' >> .envrc
direnv allow
```

---

## 4. Repository Settings Checklist

### 4.1 Initial Setup

**New Repository Security Checklist**:

```bash
# 1. Initialize gpm configuration
cd /path/to/repo
gpm init --template standard  # or strict for production

# 2. Set up GitHub token (choose security level)
gpm doctor  # Get smart recommendations

# 3. Configure branch protection
gpm protect --preset standard  # or strict

# 4. Set up .gitignore
curl -o .gitignore https://www.toptal.com/developers/gitignore/api/node,macos,linux,windows

# 5. Add security-specific patterns
cat >> .gitignore << 'EOF'
# Security
.env*
.envrc
*.pem
*.key
secrets.yml
EOF

# 6. Run security scan
gpm security

# 7. Install git hooks (optional but recommended)
gpm install-hooks

# 8. Create initial commit
git add .
git commit -m "chore: initialize repository with security settings"
git push
```

---

### 4.2 GitHub Repository Settings

**Security Settings** (navigate to Settings → Security):

1. **Dependabot Alerts** ✅ Enable
   - Automatic security updates for dependencies
   - GitHub will create PRs for vulnerable packages

2. **Secret Scanning** ✅ Enable
   - Detects committed secrets
   - Automatic alerts when secrets found

3. **Code Scanning** ✅ Enable (if applicable)
   - CodeQL analysis for security vulnerabilities
   - Recommended for production projects

4. **Private Vulnerability Reporting** ✅ Enable
   - Allows security researchers to report issues privately
   - Recommended for public repositories

---

### 4.3 Branch Protection Rules

**Configure via GitHub UI** (Settings → Branches → Add rule):

**Standard Protection**:
- ✅ Require a pull request before merging
- ✅ Require approvals: 0 (or 1 for team projects)
- ✅ Dismiss stale pull request approvals
- ✅ Require status checks to pass: `ci`, `security`
- ✅ Require branches to be up to date
- ✅ Require conversation resolution
- ✅ Do not allow bypassing settings (uncheck)
- ✅ Restrict who can push (optional)

**Or use gpm**:
```bash
gpm protect --preset standard
gpm protect --show  # Verify settings
```

---

### 4.4 Environment Protection Rules

**For Production Deployments** (Settings → Environments → production):

1. **Deployment Protection Rules**:
   - ✅ Required reviewers: 1+ people
   - ✅ Wait timer: 5 minutes (think before deploy)
   - ✅ Deployment branches: main only

2. **Environment Secrets**:
   - ✅ `DEPLOY_TOKEN` - Production deployment credentials
   - ✅ `API_KEY_PROD` - Production API keys
   - ✅ Separate from development secrets

3. **Environment Variables**:
   - ✅ `ENVIRONMENT=production`
   - ✅ `LOG_LEVEL=error`

---

## 5. Security Audit Checklist

### 5.1 Pre-Production Audit

**Before deploying to production**:

```bash
# 1. Verify branch protection
gpm protect --show

# 2. Run security scan
gpm security

# 3. Check for committed secrets
git log --all --oneline --grep="password\|secret\|key\|token" -i

# 4. Verify .gitignore coverage
git ls-files | grep -E "\.env|\.pem|\.key|secrets"  # Should be empty

# 5. Check CI status
gpm status

# 6. Verify required checks configured
cat .gpm.yml | grep -A 10 "requiredStatusChecks"

# 7. Review GitHub token setup
gpm doctor
```

---

### 5.2 Ongoing Security

**Regular Security Tasks**:

| Task | Frequency | Command |
|------|-----------|---------|
| Update dependencies | Weekly | `npm audit fix` |
| Scan for secrets | Every commit | `gpm security` |
| Rotate GitHub tokens | 90 days | https://github.com/settings/tokens |
| Review branch protection | Monthly | `gpm protect --show` |
| Audit repository access | Quarterly | Settings → Manage access |
| Check Dependabot alerts | Weekly | Security → Dependabot |

**Automated Security Checks**:

```yaml
# .github/workflows/security-audit.yml
name: Security Audit
on:
  schedule:
    - cron: '0 9 * * 1'  # Weekly on Monday
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Security scan
        run: gpm security
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: npm audit
        run: npm audit --audit-level=moderate

      - name: Branch protection check
        run: gpm protect --show --json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 6. Common Security Mistakes

### 6.1 What NOT to Do

❌ **Committing secrets**:
```bash
# BAD: .env file with credentials
GITHUB_TOKEN=ghp_abc123...
DATABASE_URL=postgres://user:pass@host/db

# GOOD: .env.example with placeholders
GITHUB_TOKEN=ghp_your_token_here
DATABASE_URL=postgres://user:password@localhost/dbname
```

❌ **Weak branch protection**:
```yaml
# BAD: No protection
branchProtection:
  enabled: false

# GOOD: Appropriate protection
branchProtection:
  enabled: true
  requireReviews: 1
  requiredStatusChecks: [ci, security]
```

❌ **Overly permissive GitHub Actions**:
```yaml
# BAD: Write-all permissions
permissions: write-all

# GOOD: Minimal permissions
permissions:
  contents: read
  checks: read
```

❌ **Ignoring security warnings**:
```bash
# BAD: Ignoring Dependabot alerts
# (Letting vulnerable dependencies accumulate)

# GOOD: Addressing promptly
npm audit fix
# Review and merge Dependabot PRs within 7 days
```

---

## 7. Quick Start Templates

### 7.1 Personal Project

```bash
# Setup
gpm init --template basic
echo 'export GITHUB_TOKEN="ghp_..."' >> ~/.zshrc
gpm protect --preset basic

# .gitignore
echo ".env*" >> .gitignore
echo ".envrc" >> .gitignore
```

### 7.2 Team Project

```bash
# Setup
gpm init --template standard
echo 'export GITHUB_TOKEN="ghp_..."' > .envrc
direnv allow
echo '.envrc' >> .gitignore
gpm protect --preset standard
gpm install-hooks

# CI
# Copy from "Team/Open Source Projects" section above
```

### 7.3 Production System

```bash
# Setup
gpm init --template strict

# Keychain integration
security add-generic-password -a "$USER" -s "GITHUB_PAT" -w "ghp_..."
echo 'source ~/bin/kc.sh && export GITHUB_TOKEN=$(kc_get GITHUB_PAT)' > .envrc
direnv allow
echo '.envrc' >> .gitignore

# Protection
gpm protect --preset strict
gpm install-hooks --post-commit

# Verify
gpm doctor
gpm protect --show
gpm security

# CI
# Copy from "Production/Critical Systems" section above
```

---

## 8. Additional Resources

### 8.1 gpm Documentation
- **GitHub Actions Integration**: `docs/guides/GITHUB-ACTIONS-INTEGRATION.md`
- **AI Agent Integration**: `docs/guides/AI-AGENT-INTEGRATION.md`
- **Quick Reference**: `docs/guides/QUICK-REFERENCE.md`

### 8.2 External Resources
- **GitHub Security Best Practices**: https://docs.github.com/en/code-security
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **Secret Detection Tools**: https://github.com/Yelp/detect-secrets
- **GitHub Token Permissions**: https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token

### 8.3 Support
- **gpm Issues**: https://github.com/littlebearapps/git-pr-manager/issues
- **Security Vulnerabilities**: Report privately via GitHub Security tab

---

## Summary

**Security is a spectrum**:
- 🟢 **Basic**: Fast iteration, personal projects
- 🟡 **Standard**: Balanced security, team projects (recommended)
- 🔴 **Strict**: Maximum protection, production systems

**Three pillars**:
1. **Branch Protection** - `gpm protect --preset [basic|standard|strict]`
2. **Secrets Management** - `gpm doctor` (direnv + keychain recommended)
3. **Security Scanning** - `gpm security` (secrets + vulnerabilities)

**Start simple, scale up**:
```bash
gpm init --template standard  # Good starting point
gpm doctor                     # Set up GitHub token
gpm security                   # Scan for issues
gpm protect --preset standard  # Apply protection
```

**Questions?** Run `gpm --help` or `gpm docs` for more information.
