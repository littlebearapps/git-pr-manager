# git-pr-manager - Quick Reference

**Version**: 1.7.0
**Updated**: 2025-11-18

---

## Daily Workflow

### 1. Start New Feature

```bash
cd ~/claude-code-tools/[project]/main/
git checkout -b feature/my-feature-name

# Make changes
git add .
git commit -m "feat: my feature description"
```

### 2. Ship Feature (Primary Command)

```bash
# Simple - Let gpm handle everything
User: "Use git-pr-manager to ship this feature"

# What happens:
# 1. Runs multi-language verification (format, lint, typecheck, test, build)
# 2. Pushes feature branch to GitHub
# 3. Creates PR (feature → main)
# 4. Waits for CI checks to pass
# 5. Merges PR with squash merge
# 6. Deletes feature branch (local + remote)
# 7. Updates main worktree
```

### 3. Check Status

```bash
User: "Use git-pr-manager to check status"

# Shows:
# - Current branch
# - Outstanding commits
# - PR status (if exists)
# - CI check status
# - Worktree sync status
```

---

## Command Reference

| Command         | When to Use            | What It Does                                                        |
| --------------- | ---------------------- | ------------------------------------------------------------------- |
| **gpm ship**    | Ready to merge feature | Complete PR workflow                                                |
| **gpm verify**  | Before committing      | Run verification checks (format, lint, typecheck, test, build)      |
| **gpm feature** | Starting new work      | Creates feature branch from main (with worktree conflict detection) |
| **gpm status**  | Check current state    | Shows branch, PR, CI status                                         |
| **gpm abort**   | Need to cancel feature | Deletes feature branch safely                                       |

---

## Common Flags

### gpm ship

```bash
# Force merge (skip CI wait)
gpm ship --force-merge

# Skip verify.sh checks
gpm ship --no-verify

# Keep feature branch after merge
gpm ship --keep-branch

# Auto-generate PR description from commits
gpm ship --auto-description

# Dry-run (show what would happen)
gpm ship --dry-run
```

### gpm feature

```bash
# Create feature branch from default branch (main/master)
gpm feature my-feature

# Create feature branch from custom base
gpm feature my-feature --from develop

# Note: Automatically detects worktree conflicts
# If branch exists in another worktree, provides helpful error with suggestions
```

### gpm verify

```bash
# Run all verification checks (auto-detects language)
gpm verify

# Skip specific checks
gpm verify --skip-format        # Skip format verification
gpm verify --skip-lint          # Skip linting
gpm verify --skip-typecheck     # Skip type checking
gpm verify --skip-test          # Skip tests
gpm verify --skip-build         # Skip build step

# Skip dependency installation prompt
gpm verify --skip-install

# Continue on failures (run all checks)
gpm verify --no-stop-on-first-failure

# JSON output for CI/automation
gpm verify --json
```

**Supported Languages**:

- Python (poetry, pipenv, uv, pip)
- Node.js (pnpm, yarn, bun, npm)
- Go (go modules)
- Rust (cargo)

**Default verification order**: format → lint → typecheck → test → build

---

## Git Worktree Management

```bash
# List all worktrees
gpm worktree list
gpm worktree list --json

# Clean up stale worktree data
gpm worktree prune
gpm worktree prune --dry-run       # Preview what would be cleaned
gpm worktree prune --json          # Machine-readable output
```

**When to use**:

- Working on multiple features simultaneously
- Reviewing PRs in separate directories
- Maintaining clean worktree administrative data

**Example output** (`gpm worktree list`):

```
▸ Git Worktrees
────────────────────────────────────────────────────────────────────────────────
* /Users/user/project/main
  main [main]
  55b5943

  /Users/user/project/feature-1
  feature/add-auth
  abc1234

  /Users/user/project/feature-2
  feature/ui-polish
  def5678

ℹ Total: 3 worktrees
```

---

## Branch Naming Conventions

**REQUIRED**: All feature branches must use one of these prefixes:

| Prefix     | Use For           | Example                 |
| ---------- | ----------------- | ----------------------- |
| `feature/` | New features      | `feature/add-dark-mode` |
| `fix/`     | Bug fixes         | `fix/button-alignment`  |
| `chore/`   | Maintenance tasks | `chore/update-deps`     |

**Invalid branch names will be rejected by pre-push hooks**

---

## Error Handling

### "Must be on feature branch"

```
❌ Must be on feature/fix/chore branch

Solution:
1. Create feature branch: git checkout -b feature/my-feature
2. Or switch to existing: git checkout feature/my-feature
```

### "CI checks failed"

```
❌ CI checks failed: [failing-check-name]

Solution:
1. Check GitHub Actions logs for details
2. Fix issues in local branch
3. Push updates: git push origin [branch-name]
4. Re-run gpm ship
```

### "Merge conflict"

```
❌ Merge conflict detected

Solution:
1. Update main: git checkout main && git pull
2. Switch to feature: git checkout feature/my-feature
3. Rebase on main: git rebase main
4. Resolve conflicts (if any)
5. Force push: git push --force origin feature/my-feature
6. Re-run gpm ship
```

### "Verification failed"

```
❌ Verification failed: [format/lint/typecheck/test/build]

Solution:
1. Run locally: gpm verify
2. Fix issues reported (tool suggestions provided)
3. Commit fixes
4. Re-run gpm ship

# For specific task failures:
gpm verify --skip-format      # Skip format to isolate other issues
gpm verify --skip-build       # Skip build if not applicable
```

### "Branch checked out in another worktree"

```
❌ Branch feature/my-feature is already checked out in another worktree
   WORKTREE_CONFLICT

   Conflicting worktrees:
   - /path/to/other/worktree

Solution:
1. Switch to existing worktree: cd /path/to/other/worktree
2. Or use a different branch name: gpm feature my-feature-v2
3. Or remove the worktree: git worktree remove /path/to/other/worktree

Note: This error only appears when using git worktrees. Standard repositories
      will show "Branch already exists" instead.
```

### Enhanced Error Context (Phase 2)

All git-related errors now automatically include worktree context for better debugging:

```
❌ Git operation failed
   Worktree: feature/my-feature

Error details:
- Worktree path: /path/to/current/worktree
- Current branch: feature/my-feature
- Additional context: ...
```

**Benefits**:

- Easier debugging in multi-worktree setups
- Clear indication of which worktree encountered the error
- Automatic context in both CLI and JSON output

**JSON Output**:

```json
{
  "error": {
    "code": "GIT_ERROR",
    "message": "Git operation failed",
    "details": {
      "worktree": "/path/to/current/worktree",
      "worktreeBranch": "feature/my-feature"
    }
  }
}
```

---

## Time Savings

| Task                    | Manual Time | gpm Time | Savings |
| ----------------------- | ----------- | -------- | ------- |
| Complete PR workflow    | 10-15 min   | <5 min   | >60%    |
| Feature branch creation | 2-3 min     | <1 min   | 66%     |
| Status check            | 5 min       | <30 sec  | 90%     |

---

## Comparison: Old vs New

### Old Workflow (dev/main worktrees)

```bash
cd ~/claude-code-tools/[project]/dev/
# Make changes in dev
git add . && git commit -m "feat: my feature"
git push origin dev
# Open browser, create PR on GitHub
# Wait for CI
# Merge PR on GitHub
cd ../main/
git pull origin main
cd ../dev/
git merge origin/main
git push origin dev
# Total: 10-15 minutes
```

### New Workflow (feature branches)

```bash
cd ~/claude-code-tools/[project]/main/
git checkout -b feature/my-feature
# Make changes
git add . && git commit -m "feat: my feature"
User: "Use git-pr-manager to ship this feature"
# Done! Total: <5 minutes
```

---

## Tips & Best Practices

### 1. Commit Often

```bash
# Make small, focused commits
git commit -m "feat: add button component"
git commit -m "test: add button tests"
git commit -m "docs: update button usage"

# gpm ship will squash all commits into one PR
```

### 2. Use Conventional Commits

```bash
# Good commit messages
git commit -m "feat: add dark mode toggle"
git commit -m "fix: button alignment on mobile"
git commit -m "chore: update dependencies"
git commit -m "docs: add API reference"

# Auto-description uses these to generate PR title
```

### 3. Check Status Frequently

```bash
# Before starting work
User: "Use git-pr-manager to check status"

# After making changes
User: "Use git-pr-manager to check status"

# Before shipping
User: "Use git-pr-manager to check status"
```

### 4. Use Dry-Run for Complex Scenarios

```bash
# Preview what will happen
User: "Use git-pr-manager to ship this feature with --dry-run"

# Review output, then run for real
User: "Use git-pr-manager to ship this feature"
```

---

## Troubleshooting

### Feature branch won't delete

```
⚠️  Could not delete feature branch

Solution:
1. Check if PR is still open: gh pr list
2. Close/merge PR if needed
3. Force delete: git branch -D feature/my-feature
4. Delete remote: git push origin --delete feature/my-feature
```

### CI never completes

```
⚠️  CI checks timed out (10+ minutes)

Solution:
1. Check GitHub Actions logs
2. Cancel stuck workflows if needed
3. Re-run failed checks
4. Use --force-merge if urgent (not recommended)
```

### Main worktree out of sync

```
⚠️  Main worktree behind origin/main

Solution:
1. cd ~/claude-code-tools/[project]/main/
2. git pull origin main
3. Re-run gpm ship
```

---

## Multi-Language Verification (Phase 1a-1c)

### Auto-Detection

```bash
# gpm ship automatically runs multi-language verification
# Detects: Python, Node.js, Go, Rust

# Verification steps (in order):
# 1. Format check (non-destructive: --check, --diff, -l flags)
# 2. Linting (eslint, ruff, golangci-lint, clippy)
# 3. Type checking (tsc, mypy, go vet)
# 4. Tests (jest, pytest, go test, cargo test)
# 5. Build (optional: npm build, go build, cargo build)

# Skip verification: gpm ship --no-verify
```

### Configuration (.gpm.yml)

```yaml
verification:
  # Override detected language
  language: python
  packageManager: poetry

  # Custom task order
  tasks: ["lint", "typecheck", "test", "build", "format"]

  # Skip specific tasks
  skipTasks: ["build"] # Build not needed for this project

  # Stop on first failure (default: true)
  stopOnFirstFailure: false # Run all checks even if one fails

  # Allow automatic dependency installation
  allowInstall: true # Prompt to run install command if dependencies missing

  # Custom command overrides
  commands:
    lint: "make lint"
    test: "make test"

  # Prefer Makefile targets (default: true)
  preferMakefile: true
```

### If GitHub Actions configured

```bash
# gpm ship automatically:
- Waits for all required checks
- Polls status every 30 seconds
- Fails if any check fails
- Timeout after 10 minutes

# Force merge: gpm ship --force-merge
```

---

## Related Documentation

- **Full Spec**: `SUBAGENT_PROMPT.md` (835 lines)
- **Workflow Details**: `WORKFLOW-DOCUMENTATION.md`
- **Subagents Overview**: `../README.md`
- **Phase 2 Scripts**: `~/claude-code-tools/scripts/phase-2/`

---

## Quick Commands Cheatsheet

```bash
# Start new feature
git checkout -b feature/my-feature

# Ship feature (most common)
User: "Use git-pr-manager to ship"

# Check status
User: "Use git-pr-manager to check status"

# Abort feature
User: "Use git-pr-manager to abort this feature"

# Emergency force merge (skip CI)
User: "Use git-pr-manager to ship with --force-merge"
```

---

**Need Help?**

- Read full spec: `SUBAGENT_PROMPT.md`
- Check workflow docs: `WORKFLOW-DOCUMENTATION.md`
- Review examples: `../README.md#quick-start-example`
