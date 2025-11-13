# Git Workflow Manager - Phase 7 Implementation Plan
## Auto-Update Notification System

**Document Version**: 1.0
**Date**: 2025-11-13
**Status**: Ready for Implementation
**Confidence Level**: Very High
**GPT-5 Validated**: Yes (via zen deepthink)

---

## Executive Summary

Phase 7 will add intelligent auto-update notifications to git-workflow-manager, ensuring users and AI agents stay informed about new versions without compromising performance or user experience. This plan implements a lightweight, npm-first approach with smart suppression for CI/automation environments.

**Key Objectives**:
1. **Zero-friction updates** - Notify users of available updates with clear upgrade path
2. **AI agent friendly** - Machine-readable JSON output, explicit suppression controls
3. **CI/automation safe** - Silent in non-interactive environments by default
4. **npm-first architecture** - Use npm registry as source of truth (no separate infrastructure)
5. **Performance conscious** - 7-day cache, <1s network timeout, fire-and-forget checks

**Timeline**: 1-2 development sessions (~4-6 hours)
**Risk Assessment**: LOW (non-breaking addition, graceful failure, extensive suppression rules)
**Expected Release**: v1.5.0

---

## Current State Analysis

### Distribution & Versioning (v1.4.0)

**npm Package**:
- Published as: `@littlebearapps/git-workflow-manager`
- Current version: v1.4.0-beta.1
- Binary: `gwm`
- Install: `npm install -g @littlebearapps/git-workflow-manager`

**GitHub Repository**:
- ❌ **NOT YET CREATED** - Currently local-only development
- ⚠️ **Required for Phase 7** - Need GitHub repo for:
  - Version control and backup
  - GitHub Actions CI/CD (already documented in guides!)
  - Optional GitHub Releases for changelogs
  - Future open-sourcing

**Current Version Management**:
- Manual version bumps in package.json
- No automated update checks
- No notification system
- Users rely on manual `npm outdated` checks

### Identified Gaps

1. **No update awareness** - Users don't know when updates are available
2. **No dist-tag strategy** - All releases use default `latest` tag
3. **No AI agent integration** - No machine-readable update check command
4. **No suppression controls** - No way to disable checks in CI/automation
5. **No GitHub repository** - Missing infrastructure for releases and CI/CD

---

## Implementation Plan

### Phase 7.1: GitHub Repository Setup (PREREQUISITE)

**Objective**: Create private GitHub repository for git-workflow-manager

**Tasks**:
1. Create private GitHub repo: `littlebearapps/git-workflow-manager`
2. Initialize with current codebase
3. Set up GitHub Actions CI/CD:
   - Test workflow (run on PR/push)
   - Publish workflow (publish to npm on release)
   - Security scan workflow
4. Configure repository settings:
   - Branch protection on `main`
   - Require status checks
   - Enable GitHub Actions
5. Optional: Set up GitHub Releases template

**Deliverables**:
- Private GitHub repo created
- CI/CD workflows active
- Documentation updated with repo URL

**Time Estimate**: 1-2 hours

**Why Private Initially**:
- Can test GitHub Actions without public visibility
- Can make public later if/when ready
- Enables GitHub Releases for changelogs (optional)
- Backup and version control

---

### Phase 7.2: Update Check Infrastructure

**Objective**: Implement lightweight update checking with npm dist-tags

#### Task 7.2.1: Add Dependencies

**File**: `package.json`

```json
{
  "dependencies": {
    "package-json": "^10.0.0",
    "semver": "^7.5.4"
  }
}
```

**Rationale**:
- `package-json`: Fetch npm package metadata with dist-tags
- `semver`: Version comparison and diff calculation

---

#### Task 7.2.2: Create Update Check Utility

**File**: `src/utils/update-check.ts` (NEW)

**Functionality**:
- Check npm registry for latest version (with dist-tag support)
- Cache results in TMPDIR (7-day TTL)
- Respect suppression rules (CI, JSON mode, non-TTY)
- Graceful failure on network errors
- Short timeout (1000ms default)

**Key Functions**:
```typescript
export async function checkForUpdate(options: {
  packageName: string;
  currentVersion: string;
  channel?: 'latest' | 'next';
  cacheMs?: number;
  timeoutMs?: number;
}): Promise<UpdateCheckResult>

export async function maybeNotifyUpdate(options: {
  pkg: { name: string; version: string };
  argv: string[];
}): Promise<UpdateCheckResult | null>
```

**Implementation** (provided by zen analysis):
- Auto-detect channel based on version (prerelease → `next`, stable → `latest`)
- Environment variable overrides: `GWM_UPDATE_CHANNEL`
- Suppression logic:
  - `GWM_DISABLE_UPDATE_CHECK=1`
  - `NO_UPDATE_NOTIFIER=1`
  - `process.env.CI`
  - `process.env.GITHUB_ACTIONS`
  - `--json` flag
  - `!process.stderr.isTTY`

**Cache Strategy**:
- Location: `os.tmpdir()/gwm-update-cache.json`
- TTL: 7 days (configurable via `GWM_UPDATE_CHECK_INTERVAL_MS`)
- Structure:
  ```json
  {
    "packageName": "@littlebearapps/git-workflow-manager",
    "channel": "latest",
    "latest": "1.5.0",
    "timestamp": 1699881234567
  }
  ```

**Time Estimate**: 2-3 hours

---

#### Task 7.2.3: CLI Integration (Fire-and-Forget)

**File**: `src/index.ts` (MODIFY)

**Changes**:
```typescript
import { maybeNotifyUpdate } from './utils/update-check.js';
import pkg from '../package.json' assert { type: 'json' };

async function main(argv: string[]) {
  // Fire-and-forget check (don't block CLI)
  void maybeNotifyUpdate({ pkg, argv });

  // ... rest of CLI routing
}
```

**Notification Format** (stderr only):
```
Update available: @littlebearapps/git-workflow-manager 1.4.0 -> 1.5.0 (stable). Run: npm i -g @littlebearapps/git-workflow-manager@latest
```

**Time Estimate**: 30 minutes

---

### Phase 7.3: Machine-Readable Update Command

**Objective**: Provide explicit update check command for AI agents and automation

#### Task 7.3.1: Create check-update Command

**File**: `src/commands/check-update.ts` (NEW)

**Functionality**:
- Force update check (ignore cache)
- Always output JSON to stdout
- Never suppress (explicit user request)
- Exit code 0 always (non-blocking)

**Implementation**:
```typescript
export async function run(argv: string[]) {
  const channel = process.env.GWM_UPDATE_CHANNEL;
  const res = await checkForUpdate({
    packageName: pkg.name,
    currentVersion: pkg.version,
    channel,
    cacheMs: 0 // Force fresh check
  });

  // Always stdout JSON
  process.stdout.write(JSON.stringify(res, null, 2) + '\n');
}
```

**JSON Output Schema**:
```typescript
interface UpdateCheckResult {
  current: string;           // Current version
  latest: string | null;     // Latest version (null if fetch failed)
  tag: string;               // Dist-tag checked ('latest' or 'next')
  updateAvailable: boolean;  // True if update available
  updateType: string | null; // 'patch', 'minor', 'major', 'prerelease'
  fromCache: boolean;        // True if result from cache
}
```

**Example Output**:
```json
{
  "current": "1.4.0-beta.1",
  "latest": "1.5.0",
  "tag": "latest",
  "updateAvailable": true,
  "updateType": "minor",
  "fromCache": false
}
```

**Time Estimate**: 1 hour

---

#### Task 7.3.2: Register Command in CLI

**File**: `src/index.ts` (MODIFY)

**Add to command routing**:
```typescript
program
  .command('check-update')
  .description('Check for available updates (machine-readable JSON)')
  .action(async () => {
    const { run } = await import('./commands/check-update.js');
    await run(process.argv);
  });
```

**Time Estimate**: 15 minutes

---

### Phase 7.4: Dist-Tag Strategy & Publishing Workflow

**Objective**: Implement dist-tag strategy for stable/prerelease versions

#### Task 7.4.1: Document Publishing Process

**File**: `docs/guides/PUBLISHING.md` (NEW)

**Content**:
- How to publish stable releases (`npm publish --tag latest`)
- How to publish prereleases (`npm publish --tag next`)
- Version numbering conventions
- Changelog update process
- Optional: GitHub Release creation

**Publishing Commands**:
```bash
# Stable release
npm version patch  # or minor, major
npm publish --tag latest
git push --follow-tags

# Prerelease
npm version prerelease --preid beta
npm publish --tag next
git push --follow-tags

# Optional: Create GitHub Release
gh release create v1.5.0 --notes "See CHANGELOG.md"
```

**Time Estimate**: 1 hour

---

#### Task 7.4.2: Update package.json Scripts

**File**: `package.json` (MODIFY)

**Add scripts**:
```json
{
  "scripts": {
    "version:patch": "npm version patch",
    "version:minor": "npm version minor",
    "version:major": "npm version major",
    "version:beta": "npm version prerelease --preid beta",
    "publish:stable": "npm publish --tag latest",
    "publish:next": "npm publish --tag next"
  }
}
```

**Time Estimate**: 15 minutes

---

### Phase 7.5: Testing

**Objective**: Comprehensive testing of update check logic

#### Task 7.5.1: Unit Tests

**File**: `tests/utils/update-check.test.ts` (NEW)

**Test Coverage**:
- ✅ Check cache behavior (hit/miss/expiry)
- ✅ Version comparison logic
- ✅ Dist-tag selection (stable vs prerelease)
- ✅ Network timeout handling
- ✅ Graceful failure on network errors
- ✅ Suppression rules (CI, JSON mode, non-TTY)
- ✅ Environment variable overrides

**Test Count**: ~15-20 tests

**Time Estimate**: 2 hours

---

#### Task 7.5.2: Integration Tests

**File**: `tests/commands/check-update.test.ts` (NEW)

**Test Coverage**:
- ✅ Command outputs valid JSON
- ✅ Respects GWM_UPDATE_CHANNEL env var
- ✅ Handles network failures gracefully
- ✅ Returns correct updateType values

**Test Count**: ~5-8 tests

**Time Estimate**: 1 hour

---

#### Task 7.5.3: Manual Testing

**Test Scenarios**:
1. Fresh install → verify notification shows
2. Up-to-date version → no notification
3. CI environment → silent
4. `--json` flag → silent
5. `gwm check-update` → JSON output
6. `GWM_DISABLE_UPDATE_CHECK=1` → no check
7. `GWM_UPDATE_CHANNEL=next` → checks prerelease

**Time Estimate**: 1 hour

---

### Phase 7.6: Documentation

**Objective**: Document update notification system

#### Task 7.6.1: Update README

**File**: `README.md` (MODIFY)

**Add section**: "## 🔔 Update Notifications"

**Content**:
- How update checks work
- How to check for updates (`gwm check-update`)
- Environment variables for control
- AI agent integration

**Time Estimate**: 30 minutes

---

#### Task 7.6.2: Update AI Agent Integration Guide

**File**: `docs/guides/AI-AGENT-INTEGRATION.md` (MODIFY)

**Add section**: "## Update Management"

**Content**:
- How AI agents can check for updates
- JSON output schema
- How to auto-update (via npm)
- Suppression in automated workflows

**Time Estimate**: 30 minutes

---

#### Task 7.6.3: Update GitHub Actions Guide

**File**: `docs/guides/GITHUB-ACTIONS-INTEGRATION.md` (MODIFY)

**Add section**: "## Version Management in CI"

**Content**:
- How to check for updates in workflows
- How to suppress notifications
- Example workflow for monitoring updates

**Time Estimate**: 30 minutes

---

## Environment Variables

### User Control

| Variable | Default | Description |
|----------|---------|-------------|
| `GWM_DISABLE_UPDATE_CHECK` | `0` | Set to `1` to disable all update checks |
| `GWM_UPDATE_CHANNEL` | `latest` or `next` | Force specific dist-tag (auto-detected from version) |
| `GWM_UPDATE_CHECK_INTERVAL_MS` | `604800000` | Cache TTL (7 days default) |
| `GWM_UPDATE_TIMEOUT_MS` | `1000` | Network timeout for npm registry check |
| `NO_UPDATE_NOTIFIER` | - | Standard env var to disable update checks (respected) |

---

## Dependencies

### New Dependencies

```json
{
  "dependencies": {
    "package-json": "^10.0.0",
    "semver": "^7.5.4"
  }
}
```

**Total Size Impact**: ~500KB (both packages are lightweight)

---

## Risk Assessment

### Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Network failures block CLI** | High | Low | Fire-and-forget, 1s timeout, graceful failure |
| **Rate limiting from npm** | Medium | Very Low | 7-day cache, short timeout |
| **False notifications** | Low | Low | Comprehensive testing, cache validation |
| **CI/automation noise** | Medium | Low | Strict suppression rules, JSON mode detection |
| **Cache corruption** | Low | Very Low | Graceful fallback to network check |

**Overall Risk**: **LOW**

---

## Success Metrics

### Quantitative

- ✅ Update check adds <50ms to CLI startup (fire-and-forget)
- ✅ Zero rate limit errors from npm registry
- ✅ 100% test coverage for update-check.ts
- ✅ Zero CI/automation noise (confirmed via GitHub Actions testing)

### Qualitative

- ✅ Users are notified of updates within 7 days
- ✅ AI agents can check and update programmatically
- ✅ Clear upgrade path in notification message
- ✅ No disruption to existing workflows

---

## Implementation Timeline

### Session 1: Infrastructure & Core (3-4 hours)
- ✅ Create GitHub repository (if not done)
- ✅ Add dependencies
- ✅ Implement update-check.ts
- ✅ CLI integration (fire-and-forget)
- ✅ Basic manual testing

### Session 2: Commands & Testing (2-3 hours)
- ✅ Implement check-update command
- ✅ Unit tests (update-check.test.ts)
- ✅ Integration tests (check-update.test.ts)
- ✅ Documentation updates

### Total Time: 5-7 hours

---

## Rollout Plan

### Version 1.5.0-beta.1 (Prerelease)

**Goals**:
- Test update notification in real environment
- Verify suppression rules in CI
- Collect feedback from AI agents

**Publish**:
```bash
npm version prerelease --preid beta
npm publish --tag next
```

**Testing Period**: 1 week

---

### Version 1.5.0 (Stable)

**Goals**:
- Production release with update notifications
- Full documentation
- GitHub Release with changelog

**Publish**:
```bash
npm version minor
npm publish --tag latest
gh release create v1.5.0 --notes-file CHANGELOG.md
```

---

## Future Enhancements (Not in Phase 7)

### Optional: GitHub Releases Integration

**When**: If/when repository becomes public

**Features**:
- `gwm release-notes` command to open release page
- Display release notes in notification
- Link to GitHub Releases for full changelog

**Time Estimate**: 1-2 hours

---

### Optional: Auto-Update Command

**Feature**: `gwm update` command that runs npm install

**Rationale**: Convenience for users (but risky for automation)

**Time Estimate**: 30 minutes

**Decision**: Defer until user request

---

## Appendix A: Implementation Code

### Full update-check.ts Implementation

See zen analysis response for complete code (200+ lines).

**Key exports**:
- `checkForUpdate(options)` - Core check logic
- `maybeNotifyUpdate({ pkg, argv })` - CLI integration
- Helper functions: `isPrerelease()`, `defaultChannelFor()`, `shouldSuppress()`

---

### Full check-update.ts Implementation

See zen analysis response for complete code (20+ lines).

**Key export**:
- `run(argv)` - Command handler

---

## Appendix B: Test Plan

### Test Coverage Matrix

| Component | Unit Tests | Integration Tests | Manual Tests |
|-----------|-----------|-------------------|--------------|
| update-check.ts | 15-20 | - | 7 scenarios |
| check-update.ts | - | 5-8 | - |
| CLI integration | - | - | 7 scenarios |
| **Total** | **15-20** | **5-8** | **7 scenarios** |

---

## Appendix C: Repository Strategy

### Recommendation: Create Private GitHub Repository

**Why create a repo NOW** (even though zen suggested "keep in monorepo"):
1. ✅ **Enable CI/CD**: We just documented GitHub Actions integration - we need a repo to use it!
2. ✅ **Version Control**: Proper git history and backup
3. ✅ **GitHub Releases**: Optional but professional for changelogs
4. ✅ **Can Make Public Later**: Start private, go public when ready
5. ✅ **Collaboration Ready**: Easier to collaborate if needed

**Why private initially**:
- Test GitHub Actions without public visibility
- Iterate on CI/CD workflows privately
- Can make public when polished and ready

**Setup Checklist**:
- [ ] Create repo: `littlebearapps/git-workflow-manager`
- [ ] Set to Private
- [ ] Push current codebase
- [ ] Set up branch protection on `main`
- [ ] Configure GitHub Actions CI/CD
- [ ] Update package.json repository field

**Time to Create**: 1-2 hours (includes CI/CD setup)

---

## Conclusion

Phase 7 adds intelligent update notifications with:
- **Zero friction** - Fire-and-forget checks with smart caching
- **AI-friendly** - JSON output, explicit suppression
- **CI-safe** - Silent in automation by default
- **npm-first** - No separate infrastructure needed
- **Performance conscious** - <1s timeout, 7-day cache

**Total Implementation Time**: 5-7 hours
**Risk Level**: LOW
**Value Delivered**: HIGH (keeps users informed, improves retention)

**Next Steps**:
1. Create private GitHub repository (prerequisite)
2. Implement Phase 7.2 (update check infrastructure)
3. Add check-update command (Phase 7.3)
4. Test and document (Phases 7.5-7.6)
5. Release v1.5.0-beta.1 for testing

---

**Document Status**: ✅ Ready for Implementation
**GPT-5 Validation**: ✅ Complete (zen deepthink analysis)
**Stakeholder**: Nathan Schram / Little Bear Apps
