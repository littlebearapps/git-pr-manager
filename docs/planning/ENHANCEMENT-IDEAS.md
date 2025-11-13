# git-workflow-manager - Enhancement Ideas

**Version**: 0.2.0 (Current) → 0.3.0+ (Future)
**Based On**: Production testing (2025-10-18)
**Status**: Validated in convert-my-file

---

## Priority Classification

- 🔴 **HIGH**: Fixes pain points or adds critical functionality
- 🟡 **MEDIUM**: Nice-to-have improvements
- 🟢 **LOW**: Long-term quality-of-life features

---

## 🔴 HIGH PRIORITY

### 1. Strict Mode (--strict Flag)

**Problem**: Untracked files currently allowed (only blocks uncommitted *changes*)

**Use Case**:
```bash
# Current: Allows untracked files
git status
# Untracked files: artifacts/test-results/

gwm ship  # ✅ Proceeds (no uncommitted changes to tracked files)

# Enhanced: Strict mode fails on untracked files
gwm ship --strict  # ❌ Fails: "Untracked files detected"
```

**Implementation**:
```bash
# Add to preflight validation
if [[ "$*" == *"--strict"* ]]; then
  untracked=$(git ls-files --others --exclude-standard)
  if [ -n "$untracked" ]; then
    echo "❌ Strict mode: Untracked files detected"
    echo "$untracked"
    echo "Either add to .gitignore or commit them"
    exit 2
  fi
fi
```

**Benefit**: Prevents shipping with incomplete work

**Effort**: 1-2 hours

---

### 2. Pre-Merge Branch Update (--rebase Flag)

**Problem**: Feature branches can become stale if main advances

**Use Case**:
```bash
# Scenario: Main has advanced since feature branch created
git log --oneline main..feature/my-feature
# 2 commits ahead, but main is 5 commits ahead

gwm ship --rebase  # Rebases feature on latest main before PR
```

**Implementation**:
```bash
# Before creating PR
if [[ "$*" == *"--rebase"* ]]; then
  echo "🔄 Rebasing on latest main..."
  git fetch origin main
  git rebase origin/main
  if [ $? -ne 0 ]; then
    echo "❌ Rebase failed - resolve conflicts"
    exit 3
  fi
fi
```

**Benefit**: Prevents merge conflicts, ensures feature builds on latest main

**Effort**: 2-3 hours

---

### 3. Rich PR Descriptions (--auto-description)

**Problem**: PR descriptions currently use basic `--fill` (just commit messages)

**Current**:
```
Title: feature/my-feature
Body:
- commit 1 message
- commit 2 message
- commit 3 message
```

**Enhanced**:
```
Title: Add dark mode toggle

## Summary
Implements dark mode toggle in settings panel with user preference persistence.

## Changes
### Features
- Add dark mode toggle component
- Implement theme switching logic

### Tests
- Add unit tests for theme switching
- Add E2E tests for dark mode persistence

### Chores
- Update dependencies

## Testing
- ✅ Unit tests pass
- ✅ E2E tests pass
- ✅ Manual testing completed
```

**Implementation**:
- Parse conventional commit messages (feat:, fix:, test:, chore:)
- Group by type
- Generate structured markdown
- Include testing checklist

**Benefit**: Professional PR descriptions, better code review context

**Effort**: 4-6 hours

---

## 🟡 MEDIUM PRIORITY

### 4. CI Failure Recovery (--retry-ci)

**Problem**: If CI fails, need to fix and re-run manually

**Use Case**:
```bash
# Initial ship attempt
gwm ship
# ❌ CI failed: ESLint errors

# Fix lint errors locally
npm run lint --fix
git add . && git commit -m "fix: lint errors"

# Retry with same PR
gwm ship --retry-ci  # Detects existing PR, pushes updates, re-waits for CI
```

**Implementation**:
- Detect existing PR for current branch
- Push additional commits
- Re-poll CI checks
- Continue from Step 5 (CI wait)

**Benefit**: Resume workflow without starting over

**Effort**: 3-4 hours

---

### 5. Interactive Conflict Resolution

**Problem**: Merge conflicts cause workflow to fail

**Current**:
```bash
gwm ship
# ❌ Merge conflict detected
# Solution: Manually resolve, then re-run
```

**Enhanced**:
```bash
gwm ship
# ❌ Merge conflict detected

# Interactive prompts:
? Would you like help resolving conflicts? (Y/n)
? Which files to prioritize? [feature/*, main/*]
? Rebase or merge strategy? [rebase]

# Guides user through resolution
# Re-runs after conflicts resolved
```

**Implementation**:
- Detect merge conflicts
- Provide step-by-step guidance
- Offer rebase vs merge strategies
- Validate resolution before continuing

**Benefit**: Easier conflict resolution for beginners

**Effort**: 6-8 hours

---

### 6. Historical Time Estimates

**Problem**: No visibility into typical workflow duration

**Use Case**:
```bash
gwm ship
# 🚀 Shipping feature...
# ⏱️  Estimated time: 2-3 min (based on last 10 ships)
#
# [1/8] Preflight validation... ✅ (1s)
# [2/8] Running verify.sh... ✅ (8s, avg: 12s)
# [3/8] Pushing branch... ✅ (3s, avg: 5s)
# ...
```

**Implementation**:
- Store ship durations in `.gwm.yml` or `.git/gwm-history.json`
- Track timing for each step
- Calculate rolling averages (last 10-50 ships)
- Display estimates during execution

**Benefit**: Better time planning, detect performance regressions

**Effort**: 4-5 hours

---

## 🟢 LOW PRIORITY

### 7. Stacked PRs Support

**Problem**: Can't create dependent PR chains

**Use Case**:
```bash
# Create base feature
git checkout -b feature/api-redesign
# ... work ...
gwm ship  # PR #1: feature/api-redesign → main

# Create dependent feature (requires API redesign)
git checkout -b feature/api-client
# ... work ...
gwm ship --base=feature/api-redesign  # PR #2: feature/api-client → feature/api-redesign

# When PR #1 merges, auto-update PR #2 to target main
```

**Implementation**:
- Track PR dependencies
- Allow custom `--base` branch
- Auto-rebase dependent PRs when base merges
- Update PR target when base is deleted

**Benefit**: Support complex feature development

**Effort**: 10-15 hours

---

### 8. Multi-Repository Coordination

**Problem**: Can't coordinate PRs across multiple repos

**Use Case**:
```bash
# In API repo
cd ~/projects/my-api/
gwm ship --link-pr  # Creates PR, returns PR URL

# In client repo
cd ~/projects/my-client/
gwm ship --depends-on=https://github.com/org/my-api/pull/42
# Waits for API PR to merge before creating client PR
```

**Implementation**:
- Parse GitHub PR URLs
- Poll multiple PRs across repos
- Block client PR creation until dependencies merge
- Add cross-repo PR links in descriptions

**Benefit**: Coordinate full-stack features

**Effort**: 15-20 hours

---

### 9. Automated Changelog Generation

**Problem**: No automatic changelog from PRs

**Use Case**:
```bash
# After shipping multiple features
gwm changelog --since=v1.0.0

# Generates:
## Changelog (v1.0.0 → HEAD)

### Features
- Add dark mode toggle (#42)
- Implement user preferences (#45)

### Fixes
- Fix button alignment on mobile (#43)

### Chores
- Update dependencies (#44)
```

**Implementation**:
- Parse merged PR titles
- Group by conventional commit type
- Format as markdown changelog
- Support version tagging

**Benefit**: Automated release notes

**Effort**: 5-6 hours

---

### 10. Custom PR Templates

**Problem**: PR descriptions don't match team standards

**Use Case**:
```bash
# Create .github/pull_request_template.md
## Summary
[Description]

## Testing
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Documentation updated
- [ ] CHANGELOG.md updated

# gwm ship uses template automatically
gwm ship --template=.github/pull_request_template.md
```

**Implementation**:
- Detect PR templates in `.github/`
- Parse template placeholders
- Inject values from commits
- Allow custom template paths

**Benefit**: Consistent PR format across team

**Effort**: 3-4 hours

---

## Enhancement Roadmap

### Phase 2.1 (Week 2-3) - Quick Wins
**Effort**: 8-12 hours total
1. 🔴 Strict Mode (1-2 hours)
2. 🔴 Pre-Merge Branch Update (2-3 hours)
3. 🔴 Rich PR Descriptions (4-6 hours)

### Phase 2.2 (Month 2) - Error Resilience
**Effort**: 13-17 hours total
1. 🟡 CI Failure Recovery (3-4 hours)
2. 🟡 Interactive Conflict Resolution (6-8 hours)
3. 🟡 Historical Time Estimates (4-5 hours)

### Phase 2.3 (Month 3-6) - Advanced Features
**Effort**: 33-45 hours total
1. 🟢 Stacked PRs Support (10-15 hours)
2. 🟢 Multi-Repository Coordination (15-20 hours)
3. 🟢 Automated Changelog Generation (5-6 hours)
4. 🟢 Custom PR Templates (3-4 hours)

---

## Testing Strategy

For each enhancement:

1. **Dry-Run Testing** (5-10 min per enhancement)
   - Create test branch
   - Run `gwm <command> --dry-run`
   - Verify expected behavior

2. **Real Execution** (10-20 min per enhancement)
   - Execute with real PR
   - Verify GitHub state
   - Validate cleanup

3. **Error Scenarios** (20-30 min per enhancement)
   - Test failure cases
   - Verify error messages
   - Validate recovery steps

---

## Community Feedback (Future)

**Collect Feedback After 2-4 Weeks of Usage**:

Questions:
1. Which enhancements would save you the most time?
2. What pain points are you experiencing?
3. What features are missing from this list?

**Priority Adjustment**:
- Move highly requested features to HIGH
- Defer low-impact features to Phase 3+
- Add new suggestions from users

---

## Implementation Priorities

**Based on Test Results (2025-10-18)**:

### Must-Have (v0.3.0)
1. 🔴 Strict Mode - Prevents incomplete ships
2. 🔴 Rich PR Descriptions - Professional output
3. 🟡 CI Failure Recovery - Common scenario

### Nice-to-Have (v0.4.0)
1. 🟡 Interactive Conflict Resolution - Helps beginners
2. 🟡 Historical Time Estimates - Visibility
3. 🔴 Pre-Merge Branch Update - Prevents conflicts

### Future (v0.5.0+)
1. 🟢 Stacked PRs - Complex workflows
2. 🟢 Multi-Repo Coordination - Full-stack features
3. 🟢 Changelog Generation - Release automation
4. 🟢 Custom PR Templates - Team consistency

---

**Status**: Ready for Phase 2.1 planning
**Next Steps**: Prioritize based on user feedback (Week 2-3)
**Version Target**: v0.3.0 (with strict mode, rich PR descriptions, CI retry)
