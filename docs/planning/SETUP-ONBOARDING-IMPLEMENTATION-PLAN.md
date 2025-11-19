# gpm Setup & Onboarding Enhancement - Implementation Plan

**Version**: 1.0
**Created**: 2025-11-19
**Status**: Proposed
**Target Version**: gpm v1.8.0

---

## Executive Summary

This plan addresses the critical "setup gap" in git-pr-manager (gpm) where users encounter errors when running verification commands (`gpm verify`, `gpm ship`) because required tools (eslint, prettier, typescript, etc.) are not installed or configured. Currently, `gpm init` only creates `.gpm.yml` configuration, leaving users to manually:

- Install verification tools (eslint, prettier, typescript, etc.)
- Configure GitHub tokens
- Set up git configuration
- Add package.json scripts
- Create tool configuration files

This creates friction for both human users and AI agents, leading to setup abandonment and support burden.

**Proposed Solution**: Multi-phase enhancement introducing intelligent detection, guided setup, and seamless onboarding for both human and AI agent workflows.

---

## Problem Statement

### Current Pain Points

**For Human Users**:

- "Why is gpm failing? I just installed it"
- No clear path from installation → working setup
- Manual tool installation and configuration required
- Cryptic error messages when tools are missing

**For AI Agents**:

- Must manually detect missing scripts
- Must install packages and add configurations
- No standardized automation interface
- Error recovery requires custom logic

### Impact

- **Setup abandonment**: Users give up before experiencing value
- **Support burden**: High volume of "how do I set up?" questions
- **Adoption friction**: Barrier to entry for new users
- **AI integration complexity**: Agents need custom setup logic

---

## Design Principles

### 1. Progressive Disclosure

Start simple, reveal complexity gradually. Users should get value quickly without overwhelming options.

### 2. Explicit Consent

**Never modify system without user approval**. Security-first approach:

- No auto-install without consent (supply chain protection)
- Show exactly what will be installed
- Provide dry-run mode for preview
- Audit logging for all changes

### 3. Fail Safe

Defensive operations:

- Detect before modify
- Backup before change
- Rollback on failure
- Idempotent operations (safe to re-run)

### 4. Dual UX

Support both workflows equally:

- **Human-interactive**: Rich prompts, explanations, step-by-step
- **AI-automatable**: Non-interactive flags, JSON output, structured errors

### 5. Security First

- Keychain integration for token storage
- No plaintext secrets in files
- Audit logging for accountability
- Minimal permissions required

---

## Architecture Overview

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Commands                             │
├─────────────────────────────────────────────────────────────┤
│  gpm doctor    │  gpm setup     │  gpm verify (enhanced)    │
│  (detection)   │  (action)      │  (feedback loop)          │
└────────┬───────┴────────┬───────┴───────────┬───────────────┘
         │                │                   │
         v                v                   v
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
├─────────────────────────────────────────────────────────────┤
│  ToolDetector          │  SetupOrchestrator                  │
│  - detectTools()       │  - runFullSetup()                   │
│  - checkVersions()     │  - runPartialSetup()                │
│  - validateConfigs()   │  - validateSetup()                  │
├────────────────────────┼─────────────────────────────────────┤
│  PackageInstaller      │  ConfigWriter                       │
│  - installPackages()   │  - addScripts()                     │
│  - verifyInstall()     │  - createConfigFile()               │
│  - rollback()          │  - backupConfig()                   │
├────────────────────────┼─────────────────────────────────────┤
│  KeychainIntegration   │  GitConfigManager                   │
│  - storeToken()        │  - getUserConfig()                  │
│  - retrieveToken()     │  - setUserConfig()                  │
│  - createEnvrc()       │  - checkDefaultBranch()             │
└─────────────────────────────────────────────────────────────┘
```

### Key Separation of Concerns

**Detection vs. Action**:

- `gpm doctor` = Pure detection, no side effects, safe to run anywhere
- `gpm setup` = Actions with consent, modifies system state
- Shared services ensure consistency

---

## Implementation Phases

### Phase 1: Enhanced Detection (2-3 weeks)

**Goal**: Upgrade `gpm doctor` to provide comprehensive diagnostics

**Features**:

- Deep project analysis (tools, scripts, configs)
- Structured recommendations (critical → nice-to-have)
- JSON output mode for AI agents
- Actionable fix suggestions

**Deliverables**:

```typescript
// New service: src/services/ToolDetector.ts
export class ToolDetector {
  async detectInstalledTools(): Promise<ToolStatus[]>;
  async checkToolVersion(tool: string): Promise<VersionInfo>;
  async validateConfiguration(tool: string): Promise<ConfigStatus>;
  async detectPackageManager(): Promise<PackageManagerInfo>;
  async detectLanguage(): Promise<LanguageInfo>;
}

// Enhanced doctor command
gpm doctor --full --json
```

**JSON Output Schema**:

```json
{
  "status": "warnings",
  "checks": [
    {
      "id": "github.token",
      "status": "missing",
      "details": "GitHub token not found",
      "recommendedAction": "run:gpm setup github-token"
    },
    {
      "id": "node.version",
      "status": "ok",
      "details": "Node.js v20.10.0",
      "version": "20.10.0"
    },
    {
      "id": "prettier.installed",
      "status": "missing",
      "details": "Prettier not installed",
      "recommendedAction": "install:prettier"
    },
    {
      "id": "prettier.config",
      "status": "missing",
      "details": "No .prettierrc found",
      "recommendedAction": "create:.prettierrc"
    }
  ]
}
```

**Testing**:

- Unit tests for detection logic (all package managers)
- Integration tests across Node 18, 20, 22
- CI matrix: macOS, Linux (Ubuntu), Windows

**Success Criteria**:

- ✅ Detects all critical tools (git, node, npm, etc.)
- ✅ Validates GitHub token presence and scopes
- ✅ Identifies missing package.json scripts
- ✅ JSON schema stable for AI agent consumption

---

### Phase 2: GitHub Token Setup (1 week)

**Goal**: Implement secure token storage with keychain integration

**Features**:

- Detect keychain helper (`~/bin/kc.sh`)
- Guide token creation with required scopes
- Keychain integration (kc_set/kc_get)
- .envrc creation with direnv support
- Fallback to shell profile or .env (with warnings)

**Deliverables**:

```typescript
// New service: src/services/KeychainIntegration.ts
export class KeychainIntegration {
  async detectKeychainHelper(): Promise<boolean>;
  async storeToken(key: string, value: string): Promise<void>;
  async retrieveToken(key: string): Promise<string | null>;
  async createEnvrc(tokenKey: string): Promise<void>;
  async validateGitignore(files: string[]): Promise<void>;
}

// New command
gpm setup github-token [--storage=keychain|env|profile]
```

**Token Setup Flow (Interactive)**:

```
$ gpm setup github-token

🔐 GitHub Token Setup
─────────────────────────────────────────────────────────────

✅ Keychain helper detected: ~/bin/kc.sh (Most secure)

How would you like to store your GitHub token?
  [1] macOS Keychain (recommended - encrypted storage)
  [2] Shell profile (~/.zshrc)
  [3] .env file (⚠️  less secure)

Choice [1-3]: 1

📝 Create a GitHub Personal Access Token:
   URL: https://github.com/settings/tokens/new

   Required scopes:
   ✓ repo (Full control of private repositories)
   ✓ workflow (Update GitHub Action workflows)
   ✓ read:org (Read org and team membership)

Paste your token (input hidden): **********************

✅ Token stored in keychain as GITHUB_PAT
✅ Created .envrc with keychain integration:
   export GITHUB_TOKEN=$(kc_get GITHUB_PAT)
✅ Added .envrc to .gitignore

Testing token... ✅ Authenticated as @nathanschram
```

**Security Safeguards**:

- Validate token via GitHub API before storing
- Check required scopes (repo, workflow, read:org)
- Never echo token to console or logs
- Ensure .gitignore includes sensitive files
- Provide token rotation command

**Testing**:

- Unit tests with mocked kc.sh
- Integration tests for all storage methods
- Security audit: No token leakage in logs
- Cross-platform compatibility (macOS, Linux)

**Success Criteria**:

- ✅ Keychain storage works seamlessly
- ✅ Token validation catches invalid tokens
- ✅ Fallback mechanisms work when keychain unavailable
- ✅ Zero plaintext tokens in committed files

---

### Phase 3: Core Setup Command (3-4 weeks)

**Goal**: Implement guided project setup wizard

**Features**:

- Interactive 7-step wizard for humans
- Non-interactive mode (--yes) for CI/AI
- Selective setup (--lint, --format flags)
- Dry-run mode (--dry-run preview)
- Package installation with consent
- Script injection to package.json
- Config file generation
- Verification tests after setup

**Deliverables**:

```typescript
// New service: src/services/SetupOrchestrator.ts
export class SetupOrchestrator {
  async runFullSetup(options: SetupOptions): Promise<SetupResult>;
  async runPartialSetup(tasks: SetupTask[]): Promise<SetupResult>;
  async validateSetup(): Promise<ValidationResult>;
  async dryRun(): Promise<SetupPlan>;
}

// New service: src/services/PackageInstaller.ts
export class PackageInstaller {
  async installPackages(packages: PackageSpec[]): Promise<InstallResult>;
  async verifyInstallation(packages: string[]): Promise<boolean>;
  async rollbackInstallation(packages: string[]): Promise<void>;
}

// New service: src/services/ConfigWriter.ts
export class ConfigWriter {
  async addScripts(scripts: Record<string, string>): Promise<void>;
  async createConfigFile(tool: string, template: string): Promise<void>;
  async backupConfig(file: string): Promise<string>;
  async restoreConfig(backup: string): Promise<void>;
}

// New commands
gpm setup                    # Full interactive wizard
gpm setup --yes              # Non-interactive (auto-approve safe changes)
gpm setup --lint --format    # Selective setup
gpm setup --dry-run          # Preview changes
```

**Interactive Setup Flow** (7 steps):

1. **GitHub Authentication** → Token storage
2. **Git Configuration** → user.name, user.email, default branch
3. **Project Configuration** → .gpm.yml template (basic/standard/strict)
4. **Verification Tools** → Install lint/format/typecheck/test/build tools
5. **Git Hooks** → Pre-push, post-commit hooks
6. **Security Tools** → Optional (detect-secrets, pip-audit)
7. **Branch Protection** → Optional (admin required)

**Non-Interactive Mode** (JSON output):

```bash
$ gpm setup --yes --json
{
  "success": true,
  "changes": {
    "dependencies_installed": ["eslint", "prettier", "@typescript-eslint/parser"],
    "scripts_added": ["lint", "typecheck", "format"],
    "configs_created": [".prettierrc", ".eslintrc.json"],
    "hooks_installed": ["pre-push"]
  },
  "verification": {
    "lint": { "status": "ok", "command": "eslint ." },
    "typecheck": { "status": "ok", "command": "tsc --noEmit" },
    "format": { "status": "ok", "command": "prettier --check ." }
  },
  "duration_ms": 45123
}
```

**Edge Case Handling**:

| Scenario                  | Detection                                  | Action                                          |
| ------------------------- | ------------------------------------------ | ----------------------------------------------- |
| **Existing config files** | Check for .eslintrc._, .prettierrc._, etc. | Backup + suggest side-by-side, never overwrite  |
| **Version conflicts**     | Compare installed vs. required versions    | Warn + offer upgrade with --force               |
| **Multiple lock files**   | Detect package-lock, yarn.lock, pnpm-lock  | Require user choice of package manager          |
| **Monorepo/Workspaces**   | Check package.json workspaces field        | Recommend installation location (root vs local) |
| **CI environment**        | Detect process.env.CI                      | Fail with helpful error unless --yes provided   |
| **Offline/air-gapped**    | Network connectivity test                  | Provide manual installation instructions        |
| **Permission issues**     | Write permission checks                    | Suggest permission fixes or workarounds         |

**Defensive Operations**:

```typescript
interface Operation {
  type:
    | "write_file"
    | "append_file"
    | "update_json"
    | "install_package"
    | "store_secret";
  target: string;
  payload: any;
}

async function executeOperation(op: Operation): Promise<OperationResult> {
  // 1. Check if change needed (idempotency)
  if (await isAlreadyInDesiredState(op)) {
    return { status: "skipped", reason: "already configured" };
  }

  // 2. Create backup
  if (op.type === "write_file" && (await fileExists(op.target))) {
    await backup(op.target, `${op.target}.gpm-backup-${Date.now()}`);
  }

  // 3. Execute atomically
  try {
    await performOperation(op);
    return { status: "ok" };
  } catch (error) {
    // 4. Rollback on failure
    await rollback(op);
    throw error;
  }
}
```

**Testing**:

- 150+ unit tests (detection, installation, config modification)
- 30+ integration tests (full setup flows)
- Matrix testing: npm, yarn, pnpm across Node 18, 20, 22
- Security testing: No token leaks, safe file operations
- Idempotency testing: Re-running setup is safe

**Success Criteria**:

- ✅ First-time setup completes in <5 minutes
- ✅ 95%+ success rate across test matrix
- ✅ AI agents can automate setup with --yes --json
- ✅ Zero data loss (backups work, rollbacks work)

---

### Phase 4: Integration & Polish (1-2 weeks)

**Goal**: Connect all pieces and enhance existing commands

**Features**:

- Update `gpm init` to suggest `gpm setup`
- Update `gpm verify` to suggest `gpm setup` on failures
- Add `gpm setup --update` for existing projects
- Comprehensive error messages with fix commands
- Documentation and examples

**Enhanced Error Messages**:

```bash
# Before (current)
$ gpm verify
Error: Exit code 1
- Running verification checks...
✖ Verification checks failed

# After (enhanced)
$ gpm verify
✖ Verification checks failed

Missing tools (3):
  • eslint - Code linting
  • prettier - Code formatting
  • typescript - Type checking

💡 Quick fix:
   gpm setup --lint --format --typecheck

   Or run full setup:
   gpm setup
```

**Workflow Integration**:

```typescript
// In gpm verify command
async function verifyCommand(options: VerifyOptions) {
  const detector = new ToolDetector();
  const missing = await detector.detectMissingTools();

  if (missing.length > 0) {
    logger.error("Missing required tools");
    logger.info("Run: gpm setup --fix");
    process.exit(2);
  }

  // Continue with verification...
}
```

**Migration for Existing Users**:

```bash
$ gpm doctor --migration-check

⚠️  Your project was configured before gpm v1.8

New features available:
  • Automated tool installation
  • GitHub token keychain integration
  • Enhanced verification

Run 'gpm setup --migrate' to update.

$ gpm setup --migrate
✅ Preserved existing .gpm.yml
✅ Added setup metadata
✅ Validated all tools
✅ Migration complete
```

**Documentation**:

- User guide: Step-by-step onboarding
- API reference: --json schemas
- Migration guide: v1.7 → v1.8
- Troubleshooting: Common issues + fixes
- Security guide: Token storage best practices

**Testing**:

- E2E scenarios: Fresh install → PR creation
- Upgrade testing: v1.7 → v1.8 migration
- Documentation verification: All examples work

**Success Criteria**:

- ✅ Existing projects migrate seamlessly
- ✅ Error messages provide clear next steps
- ✅ Documentation covers all scenarios
- ✅ Support tickets reduced by 50%

---

### Phase 5: Advanced Features (2-3 weeks) [OPTIONAL]

**Goal**: Enhance with power-user features

**Features**:

- Template system (basic/standard/strict configs)
- Rollback mechanism (undo setup changes)
- Setup history log (.gpm-setup.log)
- Migration tool (update old configs)
- Health check cron (periodic validation)

**Deliverables**:

```bash
# Template system
gpm setup --template=strict
  → Full validation suite with build step

# Rollback mechanism
gpm setup --rollback
  → Undo last setup changes

# Setup history
cat .gpm-setup.log
  → Audit trail of all modifications

# Health checks
gpm doctor --watch
  → Continuous monitoring (dev mode)
```

**Templates**:

| Template     | Format | Lint | Typecheck | Test | Build | Use Case                |
| ------------ | ------ | ---- | --------- | ---- | ----- | ----------------------- |
| **Basic**    | ✓      | ✗    | ✗         | ✓    | ✗     | Minimal, fast iteration |
| **Standard** | ✓      | ✓    | ✓         | ✓    | ✗     | Recommended for most    |
| **Strict**   | ✓      | ✓    | ✓         | ✓    | ✓     | Maximum validation      |

**Testing**:

- Template application tests
- Rollback integrity tests
- Audit log parsing tests

**Success Criteria**:

- ✅ Templates provide opinionated defaults
- ✅ Rollback works 100% of the time
- ✅ Audit logs are parseable and useful

---

## Technical Specifications

### JSON Schema Contracts

#### `gpm doctor --json` Response

```typescript
interface DoctorResponse {
  status: "ok" | "warnings" | "errors";
  checks: Check[];
  metadata: {
    timestamp: string;
    gpm_version: string;
    platform: string;
  };
}

interface Check {
  id: string; // Stable identifier: 'node.version', 'github.token'
  status: "ok" | "missing" | "incompatible" | "misconfigured";
  details: string;
  version?: string; // For versioned tools
  recommendedAction?: string; // 'run:gpm setup', 'install:prettier'
}
```

#### `gpm setup --json` Response

```typescript
interface SetupResponse {
  success: boolean;
  status: "ok" | "partial" | "failed";
  changes: Change[];
  verification: VerificationResult;
  rollbackInfo?: RollbackInfo;
  metadata: {
    duration_ms: number;
    timestamp: string;
  };
}

interface Change {
  id: string;
  action:
    | "installed"
    | "updated"
    | "created_file"
    | "modified_file"
    | "stored_secret";
  target: string;
  result: "ok" | "skipped" | "failed";
  details: string;
}
```

### Exit Codes

| Code | Meaning         | When to Use                                              |
| ---- | --------------- | -------------------------------------------------------- |
| 0    | Success         | All operations completed successfully                    |
| 1    | Partial success | Some operations failed, others succeeded                 |
| 2    | Fatal failure   | Cannot proceed (missing dependencies, permission denied) |
| 3    | User cancelled  | User explicitly aborted operation                        |

### Configuration Schema (.gpm.yml additions)

```yaml
# New setup section
setup:
  completedAt: "2025-11-19T10:30:00Z"
  version: "1.8.0"
  template: "standard"

  tools:
    lint:
      installed: true
      package: "eslint"
      version: "9.0.0"
      scriptName: "lint"
    format:
      installed: true
      package: "prettier"
      version: "3.2.0"
      scriptName: "format"
    typecheck:
      installed: true
      package: "typescript"
      version: "5.3.0"
      scriptName: "typecheck"

  github:
    tokenStorage: "keychain" # or "env" or "profile"
    tokenKey: "GITHUB_PAT"

  hooks:
    prePush: true
    postCommit: false
```

---

## Security Audit

### Threat Model

| Threat                    | Impact   | Mitigation                                                   |
| ------------------------- | -------- | ------------------------------------------------------------ |
| **Supply chain attack**   | Critical | Never auto-install without consent; verify package integrity |
| **Token leakage**         | Critical | Keychain storage; never log tokens; .gitignore enforcement   |
| **Config overwrite**      | High     | Backup before modify; require --force for overwrites         |
| **Malicious scripts**     | High     | Sanitize package.json scripts; validate commands             |
| **Permission escalation** | Medium   | Use local installs; never require sudo                       |
| **Dependency confusion**  | Medium   | Validate package names; use lock files                       |

### Security Checklist

Setup Phase:

- [ ] Never auto-install packages without explicit consent
- [ ] Validate package names against known registries
- [ ] Use package lock files for reproducibility
- [ ] Log all modifications to audit trail (.gpm-setup.log)
- [ ] Sanitize user input (package names, script content)

Token Management:

- [ ] Never store tokens in plaintext files
- [ ] Verify .gitignore includes sensitive files (.env, .envrc)
- [ ] Validate token scopes before storing
- [ ] Never echo tokens to console or logs
- [ ] Provide token rotation mechanism

File Operations:

- [ ] Check file permissions before writing
- [ ] Backup files before modification
- [ ] Atomic writes (temp file → rename)
- [ ] Verify .gitignore for new files
- [ ] Rollback capability for all operations

General:

- [ ] Fail closed on security checks (deny by default)
- [ ] Input validation on all user-provided values
- [ ] Principle of least privilege (minimal permissions)
- [ ] Audit logging for accountability
- [ ] Regular security reviews of dependencies

---

## Testing Strategy

### Unit Tests (150+ tests)

**ToolDetector**:

- Detect npm, yarn, pnpm, bun
- Detect Node.js versions
- Validate tool versions
- Check for config files
- Detect language (Node.js, Python, Go, Rust)

**PackageInstaller**:

- Install via npm, yarn, pnpm
- Verify installation success
- Rollback on failure
- Handle version conflicts
- Offline mode handling

**ConfigWriter**:

- Add scripts to package.json
- Create config files (.prettierrc, .eslintrc)
- Backup existing files
- Restore from backup
- Idempotent operations

**KeychainIntegration**:

- Detect kc.sh helper
- Store/retrieve tokens
- Create .envrc
- Validate .gitignore
- Fallback mechanisms

### Integration Tests (30+ tests)

**Full Setup Flow**:

- Fresh project → configured (all steps)
- Existing project → migration
- Selective setup (--lint only)
- Non-interactive mode (--yes)
- Dry-run mode (--dry-run)

**Package Manager Variants**:

- npm workflow
- yarn workflow
- pnpm workflow
- bun workflow (if supported)

**Multi-Language**:

- Node.js project
- Python project (poetry, pipenv)
- Go project
- Rust project

**Rollback Scenarios**:

- Failed install → rollback
- User cancel → cleanup
- Permission denied → graceful failure

### E2E Tests (10+ scenarios)

1. **First-time user**:
   - Install gpm → Run setup → Create PR → Success
2. **CI/CD automation**:
   - Fresh repo → Non-interactive setup → Verify → Pass
3. **AI agent workflow**:
   - Parse doctor JSON → Run setup with --yes → Validate success
4. **Existing project migration**:
   - v1.7 project → Migrate to v1.8 → Verify backward compat
5. **Partial setup**:
   - Only lint → Add format later → No conflicts
6. **Token rotation**:
   - Store token → Rotate → Verify new token works
7. **Monorepo**:
   - Workspace detection → Correct install location
8. **Offline mode**:
   - No internet → Graceful failure → Manual instructions
9. **Version conflicts**:
   - Incompatible tool version → Warn → Offer upgrade
10. **Complex scenario**:
    - Custom configs + hooks + tokens → All work together

### Test Matrix

**Node.js Versions**:

- v18 (LTS)
- v20 (Current LTS)
- v22 (Latest)

**Operating Systems**:

- macOS (M1/M2, Intel)
- Linux (Ubuntu 22.04, Debian 12)
- Windows (if gpm supports - TBD)

**Package Managers**:

- npm (v9, v10)
- yarn (v1, v3)
- pnpm (v8)
- bun (v1) [optional]

**CI Environments**:

- GitHub Actions
- GitLab CI
- CircleCI
- Local CI (self-hosted)

---

## Success Metrics

### Setup Success Rate

**Target**: >95% of users complete setup successfully

**Measurement**:

- Track setup completion events
- Monitor error rates by phase
- Collect exit codes

### Time to First Success

**Target**: <5 minutes from install to working PR

**Measurement**:

- Track timestamp: gpm install → gpm ship success
- Measure by user segment (developer, AI agent)
- Identify bottlenecks

### Setup Errors

**Target**: <5% encounter errors during setup

**Measurement**:

- Count errors by type
- Track error recovery rate
- Monitor support tickets

### User Satisfaction

**Target**: NPS >50 for onboarding experience

**Measurement**:

- Post-setup survey (optional)
- GitHub issue sentiment analysis
- Community feedback

### AI Agent Adoption

**Target**: 80%+ of AI workflows use non-interactive setup

**Measurement**:

- Track --yes flag usage
- Monitor JSON mode adoption
- Survey AI agent developers

### Support Reduction

**Target**: 50% reduction in setup-related issues

**Measurement**:

- Compare GitHub issues (before/after)
- Track resolution time
- Monitor recurring questions

---

## Migration Plan

### For Existing gpm Users

**Detection**:

```bash
gpm doctor --migration-check

⚠️  Your project was configured before gpm v1.8

Changes in v1.8:
  • Automated tool installation
  • GitHub token keychain integration
  • Enhanced verification pipeline
  • Setup metadata in .gpm.yml

Recommendation: Run 'gpm setup --migrate'
```

**Migration Command**:

```bash
gpm setup --migrate

🔄 Migrating to gpm v1.8
────────────────────────────────────────

Analyzing current setup...
✅ .gpm.yml found (v1.7 format)
✅ Verification tools installed
⚠️  No setup metadata found

What to migrate:
  • Add setup metadata to .gpm.yml
  • Validate tool versions
  • Update to latest best practices
  • Preserve all custom configurations

Proceed with migration? [Y/n]: y

✅ Added setup metadata
✅ Validated all tools
✅ Updated config schema
✅ Migration complete

Your project is now gpm v1.8 compatible!
```

**Non-Destructive Guarantee**:

- Preserve existing .gpm.yml configurations
- Keep custom tool configs
- Don't reinstall existing tools
- Only add metadata, never remove

### Rollout Strategy

**Phase 1: Beta Testing** (2 weeks)

- Deploy to internal projects only
- Collect feedback from team
- Fix critical bugs
- Validate metrics

**Phase 2: Limited Release** (2 weeks)

- Feature flag: `GPM_ENABLE_SETUP=1`
- Release to 10% of users
- Monitor error rates
- Gradual increase to 50%

**Phase 3: General Availability** (1 week)

- Remove feature flag
- Full release to all users
- Update documentation
- Announce via changelog

**Rollback Plan**:

- If error rate >10%, rollback immediately
- Feature flag allows instant disable
- Maintain v1.7 compatibility during transition

---

## Documentation Requirements

### 1. User Guide

**File**: `docs/guides/SETUP-ONBOARDING-GUIDE.md`

**Contents**:

- Getting started with gpm
- First-time setup walkthrough
- Interactive mode guide
- Non-interactive mode for CI
- Troubleshooting common issues
- FAQ

### 2. API Reference

**File**: `docs/api/SETUP-API-REFERENCE.md`

**Contents**:

- `gpm doctor` JSON schema
- `gpm setup` JSON schema
- Exit codes reference
- Environment variables
- Configuration schema

### 3. Migration Guide

**File**: `docs/guides/MIGRATION-v1.7-to-v1.8.md`

**Contents**:

- What's new in v1.8
- Breaking changes (if any)
- Migration steps
- Rollback procedure
- Common issues

### 4. Security Guide

**File**: `docs/guides/SECURITY-BEST-PRACTICES.md`

**Contents**:

- Token storage options
- Keychain integration
- .gitignore patterns
- Secret rotation
- Audit logging

### 5. AI Agent Integration

**File**: `docs/guides/AI-AGENT-SETUP.md`

**Contents**:

- Non-interactive setup
- JSON parsing examples
- Error handling
- Retry logic
- Best practices

---

## Risk Assessment

### High Impact, High Probability

| Risk                         | Impact | Probability | Mitigation                                            |
| ---------------------------- | ------ | ----------- | ----------------------------------------------------- |
| **Package install failures** | High   | Medium      | Robust error handling, retry logic, manual fallback   |
| **Version conflicts**        | Medium | High        | Detect conflicts early, warn user, provide resolution |

### High Impact, Low Probability

| Risk                         | Impact   | Probability | Mitigation                                             |
| ---------------------------- | -------- | ----------- | ------------------------------------------------------ |
| **Configuration overwrites** | High     | Low         | Backup files, detect existing configs, require --force |
| **Security vulnerabilities** | Critical | Low         | Audit dependencies, validate inputs, use keychain      |
| **CI/CD breakage**           | High     | Medium      | Extensive testing, gradual rollout, feature flags      |

### Medium Impact, Variable Probability

| Risk                         | Impact | Probability | Mitigation                                     |
| ---------------------------- | ------ | ----------- | ---------------------------------------------- |
| **User resistance to setup** | Medium | Medium      | Make optional, provide skip options, education |
| **Cross-platform issues**    | Medium | Medium      | Test matrix, platform-specific code paths      |
| **Dependency churn**         | Medium | Low         | Lock dependencies, test upgrades carefully     |

---

## Timeline & Resources

### Phase 1: Enhanced Detection (2-3 weeks)

**Team**: 1 developer
**Effort**: 10-15 days
**Dependencies**: None

### Phase 2: GitHub Token Setup (1 week)

**Team**: 1 developer
**Effort**: 5 days
**Dependencies**: Phase 1 complete

### Phase 3: Core Setup Command (3-4 weeks)

**Team**: 2 developers
**Effort**: 15-20 days
**Dependencies**: Phase 1, 2 complete

### Phase 4: Integration & Polish (1-2 weeks)

**Team**: 1 developer, 1 technical writer
**Effort**: 7-10 days
**Dependencies**: Phase 1, 2, 3 complete

### Phase 5: Advanced Features (2-3 weeks) [OPTIONAL]

**Team**: 1 developer
**Effort**: 10-15 days
**Dependencies**: Phase 1-4 complete

**Total Timeline**: 9-13 weeks (MVP: 6-8 weeks for Phases 1-3)

---

## Expert Analysis Integration

The following refinements from expert analysis have been incorporated:

### 1. Strict Detection/Action Layering

- `doctor` as single source of truth
- `setup` always calls detection first
- No guessing, explicit diagnostic states

### 2. Clear Interface Contracts

- JSON schemas for both commands
- Stable exit codes (0, 1, 2+)
- Structured error responses
- Idempotent operations

### 3. GitHub Token as First-Class Resource

- Canonical storage: keychain primary
- Token validation with scope checking
- Rotation and failure path handling
- Never log or echo tokens

### 4. Defensive Configuration Management

- Non-destructive hook strategy
- Config backup before modification
- Side-by-side suggestions for conflicts
- Explicit --force flag for overwrites

### 5. Smart Package Management

- Detect package manager heuristically
- Allow override via flag
- Support monorepo/workspace detection
- Lock file consistency checks

### 6. Graduated Testing Strategy

- Focus on supported platforms
- Prioritize critical paths
- Incremental coverage expansion
- CI matrix for key combinations

---

## Next Steps

### Immediate Actions

1. **Finalize JSON schemas** for `doctor` and `setup`
   - Define stable field names
   - Version schemas for evolution
   - Document for AI agents

2. **Define Check registry** structure
   - Each check: `id`, `run()`, status
   - Pluggable architecture
   - Easy to extend

3. **Implement minimal `gpm doctor`**
   - Node + package manager detection
   - Git presence check
   - GitHub token detection (no validation yet)

4. **Early integration tests**
   - Test on target platforms
   - Validate JSON output
   - Sample AI workflows

### Pre-Implementation Review

Before starting implementation:

- [ ] Get stakeholder approval on scope
- [ ] Confirm timeline and resources
- [ ] Review security checklist
- [ ] Set up feature branch: `feature/enhanced-setup`
- [ ] Create tracking issue in GitHub

### Implementation Kickoff

Once approved:

1. Create feature branch
2. Set up test infrastructure
3. Implement Phase 1 (Enhanced Detection)
4. Daily standups for coordination
5. Weekly demos to stakeholders

---

## Conclusion

This implementation plan addresses the critical setup gap in git-pr-manager through a multi-phase approach that balances:

- **User Safety**: Explicit consent, backups, rollback capability
- **User Experience**: Guided setup, clear feedback, fast completion
- **Developer Experience**: Well-tested, maintainable, extensible code
- **Security**: Keychain integration, audit logging, no plaintext secrets
- **AI Compatibility**: Non-interactive modes, JSON output, structured errors

**Recommendation**: **PROCEED** with phased implementation, starting with Phase 1 (Enhanced Detection) to establish the foundation.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-19
**Author**: Claude Code (via zen thinkdeep + expert analysis)
**Review Status**: Pending stakeholder approval
