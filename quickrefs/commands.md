# Common Commands Reference

**Last Updated**: 2025-11-18

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

## Optional Security Enhancements

### Secret Scanning (detect-secrets)

```bash
pip install detect-secrets
detect-secrets scan --baseline .secrets.baseline  # optional baseline management
```

- Python-based secret detector that plugs into `gpm security`
- Adds regex-based scanning and baseline workflows on top of the default `npm audit`
- Safe to skip—`gpm security` still runs dependency checks even if `detect-secrets` is not installed

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
gpminstall-hooks
npm run dev -- install-hooks  # Development mode

# Install both pre-push and post-commit hooks
gpminstall-hooks --post-commit
npm run dev -- install-hooks --post-commit

# Force overwrite existing hooks
gpminstall-hooks --force

# Uninstall all gpm hooks
gpmuninstall-hooks
npm run dev -- uninstall-hooks

# Check hook status (shows in .gpm.yml)
cat .gpm.yml | grep -A 6 "^hooks:"
gpmstatus  # Shows hooks in workflow status
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

# Issue: Hook exists but not gpm hook
gpminstall-hooks --force  # Overwrites

# Issue: Want to disable temporarily
gpmuninstall-hooks  # Can reinstall anytime

# Issue: Hook not triggering
# Check if it exists and is executable
ls -l .git/hooks/pre-push
cat .git/hooks/pre-push | head -3  # Should show gpm signature
```

---

## Package Publishing

### ⚠️ AUTOMATED via semantic-release

**Publishing is fully automated** - no manual version bumping or npm publish needed!

### Publishing Flow (semantic-release)

**Trigger**: Push conventional commit to main branch

```bash
# 1. Create feature branch and make changes
git checkout -b feature/my-feature
# ... make changes ...

# 2. Commit with conventional commit message
git commit -m "feat: add new feature"    # → minor bump (1.5.0 → 1.6.0)
git commit -m "fix: fix bug"             # → patch bump (1.5.0 → 1.5.1)
git commit -m "docs: update docs"        # → patch bump (1.5.0 → 1.5.1)

# 3. Push feature branch and create PR
git push origin feature/my-feature
gh pr create

# 4. Get user approval to merge PR

# 5. Merge PR to main → GitHub Actions → semantic-release → npm
# ✅ Version auto-determined from commits
# ✅ Changelog auto-generated
# ✅ npm package published with OIDC + provenance
# ✅ GitHub release created
```

### Conventional Commit Types

```bash
feat:     # New feature (minor version bump: 1.5.0 → 1.6.0)
fix:      # Bug fix (patch version bump: 1.5.0 → 1.5.1)
docs:     # Documentation (patch version bump: 1.5.0 → 1.5.1)
refactor: # Code refactoring (patch version bump: 1.5.0 → 1.5.1)
perf:     # Performance improvement (patch version bump: 1.5.0 → 1.5.1)
test:     # Test changes (no version bump)
chore:    # Maintenance (no version bump)

# Breaking change (major version bump: 1.5.0 → 2.0.0)
feat!: breaking change
# OR
feat: breaking change

BREAKING CHANGE: description in footer
```

### Version Management (DEPRECATED - use semantic-release)

```bash
# ❌ DON'T manually bump versions anymore
# npm version patch/minor/major

# ✅ DO use conventional commits instead
git commit -m "feat: add feature"  # semantic-release handles version

# View current version
npm version
```

### Verification

```bash
# Check published version on npm
npm view @littlebearapps/git-pr-manager version

# View GitHub release
gh release view v1.5.0

# Check workflow run
gh run list --limit 1
```

### Workflow Configuration

- **File**: `.github/workflows/publish.yml`
- **Trigger**: Push to main (conventional commits only)
- **Steps**: Install → Test → Build → semantic-release → npm publish (OIDC)
- **E409 Handling**: Retry verification script (`.github/scripts/publish-with-retry.sh`)
- **Provenance**: Enabled (Sigstore attestations)

---

## Local CLI Usage

### Install Globally (for testing)

```bash
# Link local package
npm link

# Test globally
gpm--help
gpmfeature test-branch
gpmauto --json

# Unlink
npm unlink -g @littlebearapps/git-pr-manager
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

## Git Worktree Management

### List Worktrees

```bash
# List all worktrees (plain text)
gpmworktree list
npm run dev -- worktree list

# List with JSON output
gpmworktree list --json
```

### Prune Stale Worktrees

```bash
# Dry-run (preview what would be pruned)
gpmworktree prune --dry-run
npm run dev -- worktree prune --dry-run

# Actually prune stale worktree data
gpmworktree prune

# Dry-run with JSON output
gpmworktree prune --dry-run --json
```

**When to use**:

- Working with multiple feature branches simultaneously
- Cleaning up after manually deleted worktree directories
- Maintaining clean worktree administrative data
- Troubleshooting "branch checked out in another worktree" issues

---

## System Health Check

### Verify Setup with gpm doctor

```bash
# Check all requirements and dependencies
gpmdoctor
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
time gpm --help

# Time specific command
time gpm status --json
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
npm view @littlebearapps/git-pr-manager versions

# View latest version
npm view @littlebearapps/git-pr-manager version

# View package info
npm view @littlebearapps/git-pr-manager

# View dist-tags
npm view @littlebearapps/git-pr-manager dist-tags
```

### Install Specific Version

```bash
npm install -g @littlebearapps/git-pr-manager@latest
npm install -g @littlebearapps/git-pr-manager@next
npm install -g @littlebearapps/git-pr-manager@1.4.0-beta.1
```
