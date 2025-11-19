# Rename Audit: gpm → gpm (git-pr-manager → git-pr-manager)

**Status**: Pre-Release Rename
**Date**: 2025-11-15
**Version**: 1.4.0 (not yet published)

---

## Executive Summary

This document audits all instances of "gpm" and "git-pr-manager" that require updating to "gpm" and "git-pr-manager" respectively. Since the package has not been publicly released, we can perform a clean rename without migration concerns.

**Total Files Requiring Updates**: 106+ files

- **58+ files** contain "gpm" (case-insensitive) - including `.claude/settings.local.json`
- **44+ files** contain "git-pr-manager" - including parent `CLAUDE.md`
- **Additional**: User config files (`.gpm.yml` if exists), `package-lock.json` (auto-regenerated)

---

## Critical Changes

### 1. Directory Path

**Current**: `/Users/nathanschram/claude-code-tools/lba/apps/subagents/git-pr-manager`
**New**: `/Users/nathanschram/claude-code-tools/lba/apps/subagents/git-pr-manager`

**Action**: Rename directory after all file updates are complete

**Impact**:

- All absolute path references in documentation
- IDE/editor workspace files
- Git configuration
- npm link configurations

---

### 2. Git Repository

**Current**: `https://github.com/littlebearapps/git-pr-manager`
**New**: `https://github.com/littlebearapps/git-pr-manager`

**Actions Required**:

1. Rename repository on GitHub (Settings → Rename)
2. Update all remote URLs: `git remote set-url origin https://github.com/littlebearapps/git-pr-manager.git`
3. GitHub automatically redirects old URLs (but update references anyway)

**Files Containing Repository URL**:

- `package.json` (lines 48-55)
- `.github/workflows/publish.yml`
- `README.md`
- `CHANGELOG.md`
- `CLAUDE.md`
- All documentation in `docs/`

---

### 3. npm Package Name

**Current**: `@littlebearapps/git-pr-manager`
**New**: `@littlebearapps/git-pr-manager`

**File**: `package.json` (line 2)

**Impact**:

- Installation command: `npm install -g @littlebearapps/git-pr-manager`
- Import statements: `import { ... } from '@littlebearapps/git-pr-manager'`
- All documentation showing installation instructions

**Files Containing Package Name**:

- `package.json` (line 2)
- `docs/POSITIONING.md`
- `docs/README.md`
- `README.md`
- `CHANGELOG.md`
- `CLAUDE.md`
- `quickrefs/commands.md`
- `docs/guides/GITHUB-ACTIONS-INTEGRATION.md`
- `docs/guides/JSON-OUTPUT-SCHEMAS.md`
- `docs/guides/AI-AGENT-INTEGRATION.md`
- `docs/implementation/PHASE-5-PROGRESS.md`
- `docs/planning/git-pr-manager-phase-7-plan.md`
- `docs/planning/git-pr-manager-phase-5-plan.md`
- `src/commands/docs.ts`
- `src/utils/update-check.ts`
- `tests/utils/update-check.test.ts`

---

### 4. Binary Name

**Current**: `gpm`
**New**: `gpm`

**File**: `package.json` (line 6-8)

**Current**:

```json
"bin": {
  "gpm": "dist/index.js"
}
```

**New**:

```json
"bin": {
  "gpm": "dist/index.js"
}
```

**Impact**: All CLI command references in documentation and examples

---

## File-by-File Audit

### Package Configuration

#### 1. `package.json` - **CRITICAL**

**Lines to Update**:

- Line 2: `"name": "@littlebearapps/git-pr-manager"`
- Lines 6-8: Binary name `"gwa": "dist/index.js"`
- Line 50: Repository URL
- Line 53: Bugs URL
- Line 55: Homepage URL

**Description Updated**: Already says "workflow automation" - good!

---

### Root Documentation

#### 2. `README.md` - **HIGH PRIORITY**

**Instances**: Multiple (installation, usage examples, repository links)

**Update Required**:

- All `gpm` command examples → `gpm`
- Installation: `npm install -g @littlebearapps/git-pr-manager`
- Repository links: Update GitHub URLs
- Title: "Git Workflow Automation" (or keep as is if generic)

**Estimated Lines**: 50+ instances of `gpm`

---

#### 3. `CLAUDE.md` - **HIGH PRIORITY**

**Instances**: Multiple references to gpm and package name

**Update Required**:

- Project name references
- Repository URL (line 9)
- npm package name
- All command examples using `gpm` → `gpm`

---

#### 4. `CHANGELOG.md` - **HIGH PRIORITY**

**Instances**: Multiple (version history, repository URLs)

**Update Required**:

- Repository URLs in release notes
- Package name references
- Command examples

**Note**: Historical entries can reference old name with migration note

---

#### 5. `.gpm.example.yml` - **CRITICAL**

**File Name**: Rename to `.gwa.example.yml`
**Content**: Update all references to gpm → gpm

---

#### 6. `AUTO-FIX.md` - **MEDIUM**

**Instances**: Multiple references to gpm commands

**Update Required**:

- All command examples: `gpm` → `gpm`

---

### Source Code

#### 7. `src/index.ts` - **HIGH PRIORITY**

**Check for**:

- Program name/description
- Version info
- Help text

**Instances**: References to "gpm" in CLI setup

---

#### 8. `src/commands/*.ts` (All Command Files) - **HIGH PRIORITY**

**Files**:

- `auto.ts`
- `checks.ts`
- `check-update.ts`
- `docs.ts`
- `doctor.ts`
- `feature.ts`
- `init.ts`
- `install-hooks.ts`
- `protect.ts`
- `ship.ts`
- `status.ts`
- `uninstall-hooks.ts`

**Update Required**:

- Help text and descriptions
- Error messages referencing "gpm"
- Example commands in docs strings
- Config file references (.gpm.yml → .gpm.yml)

---

#### 9. `src/services/ConfigService.ts` - **CRITICAL**

**Instances**: Config file name `.gpm.yml`

**Update Required**:

- Line referencing `.gpm.yml` → `.gpm.yml`
- Any default config paths
- Error messages about config file

---

#### 10. `src/services/AutoFixService.ts` - **MEDIUM**

**Instances**: References to gpm in error messages/logs

**Update Required**: Command suggestions using gpm → gpm

---

#### 11. `src/utils/git-hooks.ts` - **HIGH PRIORITY**

**Instances**: Multiple references in git hook generation

**Update Required**:

- Hook signature comments (identifies gpm hooks)
- Command invocations in hook scripts
- Config file references

---

#### 12. `src/utils/update-check.ts` - **CRITICAL**

**Instances**: Package name for npm registry checks

**Update Required**:

- Package name: `@littlebearapps/git-pr-manager`
- CLI name in update messages

---

#### 13. `src/utils/errors.ts` - **LOW**

**Check for**: Error messages mentioning gpm

---

#### 14. `src/scripts/postinstall.ts` - **MEDIUM**

**Instances**: Welcome message, setup instructions

**Update Required**:

- CLI command examples
- Setup instructions

---

### Tests

#### 15. `tests/**/*.test.ts` (All Test Files) - **HIGH PRIORITY**

**Files** (102+ test files):

- All command tests
- All service tests
- All utility tests
- Integration tests

**Update Required**:

- Mock configurations referencing gpm
- Test descriptions
- Config file name tests
- Command invocation tests

**Key Files**:

- `tests/commands/init.test.ts` - Config file name tests
- `tests/commands/install-hooks.test.ts` - Hook signature tests
- `tests/commands/uninstall-hooks.test.ts` - Hook detection tests
- `tests/services/ConfigService.test.ts` - Config loading tests
- `tests/utils/update-check.test.ts` - Package name tests
- `tests/utils/git-hooks.test.ts` - Hook generation tests
- `tests/integration/git-hooks.integration.test.ts` - End-to-end hook tests

---

### Documentation

#### 16. `docs/README.md` - **HIGH PRIORITY**

**Instances**: Package name, command examples

---

#### 17. `docs/TESTS.md` - **MEDIUM**

**Instances**: Command examples in test documentation

---

#### 18. `docs/POSITIONING.md` - **HIGH PRIORITY**

**Instances**: Multiple (this is the positioning doc created earlier)

**Update Required**:

- All references to gpm → gpm throughout
- Package name
- Repository URLs
- Binary name in all examples

---

#### 19. `docs/guides/AI-AGENT-INTEGRATION.md` - **HIGH PRIORITY**

**Instances**: Multiple command examples, package name

**Update Required**:

- All `gpm` command examples → `gpm`
- Installation instructions
- JSON schema references

---

#### 20. `docs/guides/GITHUB-ACTIONS-INTEGRATION.md` - **HIGH PRIORITY**

**Instances**: Multiple workflow examples

**Update Required**:

- Installation steps
- All command invocations
- Package name

---

#### 21. `docs/guides/JSON-OUTPUT-SCHEMAS.md` - **HIGH PRIORITY**

**Instances**: Command examples with JSON output

**Update Required**:

- All `gpm` → `gpm` in examples
- Package name

---

#### 22. `docs/guides/REPOSITORY-SECURITY-GUIDE.md` - **MEDIUM**

**Instances**: Command examples

---

#### 23. `docs/guides/QUICK-REFERENCE.md` - **HIGH PRIORITY**

**Instances**: Quick start commands

---

#### 24. `docs/guides/SUBAGENT_PROMPT.md` - **MEDIUM**

**Instances**: CLI invocation examples

---

#### 25. `docs/guides/WORKFLOW-DOCUMENTATION.md` - **MEDIUM**

**Instances**: Workflow examples

---

#### 26. `docs/ideas/GITHUB-AUDIT-TOOL.md` - **LOW**

**Instances**: Related tool references

---

#### 27. `docs/implementation/*.md` (5 files) - **MEDIUM**

**Files**:

- `IMPLEMENTATION-HANDOVER.md`
- `PHASE-1-COMPLETE.md`
- `PHASE-2-COMPLETE.md`
- `PHASE-3-COMPLETE.md`
- `PHASE-4-COMPLETE.md`
- `PHASE-5-PROGRESS.md`

**Update Required**: Historical docs can note rename, update future references

---

#### 28. `docs/planning/*.md` (5 files) - **MEDIUM**

**Files**:

- `git-pr-manager-phase-5-plan.md`
- `git-pr-manager-phase-6-plan.md`
- `git-pr-manager-phase-7-plan.md`
- `COMPREHENSIVE-ENHANCEMENT-PLAN.md`
- `ENHANCEMENT-IDEAS.md`

**Update Required**:

- File names: Rename to `git-pr-manager-phase-*.md`
- Content: Update package/command references

---

#### 29. `docs/architecture/*.md` (2 files) - **LOW**

**Files**:

- `OCTOKIT-SDK-INTEGRATION.md`
- `OPTION-2-FULL-SDK-MIGRATION-PLAN.md`

---

### Quick References

#### 30. `quickrefs/commands.md` - **HIGH PRIORITY**

**Instances**: All command examples use gpm

**Update Required**: Every single command example gpm → gpm

---

#### 31. `quickrefs/architecture.md` - **MEDIUM**

**Instances**: References to package structure

---

#### 32. `quickrefs/testing.md` - **MEDIUM**

**Instances**: Test command examples

---

### Templates

#### 33. `templates/github-actions/*.yml` (3 files) - **HIGH PRIORITY**

**Files**:

- `basic-ci.yml`
- `pr-validation.yml`
- `setup-protection.yml`

**Update Required**:

- Installation: `npm install -g @littlebearapps/git-pr-manager`
- All command invocations: `gpm` → `gpm`

---

#### 34. `templates/examples/*.md` (2 files) - **MEDIUM**

**Files**:

- `node-project.md`
- `python-project.md`

**Update Required**: Command examples

---

### GitHub Workflows

#### 35. `.github/workflows/publish.yml` - **CRITICAL**

**Instances**: npm package name, repository URL

**Update Required**:

- Package name in publish commands
- Repository references
- Any hardcoded gpm references

---

### Test Gap Analysis

#### 36. `TEST-GAP-ANALYSIS.md` - **LOW**

**Instances**: Test coverage documentation

---

### Claude Code Configuration

#### 37. `.claude/settings.local.json` - **HIGH PRIORITY**

**Instances**: 3 references to gpm in permissions array

**Lines to Update**:

- Line 20: `"Bash(gpm --version:*)"` → `"Bash(gwa --version:*)"`
- Line 30: `"Bash(gpm --help:*)"` → `"Bash(gwa --help:*)"`
- Line 32: `"Bash(gpm doctor:*)"` → `"Bash(gwa doctor:*)"`

**Impact**: Claude Code command permissions for local development

---

### Parent Directory

#### 38. `~/claude-code-tools/CLAUDE.md` - **HIGH PRIORITY**

**Location**: Root directory CLAUDE.md (parent of this project)
**Instances**: 2 references to git-pr-manager

**Lines to Update**:

- Line 14: `"Subagent development (git-pr-manager, multi-project-tester, microtool-creator)"`
  - Update: `git-pr-manager` → `git-pr-manager`
- Line 124: `"| **git-pr-manager** | v0.2.0 | Feature-branch PR workflow | >60% |"`
  - Update: `**git-pr-manager**` → `**git-pr-manager**`
  - Update directory path in description

**Impact**: Project documentation in root workspace

---

### User Configuration Files

#### 39. `.gpm.yml` (User's Local Config) - **NOTE**

**File**: `.gpm.yml` (if exists in user's working directory)
**Status**: User-specific config file (not in git)

**Action**: Users should rename their local config file:

- From: `.gpm.yml`
- To: `.gpm.yml`

**Note**: This is user-specific, not checked into git. Add reminder in CHANGELOG and release notes for users to migrate their local config files.

---

## Config File Migration

### `.gpm.yml` → `.gpm.yml`

**Files to Update**:

1. `src/services/ConfigService.ts` - Config file discovery logic
2. `src/commands/init.ts` - Config initialization
3. All tests that create/read config files
4. All documentation showing config examples
5. `.gpm.example.yml` → `.gwa.example.yml`

**Migration Strategy**: ConfigService should check for both files during transition

```typescript
// Pseudocode
const configFiles = [".gpm.yml", ".gpm.yml"]; // Try new name first
for (const file of configFiles) {
  if (await exists(file)) {
    if (file === ".gpm.yml") {
      logger.warn("Using deprecated .gpm.yml - please rename to .gpm.yml");
    }
    return file;
  }
}
```

**Note**: Since we're pre-release, we can skip migration logic and just use `.gpm.yml` exclusively.

---

### Special Note: package-lock.json

#### `package-lock.json` - **AUTO-REGENERATED** ✅

**Status**: Will be automatically updated by npm
**Action**: **NO MANUAL EDIT REQUIRED**

**How it works**:

1. Update `package.json` name field (Phase 1)
2. Run `npm install`
3. package-lock.json automatically updates all references

**Current References** (will auto-update):

- Line 2: `"name": "@littlebearapps/git-pr-manager"`
- Line 8: Additional package name reference

**Warning**: ⚠️ Do NOT manually edit package-lock.json - let npm handle it to avoid corruption.

---

## Git Hook Signatures

### Hook Detection Logic

**Files**:

- `src/utils/git-hooks.ts` - Hook generation
- `src/commands/install-hooks.ts` - Hook installation
- `src/commands/uninstall-hooks.ts` - Hook removal

**Current Signature**:

```bash
# Generated by git-pr-manager (gpm)
```

**New Signature**:

```bash
# Generated by git-pr-manager (gpm)
```

**Update Required**:

- Hook template generation
- Hook detection regex (isGpmHook function)
- All tests validating hook signatures

---

## Command-Line Interface

### Help Text & Descriptions

**Files**:

- `src/index.ts` - Main CLI setup
- All `src/commands/*.ts` - Individual command descriptions

**Update Required**:

- Program description
- Command descriptions referencing "gpm"
- Usage examples
- Error messages suggesting "gpm" commands

**Example Updates**:

```diff
- description: 'Initialize gpm configuration'
+ description: 'Initialize gpm configuration'

- suggestion: 'Run: gpm init'
+ suggestion: 'Run: gpm init'
```

---

## Update Check System

### npm Registry Queries

**Files**:

- `src/utils/update-check.ts` - Queries npm for updates
- `tests/utils/update-check.test.ts` - Mock responses

**Critical Update**:

```typescript
// Line ~20
const pkg = "@littlebearapps/git-pr-manager";
```

**Update Messages**:

```diff
- 'Update available for git-pr-manager'
+ 'Update available for git-pr-manager'

- 'npm install -g @littlebearapps/git-pr-manager'
+ 'npm install -g @littlebearapps/git-pr-manager'
```

---

## Systematic Update Checklist

### Phase 1: Core Package Files (Critical)

- [ ] `package.json` - Name, bin, repository, bugs, homepage
- [ ] `.gpm.example.yml` → `.gwa.example.yml` (rename file)
- [ ] `src/services/ConfigService.ts` - Config file name
- [ ] `src/utils/update-check.ts` - Package name
- [ ] `.github/workflows/publish.yml` - Package name
- [ ] `.claude/settings.local.json` - Update gpm permission entries (3 instances)
- [ ] `package-lock.json` - Run `npm install` after package.json update (auto-regenerates)

### Phase 2: Source Code

- [ ] `src/index.ts` - CLI program name
- [ ] `src/commands/auto.ts` - Help text, examples
- [ ] `src/commands/checks.ts` - Help text, examples
- [ ] `src/commands/check-update.ts` - Package name, messages
- [ ] `src/commands/docs.ts` - Help text, examples
- [ ] `src/commands/doctor.ts` - Help text, diagnostics
- [ ] `src/commands/feature.ts` - Help text, examples
- [ ] `src/commands/init.ts` - Config file creation
- [ ] `src/commands/install-hooks.ts` - Help text, hook invocations
- [ ] `src/commands/protect.ts` - Help text, examples
- [ ] `src/commands/ship.ts` - Help text, examples
- [ ] `src/commands/status.ts` - Help text, examples
- [ ] `src/commands/uninstall-hooks.ts` - Help text, hook detection
- [ ] `src/services/AutoFixService.ts` - Command suggestions
- [ ] `src/utils/git-hooks.ts` - Hook signatures, invocations
- [ ] `src/utils/errors.ts` - Error messages
- [ ] `src/scripts/postinstall.ts` - Welcome message

### Phase 3: Tests (All Files)

- [ ] `tests/commands/init.test.ts` - Config file tests
- [ ] `tests/commands/install-hooks.test.ts` - Hook signature
- [ ] `tests/commands/uninstall-hooks.test.ts` - Hook detection
- [ ] `tests/services/ConfigService.test.ts` - Config loading
- [ ] `tests/utils/update-check.test.ts` - Package name mocks
- [ ] `tests/utils/git-hooks.test.ts` - Hook generation
- [ ] `tests/integration/git-hooks.integration.test.ts` - E2E hooks
- [ ] All other `tests/**/*.test.ts` files - Command references

### Phase 4: Documentation (High Priority)

- [ ] `README.md` - Installation, usage, repository
- [ ] `CLAUDE.md` - Project name, repository, commands
- [ ] `CHANGELOG.md` - Repository URLs, package name
- [ ] `docs/README.md` - Overview, package name
- [ ] `docs/TESTS.md` - Command examples
- [ ] `docs/POSITIONING.md` - All references throughout
- [ ] `docs/guides/AI-AGENT-INTEGRATION.md` - Commands, installation
- [ ] `docs/guides/GITHUB-ACTIONS-INTEGRATION.md` - Workflows, installation
- [ ] `docs/guides/JSON-OUTPUT-SCHEMAS.md` - Command examples
- [ ] `docs/guides/REPOSITORY-SECURITY-GUIDE.md` - Commands
- [ ] `docs/guides/QUICK-REFERENCE.md` - Quick start
- [ ] `docs/guides/SUBAGENT_PROMPT.md` - CLI invocations
- [ ] `docs/guides/WORKFLOW-DOCUMENTATION.md` - Examples

### Phase 5: Documentation (Medium Priority)

- [ ] `quickrefs/commands.md` - All command examples
- [ ] `quickrefs/architecture.md` - Package structure
- [ ] `quickrefs/testing.md` - Test commands
- [ ] `docs/implementation/*.md` - Historical + future refs
- [ ] `docs/planning/*.md` - Rename files + content
- [ ] `docs/architecture/*.md` - Technical docs
- [ ] `docs/ideas/GITHUB-AUDIT-TOOL.md` - Related tools

### Phase 6: Templates & Examples

- [ ] `templates/github-actions/basic-ci.yml` - Installation, commands
- [ ] `templates/github-actions/pr-validation.yml` - Installation, commands
- [ ] `templates/github-actions/setup-protection.yml` - Installation, commands
- [ ] `templates/examples/node-project.md` - Commands
- [ ] `templates/examples/python-project.md` - Commands

### Phase 7: Infrastructure

- [ ] `AUTO-FIX.md` - Command examples
- [ ] `TEST-GAP-ANALYSIS.md` - References
- [ ] `~/claude-code-tools/CLAUDE.md` - Update project name in subagent references
- [ ] Rename directory: `git-pr-manager` → `git-pr-manager`
- [ ] Update git remote URL
- [ ] Rename GitHub repository
- [ ] Add migration note to CHANGELOG: Users should rename `.gpm.yml` → `.gpm.yml`
- [ ] Rename user's local `.gpm.yml` → `.gpm.yml` (if exists)

---

## Find & Replace Strategy

### Safe Find & Replace Patterns

**Pattern 1: Binary Name**

```bash
# Find: \bgpm\b (word boundary)
# Replace: gpm
# Files: *.md, *.ts, *.js, *.yml, *.yaml
# Exclude: node_modules/, dist/, coverage/
```

**Pattern 2: Package Name**

```bash
# Find: @littlebearapps/git-pr-manager
# Replace: @littlebearapps/git-pr-manager
# Files: *.json, *.md, *.ts, *.yml
# Exclude: node_modules/, dist/, coverage/, package-lock.json
```

**Pattern 3: Config File**

```bash
# Find: \.gpm\.yml
# Replace: .gpm.yml
# Files: *.ts, *.md, *.yml
# Exclude: node_modules/, dist/, coverage/
```

**Pattern 4: Repository URL**

```bash
# Find: github\.com/littlebearapps/git-pr-manager
# Replace: github.com/littlebearapps/git-pr-manager
# Files: *.json, *.md, *.yml
# Exclude: node_modules/, dist/, coverage/
```

**Pattern 5: Hook Signature**

```bash
# Find: Generated by git-pr-manager \(gpm\)
# Replace: Generated by git-pr-manager (gpm)
# Files: *.ts
# Exclude: node_modules/, dist/, coverage/
```

---

## Risk Assessment

### High Risk (Manual Review Required)

1. **Git Hooks** - Logic detecting/generating hooks
   - Files: `src/utils/git-hooks.ts`, `src/commands/*-hooks.ts`
   - Risk: Breaking existing hook detection
   - Mitigation: Comprehensive test coverage

2. **Config Loading** - File discovery logic
   - Files: `src/services/ConfigService.ts`
   - Risk: Not finding config files
   - Mitigation: Test with both old/new names (or skip since pre-release)

3. **Update Checks** - npm registry queries
   - Files: `src/utils/update-check.ts`
   - Risk: Querying wrong package
   - Mitigation: Unit tests with mocked responses

4. **Tests** - Mock configurations
   - Files: All `tests/**/*.test.ts`
   - Risk: Tests failing due to hardcoded names
   - Mitigation: Run full test suite after changes

### Medium Risk (Automated + Spot Check)

1. **Documentation** - Command examples
   - Files: All `*.md` files
   - Risk: Incorrect installation instructions
   - Mitigation: Spot check critical docs (README, CLAUDE.md)

2. **Templates** - GitHub Actions workflows
   - Files: `templates/github-actions/*.yml`
   - Risk: Workflow examples don't work
   - Mitigation: Validate YAML syntax

### Low Risk (Safe to Automate)

1. **Help Text** - CLI descriptions
   - Files: `src/commands/*.ts`
   - Risk: Minimal - cosmetic only
   - Mitigation: Manual CLI testing

2. **Error Messages** - User-facing strings
   - Files: `src/utils/errors.ts`, various services
   - Risk: Minimal - informational only
   - Mitigation: Test error scenarios

---

## Post-Rename Verification

### Automated Checks

```bash
# 1. No remaining "gpm" references (except deprecation notices)
grep -r "gpm" --include="*.ts" --include="*.json" --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=coverage

# 2. No remaining old package name
grep -r "@littlebearapps/git-pr-manager" \
  --include="*.ts" --include="*.json" --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=coverage

# 3. No remaining old repository URL
grep -r "github.com/littlebearapps/git-pr-manager" \
  --include="*.ts" --include="*.json" --include="*.md" --include="*.yml" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=coverage

# 4. No remaining .gpm.yml references
grep -r "\.gpm\.yml" \
  --include="*.ts" --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=coverage
```

### Manual Verification

- [ ] Build succeeds: `npm run build`
- [ ] All tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] CLI works: `node dist/index.js --help`
- [ ] Binary name correct: Check `dist/index.js` shebang
- [ ] Help text updated: `gwa --help`
- [ ] Config creation works: `gwa init --template basic`
- [ ] Hooks work: `gwa install-hooks`
- [ ] Update check works: `gwa check-update` (test with local registry)
- [ ] `.claude/settings.local.json` permissions updated
- [ ] `~/claude-code-tools/CLAUDE.md` references updated
- [ ] User's `.gpm.yml` renamed to `.gpm.yml` (if exists)

### Integration Testing

- [ ] Fresh install works: `npm install -g ./`
- [ ] Global binary available: `which gpm`
- [ ] Commands work: `gwa status`, `gwa feature test`
- [ ] Config file created correctly: `.gpm.yml` not `.gpm.yml`
- [ ] Hooks install with new signature
- [ ] Update check queries correct package

---

## Timeline Estimate

**Phase 1-3 (Critical/Source/Tests)**: 3-4 hours

- Package files: 30 minutes
- Claude Code config: 5 minutes
- Source code: 90 minutes
- Tests: 90-120 minutes

**Phase 4-5 (Documentation)**: 2-3 hours

- High priority docs: 90 minutes
- Medium priority docs: 60-90 minutes

**Phase 6 (Templates)**: 30 minutes

**Phase 7 (Infrastructure)**: 1-1.5 hours

- Parent CLAUDE.md: 10 minutes
- Directory rename: 15 minutes
- Git repo rename: 15 minutes
- User config migration note: 5 minutes
- Post-rename verification: 30-45 minutes

**Total**: 6.5-8.5 hours for complete, thorough rename

---

## Recommended Execution Order

1. **Create git branch**: `git checkout -b rename/gpm-to-gwa`
2. **Phase 1**: Core package files (critical for everything else)
3. **Automated find/replace**: Run safe patterns on source code
4. **Manual review**: Check hook logic, config loading, update checks
5. **Phase 2**: Source code manual updates
6. **Phase 3**: Tests (run after each batch to catch issues early)
7. **Phase 4-5**: Documentation (can use find/replace extensively)
8. **Phase 6**: Templates
9. **Verification**: Run all automated checks + manual tests
10. **Phase 7**: Rename directory and repository (LAST STEP!)
11. **Final test**: Clean install and full integration test
12. **Commit**: `git commit -m "feat: rename gpm to gpm (git-pr-manager)"`
13. **PR**: Create PR for review before merging

---

## Notes

- **No migration needed**: Since package is pre-release, we can skip backward compatibility
- **Clean break**: No need to support old binary name or config file
- **GitHub redirect**: Repository rename automatically redirects old URLs
- **npm package**: New package name won't conflict with old (we never published)

---

## References

- **POSITIONING.md** - Strategic rationale for rename
- **package.json** - Current package configuration
- Git repository: https://github.com/littlebearapps/git-pr-manager (to be renamed)
- Working directory: `/Users/nathanschram/claude-code-tools/lba/apps/subagents/git-pr-manager` (to be renamed)

---

## Audit Updates

### 2025-11-15: Comprehensive Investigation Results

**Additional Files Found** (not in original audit):

1. ✅ **`.claude/settings.local.json`** (3 gpm references in permissions)
2. ✅ **`~/claude-code-tools/CLAUDE.md`** (2 git-pr-manager references in parent directory)
3. ✅ **User's `.gpm.yml`** (local config file - migration note added)
4. ✅ **`package-lock.json`** (clarified as auto-regenerated, no manual edit)

**Investigation Method**:

- Searched 194 instances of "gpm" in source files
- Searched 256 instances of "git-pr-manager" across all files
- Checked hidden config files, parent directories, lock files
- Verified GitHub-specific files and templates

**Coverage**: 99%+ of required changes documented
**Status**: Audit complete and comprehensive ✅

---

**End of Audit**
