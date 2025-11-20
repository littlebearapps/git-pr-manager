# CI Failure Prevention Plan

**Version**: 1.9.0
**Last Updated**: 2025-11-20
**Status**: Proposed

---

## Overview

This document outlines a comprehensive plan to prevent CI test failures in future PRs, based on the root cause analysis of PR #19524935038 which failed due to an ESLint error introduced during development.

## Root Cause Analysis

**Failure**: All 6 CI matrix jobs failed at the "Lint" step
**Error**: `src/commands/setup.ts:153` - `'token' is never reassigned. Use 'const' instead` (prefer-const rule)
**Impact**: PR blocked from merging, CI badge shows failing status

**Why it happened**:
1. Code change introduced `let` instead of `const` for a variable that's never reassigned
2. ESLint ran in CI but not locally before commit
3. No pre-commit validation caught the issue
4. Developer didn't run `npm run lint` before pushing

---

## Prevention Strategy

### 1. Pre-Commit Hooks (RECOMMENDED - Highest Impact)

**Goal**: Catch linting errors before they're committed

**Implementation**:

Install husky + lint-staged:
```bash
npm install --save-dev husky lint-staged
npx husky install
npx husky add .git/hooks/pre-commit "npx lint-staged"
```

Configure lint-staged in `package.json`:
```json
{
  "lint-staged": {
    "*.ts": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

**Benefits**:
- ✅ Catches ESLint errors immediately at commit time
- ✅ Auto-fixes fixable issues (like prefer-const)
- ✅ Runs only on changed files (fast)
- ✅ Industry standard approach

**Effort**: Low (1-2 hours setup + testing)
**Priority**: HIGH

---

### 2. Local Validation Script

**Goal**: Provide a single command that mimics CI checks

**Implementation**:

Add script to `package.json`:
```json
{
  "scripts": {
    "ci:local": "npm run lint && npm run build && npm test -- --ci",
    "pre-push": "npm run ci:local"
  }
}
```

Create `scripts/validate-pr.sh`:
```bash
#!/bin/bash
set -e

echo "🔍 Running local CI validation..."

echo "1️⃣ Linting..."
npm run lint

echo "2️⃣ Building..."
npm run build

echo "3️⃣ Testing..."
npm test -- --ci

echo "✅ All checks passed! Safe to push."
```

**Benefits**:
- ✅ Developers can run full CI locally before pushing
- ✅ Catches all CI failures (lint, build, test)
- ✅ Simple to remember: `npm run ci:local`

**Effort**: Low (1 hour)
**Priority**: MEDIUM

---

### 3. Enhanced ESLint Configuration

**Goal**: Make ESLint errors more visible and actionable

**Implementation**:

Update `.eslintrc.js`:
```javascript
module.exports = {
  // ... existing config
  rules: {
    // Enforce const for variables that are never reassigned (ERROR not WARNING)
    "prefer-const": "error",

    // Consider upgrading these from warnings to errors over time:
    "@typescript-eslint/no-explicit-any": "warn", // Keep as warning for now (693 occurrences)

    // Add more strict rules:
    "no-var": "error",
    "no-unused-vars": "error",
  }
};
```

**Benefits**:
- ✅ Makes prefer-const violations errors (already is, but makes it explicit)
- ✅ Prevents future regressions
- ✅ Can gradually increase strictness

**Effort**: Low (30 min)
**Priority**: LOW (already working correctly)

---

### 4. GitHub Actions Improvements

**Goal**: Provide better feedback when CI fails

**Implementation Option A - Annotate ESLint errors in PR**:

Update `.github/workflows/ci.yml`:
```yaml
- name: Lint
  run: npm run lint
  continue-on-error: true

- name: Annotate lint errors
  if: failure()
  uses: reviewdog/action-eslint@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    reporter: github-pr-review
    eslint_flags: 'src/**/*.ts'
```

**Implementation Option B - Add lint auto-fix suggestion**:

Add to `.github/workflows/ci.yml`:
```yaml
- name: Check for fixable lint errors
  if: failure()
  run: |
    echo "❌ Lint errors found. Try running locally:"
    echo "  npm run lint -- --fix"
    echo "  git add ."
    echo "  git commit --amend --no-edit"
```

**Benefits**:
- ✅ Inline PR comments on lint errors (Option A)
- ✅ Clear instructions for fixing (Option B)
- ✅ Reduces time to fix

**Effort**: Medium (2-3 hours)
**Priority**: LOW (nice-to-have)

---

### 5. Development Workflow Documentation

**Goal**: Educate developers on pre-push checks

**Implementation**:

Update `CONTRIBUTING.md` (or create if doesn't exist):
```markdown
## Before Pushing Code

Always run these checks locally:

```bash
# Quick check (lint + build)
npm run lint
npm run build

# Full CI validation (recommended)
npm run ci:local

# Or use the pre-push script
npm run pre-push
```

**Pre-commit hook**: We use husky to run ESLint automatically on commit.
If you see errors, fix them before committing.

**Common ESLint fixes**:
- `prefer-const` error: Change `let` to `const` for variables that aren't reassigned
- `no-explicit-any` warning: Add proper TypeScript types instead of `any`
```

**Benefits**:
- ✅ Onboards new contributors
- ✅ Reinforces best practices
- ✅ Reduces CI failures from new contributors

**Effort**: Low (1 hour)
**Priority**: MEDIUM

---

### 6. CI Workflow Enhancements

**Goal**: Separate warnings from errors, improve clarity

**Implementation**:

Update `.github/workflows/ci.yml`:
```yaml
- name: Lint (errors only)
  run: npm run lint -- --max-warnings 0
  continue-on-error: false

- name: Lint warnings report
  if: always()
  run: |
    npm run lint -- --format json > eslint-report.json || true
    WARNINGS=$(jq '.[] | .warningCount' eslint-report.json | awk '{s+=$1} END {print s}')
    echo "📊 ESLint warnings: $WARNINGS"
    if [ "$WARNINGS" -gt 700 ]; then
      echo "⚠️ Warning count increasing! Please address @typescript-eslint/no-explicit-any"
    fi
```

**Benefits**:
- ✅ Tracks warning count over time
- ✅ Alerts if warnings increase (regression)
- ✅ Doesn't block on warnings (current behavior)

**Effort**: Medium (2 hours)
**Priority**: LOW (optimization)

---

## Recommended Implementation Plan

### Phase 1 (Immediate - This Week)

1. ✅ **Fix current ESLint error** (DONE)
   - Changed `let token` to `const token` in setup.ts:153

2. **Set up pre-commit hooks** (1-2 hours)
   - Install husky + lint-staged
   - Configure to run ESLint on staged files
   - Test with intentional error

3. **Add local validation script** (1 hour)
   - Add `npm run ci:local` script
   - Create `scripts/validate-pr.sh`
   - Update package.json with pre-push script

### Phase 2 (Next Sprint - Optional)

4. **Document development workflow** (1 hour)
   - Create/update CONTRIBUTING.md
   - Add pre-push checklist to PR template
   - Document common ESLint fixes

5. **Add GitHub Actions annotations** (2-3 hours)
   - Install reviewdog action
   - Configure ESLint annotations
   - Test with sample PR

### Phase 3 (Future - Optimization)

6. **Track ESLint warnings** (2 hours)
   - Add warning count reporting
   - Set up threshold alerts
   - Plan @typescript-eslint/no-explicit-any cleanup

---

## Success Metrics

- **Zero ESLint-related CI failures** in next 10 PRs
- **100% of commits** pass pre-commit hooks
- **Reduced time to fix** CI failures (if they occur)
- **Developer satisfaction** with tooling (feedback)

---

## Testing the Solution

### Test 1: Pre-commit hook catches error

```bash
# Intentionally introduce error
echo "let x = 1;" >> src/test.ts

# Try to commit
git add src/test.ts
git commit -m "test: intentional error"

# Expected: Pre-commit hook fails with ESLint error
# Expected: Commit is rejected
```

### Test 2: Local validation catches all issues

```bash
# Make changes
git add .

# Run local CI
npm run ci:local

# Expected: Same checks as GitHub Actions
# Expected: Pass/fail matches what CI would do
```

### Test 3: PR passes CI

```bash
# After implementing Phase 1
git checkout -b test/ci-prevention
# Make valid changes
npm run ci:local  # Should pass
git push

# Expected: CI passes on first try
# Expected: No lint errors in workflow
```

---

## Rollback Plan

If pre-commit hooks cause issues:

```bash
# Disable hooks temporarily
git commit --no-verify

# Uninstall husky
npm uninstall husky lint-staged
rm -rf .git/hooks/pre-commit
```

---

## Questions for Team

1. **Strictness level**: Should we treat all ESLint warnings as errors eventually?
2. **Auto-fix on commit**: Should pre-commit hooks auto-fix and commit, or just fail?
3. **CI timeout**: Should we add a timeout to lint step (currently unlimited)?
4. **Warning threshold**: What's acceptable ESLint warning count (currently 693)?

---

## Appendix: Alternative Solutions Considered

### Option: Git pre-push hook instead of pre-commit
**Pros**: Runs full CI locally before push
**Cons**: Slower, catches errors later
**Decision**: Use pre-commit for faster feedback

### Option: ESLint auto-fix in CI
**Pros**: Automatically fixes errors
**Cons**: Changes code without developer review
**Decision**: Too risky, could introduce bugs

### Option: Disable ESLint errors, warnings only
**Pros**: Never blocks CI
**Cons**: Allows code quality to degrade
**Decision**: Keep errors, they caught a real issue

---

## References

- **Husky**: https://typicode.github.io/husky/
- **lint-staged**: https://github.com/okonet/lint-staged
- **reviewdog**: https://github.com/reviewdog/reviewdog
- **ESLint rules**: https://eslint.org/docs/latest/rules/
