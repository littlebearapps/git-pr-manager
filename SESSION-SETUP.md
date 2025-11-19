# Session Configuration Setup

**Last Updated**: 2025-11-16
**Status**: ✅ Complete

---

## Overview

This directory has been configured for optimal development workflow with automatic environment setup and Claude Code integration.

## Configuration Files

### `.envrc` (Local only - Not committed)

**Purpose**: Automatic environment variable loading via direnv

**Contents**:

```bash
# Load keychain helper
source ~/bin/kc.sh

# GitHub token for gpm
export GITHUB_TOKEN=$(kc_get GITHUB_PAT)
```

**How it works**:

1. When you `cd` into this directory, direnv automatically sources `.envrc`
2. The keychain helper (`kc.sh`) is loaded
3. `GITHUB_TOKEN` is retrieved from macOS Keychain (secret: `GITHUB_PAT`)
4. Token is available for all gpm commands

**Setup (one-time)**:

```bash
# Already done - direnv allow executed during setup
direnv allow .
```

**Verification**:

```bash
# Check if GITHUB_TOKEN is loaded
echo $GITHUB_TOKEN

# Should output a token starting with ghp_...
```

### `.claude-settings.json` (Local only - Not committed)

**Purpose**: Lock Claude Code sessions to this working directory

**Contents**:

```json
{
  "workingDirectory": "/Users/nathanschram/claude-code-tools/lba/apps/subagents/git-pr-manager",
  "mcpServers": {
    "zen": {
      "command": "node",
      "args": [
        "/Users/nathanschram/claude-code-tools/mcp/zen/dist/index.js",
        "--port",
        "7518"
      ]
    }
  }
}
```

**What it does**:

- Locks Claude Code to this directory (prevents accidental work in wrong location)
- Configures Zen MCP server on port 7518 (root instance - instH)

---

## File Exclusions

### `.gitignore` Additions

```gitignore
# Environment variables (line 20)
.envrc
```

**Why**: `.envrc` contains keychain references and should never be committed

### `.npmignore` Additions

```gitignore
# Development files (lines 17-18)
.envrc
.claude-settings.json
```

**Why**: Session configuration files should never be published to npm

---

## Verification

### Test Environment Loading

```bash
# Check GITHUB_TOKEN is available
source .envrc
echo "Token: $([ -n "$GITHUB_TOKEN" ] && echo 'SET ✓' || echo 'NOT SET ✗')"

# Test gpm with loaded environment
source .envrc && npm run dev -- doctor
```

**Expected output**:

```
Token: SET ✓
✅ GitHub token: GITHUB_TOKEN
```

### Test npm Package Exclusion

```bash
# Verify session files are excluded
npm pack --dry-run 2>&1 | grep -E "(envrc|claude-settings)"

# Expected: No output (files excluded)
```

---

## Usage

### Starting a Session

1. **cd into directory**:

   ```bash
   cd /Users/nathanschram/claude-code-tools/lba/apps/subagents/git-pr-manager
   ```

2. **direnv auto-loads** (if configured in shell):

   ```
   direnv: loading ~/claude-code-tools/lba/apps/subagents/git-pr-manager/.envrc
   ```

3. **Verify setup**:
   ```bash
   npm run dev -- status
   # Should show current git status with GitHub API access
   ```

### Using gpm Commands

All gpm commands will automatically have access to `GITHUB_TOKEN`:

```bash
# Check current status
npm run dev -- status

# Create feature branch
npm run dev -- feature my-feature

# Ship PR with full workflow
npm run dev -- ship

# Run security scan
npm run dev -- security
```

---

## Troubleshooting

### Issue: "No GitHub token found"

**Solution 1**: Source .envrc manually

```bash
source .envrc
npm run dev -- doctor
```

**Solution 2**: Verify direnv is allowed

```bash
direnv allow .
```

**Solution 3**: Check keychain secret exists

```bash
source ~/bin/kc.sh
kc_get GITHUB_PAT
```

### Issue: "Permission denied: .envrc"

**Solution**: Ensure correct permissions

```bash
chmod 600 .envrc
```

### Issue: Changes to .envrc or .claude-settings.json appear in git status

**Solution**: Verify .gitignore is working

```bash
git check-ignore -v .envrc
git check-ignore -v .claude-settings.json

# Both should show they're ignored
```

---

## Security Notes

- ✅ `.envrc` uses keychain (no plaintext secrets)
- ✅ `.envrc` is gitignored (never committed)
- ✅ `.envrc` is npmignored (never published)
- ✅ `.claude-settings.json` is gitignored (local only)
- ✅ `.claude-settings.json` is npmignored (never published)
- ✅ Both files have restrictive permissions (600)

---

## Integration with tmux (Future)

When setting up tmux project session for gpm:

```bash
# In ~/bin/tmux-projects.sh, add:
"gpm" => "/Users/nathanschram/claude-code-tools/lba/apps/subagents/git-pr-manager"

# Start session:
tp create gpm
tp attach gpm
```

The .envrc will automatically load when the tmux session starts in this directory.

---

## Related Documentation

- **Keychain Management**: `~/claude-code-tools/keychain/KEYCHAIN-QUICK-REFERENCE.md`
- **direnv Setup**: `~/.direnvrc` (if exists)
- **tmux Sessions**: `~/claude-code-tools/docs/tmux/CLAUDE-CODE-TMUX-SETUP.md`
- **MCP Configuration**: `~/claude-code-tools/mcp/MCP-CONFIGURATION.md`

---

## Maintenance

### Adding New Environment Variables

Edit `.envrc`:

```bash
# Example: Add debug mode
export DEBUG=1

# Reload
direnv allow .
```

### Updating MCP Configuration

Edit `.claude-settings.json`:

```json
{
  "workingDirectory": "...",
  "mcpServers": {
    "zen": { ... },
    "brave-search": { ... }  // Add new server
  }
}
```

Restart Claude Code session to apply changes.

---

**Status**: ✅ Session configuration complete and verified
**Commit**: e2fd563 (chore: add session configuration file exclusions)
