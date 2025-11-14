# Common Commands Reference

**Last Updated**: 2025-11-13

---

## Development Scripts

### Installation & Setup
```bash
npm install                    # Install all dependencies
npm ci                         # Clean install (CI/production)
```

### Build & Compile
```bash
npm run build                  # Build TypeScript → dist/
npm run clean                  # Remove dist/ directory
npm run prepublishOnly         # Pre-publish hook (build + test)
```

### Development
```bash
npm run dev                    # Run CLI in development mode with ts-node
npm run dev -- <command>       # Run specific command in dev
npm run dev -- feature test    # Test feature command
npm run dev -- auto --json     # Test auto workflow with JSON output
```

### Testing
```bash
npm test                       # Run all tests
npm run test:watch             # Run tests in watch mode
npm run test:coverage          # Generate coverage report
npm test -- <path>             # Run specific test file
npm test -- --verbose          # Verbose test output
```

#### Specific Test Suites
```bash
# By category
npm test -- tests/services/    # All service tests
npm test -- tests/commands/    # All command tests
npm test -- tests/utils/       # All utility tests

# Specific files
npm test -- tests/services/GitHubService.test.ts
npm test -- tests/utils/update-check.test.ts
npm test -- tests/commands/auto.test.ts
```

### Code Quality
```bash
npm run lint                   # Run ESLint
npm run lint -- --fix          # Auto-fix ESLint issues
```

---

## Git Workflow

### Local Development
```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes, then test
npm run build && npm test && npm run lint

# Stage and commit
git add .
git commit -m "feat: add new feature"

# Push to remote
git push origin feature/my-feature
```

### Pre-Commit Checklist
```bash
# Run this before every commit
npm run build     # ✅ Build succeeds
npm test          # ✅ All tests pass
npm run lint      # ✅ No lint errors
npm run test:coverage  # ✅ Coverage >80%
```

### Git Hooks Management

```bash
# Install pre-push hook (default - reminder only)
gwm install-hooks
npm run dev -- install-hooks  # Development mode

# Install both pre-push and post-commit hooks
gwm install-hooks --post-commit
npm run dev -- install-hooks --post-commit

# Force overwrite existing hooks
gwm install-hooks --force

# Uninstall all gwm hooks
gwm uninstall-hooks
npm run dev -- uninstall-hooks

# Check hook status (shows in .gwm.yml)
cat .gwm.yml | grep -A 6 "^hooks:"
gwm status  # Shows hooks in workflow status
```

**Hook Behavior**:
- Non-blocking (never prevents commits/pushes)
- Displays helpful workflow reminders
- Auto-skips in CI environments
- Config syncs automatically

**Common Issues**:
```bash
# Issue: Hook not executable
chmod +x .git/hooks/pre-push

# Issue: Hook exists but not gwm hook
gwm install-hooks --force  # Overwrites

# Issue: Want to disable temporarily
gwm uninstall-hooks  # Can reinstall anytime

# Issue: Hook not triggering
# Check if it exists and is executable
ls -l .git/hooks/pre-push
cat .git/hooks/pre-push | head -3  # Should show gwm signature
```

---

## Package Publishing

### Version Management
```bash
# Bump version
npm version patch              # 1.4.0 → 1.4.1
npm version minor              # 1.4.0 → 1.5.0
npm version major              # 1.4.0 → 2.0.0
npm version prerelease --preid=beta  # 1.4.0 → 1.4.1-beta.0

# View current version
npm version
```

### Publishing to npm
```bash
# Build and test first
npm run build
npm test

# Publish (manual)
npm publish --tag latest      # Stable release
npm publish --tag next        # Prerelease (beta)

# OR trigger GitHub Actions
git tag v1.4.0-beta.1
git push --tags
# Creates GitHub release → auto-publishes to npm
```

### Publishing Flow (Automated)
1. Update version: `npm version prerelease --preid=beta`
2. Commit: `git commit -am "chore: bump version to 1.4.0-beta.2"`
3. Tag: `git tag v1.4.0-beta.2`
4. Push: `git push && git push --tags`
5. Create GitHub release (triggers `.github/workflows/publish.yml`)

---

## Local CLI Usage

### Install Globally (for testing)
```bash
# Link local package
npm link

# Test globally
gwm --help
gwm feature test-branch
gwm auto --json

# Unlink
npm unlink -g @littlebearapps/git-workflow-manager
```

### Direct Execution
```bash
# Using npm run dev
npm run dev -- feature my-feature
npm run dev -- ship --no-wait
npm run dev -- auto --draft

# Using built dist/
node dist/index.js feature my-feature
```

---

## System Health Check

### Verify Setup with gwm doctor

```bash
# Check all requirements and dependencies
gwm doctor
npm run dev -- doctor  # Development mode

# What it checks:
# - GitHub token (GITHUB_TOKEN or GH_TOKEN)
#   - Detects available setup tools (direnv, keychain)
#   - Provides ranked setup suggestions when token not found
# - Required tools (git, node)
# - Optional tools (gh, detect-secrets, pip-audit, npm)
# - Shows versions for installed tools
# - Provides install commands for missing tools
```

**Example output (token found)**:
```
▸ System Health Check
────────────────────────────────────────────────────────────────────────────────
✅ GitHub token: GITHUB_TOKEN

Required Tools:
────────────────────────────────────────────────────────────────────────────────
✅ git                  git version 2.51.0
✅ node                 v20.10.0

Optional Tools:
────────────────────────────────────────────────────────────────────────────────
✅ gh                   gh version 2.78.0 (2025-08-21)
⚠️  detect-secrets       NOT FOUND (optional)
    Secret scanning in code
    Install: pip install detect-secrets
⚠️  pip-audit            NOT FOUND (optional)
    Python dependency vulnerability scanning
    Install: pip install pip-audit
✅ npm                  11.6.0
```

**Example output (token not found, with smart setup suggestions)**:
```
▸ System Health Check
────────────────────────────────────────────────────────────────────────────────
⚠️  GitHub token: Not found

Setup Options (ranked by security & your system):

✨ Recommended: direnv + keychain (high security)
   Create .envrc with keychain integration:
     echo 'source ~/bin/kc.sh && export GITHUB_TOKEN=$(kc_get GITHUB_PAT)' >> .envrc
     direnv allow
     echo '.envrc' >> .gitignore  # Prevent accidental commit

Alternative 1: shell profile (medium security)
   Add to ~/.zshrc or ~/.bashrc:
     echo 'export GITHUB_TOKEN="ghp_your_token_here"' >> ~/.zshrc
     source ~/.zshrc

Alternative 2: .env file (low security)
   Create .env file:
     echo 'GITHUB_TOKEN=ghp_your_token_here' >> .env
     echo '.env' >> .gitignore  # CRITICAL: Prevent token leak!

Alternative 3: current session (low security)
   Export in current shell (temporary):
     export GITHUB_TOKEN="ghp_your_token_here"

   Note: Token will be lost when you close the terminal

Generate token at: https://github.com/settings/tokens
Required scopes: repo (full control of private repositories)
```

**Smart Setup Detection**:
- Detects available tools (direnv, keychain helper at ~/bin/kc.sh)
- Ranks suggestions by security: High (keychain) > Medium (direnv, shell) > Low (.env, session)
- Provides copy-paste commands for immediate setup
- Always shows all alternatives so you have choices

**When to use**:
- After first installation
- Before running security scans
- When debugging "tool not found" errors
- To verify CI/CD environment setup

---

## Debugging

### TypeScript Compilation
```bash
# Check for type errors without building
npx tsc --noEmit

# Watch mode (recompile on changes)
npx tsc --watch
```

### Jest Debugging
```bash
# Run single test with verbose output
npm test -- tests/utils/update-check.test.ts --verbose

# Debug specific test
node --inspect-brk node_modules/.bin/jest tests/utils/update-check.test.ts

# Clear Jest cache
npx jest --clearCache
```

### ESLint Debugging
```bash
# Show all lint errors
npm run lint

# Auto-fix what's possible
npm run lint -- --fix

# Check specific file
npx eslint src/utils/update-check.ts
```

---

## Coverage Analysis

### Generate Report
```bash
npm run test:coverage

# Opens coverage/lcov-report/index.html
open coverage/lcov-report/index.html
```

### Check Specific File Coverage
```bash
# Run coverage for single file
npm test -- tests/utils/update-check.test.ts --coverage

# Check coverage thresholds
npm run test:coverage -- --verbose
```

---

## GitHub Actions (CI)

### Manual Workflow Dispatch
```bash
# Trigger publish workflow
gh workflow run publish.yml

# Trigger test workflow
gh workflow run test.yml

# View workflow runs
gh run list
gh run view <run-id>
```

### Check CI Status
```bash
# View latest run
gh run list --limit 1

# View specific workflow
gh run list --workflow=test.yml

# Watch run
gh run watch
```

---

## Useful Git Commands

### Branch Management
```bash
# List branches
git branch -a

# Delete local branch
git branch -d feature/my-feature

# Delete remote branch
git push origin --delete feature/my-feature

# Sync with remote
git fetch --all --prune
```

### Tag Management
```bash
# List tags
git tag

# Create tag
git tag v1.4.0-beta.1

# Push tags
git push --tags

# Delete local tag
git tag -d v1.4.0-beta.1

# Delete remote tag
git push origin --delete v1.4.0-beta.1
```

---

## Quick Fixes

### Node Modules Issues
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build Cache Issues
```bash
npm run clean
rm -rf dist/ .tsbuildinfo coverage/
npm run build
```

### Test Cache Issues
```bash
npx jest --clearCache
npm test
```

### Git Issues
```bash
# Reset to remote
git fetch origin
git reset --hard origin/main

# Clean untracked files (careful!)
git clean -fd
```

---

## Performance Testing

### Bundle Size
```bash
# Check dist/ size
du -sh dist/

# Detailed breakdown
du -h dist/
```

### Load Time Testing
```bash
# Time CLI startup
time gwm --help

# Time specific command
time gwm status --json
```

---

## Documentation Updates

### When Adding Commands
1. Update `README.md` - Commands section
2. Update `CLAUDE.md` - Quick reference
3. Update `docs/guides/AI-AGENT-INTEGRATION.md` - New workflow
4. Update `docs/guides/GITHUB-ACTIONS-INTEGRATION.md` - New pattern

### When Adding Tests
1. Update `docs/TESTS.md` - Coverage metrics
2. Run coverage: `npm run test:coverage`
3. Document new patterns or utilities

---

## NPM Package Commands

### Package Info
```bash
# View published versions
npm view @littlebearapps/git-workflow-manager versions

# View latest version
npm view @littlebearapps/git-workflow-manager version

# View package info
npm view @littlebearapps/git-workflow-manager

# View dist-tags
npm view @littlebearapps/git-workflow-manager dist-tags
```

### Install Specific Version
```bash
npm install -g @littlebearapps/git-workflow-manager@latest
npm install -g @littlebearapps/git-workflow-manager@next
npm install -g @littlebearapps/git-workflow-manager@1.4.0-beta.1
```
