# git-pr-manager Implementation Handover

**Date**: 2025-11-12
**Status**: Ready to Start Phase 1
**Next Session**: Begin implementation in root directory

---

## Quick Orientation

You are about to implement a **complete transformation** of the `git-pr-manager` subagent from bash + gh CLI to TypeScript + Octokit SDK with enhanced CI/security features.

### What Happened Before This Session

1. **GitHub Organization Audit** - Audited littlebearapps org (28 repos) for CI/security patterns
   - Found pain points: poor error visibility, inconsistent branch protection, failing security scans
   - Identified best practices from auditor-toolkit and wp-navigator-pro
   - Document: `GITHUB-CI-SECURITY-AUDIT-2025.md`

2. **SDK Research** - Researched Octokit SDK integration options
   - Evaluated Option 1 (gradual) vs Option 2 (full migration)
   - Chose Option 2 (full SDK migration)
   - Document: `OPTION-2-FULL-SDK-MIGRATION-PLAN.md`

3. **Comprehensive Plan Created** - Combined SDK migration + audit findings
   - This is THE plan to follow
   - Document: `COMPREHENSIVE-ENHANCEMENT-PLAN.md` ⭐

---

## Key Documents

**Location**: `~/claude-code-tools/lba/apps/subagents/git-pr-manager/`

### Primary Document (Follow This)
- **COMPREHENSIVE-ENHANCEMENT-PLAN.md** ⭐
  - Complete implementation plan
  - 4-5 weeks, 5 phases
  - Includes all code examples
  - **START HERE**

### Reference Documents (Background Only)
- **GITHUB-CI-SECURITY-AUDIT-2025.md** - Audit findings (background context)
- **OPTION-2-FULL-SDK-MIGRATION-PLAN.md** - Original SDK plan (superseded by comprehensive plan)
- **OCTOKIT-SDK-INTEGRATION.md** - Integration guide (reference)

### Existing Subagent
- **SUBAGENT_PROMPT.md** - Current bash implementation (v0.3.0)
- **Current scripts**: Various bash scripts in the directory

---

## What You're Building

**Transform git-pr-manager from**:
```
Current (v0.3.0):
- Language: Bash
- GitHub: gh CLI
- Git: git CLI
- CI Polling: Blocking gh pr checks --watch
- Error Reporting: Exit codes only
- Security: None
```

**To**:
```
Target (v1.0.0):
- Language: TypeScript
- GitHub: Octokit SDK (@octokit/rest)
- Git: simple-git
- CI Polling: Async with rich error details
- Error Reporting: File:line, error classification, suggested fixes
- Security: Pre-commit scanning (secrets, vulnerabilities)
- Branch Protection: Pre-flight validation
- Testing: Jest + Nock
```

---

## Implementation Phases Overview

### Phase 1: Core SDK + Enhanced Error Reporting (Week 1, ~25-30 hours)
**Goal**: Replace bash with TypeScript, implement rich CI error reporting

**Key Deliverables**:
- TypeScript project setup
- GitHubService (Octokit wrapper)
- GitService (simple-git wrapper)
- **EnhancedCIPoller** ⭐ - Rich error reporting
- **ErrorClassifier** ⭐ - Classify error types
- **SuggestionEngine** ⭐ - Suggest fixes

**Tasks** (see COMPREHENSIVE-ENHANCEMENT-PLAN.md lines 1663-1740):
- [ ] Project setup (4 hours)
- [ ] Core services (8 hours)
- [ ] Enhanced CI Poller (12 hours) - PRIORITY
- [ ] CLI framework (4 hours)

### Phase 2: PR Automation + Intelligent Polling (Week 2, ~25-30 hours)
**Goal**: Implement PR creation/merge with intelligent CI polling

**Key Deliverables**:
- PRService, PRTemplateService
- Intelligent polling (progress, fail-fast, retry)
- VerifyService
- **`gpm ship` command** ⭐

### Phase 3: Branch Protection + Security (Week 3, ~25-30 hours)
**Goal**: Add branch protection validation and pre-commit security

**Key Deliverables**:
- **BranchProtectionChecker** ⭐ - Validate merge requirements
- **SecurityScanner** ⭐ - Pre-commit checks
- New commands: `gpm checks`, `gpm protect`, `gpm security`

### Phase 4: Testing + Documentation (Week 4, ~20-25 hours)
**Goal**: Comprehensive tests, docs, workflow templates

**Key Deliverables**:
- 80%+ test coverage
- Complete documentation
- Workflow templates (ci-python.yml, ci-nodejs.yml, security.yml)

### Phase 5: Rollout (Week 5, ~5-10 hours)
**Goal**: Deploy to production, gather feedback

**Staged Rollout**:
1. auditor-toolkit (best CI)
2. wp-navigator-pro, brand-copilot, platform
3. All remaining repos

---

## Start Here: Phase 1, Task 1

**Your first task**: Project Setup (4 hours)

```bash
cd ~/claude-code-tools/lba/apps/subagents/git-pr-manager
```

### Step 1: Initialize TypeScript Project

1. Create `package.json`:
```json
{
  "name": "git-pr-manager",
  "version": "1.0.0",
  "description": "Enhanced git workflow automation with Octokit SDK",
  "main": "dist/index.js",
  "bin": {
    "gpm": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "dev": "ts-node src/index.ts"
  },
  "dependencies": {
    "@octokit/rest": "^19.0.0",
    "simple-git": "^3.19.0",
    "commander": "^11.0.0",
    "chalk": "^5.3.0",
    "ora": "^6.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "nock": "^13.3.0",
    "ts-node": "^10.9.0"
  }
}
```

2. Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

3. Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ]
};
```

4. Run `npm install`

### Step 2: Create Project Structure

```bash
mkdir -p src/{commands,services,types,utils}
mkdir -p tests/{unit,integration,fixtures}
mkdir -p templates
```

### Step 3: Reference the Comprehensive Plan

**Open**: `COMPREHENSIVE-ENHANCEMENT-PLAN.md`

**Navigate to**:
- Line 1663: Phase 1 detailed tasks
- Line 440: EnhancedCIPoller implementation (full code example)
- Line 1025: BranchProtectionChecker implementation (for Phase 3)
- Line 1290: SecurityScanner implementation (for Phase 3)

**Use the code examples** provided in the plan - they are production-ready templates.

---

## Critical Implementation Notes

### 1. Environment Configuration

**GitHub Token**: Available via keychain
```bash
# Token is loaded via .envrc.github
source ~/claude-code-tools/.envrc.github
echo $GITHUB_TOKEN  # Should show token
```

**Location**: `~/.envrc.github` (already created)

### 2. Testing Strategy

**Use Nock** to mock GitHub API:
```typescript
import nock from 'nock';

nock('https://api.github.com')
  .get('/repos/littlebearapps/test-repo/pulls/123')
  .reply(200, { head: { sha: 'abc123' } });
```

**Test repos**:
- auditor-toolkit (Python, pytest, best CI)
- wp-navigator-pro (Node.js, Jest, good CI)

### 3. Audit Findings to Incorporate

**From GITHUB-CI-SECURITY-AUDIT-2025.md**:

1. **Error Reporting Patterns** (lines 140-180)
   - auditor-toolkit uses test-reporter with annotations
   - wp-navigator-pro uses TAP output
   - Most repos show "undefined" summaries (BAD)

2. **Best Practice CI** (auditor-toolkit, lines 38-80)
   - JUnit XML parsing for test counts
   - GitHub Step Summary
   - Test reporter with max 50 annotations
   - continue-on-error for security scans

3. **Security Patterns** (lines 200-250)
   - TruffleHog for secret scanning
   - pip-audit / npm audit for dependencies
   - CodeQL (requires Advanced Security setup)

### 4. Code Examples Location

**EnhancedCIPoller**: COMPREHENSIVE-ENHANCEMENT-PLAN.md, lines 440-568
**ErrorClassifier**: Lines 670-730
**SuggestionEngine**: Lines 732-780
**OutputFormatter**: Lines 782-850
**BranchProtectionChecker**: Lines 1025-1270
**SecurityScanner**: Lines 1290-1400

**Copy these directly** - they are complete, production-ready implementations.

---

## Success Criteria for Phase 1

By end of Week 1, you should have:

1. ✅ Working TypeScript project (compiles, tests run)
2. ✅ Core services: GitHubService, GitService, ConfigService
3. ✅ EnhancedCIPoller with error classification
4. ✅ Can fetch detailed check status from a PR
5. ✅ Can classify error types (test, lint, type, security)
6. ✅ Can suggest fixes automatically
7. ✅ Unit tests passing (mock with Nock)

**Test it**:
```bash
# Should compile
npm run build

# Should pass tests
npm test

# Should work with real PR (integration test)
npm run dev checks 123  # Replace 123 with real PR number
```

---

## Quick Reference Commands

**Current location**:
```bash
cd ~/claude-code-tools/lba/apps/subagents/git-pr-manager
```

**View plan**:
```bash
cat COMPREHENSIVE-ENHANCEMENT-PLAN.md | less
```

**View audit findings**:
```bash
cat ~/claude-code-tools/GITHUB-CI-SECURITY-AUDIT-2025.md | less
```

**Test GitHub token**:
```bash
source ~/.envrc.github
echo $GITHUB_TOKEN
```

**Check existing implementation**:
```bash
cat SUBAGENT_PROMPT.md  # Current bash version
```

---

## Questions to Ask if Stuck

1. **Architecture questions**: Refer to COMPREHENSIVE-ENHANCEMENT-PLAN.md, lines 196-330 (Target Architecture)
2. **Implementation details**: Check code examples in lines 440-1400
3. **Testing approach**: Refer to lines 1900-2000 (Testing Strategy)
4. **Audit context**: Check GITHUB-CI-SECURITY-AUDIT-2025.md

---

## Expected Timeline

**Total Effort**: 4-5 weeks (100-120 hours)

**Breakdown**:
- Week 1: Foundation + Error Reporting (THIS IS WHERE YOU START)
- Week 2: PR Automation + Polling
- Week 3: Security + Branch Protection
- Week 4: Testing + Documentation
- Week 5: Rollout + Fixes

**ROI**: 10-20 hours saved per week across team after deployment

---

## Final Checklist Before Starting

- [ ] Read this handover document completely
- [ ] Skim COMPREHENSIVE-ENHANCEMENT-PLAN.md (focus on Phase 1)
- [ ] Verify GitHub token is accessible (`echo $GITHUB_TOKEN`)
- [ ] Review current bash implementation (SUBAGENT_PROMPT.md)
- [ ] Understand the target architecture (plan lines 196-330)
- [ ] Ready to start Phase 1, Task 1 (Project Setup)

---

## Let's Go! 🚀

**Your first command**:
```bash
cd ~/claude-code-tools/lba/apps/subagents/git-pr-manager
npm init -y  # Then edit package.json as shown above
```

**Next**: Follow Phase 1 tasks in COMPREHENSIVE-ENHANCEMENT-PLAN.md starting at line 1663.

**Remember**: The comprehensive plan has **all the code examples you need**. Copy them, adapt them, test them. You're not starting from scratch - you're implementing a well-researched, detailed plan.

Good luck! This is going to dramatically improve the PR/merge workflow for the entire organization. 🎯
