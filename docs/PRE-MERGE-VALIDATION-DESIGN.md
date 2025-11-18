# Pre-Merge Validation System - Design Document

**Version**: 1.0.0
**Status**: Design Phase
**Created**: 2025-11-18
**Author**: Claude Code + Nathan Schram

---

## Executive Summary

Design for a multi-layered pre-merge validation system that prevents accidental PR merges to main branch without explicit user approval. This addresses the critical safety gap where `gpm ship` can auto-merge PRs and trigger npm package publication without user confirmation.

**Problem**: Current `gpm ship` command automatically merges PRs after CI passes, which:
- Triggers npm publish via semantic-release (main branch push → GitHub Actions → npm)
- Bypasses user review for production releases
- Creates risk of publishing unintended changes
- Violates principle of explicit approval for releases

**Solution**: Implement 4-layer validation system with progressive enforcement.

---

## Design Principles

1. **Defense in Depth**: Multiple independent validation layers
2. **Fail-Safe**: Default to requiring approval (opt-in to auto-merge, not opt-out)
3. **User Experience**: Clear messaging and easy override for authorized merges
4. **Backwards Compatible**: Existing workflows continue to work with deprecation warnings
5. **CI/CD Friendly**: Smart detection of CI environments with appropriate behavior

---

## Layer 1: Interactive Approval Prompt (Immediate)

### Purpose
Add interactive confirmation prompt in `gpm ship` before merge step.

### Implementation

**File**: `src/commands/ship.ts`

**Location**: Before merge operation (after CI checks pass, before calling `github.mergePR()`)

**Code Addition**:
```typescript
// Step 7: Merge PR (with approval prompt)
if (!options.noMerge) {
  logger.blank();
  logger.section(`Ready to Merge PR #${prNumber}`);

  // Check if approval is required
  const requireApproval = process.env.GPM_REQUIRE_APPROVAL === '1'
    || config.workflow?.requireApproval === true
    || !process.env.CI; // Always require in interactive mode

  if (requireApproval && !options.approve) {
    // Interactive prompt
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(
        `\n⚠️  Merge PR #${prNumber} to ${defaultBranch}? This will trigger npm publish.\n` +
        `   Type 'yes' to confirm, or Ctrl+C to cancel: `,
        (answer: string) => {
          rl.close();
          resolve(answer.toLowerCase().trim());
        }
      );
    });

    if (answer !== 'yes' && answer !== 'y') {
      logger.warn('Merge cancelled by user');
      logger.info(`PR #${prNumber} is ready to merge when you're ready`);
      logger.info(`To merge later: gh pr merge ${prNumber} --squash`);
      process.exit(0);
    }
  }

  // Proceed with merge...
  spinner.start(`Merging PR #${prNumber}...`);
  // ... existing merge code
}
```

**New CLI Options**:
```bash
gpm ship --approve          # Skip prompt, auto-approve (CI mode)
gpm ship --no-merge         # Create PR but don't merge
gpm ship --draft            # Create as draft (already exists, prevents merge)
```

**Configuration** (`.gpm.yml`):
```yaml
workflow:
  requireApproval: true   # Require interactive approval (default: false)
  alwaysDraft: false      # Always create draft PRs (default: false)
```

**Environment Variable**:
```bash
export GPM_REQUIRE_APPROVAL=1   # Force approval prompts
```

**Behavior Matrix**:

| Context | `requireApproval` | `--approve` | `CI` env | Behavior |
|---------|-------------------|-------------|----------|----------|
| Local dev | false | - | false | Prompt for approval |
| Local dev | true | - | false | Prompt for approval |
| Local dev | - | yes | false | Skip prompt, merge |
| CI/CD | false | - | true | Auto-merge (no prompt) |
| CI/CD | true | - | true | Fail with error |
| CI/CD | true | yes | true | Auto-merge |

---

## Layer 2: Environment Variable Enforcement (Immediate)

### Purpose
Prevent accidental merges in development environments through environment configuration.

### Implementation

**Setup Instructions** (add to README.md and CLAUDE.md):

```bash
# Add to ~/.zshrc or ~/.bashrc
export GPM_REQUIRE_APPROVAL=1

# Or use direnv (.envrc)
echo 'export GPM_REQUIRE_APPROVAL=1' >> .envrc
direnv allow

# Or use Claude Code keychain integration
echo 'source ~/bin/kc.sh && export GPM_REQUIRE_APPROVAL=1' >> .envrc
```

**Error Handling**:
```typescript
if (process.env.GPM_REQUIRE_APPROVAL === '1' && process.env.CI) {
  logger.error('GPM_REQUIRE_APPROVAL is set but running in CI environment');
  logger.error('Use --approve flag to explicitly authorize merge in CI');
  process.exit(1);
}
```

---

## Layer 3: Config File Safety Defaults (Medium Priority)

### Purpose
Repository-level configuration to enforce approval requirements.

### Implementation

**New Config Options** (`.gpm.yml`):
```yaml
workflow:
  # Merge approval settings
  requireApproval: true          # Require approval prompt (default: false)
  alwaysDraft: false             # Always create draft PRs (default: false)
  allowAutoMerge: false          # Allow auto-merge without approval (default: true)

  # Safety overrides
  protectedBranches:             # Branches requiring approval
    - main
    - master
    - production

  # Approval methods
  approvalMethods:
    - interactive-prompt         # Terminal prompt (default)
    - environment-variable       # GPM_REQUIRE_APPROVAL=1
    - config-file               # requireApproval: true
```

**Config Validation** (on load):
```typescript
// src/services/ConfigService.ts
async validateSafetyConfig(): Promise<ValidationResult> {
  const warnings: string[] = [];

  // Warn if auto-merge enabled without protection
  if (config.workflow?.allowAutoMerge !== false) {
    if (!config.workflow?.requireApproval) {
      warnings.push(
        'Auto-merge enabled without approval requirement. ' +
        'Set workflow.requireApproval: true for safety.'
      );
    }
  }

  // Warn if main branch not protected
  if (!config.workflow?.protectedBranches?.includes('main')) {
    warnings.push(
      'Main branch not in protectedBranches list. ' +
      'Consider adding for safety.'
    );
  }

  return { valid: true, warnings };
}
```

---

## Layer 4: Git Hooks - Pre-Merge Warning (Low Priority)

### Purpose
Final safety net: warn users before pushing changes that would trigger merge.

### Implementation

**New Hook**: `pre-push-merge-check`

**File**: `src/commands/install-hooks.ts`

**Hook Content**:
```bash
#!/bin/sh
# gpm pre-push merge check hook
# Warns before pushing to main/master branches

# Skip in CI environments
if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; then
  exit 0
fi

# Get current branch
current_branch=$(git symbolic-ref --short HEAD 2>/dev/null)

# Check if pushing to protected branch
if [ "$current_branch" = "main" ] || [ "$current_branch" = "master" ]; then
  echo ""
  echo "⚠️  WARNING: Pushing to $current_branch branch!"
  echo ""
  echo "This will trigger:"
  echo "  • GitHub Actions publish workflow"
  echo "  • semantic-release version bump"
  echo "  • npm package publication"
  echo "  • GitHub release creation"
  echo ""
  echo "Are you sure you want to continue? (yes/no)"
  read -r answer

  if [ "$answer" != "yes" ] && [ "$answer" != "y" ]; then
    echo ""
    echo "❌ Push cancelled"
    echo ""
    echo "To create a PR instead:"
    echo "  • gpm ship --draft    (create draft PR for review)"
    echo "  • gpm auto           (create PR without merge)"
    echo ""
    exit 1
  fi
fi

# Allow push
exit 0
```

**Installation**:
```bash
gpm install-hooks --merge-check
```

**Configuration**:
```yaml
hooks:
  mergeCheck:
    enabled: true              # Install merge check hook
    protectedBranches:         # Branches to check
      - main
      - master
    requireConfirmation: true  # Require 'yes' to proceed
```

---

## Implementation Phases

### Phase 1: Immediate (1-2 hours)
**Priority**: P0 - Critical Safety
**Timeline**: Today

**Deliverables**:
1. ✅ Update CLAUDE.md with `--draft` mandatory rule
2. 🔜 Add interactive approval prompt to `ship.ts`
3. 🔜 Add `--approve` and `--no-merge` CLI flags
4. 🔜 Add `GPM_REQUIRE_APPROVAL` environment variable check
5. 🔜 Update help text and documentation

**Testing**:
- Manual test: `gpm ship` prompts for approval
- Manual test: `gpm ship --approve` skips prompt
- Manual test: `gpm ship --draft` creates draft PR
- CI test: `GPM_REQUIRE_APPROVAL=1` in CI fails without `--approve`

### Phase 2: Safety Defaults (4-6 hours)
**Priority**: P1 - High
**Timeline**: This week

**Deliverables**:
1. Add `workflow.requireApproval` config option
2. Add `workflow.alwaysDraft` config option
3. Add config validation with safety warnings
4. Update `.gpm.yml` schema and examples
5. Add tests for config validation

**Testing**:
- Unit tests: Config validation logic
- Integration tests: Approval behavior with config
- Manual tests: Various config combinations

### Phase 3: Git Hooks (2-3 hours)
**Priority**: P2 - Medium
**Timeline**: Next week

**Deliverables**:
1. Create pre-push merge check hook
2. Add `--merge-check` flag to `install-hooks`
3. Update hook templates and installation logic
4. Add hook configuration options
5. Update documentation

**Testing**:
- Manual test: Hook prompts on push to main
- Manual test: Hook allows push on 'yes'
- Manual test: Hook cancels push on 'no'
- Manual test: Hook skips in CI

---

## User Experience

### Developer Workflow (Interactive Mode)

**Before** (unsafe):
```bash
$ gpm ship
✅ Verification passed
✅ Security scan passed
✅ PR created: #29
✅ CI checks passed
✅ PR merged              # ❌ No approval!
✅ Branch deleted
```

**After** (safe):
```bash
$ gpm ship --draft
✅ Verification passed
✅ Security scan passed
✅ Draft PR created: #29   # ✅ Draft prevents auto-merge
⏸  PR is ready for review

$ # Review PR, ready to merge
$ gpm ship
✅ Verification passed
✅ PR exists: #29
✅ CI checks passed

⚠️  Merge PR #29 to main? This will trigger npm publish.
   Type 'yes' to confirm, or Ctrl+C to cancel: yes

✅ PR merged               # ✅ Explicit approval!
✅ Branch deleted
```

### CI/CD Workflow

**Authorized CI Merge** (with approval):
```yaml
# .github/workflows/merge-approved-pr.yml
- name: Merge PR after approval
  run: gpm ship --approve  # Explicit authorization
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Blocked CI Merge** (safety check):
```bash
$ GPM_REQUIRE_APPROVAL=1 gpm ship  # In CI
❌ Error: GPM_REQUIRE_APPROVAL is set but running in CI
   Use --approve flag to explicitly authorize merge
```

---

## Backwards Compatibility

### Deprecation Strategy

**Timeline**: 3-release deprecation

**Version 1.7.0** (Next release):
- Add deprecation warning for `gpm ship` without safety flags
- Warning shows but still allows merge
- Encourage migration to `--draft` or `--approve`

**Warning Message**:
```
⚠️  DEPRECATION WARNING
   Using 'gpm ship' without safety flags will be blocked in v2.0.0

   Recommended actions:
   • Use 'gpm ship --draft' to create draft PRs for review
   • Use 'gpm ship --approve' to explicitly authorize merge
   • Set 'workflow.requireApproval: true' in .gpm.yml

   This warning will become an error in v2.0.0
```

**Version 1.8.0**:
- Deprecation warning persists
- Add `workflow.allowLegacyMerge: true` escape hatch

**Version 2.0.0** (Breaking change):
- `gpm ship` without safety flags requires explicit approval
- Default behavior: always prompt or require `--approve`
- Remove `workflow.allowLegacyMerge` option

### Migration Guide

**For Individual Developers**:
```bash
# Old workflow (deprecated)
gpm ship

# New workflow (recommended)
gpm ship --draft           # Create draft PR
# Review PR in GitHub
gh pr ready 29            # Mark as ready
gpm ship --approve        # Merge with approval
```

**For CI/CD Pipelines**:
```yaml
# Old workflow (deprecated)
- run: gpm ship

# New workflow (explicit)
- run: gpm ship --approve  # Explicit merge authorization
```

**For Team Settings**:
```yaml
# .gpm.yml - Team-wide safety defaults
workflow:
  requireApproval: true    # Require approval for all merges
  alwaysDraft: true        # Default all PRs to draft
```

---

## Testing Strategy

### Unit Tests

**Test File**: `tests/commands/ship.test.ts`

**Test Cases**:
1. ✅ `ship --draft` creates draft PR and does not merge
2. ✅ `ship --approve` skips approval prompt and merges
3. ✅ `ship` with `GPM_REQUIRE_APPROVAL=1` prompts for approval
4. ✅ `ship` in CI without `--approve` proceeds (legacy behavior)
5. ✅ `ship` in CI with `requireApproval: true` fails without `--approve`
6. ✅ Approval prompt accepts 'yes' and merges
7. ✅ Approval prompt rejects 'no' and exits cleanly
8. ✅ Config validation warns about unsafe settings

### Integration Tests

**Test File**: `tests/integration/merge-approval.integration.test.ts`

**Test Scenarios**:
1. ✅ Full workflow with draft PR creation
2. ✅ Full workflow with approval prompt (mocked stdin)
3. ✅ Full workflow with `--approve` flag in CI
4. ✅ Config-driven behavior (requireApproval: true/false)
5. ✅ Environment variable override behavior

### Manual Testing

**Pre-Release Checklist**:
- [ ] Test `gpm ship --draft` creates draft PR
- [ ] Test `gpm ship` prompts for approval in terminal
- [ ] Test 'yes' response merges PR
- [ ] Test 'no' response cancels merge
- [ ] Test `gpm ship --approve` skips prompt
- [ ] Test `GPM_REQUIRE_APPROVAL=1` forces prompt
- [ ] Test CI detection skips prompt (unless required)
- [ ] Test git hook warns on push to main
- [ ] Test git hook accepts 'yes' and allows push
- [ ] Test git hook rejects 'no' and blocks push

---

## Documentation Updates Required

### Files to Update

1. **CLAUDE.md** (✅ Complete)
   - Added mandatory `--draft` rule
   - Added approval workflow examples
   - Updated local CLI testing examples

2. **README.md** (🔜 Phase 1)
   - Update `gpm ship` command documentation
   - Add `--approve` and `--draft` flag explanations
   - Add safety best practices section
   - Update quick start examples

3. **docs/guides/QUICK-REFERENCE.md** (🔜 Phase 1)
   - Update ship command examples
   - Add approval workflow section
   - Add environment variable documentation

4. **docs/guides/AI-AGENT-INTEGRATION.md** (🔜 Phase 2)
   - Update AI agent workflow patterns
   - Add approval handling guidance
   - Add safety recommendations

5. **docs/guides/GITHUB-ACTIONS-INTEGRATION.md** (🔜 Phase 2)
   - Update CI/CD workflow examples
   - Add `--approve` flag to all merge examples
   - Add safety configuration section

6. **package.json scripts** (🔜 Phase 1)
   - Update test scripts with `--draft` examples
   - Add safety documentation links

---

## Security Considerations

### Threat Model

**Threat 1**: Accidental merge by developer
- **Mitigation**: Interactive approval prompt (Layer 1)
- **Fallback**: Environment variable enforcement (Layer 2)

**Threat 2**: Automated merge in untrusted CI
- **Mitigation**: Require explicit `--approve` flag in CI
- **Fallback**: Config file `requireApproval: true`

**Threat 3**: Social engineering (Claude Code auto-merge)
- **Mitigation**: Update CLAUDE.md with mandatory `--draft` rule
- **Fallback**: Multiple approval layers prevent bypass

**Threat 4**: Configuration tampering
- **Mitigation**: Config validation warns about unsafe settings
- **Fallback**: Environment variable overrides config

### Audit Trail

**Log all merge decisions**:
```typescript
logger.info(`Merge decision: approved=${approved}, method=${method}`);
// Where method = 'interactive-prompt' | 'approve-flag' | 'env-var' | 'auto'

telemetry?.breadcrumb('merge-decision', {
  prNumber,
  approved,
  method,
  requireApproval: config.workflow?.requireApproval,
  ci: !!process.env.CI
});
```

---

## Success Metrics

### Phase 1 (Immediate)
- ✅ Zero accidental merges to main without approval
- ✅ 100% of `gpm ship` uses require explicit approval or `--draft` flag
- ✅ Updated documentation reflects new safety rules

### Phase 2 (Safety Defaults)
- ✅ 90%+ of projects use `workflow.requireApproval: true` in config
- ✅ Config validation catches unsafe settings
- ✅ Clear warnings guide users to safer configurations

### Phase 3 (Git Hooks)
- ✅ Pre-push hook installed in 50%+ of development environments
- ✅ Zero complaints about false-positive merge warnings
- ✅ Hooks integrate smoothly with existing workflows

---

## Alternatives Considered

### Alternative 1: Remove Auto-Merge Entirely
**Pros**: Simplest, most secure
**Cons**: Breaks existing workflows, reduces automation value
**Decision**: Rejected - too disruptive

### Alternative 2: GitHub Branch Protection Only
**Pros**: Native GitHub feature, well-understood
**Cons**: Doesn't prevent gpm from attempting merge, only GitHub blocks it
**Decision**: Included as supplementary layer, not primary

### Alternative 3: Token Permission Restriction
**Pros**: Prevents merge at API level
**Cons**: Requires manual token management, breaks automation
**Decision**: Rejected - poor UX for legitimate merges

### Alternative 4: Always Require PR Review
**Pros**: Forces human review
**Cons**: Slows down solo developer workflows
**Decision**: Included as option, not requirement

---

## Open Questions

1. **Should `--draft` be the default behavior?**
   - Pro: Maximum safety, explicit opt-in to merge
   - Con: Changes existing behavior, may confuse users
   - **Decision**: Keep current default, add deprecation warning in v1.7.0

2. **Should approval prompt have timeout?**
   - Pro: Prevents hanging processes in edge cases
   - Con: May interrupt legitimate slow responses
   - **Decision**: No timeout in interactive mode, fail in CI if no `--approve`

3. **Should we track approval decisions for audit?**
   - Pro: Useful for understanding usage patterns
   - Con: Privacy concerns, adds complexity
   - **Decision**: Log locally only (via telemetry breadcrumbs), no remote tracking

4. **Should we add `--force` flag to bypass all checks?**
   - Pro: Escape hatch for emergencies
   - Con: Defeats purpose of safety system
   - **Decision**: No, use `--approve` in CI for authorized automated merges

---

## References

- **GitHub API**: Draft PR behavior and merge restrictions
- **semantic-release**: Automated publishing on main branch push
- **Git Hooks**: Available hooks and execution order
- **CLAUDE.md**: Claude Code safety rules and best practices
- **Issue**: Dogfooding incident (PR #28 near-miss)

---

## Appendix: Implementation Code Snippets

### A. Interactive Approval Prompt

```typescript
// src/utils/approval.ts
import readline from 'readline';
import { logger } from './logger';

export interface ApprovalOptions {
  message: string;
  defaultResponse?: 'yes' | 'no';
  timeout?: number; // milliseconds
}

export async function promptForApproval(
  options: ApprovalOptions
): Promise<boolean> {
  // Skip in non-interactive environments
  if (!process.stdin.isTTY || process.env.CI) {
    return options.defaultResponse === 'yes';
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise<boolean>((resolve) => {
    const prompt = `\n⚠️  ${options.message}\n   Type 'yes' to confirm, or Ctrl+C to cancel: `;

    rl.question(prompt, (answer: string) => {
      rl.close();
      const normalized = answer.toLowerCase().trim();
      resolve(normalized === 'yes' || normalized === 'y');
    });
  });
}
```

### B. Config Validation

```typescript
// src/services/ConfigService.ts
interface ValidationWarning {
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

async validateWorkflowSafety(
  config: WorkflowConfig
): Promise<ValidationWarning[]> {
  const warnings: ValidationWarning[] = [];

  // Check for unsafe auto-merge configuration
  if (config.workflow?.allowAutoMerge !== false) {
    if (!config.workflow?.requireApproval) {
      warnings.push({
        severity: 'warning',
        message: 'Auto-merge enabled without approval requirement',
        suggestion: 'Set workflow.requireApproval: true for safety'
      });
    }
  }

  // Check for protected branch configuration
  const defaultBranch = config.github?.defaultBranch || 'main';
  if (!config.workflow?.protectedBranches?.includes(defaultBranch)) {
    warnings.push({
      severity: 'info',
      message: `Default branch '${defaultBranch}' not in protectedBranches`,
      suggestion: `Add '${defaultBranch}' to workflow.protectedBranches`
    });
  }

  return warnings;
}
```

### C. Ship Command Updates

```typescript
// src/commands/ship.ts (merge section)
import { promptForApproval } from '../utils/approval';

// After CI checks pass, before merge:
const shouldMerge = await determineMergeApproval({
  prNumber,
  config,
  options,
  defaultBranch
});

if (!shouldMerge) {
  logger.info(`PR #${prNumber} is ready to merge when you're ready`);
  logger.info(`To merge later: gh pr merge ${prNumber} --squash`);
  return;
}

// Proceed with merge...

async function determineMergeApproval(params: {
  prNumber: number;
  config: WorkflowConfig;
  options: ShipOptions;
  defaultBranch: string;
}): Promise<boolean> {
  const { prNumber, config, options, defaultBranch } = params;

  // 1. Check --draft flag (never merge drafts)
  if (options.draft) {
    return false;
  }

  // 2. Check --approve flag (explicit approval)
  if (options.approve) {
    return true;
  }

  // 3. Check --no-merge flag
  if (options.noMerge) {
    return false;
  }

  // 4. Check if approval required
  const requireApproval =
    process.env.GPM_REQUIRE_APPROVAL === '1' ||
    config.workflow?.requireApproval === true ||
    (!process.env.CI && process.stdin.isTTY); // Interactive mode

  if (!requireApproval) {
    // Legacy behavior: auto-merge
    return true;
  }

  // 5. Prompt for approval
  const message = `Merge PR #${prNumber} to ${defaultBranch}? This will trigger npm publish.`;
  return await promptForApproval({ message, defaultResponse: 'no' });
}
```

---

**End of Design Document**
