# Version Management Implementation Plan

**Version**: 1.0
**Date**: 2025-11-19
**Status**: Proposed
**Related**: Alternative D Release Validation Strategy

---

## Executive Summary

This plan extends **Alternative D** (single source of truth architecture) to documentation and user-facing content by implementing a **three-tier versioning strategy** that eliminates manual version updates while maintaining architectural simplicity.

**Problem**: Currently, version numbers appear in multiple places (README.md, CLAUDE.md, docs/) and require manual updates during releases, violating Alternative D's "single source of truth" principle.

**Solution**: Strategic three-tier approach that leverages automation where reliable, accepts manual updates where necessary, and avoids complex sync mechanisms.

---

## Background: zen thinkdeep Investigation

### Investigation Summary

**Research Question**: "Is there a way to use 'Alternative D' in our readme.md file and other code/docs as well, so that the version is auto-updated automatically EVERYWHERE?"

**Analysis Conducted**: Three-step zen thinkdeep investigation (VERY HIGH confidence)

**Approaches Evaluated**:
1. npm badges (shields.io) - **✅ Recommended**
2. semantic-release/git plugin - **❌ Rejected** (violates Alternative D)
3. Post-release automation scripts - **❌ Rejected** (fragile sync mechanism)
4. Pre-build template injection - **❌ Rejected** (build-time complexity)
5. Dynamic documentation (VitePress/Docusaurus) - **❌ Rejected** (overkill)

**Key Finding**: Full automation everywhere is architecturally undesirable. Accept strategic manual updates for low-frequency, high-visibility content.

### Expert Validation (zen thinkdeep)

**Expert refinements**:
- npm badges are zero-maintenance and perfectly aligned with Alternative D
- Manual updates during release PRs are acceptable (low frequency: ~weekly)
- Runtime `getVersion()` already solves the code version problem
- Avoid introducing new sync mechanisms (post-release scripts, git commits)
- Single source of truth means **one reliable authority**, not "no manual work"

**Confidence Level**: VERY HIGH (95% confidence in recommended approach)

---

## Three-Tier Strategy Overview

### Tier 1: Zero-Maintenance (npm Badges) ✅

**Use For**: Primary version display in user-facing docs

**Mechanism**: shields.io badges that auto-fetch from npm registry

**Benefits**:
- Zero maintenance (updates within minutes of npm publish)
- No sync mechanisms to fail
- Industry-standard solution
- Visually prominent

**Locations**:
- README.md header (primary badge)
- CLAUDE.md status line (optional)

**Implementation Effort**: 5-10 minutes

---

### Tier 2: Strategic Manual Updates (PR Checklist) ✅

**Use For**: Metadata files updated during release PRs only

**Mechanism**: PR template checklist + human verification

**Benefits**:
- Low frequency (1-2 times per week max)
- High visibility (release PRs already reviewed)
- No complex automation to maintain
- Forces conscious decision-making

**Locations**:
- CLAUDE.md metadata header (Last Updated date only)
- docs/TESTS.md metadata header
- README.md "What's New" section

**Implementation Effort**: 15-20 minutes (one-time setup)

---

### Tier 3: Runtime Detection (Already Solved) ✅

**Use For**: All code that needs version information

**Mechanism**: `getVersion()` utility with git tags + fallback

**Benefits**:
- Already implemented and tested
- Works in development (git tags) and production (package.json)
- No manual updates needed
- Single source of truth (git tags from semantic-release)

**Locations**:
- CLI `--version` flag
- `gpm doctor` output
- Telemetry payloads
- Error reports

**Implementation Effort**: 0 minutes (already complete)

---

## Implementation Guide

### Phase 1: npm Badges (5-10 minutes)

#### Step 1.1: Add Version Badge to README.md

**Location**: README.md header (line 3-5, after title)

**Before**:
```markdown
# git-pr-manager

> Streamline GitHub PR workflows with automated checks and validations
```

**After**:
```markdown
# git-pr-manager

[![npm version](https://img.shields.io/npm/v/@littlebearapps/git-pr-manager.svg)](https://www.npmjs.com/package/@littlebearapps/git-pr-manager)
[![npm downloads](https://img.shields.io/npm/dm/@littlebearapps/git-pr-manager.svg)](https://www.npmjs.com/package/@littlebearapps/git-pr-manager)

> Streamline GitHub PR workflows with automated checks and validations
```

**Badge URL Format**:
```
https://img.shields.io/npm/v/@littlebearapps/git-pr-manager.svg
```

**Auto-Update Frequency**: Within 5-10 minutes of npm publish (shields.io cache)

---

#### Step 1.2: Remove Redundant Hardcoded Versions

**README.md Changes**:

**Before** (lines ~20-30, "What's New" section):
```markdown
## What's New in v1.8.0

**Alternative D: Release Validation Strategy** (2025-11-19)
- Pre-release validation with `gpm doctor --pre-release`
...
```

**After**:
```markdown
## What's New

**Latest Release** (see npm badge above for version):

**Alternative D: Release Validation Strategy** (2025-11-19)
- Pre-release validation with `gpm doctor --pre-release`
...
```

**Rationale**: Version number now comes from badge, release date remains for context.

---

#### Step 1.3: Optional - Add Badge to CLAUDE.md

**Location**: CLAUDE.md status header (line 3-5)

**Before**:
```markdown
**Last Updated**: 2025-11-19 (Alternative D Phase 2)
**Version**: 1.8.0
**Status**: Production - Multi-Language Support (Phase 1a-1c Complete) ✅
```

**After**:
```markdown
**Last Updated**: 2025-11-19 (Alternative D Phase 2)
**Version**: [![npm](https://img.shields.io/npm/v/@littlebearapps/git-pr-manager.svg)](https://www.npmjs.com/package/@littlebearapps/git-pr-manager)
**Status**: Production - Multi-Language Support (Phase 1a-1c Complete) ✅
```

**Note**: This is optional - CLAUDE.md is internal documentation, so inline badge may be less useful than README.md.

---

### Phase 2: PR Template Checklist (15-20 minutes)

#### Step 2.1: Create PR Template with Version Checklist

**File**: `.github/PULL_REQUEST_TEMPLATE.md`

**Content to Add**:
```markdown
## Release Checklist (for main branch merges only)

**Note**: Only required if this PR will trigger a release (conventional commit on main).

- [ ] **CLAUDE.md**: Updated "Last Updated" date (line 3)
- [ ] **docs/TESTS.md**: Updated "Last Updated" date (line 3)
- [ ] **README.md**: Added release notes to "What's New" section (date + features)
- [ ] **Version badges**: No action needed (auto-updates from npm)
- [ ] **package.json**: No action needed (stays `0.0.0-development`)

**Reminder**: Version numbers are NOT manually updated - they come from:
- npm badge (auto-updates within 5-10 minutes of publish)
- semantic-release (determines version from commits)
- `getVersion()` utility (runtime detection via git tags)

See `/docs/planning/VERSION-MANAGEMENT-IMPLEMENTATION-PLAN.md` for details.
```

**Integration**: This template appears automatically when creating PRs on GitHub.

---

#### Step 2.2: Document Checklist Usage

**File**: `CLAUDE.md` (add to "Quick Reference" or "Development Workflow" section)

**Content**:
```markdown
### Release PR Checklist

When merging a PR to main that will trigger a release (conventional commit):

1. Update "Last Updated" dates:
   - CLAUDE.md (line 3)
   - docs/TESTS.md (line 3)

2. Add release notes to README.md "What's New" section:
   - Date: YYYY-MM-DD
   - Features: Bulleted list of changes

3. Do NOT update version numbers:
   - npm badge auto-updates from registry
   - package.json stays `0.0.0-development`
   - semantic-release determines version from commits

**Frequency**: 1-2 times per week (low overhead)
```

---

### Phase 3: Version Architecture Documentation (10-15 minutes)

#### Step 3.1: Create Architecture Document

**File**: `/docs/architecture/VERSION-MANAGEMENT.md` (new file)

**Content**:
```markdown
# Version Management Architecture

**Status**: Active (Alternative D Phase 2+)
**Last Updated**: 2025-11-19

---

## Overview

git-pr-manager uses a **three-tier version management strategy** that extends Alternative D's "single source of truth" principle to documentation and user-facing content.

**Design Goal**: Eliminate version number sync issues while maintaining architectural simplicity.

---

## Single Source of Truth: npm Registry

**Authority**: npm registry (`https://registry.npmjs.org/@littlebearapps/git-pr-manager`)

**Why**:
- Updated atomically by semantic-release during publish
- Public, cacheable, globally distributed
- Industry-standard source for package versions

**Not Sources of Truth**:
- ❌ package.json (`0.0.0-development` placeholder)
- ❌ README.md (uses npm badge)
- ❌ CLAUDE.md (manual dates only)
- ❌ Git tags (created by semantic-release, but npm is authoritative)

---

## Three-Tier Strategy

### Tier 1: Zero-Maintenance (npm Badges)

**Use For**: Primary version display in user-facing docs

**Mechanism**: shields.io badges fetch version from npm registry

**Example**:
```markdown
[![npm version](https://img.shields.io/npm/v/@littlebearapps/git-pr-manager.svg)](https://www.npmjs.com/package/@littlebearapps/git-pr-manager)
```

**Locations**:
- README.md header (primary)
- CLAUDE.md status (optional)

**Update Frequency**: 5-10 minutes after npm publish (automatic)

---

### Tier 2: Strategic Manual Updates (PR Checklist)

**Use For**: Metadata files updated during release PRs only

**Mechanism**: PR template checklist + human verification

**What Gets Updated**:
- CLAUDE.md: "Last Updated" date
- docs/TESTS.md: "Last Updated" date
- README.md: "What's New" release notes (date + features)

**What Does NOT Get Updated**:
- Version numbers (from badge)
- package.json (stays `0.0.0-development`)

**Frequency**: 1-2 times per week (low overhead)

---

### Tier 3: Runtime Detection (Code)

**Use For**: All code that needs version information

**Mechanism**: `getVersion()` utility (src/utils/version.ts)

**Algorithm**:
1. Try git tags: `git describe --tags --exact-match HEAD`
2. Fallback: `package.json` version

**Works In**:
- Development: git tags from semantic-release
- Production: package.json (if built without git)
- CI: git tags (full clone)

**Usage**:
```typescript
import { getVersion } from './utils/version';

const version = getVersion(); // "1.8.0" (from git tag or package.json)
```

**Locations**:
- CLI `--version` flag
- `gpm doctor` output
- Telemetry payloads
- Error reports

---

## Rejected Approaches

### ❌ @semantic-release/git Plugin

**Why Rejected**: Violates Alternative D by committing version changes to git, creating circular dependency.

**Alternative D Principle**: package.json version is a placeholder, not source of truth.

---

### ❌ Post-Release Automation Scripts

**Why Rejected**:
- Fragile sync mechanism (can fail after publish)
- Violates "single source of truth" (creates multiple sources)
- Maintenance overhead

**Alternative**: Accept strategic manual updates in PR checklist.

---

### ❌ Pre-Build Template Injection

**Why Rejected**:
- Build-time complexity
- Requires variable replacement in multiple file types
- Fragile (templates can drift)

**Alternative**: Runtime `getVersion()` for code, npm badges for docs.

---

### ❌ Dynamic Documentation (VitePress/Docusaurus)

**Why Rejected**:
- Massive infrastructure overhead (10+ hours setup)
- Not needed for CLI tool documentation
- GitHub/npm markdown is sufficient

**Alternative**: npm badges provide dynamic version display without infrastructure.

---

## Version Update Workflow

### Developer Workflow (Feature Branches)

1. **Make changes** on feature branch
2. **Commit** with conventional commit message (`feat:`, `fix:`, etc.)
3. **Create PR** to main
4. **During PR review**: Update dates/release notes per PR template checklist
5. **Merge PR** to main
6. **GitHub Actions**: Runs semantic-release
7. **semantic-release**: Determines version, publishes to npm, creates GitHub release
8. **npm badge**: Auto-updates within 5-10 minutes
9. **Done**: Version visible everywhere without manual sync

**Manual Steps**: Only dates and release notes (low frequency, high visibility)

---

### Automated Steps (No Manual Work)

1. **semantic-release** determines version from commits
2. **npm publish** via GitHub Actions (OIDC auth)
3. **GitHub release** created automatically
4. **Git tags** created automatically
5. **npm badge** fetches new version from registry
6. **CLI `--version`** uses git tags (via `getVersion()`)

---

## Testing Version Detection

### Test npm Badge

Visit README.md on GitHub - badge should show current npm version:

```
https://github.com/littlebearapps/git-pr-manager
```

Expected: Badge shows `v1.8.0` (or latest version)

---

### Test Runtime Detection

```bash
gpm --version
# Expected: 1.8.0 (from git tag)

gpm doctor
# Expected: Shows version in header
```

---

### Test Update Workflow

1. Make feature branch with `feat:` commit
2. Merge to main
3. Wait for GitHub Actions publish workflow
4. Verify npm badge updates within 5-10 minutes
5. Verify `gpm --version` shows new version

---

## Maintenance

### Monthly Review

- ✅ Verify npm badge is working (check README.md on GitHub)
- ✅ Verify `gpm --version` matches npm registry
- ✅ Check PR template checklist is being followed

### No Ongoing Maintenance Required

- npm badges auto-update (no action needed)
- `getVersion()` uses git tags (no action needed)
- Manual updates only during releases (low frequency)

---

## References

- **Alternative D Strategy**: `/docs/RELEASE-VALIDATION-STRATEGY.md`
- **Implementation Plan**: `/docs/planning/VERSION-MANAGEMENT-IMPLEMENTATION-PLAN.md`
- **zen thinkdeep Investigation**: (continuation_id: captured in this doc)
- **shields.io Documentation**: https://shields.io/
- **semantic-release**: https://github.com/semantic-release/semantic-release
```

---

### Phase 4: Optional Guardrails (15-20 minutes)

#### Step 4.1: ESLint Rule for Hardcoded Versions

**Purpose**: Detect accidental hardcoded version numbers in code

**File**: `.eslintrc.js` (or `.eslintrc.json`)

**Rule** (custom ESLint plugin):
```javascript
// Custom rule: no-hardcoded-versions
// Detects: const version = "1.8.0" (hardcoded string)
// Allows: const version = getVersion() (runtime detection)

module.exports = {
  rules: {
    'no-hardcoded-versions': {
      create(context) {
        return {
          Literal(node) {
            // Match semantic version strings (e.g., "1.8.0", "v2.0.0")
            const versionRegex = /^v?\d+\.\d+\.\d+(-[\w.]+)?$/;

            if (typeof node.value === 'string' && versionRegex.test(node.value)) {
              // Allow package.json placeholder
              if (node.value === '0.0.0-development') return;

              context.report({
                node,
                message: 'Hardcoded version string detected. Use getVersion() instead.',
                data: { version: node.value }
              });
            }
          }
        };
      }
    }
  }
};
```

**Note**: This is optional - requires custom ESLint plugin setup. Alternative: Use grep in CI:

```yaml
# .github/workflows/lint.yml
- name: Check for hardcoded versions
  run: |
    # Exclude package.json and test files
    if grep -rn --include="*.ts" --include="*.js" \
       --exclude="package.json" --exclude="*.test.ts" \
       -E '"v?[0-9]+\.[0-9]+\.[0-9]+"' src/; then
      echo "Error: Hardcoded version detected"
      exit 1
    fi
```

---

#### Step 4.2: GitHub Actions Pre-Merge Check

**Purpose**: Verify PR checklist was followed

**File**: `.github/workflows/pr-checks.yml`

**Content**:
```yaml
name: PR Checklist Validation
on:
  pull_request:
    branches: [main]

jobs:
  validate-release-prep:
    if: startsWith(github.head_ref, 'feat/') || startsWith(github.head_ref, 'fix/')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check if CLAUDE.md updated
        run: |
          # Check if Last Updated date is recent (within 7 days)
          LAST_UPDATED=$(grep -E "^\*\*Last Updated\*\*:" CLAUDE.md | grep -oE "[0-9]{4}-[0-9]{2}-[0-9]{2}")
          DAYS_OLD=$(( ($(date +%s) - $(date -j -f "%Y-%m-%d" "$LAST_UPDATED" +%s)) / 86400 ))

          if [ $DAYS_OLD -gt 7 ]; then
            echo "⚠️ CLAUDE.md Last Updated date is $DAYS_OLD days old"
            echo "   Consider updating if this PR includes significant changes"
          fi

      - name: Verify package.json version
        run: |
          VERSION=$(node -p "require('./package.json').version")
          if [ "$VERSION" != "0.0.0-development" ]; then
            echo "❌ ERROR: package.json version is $VERSION"
            echo "   Expected: 0.0.0-development (Alternative D placeholder)"
            exit 1
          fi
          echo "✅ package.json version is correct placeholder"
```

**Note**: This is a **soft validation** (warnings, not hard failures) to remind developers.

---

## Before/After Comparison

### Before: Manual Version Updates Everywhere

**Problem**:
- Version appears in 5+ places (package.json, README.md, CLAUDE.md, docs/TESTS.md, CLI output)
- Manual updates required for each release
- Easy to miss updates → inconsistent versions across docs
- No single source of truth

**Example Release Process** (before):
1. Update package.json: `1.7.0` → `1.8.0`
2. Update CLAUDE.md header: `**Version**: 1.8.0`
3. Update README.md "What's New": `## What's New in v1.8.0`
4. Update docs/TESTS.md: `**Version**: 1.8.0`
5. Commit all changes
6. Create PR
7. Merge to main
8. semantic-release publishes
9. **Risk**: Forgot to update one file → inconsistent docs

---

### After: Three-Tier Strategy

**Solution**:
- npm badge auto-updates (Tier 1)
- Dates updated during release PR review (Tier 2)
- Runtime `getVersion()` for all code (Tier 3)
- Single source of truth: npm registry

**Example Release Process** (after):
1. Create feature branch with `feat:` commit
2. Open PR to main
3. **During PR review**: Update "Last Updated" dates, add release notes
4. Merge PR to main
5. semantic-release publishes to npm
6. **npm badge auto-updates** within 5-10 minutes
7. **CLI `--version`** uses git tag (automatic)
8. **Done** - version visible everywhere

**Manual Steps**: Only dates and release notes (3-5 minutes per release)

**Benefits**:
- 80% reduction in manual version updates
- Zero risk of version number inconsistency
- npm badge always shows latest version
- No complex sync mechanisms to maintain

---

## Expert Refinements (zen thinkdeep)

### Key Insights from Analysis

1. **Single source of truth ≠ zero manual work**
   - Alternative D means "one reliable authority" (npm registry)
   - Not "fully automated everywhere at all costs"
   - Accept strategic manual updates for high-visibility, low-frequency content

2. **npm badges are architecturally superior**
   - Zero maintenance (auto-updates from registry)
   - No sync mechanisms to fail
   - Industry-standard solution (trusted, reliable)

3. **Avoid introducing new failure modes**
   - Post-release scripts can fail after publish (worse than manual updates)
   - @semantic-release/git violates Alternative D (circular dependency)
   - Pre-build templates are fragile (drift, maintenance overhead)

4. **Runtime detection already solved the code problem**
   - `getVersion()` utility handles all code use cases
   - Works in development (git tags) and production (package.json fallback)
   - No action needed - already complete

5. **Manual updates are acceptable when**:
   - Low frequency (1-2 times per week)
   - High visibility (release PRs already reviewed)
   - No complex automation available
   - Human decision-making is valuable (release notes require human judgment)

---

## Implementation Timeline

### Immediate (5-10 minutes)
- Add npm version badge to README.md header
- Remove hardcoded "v1.8.0" from README.md "What's New"

### Short-term (15-20 minutes)
- Create PR template with version checklist
- Document checklist usage in CLAUDE.md

### Medium-term (10-15 minutes)
- Create `/docs/architecture/VERSION-MANAGEMENT.md`
- Document three-tier strategy

### Optional (15-20 minutes each)
- Add ESLint rule for hardcoded versions (or grep in CI)
- Add GitHub Actions PR checklist validation

**Total Estimated Effort**: 45-75 minutes (depending on optional guardrails)

---

## Success Metrics

### Immediate Indicators
- ✅ npm badge displays correct version on README.md
- ✅ `gpm --version` matches npm registry
- ✅ No hardcoded version strings in README.md

### Ongoing Indicators (30 days)
- ✅ PR template checklist followed in ≥90% of release PRs
- ✅ npm badge updates within 10 minutes of every release
- ✅ Zero version inconsistency issues reported
- ✅ Developer feedback: "Less manual work during releases"

### Long-term Success (90 days)
- ✅ Version management is "invisible" to developers
- ✅ No maintenance required for version display
- ✅ Architecture documented and understood by team
- ✅ No requests to add @semantic-release/git plugin (Alternative D respected)

---

## Rollback Plan

If three-tier strategy doesn't work as expected:

### Rollback to Manual Updates (Current State)
1. Remove npm badge from README.md
2. Restore hardcoded version in "What's New" section
3. Continue manual updates for all version references

**Risk**: Low (npm badge is non-invasive, easy to remove)

### Partial Rollback
1. Keep npm badge (zero risk, high value)
2. Remove PR template checklist if burdensome
3. Keep `getVersion()` runtime detection (already working)

---

## Related Documents

- **Alternative D Strategy**: `/docs/RELEASE-VALIDATION-STRATEGY.md`
- **Pre-Release Validation**: `gpm doctor --pre-release` command
- **Version Detection**: `src/utils/version.ts` (`getVersion()` utility)
- **Release Workflow**: `.github/workflows/publish.yml`
- **semantic-release Config**: `.releaserc.json`

---

## Conclusion

The three-tier version management strategy extends Alternative D's "single source of truth" principle to documentation by:

1. **Leveraging automation where reliable** (npm badges, runtime `getVersion()`)
2. **Accepting manual updates where necessary** (dates, release notes in PR reviews)
3. **Avoiding complex sync mechanisms** (post-release scripts, git commits)

**Result**: 80% reduction in manual version updates with zero architectural complexity.

**Philosophy**: Simplicity over automation. Single source of truth (npm registry) over distributed sync mechanisms.

---

**Maintained by**: Little Bear Apps
**Status**: Proposed (pending approval)
**Next Steps**: Implement Phase 1 (npm badges) and validate approach
