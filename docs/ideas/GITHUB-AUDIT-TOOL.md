# GitHub Repository Audit Tool - Feature Proposal

**Version**: 1.0 (Draft)
**Date**: 2025-11-14
**Status**: 💡 Idea / Planning Phase
**Estimated Effort**: 28-38 hours for full implementation

---

## 📋 Executive Summary

Add a comprehensive repository audit tool to `gpm` that analyzes GitHub repository settings, CI/CD configuration, security posture, and code quality tooling. The tool would leverage the same GitHub token used by gpm for PR operations to provide an actionable assessment with prioritized recommendations.

**Key Value Proposition**: Transform gpm from a "PR workflow manager" into a "GitHub repository health and security tool" that helps developers ensure their repositories follow best practices.

---

## 🎯 Goals

### Primary Goals
1. **Security Assessment**: Audit branch protection, secret scanning, vulnerability alerts, and security features
2. **CI/CD Analysis**: Parse GitHub Actions workflows to identify testing gaps, missing security scans, and optimization opportunities
3. **Code Quality**: Detect linting/formatting tools and identify gaps across languages
4. **Actionable Output**: Provide clear, prioritized recommendations for improvement
5. **Developer-Friendly**: Beautiful terminal output + JSON mode for automation

### Non-Goals
- Not a replacement for specialized security tools (Snyk, SonarQube, etc.)
- Not an automated fixer (at least in Phase 1 - future enhancement)
- Not a compliance certification tool (PCI, SOC2, etc.)

---

## ✅ Technical Feasibility

### High Feasibility - Existing Infrastructure

gpm already has 40% of the required infrastructure:

| Component | Status | Coverage | Notes |
|-----------|--------|----------|-------|
| **BranchProtectionChecker** | ✅ Exists | 90.9% | `src/services/BranchProtectionChecker.ts` |
| **SecurityScanner** | ✅ Exists | 86.45% | `src/services/SecurityScanner.ts` |
| **GitHubService** | ✅ Exists | 87.23% | Octokit wrapper with auth, caching, rate limiting |
| **JSON Output** | ✅ Exists | All commands | Consistent structured output |
| **Error Handling** | ✅ Exists | 100% | `WorkflowError` with suggestions |
| **Logger System** | ✅ Exists | 98.48% | Verbosity levels, CI detection |

### GitHub API Coverage

All audit features map to existing GitHub REST APIs:

| Audit Area | GitHub API Endpoint | Token Scope Required | Status |
|------------|---------------------|---------------------|--------|
| **Branch Protection** | `GET /repos/{owner}/{repo}/branches/{branch}/protection` | `repo` ✅ | Have it |
| **GitHub Actions** | `GET /repos/{owner}/{repo}/actions/workflows`<br>`GET /repos/{owner}/{repo}/contents/.github/workflows` | `repo` ✅ | Have it |
| **Vulnerability Alerts** | `GET /repos/{owner}/{repo}/vulnerability-alerts` | `repo` ✅ | Have it |
| **Code Scanning** | `GET /repos/{owner}/{repo}/code-scanning/alerts` | `security_events` ⚠️ | Optional scope |
| **Secret Scanning** | `GET /repos/{owner}/{repo}/secret-scanning/alerts` | `security_events` ⚠️ | Optional scope |
| **Dependabot** | `GET /repos/{owner}/{repo}/dependabot/alerts` | `security_events` ⚠️ | Optional scope |
| **Repository Settings** | `GET /repos/{owner}/{repo}` | `repo` ✅ | Have it |
| **File Contents** | `GET /repos/{owner}/{repo}/contents/{path}` | `repo` ✅ | Have it |

**Token Scope Strategy**:
- Core features work with existing `repo` scope ✅
- Advanced security features gracefully degrade if `security_events` scope missing
- Display warning: "⚠️ Some security checks skipped (missing scope: security_events)"

---

## 🏗️ Architecture Design

### New Components

#### 1. RepoAuditor Service (`src/services/RepoAuditor.ts`)

Main orchestrator for all audit checks:

```typescript
export interface AuditOptions {
  checks?: 'all' | 'ci' | 'security' | 'linting' | 'branch-protection';
  detailed?: boolean;
  baseline?: string;  // Path to baseline JSON for comparison
}

export interface AuditReport {
  ci: CIAuditResult;
  branchProtection: BranchProtectionAuditResult;
  security: SecurityAuditResult;
  linting: LintingAuditResult;
  secrets: SecretsAuditResult;
  overall: OverallScore;
  timestamp: string;
  repository: { owner: string; repo: string };
}

export class RepoAuditor {
  constructor(
    private github: GitHubService,
    private git: GitService,
    private config: Config
  ) {}

  async runAudit(options: AuditOptions): Promise<AuditReport> {
    const checks = this.selectChecks(options.checks);

    const results: Partial<AuditReport> = {};

    if (checks.includes('ci')) {
      results.ci = await this.auditCI();
    }

    if (checks.includes('branchProtection')) {
      results.branchProtection = await this.auditBranchProtection();
    }

    if (checks.includes('security')) {
      results.security = await this.auditSecurity();
    }

    if (checks.includes('linting')) {
      results.linting = await this.auditLinting();
    }

    if (checks.includes('secrets')) {
      results.secrets = await this.auditSecretsScanning();
    }

    results.overall = this.calculateOverallScore(results);
    results.timestamp = new Date().toISOString();
    results.repository = {
      owner: this.github.owner,
      repo: this.github.repo
    };

    return results as AuditReport;
  }

  private async auditCI(): Promise<CIAuditResult> {
    // Parse .github/workflows/*.yml files
    // Detect test jobs, matrix strategies, caching
    // Check for scheduled workflows (security scans, dependency updates)
    // Analyze job dependencies and parallelization
  }

  private async auditBranchProtection(): Promise<BranchProtectionAuditResult> {
    // Leverage existing BranchProtectionChecker service
    // Extend with additional checks (signed commits, linear history, etc.)
  }

  private async auditSecurity(): Promise<SecurityAuditResult> {
    // Check if Dependabot is enabled
    // Check if secret scanning is enabled (if scope available)
    // Check if code scanning is enabled (if scope available)
    // Query vulnerability alerts
    // Leverage existing SecurityScanner for local scans
  }

  private async auditLinting(): Promise<LintingAuditResult> {
    // Read package.json for lint/format scripts
    // Check for config files: .eslintrc*, .prettierrc*, pyproject.toml, etc.
    // Detect pre-commit hooks (gpm already has hooks integration!)
    // Analyze by language: JS/TS, Python, Go, Rust, Java, etc.
  }

  private async auditSecretsScanning(): Promise<SecretsAuditResult> {
    // Leverage existing SecurityScanner service
    // Run detect-secrets scan
    // Check GitHub secret scanning status (if scope available)
  }

  private calculateOverallScore(results: Partial<AuditReport>): OverallScore {
    // Weighted scoring system
    // Generate grade (A-F)
    // Prioritize recommendations by impact
  }
}
```

#### 2. CIAnalyzer Utility (`src/utils/CIAnalyzer.ts`)

Parses GitHub Actions workflows:

```typescript
export interface WorkflowAnalysis {
  name: string;
  path: string;
  triggers: string[];  // [push, pull_request, schedule, workflow_dispatch]
  jobs: JobAnalysis[];
  hasTests: boolean;
  hasLinting: boolean;
  hasSecurity: boolean;
  hasMatrixStrategy: boolean;
  hasCaching: boolean;
  issues: string[];
  recommendations: string[];
}

export class CIAnalyzer {
  async analyzeWorkflows(
    workflowFiles: Array<{ path: string; content: string }>
  ): Promise<WorkflowAnalysis[]> {
    // Parse YAML
    // Detect test jobs (names containing: test, spec, jest, pytest, etc.)
    // Detect linting jobs (names containing: lint, eslint, flake8, etc.)
    // Detect security jobs (names containing: security, audit, scan, etc.)
    // Analyze matrix strategies
    // Check for caching (actions/cache, setup-node with cache, etc.)
  }

  private detectJobType(job: any): 'test' | 'lint' | 'security' | 'build' | 'deploy' | 'unknown' {
    // Heuristic detection based on job name and steps
  }
}
```

#### 3. LintConfigDetector Utility (`src/utils/LintConfigDetector.ts`)

Detects linting/formatting configuration:

```typescript
export interface LintingConfig {
  language: string;
  tools: Array<{
    name: string;
    configFile?: string;
    scriptName?: string;  // In package.json
    detected: boolean;
  }>;
}

export class LintConfigDetector {
  async detectConfigs(): Promise<LintingConfig[]> {
    const configs: LintingConfig[] = [];

    // JavaScript/TypeScript
    configs.push(await this.detectJavaScript());

    // Python
    configs.push(await this.detectPython());

    // Go
    configs.push(await this.detectGo());

    // Rust
    configs.push(await this.detectRust());

    // Other languages...

    return configs.filter(c => c.tools.length > 0);
  }

  private async detectJavaScript(): Promise<LintingConfig> {
    // Check for: eslint, prettier, biome, tslint (legacy)
    // Look for: .eslintrc*, .prettierrc*, biome.json, package.json scripts
  }

  private async detectPython(): Promise<LintingConfig> {
    // Check for: black, flake8, pylint, mypy, isort, ruff
    // Look for: pyproject.toml, .flake8, .pylintrc, mypy.ini
  }
}
```

#### 4. Audit Command (`src/commands/audit.ts`)

CLI interface:

```typescript
export interface AuditCommandOptions {
  check?: string;  // Specific check or 'all'
  json?: boolean;
  detailed?: boolean;
  baseline?: string;
  output?: string;  // Save to file
}

export async function auditCommand(options: AuditCommandOptions): Promise<void> {
  const logger = new Logger({ json: options.json });

  try {
    // Initialize services
    const github = new GitHubService(token, owner, repo);
    const git = new GitService(process.cwd());
    const config = await loadConfig();

    const auditor = new RepoAuditor(github, git, config);

    // Run audit
    const spinner = createSpinner('Running repository audit...');
    const results = await auditor.runAudit({
      checks: options.check || 'all',
      detailed: options.detailed || false,
      baseline: options.baseline
    });
    spinner.succeed('Audit complete!');

    // Output results
    if (options.json) {
      logger.outputJsonResult(true, results);
    } else {
      displayAuditReport(results, options.detailed || false);
    }

    // Save to file if requested
    if (options.output) {
      await fs.writeFile(
        options.output,
        JSON.stringify(results, null, 2),
        'utf8'
      );
      logger.success(`Report saved to ${options.output}`);
    }

    // Exit code based on score
    if (results.overall.score < 60) {
      process.exit(1);  // Fail if score < 60 (F/D grade)
    }
  } catch (error) {
    logger.error('Audit failed', toWorkflowError(error));
    process.exit(1);
  }
}

function displayAuditReport(report: AuditReport, detailed: boolean): void {
  // Beautiful terminal output with colors, tables, progress bars
  // Show overall score/grade prominently
  // List top 3-5 recommendations
  // Detailed mode: show full breakdown per category
}
```

---

## 📊 Example Outputs

### Terminal Output (Normal Mode)

```
▸ Repository Audit Report
────────────────────────────────────────────────────────────────────────────────

Repository: littlebearapps/git-pr-manager
Timestamp:  2025-11-14T10:30:00Z

────────────────────────────────────────────────────────────────────────────────
Overall Score: 84/100 (B)
────────────────────────────────────────────────────────────────────────────────

Category Scores:
  ✅ Branch Protection    95/100  (Excellent)
  ✅ Secrets Scanning     100/100 (Perfect)
  ✅ Linting & Formatting 80/100  (Good)
  ⚠️  CI/CD Setup          85/100  (Good)
  ⚠️  Security Tools       60/100  (Needs Work)

────────────────────────────────────────────────────────────────────────────────
Top Recommendations
────────────────────────────────────────────────────────────────────────────────

🔴 Critical
  • Enable GitHub secret scanning in repository settings
    Impact: HIGH | Effort: LOW | Category: Security

🟡 Important
  • Add scheduled security scan workflow (weekly)
    Impact: MEDIUM | Effort: LOW | Category: CI/CD

  • Configure Python linting (black, flake8)
    Impact: MEDIUM | Effort: MEDIUM | Category: Linting

🟢 Nice to Have
  • Add matrix testing for Node 18, 20, 22
    Impact: LOW | Effort: LOW | Category: CI/CD

────────────────────────────────────────────────────────────────────────────────

Run 'gpm audit --detailed' for full report
Run 'gpm audit --json' for machine-readable output
Run 'gpm audit --output report.json' to save results
```

### Terminal Output (Detailed Mode)

```
▸ CI/CD Setup (85/100)
────────────────────────────────────────────────────────────────────────────────

Workflows Found: 3
  ✅ test.yml          - Tests, linting, coverage
  ✅ publish.yml       - npm publish on release
  ⚠️  codeql.yml        - Security analysis (only on schedule)

Test Coverage:
  ✅ Unit tests detected (jest)
  ✅ Matrix strategy (ubuntu, macos, windows)
  ✅ Caching enabled (npm cache)
  ⚠️  No integration tests detected

Security Workflows:
  ⚠️  No scheduled dependency updates
  ⚠️  No scheduled security scans
  ✅ CodeQL runs on push to main

Issues:
  • No scheduled workflows for dependency updates (consider Dependabot)
  • Security scans only run on schedule, not on PR

Recommendations:
  • Add 'gpm security' step to test.yml for PR validation
  • Enable Dependabot for automated dependency updates
  • Add npm audit check to CI

────────────────────────────────────────────────────────────────────────────────
```

### JSON Output

```json
{
  "repository": {
    "owner": "littlebearapps",
    "repo": "git-pr-manager"
  },
  "timestamp": "2025-11-14T10:30:00Z",
  "ci": {
    "score": 85,
    "status": "good",
    "workflows": [
      {
        "name": "test",
        "path": ".github/workflows/test.yml",
        "triggers": ["push", "pull_request"],
        "hasTests": true,
        "hasLinting": true,
        "hasSecurity": false,
        "hasMatrixStrategy": true,
        "hasCaching": true
      },
      {
        "name": "publish",
        "path": ".github/workflows/publish.yml",
        "triggers": ["release"],
        "hasTests": false,
        "hasLinting": false,
        "hasSecurity": false,
        "hasMatrixStrategy": false,
        "hasCaching": false
      },
      {
        "name": "codeql",
        "path": ".github/workflows/codeql.yml",
        "triggers": ["schedule", "push"],
        "hasTests": false,
        "hasLinting": false,
        "hasSecurity": true,
        "hasMatrixStrategy": false,
        "hasCaching": false
      }
    ],
    "issues": [
      "No scheduled dependency update workflows",
      "Security scans not running on PRs"
    ],
    "recommendations": [
      {
        "priority": "medium",
        "impact": "medium",
        "effort": "low",
        "category": "ci",
        "title": "Add security scan to PR workflow",
        "description": "Add 'gpm security' step to test.yml",
        "actionable": "Add step: - name: Security scan\n  run: gpm security"
      }
    ]
  },
  "branchProtection": {
    "score": 95,
    "status": "excellent",
    "protectedBranches": [
      {
        "name": "main",
        "requiresReviews": true,
        "requiredReviewers": 1,
        "requiresStatusChecks": true,
        "requiredStatusChecks": ["test", "lint", "coverage"],
        "enforceAdmins": true,
        "requiresSignedCommits": false,
        "requiresLinearHistory": true,
        "allowsForcePushes": false,
        "allowsDeletions": false
      }
    ],
    "issues": [
      "Signed commits not required on main"
    ],
    "recommendations": [
      {
        "priority": "low",
        "impact": "low",
        "effort": "low",
        "category": "branch-protection",
        "title": "Require signed commits",
        "description": "Enable signed commits for added security",
        "actionable": "Repository Settings → Branches → main → Require signed commits"
      }
    ]
  },
  "security": {
    "score": 60,
    "status": "warning",
    "dependabot": {
      "enabled": true,
      "ecosystems": ["npm"],
      "securityUpdates": true,
      "versionUpdates": false
    },
    "secretScanning": {
      "enabled": false,
      "available": true
    },
    "codeScanning": {
      "enabled": true,
      "tool": "CodeQL",
      "languages": ["javascript", "typescript"]
    },
    "vulnerabilities": {
      "critical": 0,
      "high": 2,
      "moderate": 5,
      "low": 3
    },
    "issues": [
      "Secret scanning not enabled",
      "2 high-severity vulnerabilities in dependencies",
      "5 moderate-severity vulnerabilities in dependencies"
    ],
    "recommendations": [
      {
        "priority": "high",
        "impact": "high",
        "effort": "low",
        "category": "security",
        "title": "Enable GitHub secret scanning",
        "description": "Detect secrets committed to repository",
        "actionable": "Repository Settings → Security → Secret scanning → Enable"
      },
      {
        "priority": "high",
        "impact": "high",
        "effort": "medium",
        "category": "security",
        "title": "Fix high-severity vulnerabilities",
        "description": "Run npm audit fix to address 2 high-severity issues",
        "actionable": "npm audit fix"
      }
    ]
  },
  "linting": {
    "score": 80,
    "status": "good",
    "configs": [
      {
        "language": "javascript",
        "tools": [
          {
            "name": "eslint",
            "configFile": ".eslintrc.json",
            "scriptName": "lint",
            "detected": true
          },
          {
            "name": "prettier",
            "configFile": ".prettierrc",
            "scriptName": null,
            "detected": true
          }
        ]
      },
      {
        "language": "typescript",
        "tools": [
          {
            "name": "eslint",
            "configFile": ".eslintrc.json",
            "scriptName": "lint",
            "detected": true
          }
        ]
      },
      {
        "language": "python",
        "tools": []
      }
    ],
    "issues": [
      "No Python linting configured"
    ],
    "recommendations": [
      {
        "priority": "medium",
        "impact": "medium",
        "effort": "medium",
        "category": "linting",
        "title": "Add Python linting",
        "description": "Configure black and flake8 for Python code formatting",
        "actionable": "pip install black flake8\necho '[tool.black]\nline-length = 100' >> pyproject.toml"
      }
    ]
  },
  "secrets": {
    "score": 100,
    "status": "excellent",
    "scanResults": {
      "secretsFound": 0,
      "filesScanned": 247,
      "excludedFiles": 58
    },
    "issues": [],
    "recommendations": []
  },
  "overall": {
    "score": 84,
    "grade": "B",
    "summary": "Good security posture with room for improvement",
    "strengths": [
      "Strong branch protection on main",
      "No secrets detected in codebase",
      "Good linting setup for JavaScript/TypeScript"
    ],
    "weaknesses": [
      "Secret scanning not enabled",
      "Multiple high/moderate vulnerabilities",
      "Missing Python linting configuration"
    ],
    "topRecommendations": [
      {
        "priority": "high",
        "category": "security",
        "title": "Enable GitHub secret scanning"
      },
      {
        "priority": "high",
        "category": "security",
        "title": "Fix high-severity vulnerabilities"
      },
      {
        "priority": "medium",
        "category": "ci",
        "title": "Add security scan to PR workflow"
      }
    ]
  }
}
```

---

## 🚀 Implementation Phases

### Phase 1: Minimal Viable Audit (4-6 hours)

**Goal**: Leverage existing services for quick win

**Components**:
- ✅ Use existing `BranchProtectionChecker`
- ✅ Use existing `SecurityScanner`
- 🆕 Add `RepoAuditor` service (basic orchestration)
- 🆕 Add `audit` command (basic terminal output + JSON)
- 🆕 Basic scoring system

**Deliverables**:
```bash
gpm audit  # Branch protection + secrets + basic security
gpm audit --json
```

**Test Coverage**: >80% for new code (RepoAuditor, audit command)

---

### Phase 2: CI & Workflow Analysis (6-8 hours)

**Goal**: Parse and analyze GitHub Actions workflows

**Components**:
- 🆕 Add `CIAnalyzer` utility
- 🆕 Workflow parsing (YAML)
- 🆕 Heuristic detection (tests, linting, security)
- 🆕 Matrix strategy detection
- 🆕 Caching detection

**Deliverables**:
```bash
gpm audit --check=ci           # Just CI analysis
gpm audit --check=ci --detailed  # Full CI breakdown
```

**Test Coverage**: >80% for CIAnalyzer

---

### Phase 3: Linting & Formatting Detection (4-6 hours)

**Goal**: Detect linting/formatting tools across languages

**Components**:
- 🆕 Add `LintConfigDetector` utility
- 🆕 JavaScript/TypeScript detection (eslint, prettier, biome)
- 🆕 Python detection (black, flake8, pylint, mypy, ruff)
- 🆕 Go detection (gofmt, golangci-lint)
- 🆕 Rust detection (rustfmt, clippy)

**Deliverables**:
```bash
gpm audit --check=linting
gpm audit --check=linting --detailed
```

**Test Coverage**: >80% for LintConfigDetector

---

### Phase 4: Scoring & Recommendations (6-8 hours)

**Goal**: Intelligent scoring and prioritization

**Components**:
- 🆕 Weighted scoring system
- 🆕 Grade calculation (A-F)
- 🆕 Recommendation prioritization (impact × effort)
- 🆕 Baseline comparison support

**Deliverables**:
```bash
gpm audit --baseline baseline.json  # Compare against baseline
gpm audit --output audit-report.json  # Save for baseline
```

**Scoring Weights** (proposed):
- Security: 40% (most critical)
- Branch Protection: 25% (prevents mistakes)
- CI/CD: 20% (ensures quality)
- Linting: 15% (code quality)

**Test Coverage**: >80% for scoring logic

---

### Phase 5: Polish & Testing (8-10 hours)

**Goal**: Production-ready quality

**Components**:
- 🆕 Beautiful terminal output (colors, tables, boxes)
- 🆕 Progress indicators
- 🆕 Error handling for missing permissions
- 🆕 Rate limit handling
- 🆕 Comprehensive tests (target: >80% coverage)
- 🆕 Documentation (README, command help, examples)

**Deliverables**:
- All tests passing
- Coverage >80%
- README updated with `gpm audit` examples
- CLAUDE.md updated with audit command reference

---

## 📚 Integration Points

### 1. Extend `gpm doctor`

Add repository audit to health check:

```bash
gpm doctor --repo  # Include repo audit in health check
```

**Output**:
```
▸ System Health Check
────────────────────────────────────────────────────────────────────────────────
✅ GitHub token: GITHUB_TOKEN
✅ git                  git version 2.51.0
✅ node                 v20.10.0

▸ Repository Health
────────────────────────────────────────────────────────────────────────────────
✅ Branch protection    95/100
⚠️  Security tools       60/100
✅ CI/CD setup          85/100

Overall: 84/100 (B)

Run 'gpm audit' for full report
```

---

### 2. Smart `gpm init`

Run audit first, suggest template based on findings:

```bash
gpm init --audit
```

**Behavior**:
1. Run lightweight audit (no linting/CI checks)
2. Analyze branch protection and security
3. Suggest appropriate template:
   - **Basic**: If no branch protection
   - **Standard**: If some protection exists
   - **Strict**: If advanced security features detected

---

### 3. Continuous Monitoring (Future)

```bash
gpm audit --watch  # Re-run audit on file changes
gpm audit --baseline baseline.json  # Save current state
gpm audit --compare baseline.json  # Compare against baseline
```

---

### 4. GitHub Actions Integration

```yaml
name: Weekly Audit
on:
  schedule:
    - cron: '0 9 * * 1'  # Monday at 9am
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install gpm
        run: npm install -g @littlebearapps/git-pr-manager

      - name: Run audit
        run: gpm audit --json > audit-report.json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: audit-report
          path: audit-report.json

      - name: Create issue if score low
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const audit = JSON.parse(fs.readFileSync('audit-report.json'));

            if (audit.overall.score < 70) {
              github.rest.issues.create({
                owner: context.repo.owner,
                repo: context.repo.repo,
                title: `Repository audit score: ${audit.overall.score}/100 (${audit.overall.grade})`,
                body: `## Audit Results\n\n${audit.overall.summary}\n\n### Top Recommendations\n\n${audit.overall.topRecommendations.map(r => `- ${r.title}`).join('\n')}\n\nRun \`gpm audit\` for full report.`,
                labels: ['maintenance', 'security']
              });
            }
```

---

## ⚠️ Considerations & Challenges

### 1. Token Permissions

**Challenge**: Some features require `security_events` scope

**Solution**:
- Core features work with `repo` scope ✅
- Gracefully skip advanced security checks if scope missing
- Display clear warning:
  ```
  ⚠️  Some security checks skipped

  Missing scope: security_events

  To enable:
  1. Generate new token: https://github.com/settings/tokens
  2. Add scope: security_events
  3. Update GITHUB_TOKEN
  ```

---

### 2. Rate Limiting

**Challenge**: Audit = many API calls (10-20+ requests)

**Solutions**:
- ✅ Use existing `GitHubService` caching (ETag support)
- ✅ Use existing rate limit handling
- Show progress spinner during audit
- Allow selective audits: `gpm audit --check=security` (fewer API calls)
- Cache audit results for 5 minutes (optional)

**Estimated API Calls**:
- Branch protection: 1-3 (per protected branch)
- Workflows: 1 (list) + N (fetch each workflow file)
- Security settings: 3-5 (repo settings, vulnerability alerts, etc.)
- File contents: 5-10 (package.json, config files)
- **Total**: 15-25 API calls per full audit

---

### 3. GitHub Feature Availability

**Challenge**: Advanced Security features require GitHub Pro/Team/Enterprise

**Solution**:
- Check feature availability via repository settings API
- Skip unavailable checks gracefully
- Note in report: "⚠️ Code scanning not available (requires GitHub Advanced Security)"

---

### 4. Repository Size

**Challenge**: Large repos with many workflows = slow parsing

**Solutions**:
- Implement timeout (30 seconds default)
- Parallel API requests where possible
- Show progress: "Analyzing workflows... (2/5)"
- Allow skipping slow checks: `gpm audit --quick` (skip workflow parsing)

---

### 5. False Positives

**Challenge**: Heuristics may incorrectly identify job types

**Solutions**:
- Conservative detection (only flag clear cases)
- Allow configuration overrides in `.gpm.yml`:
  ```yaml
  audit:
    ci:
      testJobs: ['test', 'integration-test']
      lintJobs: ['lint', 'check-format']
      securityJobs: ['security-scan']
  ```
- Show confidence levels in detailed mode

---

## 🎯 Success Metrics

### Quantitative
- **Adoption**: >50% of gpm users run audit within 30 days of v1.5 release
- **Performance**: Audit completes in <30 seconds for typical repository
- **Coverage**: >80% test coverage for new code
- **API Efficiency**: <25 API calls per full audit (leverage caching)

### Qualitative
- **Actionable**: Users can act on >80% of recommendations without research
- **Accurate**: <5% false positive rate on issue detection
- **Clear**: Non-technical users understand overall score/grade

---

## 📈 Future Enhancements (Post v1.5)

### Phase 6: Auto-Fix (Future)

```bash
gpm audit --fix  # Automatically create PRs to fix issues
```

**Auto-fixable issues**:
- Enable Dependabot (create `.github/dependabot.yml`)
- Add missing workflow steps (security scan, linting)
- Add missing config files (`.eslintrc`, `.prettierrc`)
- Fix known vulnerabilities (`npm audit fix`)

---

### Phase 7: Trend Tracking (Future)

Store audit history in `.gpm-audit-history.json`:

```bash
gpm audit --track  # Append to history
gpm audit --history  # Show trend over time
```

**Output**:
```
▸ Audit History (Last 30 Days)
────────────────────────────────────────────────────────────────────────────────

  Score
   100 ┤
    90 ┤        ╭─────╮
    80 ┤    ╭───╯     ╰────╮
    70 ┤────╯                ╰─
    60 ┤
       └────────────────────────────────────
      Nov 1    Nov 8    Nov 15    Nov 22

Improvements:
  ✅ +10 points: Enabled secret scanning (Nov 8)
  ✅ +5 points: Added security workflow (Nov 15)

Issues:
  ⚠️  -3 points: New vulnerabilities detected (Nov 22)
```

---

### Phase 8: Compliance Profiles (Future)

Pre-configured audit profiles for compliance frameworks:

```bash
gpm audit --profile=pci-dss  # PCI DSS compliance
gpm audit --profile=soc2     # SOC 2 compliance
gpm audit --profile=gdpr     # GDPR compliance
```

---

### Phase 9: Team Benchmarking (Future)

Compare against other repositories:

```bash
gpm audit --benchmark  # Compare to public repos
gpm audit --benchmark=team  # Compare to org repos
```

**Output**:
```
Your score: 84/100 (B)

Benchmark:
  Public repos (similar size):  75/100 (C)
  Your organization:            88/100 (B+)
  Top 10% of repos:             95/100 (A)

You're above average! 🎉
```

---

## 📝 Documentation Plan

### README.md Updates

Add new section:

```markdown
### `gpm audit` - Repository Health Check

Audit your repository's security posture, CI/CD setup, and code quality tooling.

**Usage:**
```bash
gpm audit                     # Full audit
gpm audit --check=security    # Security only
gpm audit --json              # JSON output
gpm audit --detailed          # Detailed report
```

**What it checks:**
- ✅ Branch protection settings
- ✅ Secret scanning & vulnerability alerts
- ✅ GitHub Actions workflows
- ✅ Linting & formatting tools
- ✅ Security tools (Dependabot, CodeQL)

**Example output:**
```
Overall Score: 84/100 (B)

Top Recommendations:
  🔴 Enable GitHub secret scanning
  🟡 Add scheduled security workflows
  🟢 Configure Python linting
```
```

---

### CLAUDE.md Updates

Add to "Core Commands" section:

```markdown
### Auditing
```bash
npm run dev -- audit                    # Full repo audit
npm run dev -- audit --check=ci         # CI-only audit
npm run dev -- audit --json             # JSON output
npm run dev -- audit --detailed         # Detailed report
```
```

Add to "Common Patterns" section:

```markdown
### Adding an Audit Check

1. Add check method to `RepoAuditor` service
2. Update `AuditReport` interface with new check result type
3. Implement scoring logic in `calculateOverallScore()`
4. Add tests in `tests/services/RepoAuditor.test.ts`
5. Update documentation
```

---

### New Documentation Files

Create:
- `docs/guides/AUDIT-GUIDE.md` - Comprehensive audit guide
- `docs/guides/AUDIT-SCORING.md` - Scoring methodology
- `docs/guides/AUDIT-RECOMMENDATIONS.md` - How to act on recommendations

---

## 🎬 Next Steps

To proceed with implementation:

1. **Approve scope**: Review and approve this proposal
2. **Set timeline**: Decide on implementation schedule (4-6 week timeline recommended)
3. **Phase 1 start**: Begin with minimal viable audit (leverage existing code)
4. **Iterative rollout**: Ship Phase 1, gather feedback, iterate
5. **Community input**: Consider opening GitHub issue for feature requests

---

## 📞 Questions for Discussion

1. **Scope**: Start with Phase 1 only, or commit to all 5 phases?
2. **Scoring weights**: Agree on category weights (Security: 40%, Branch: 25%, CI: 20%, Linting: 15%)?
3. **Output format**: Terminal output design approval needed?
4. **Integration**: Should this be `gpm audit` or extend `gpm doctor --repo`?
5. **Token scopes**: Acceptable to require `security_events` scope, or graceful degradation only?
6. **Baselines**: Store baselines in `.gpm-audit-baseline.json` or separate directory?

---

## 💭 Alternative Approaches Considered

### Approach 1: External Tool Integration
**Idea**: Integrate existing audit tools (npm audit, detect-secrets, etc.)
**Pros**: Less code to write, leverage mature tools
**Cons**: Inconsistent output formats, additional dependencies
**Decision**: Hybrid - use existing tools where possible (detect-secrets) but wrap in consistent interface

### Approach 2: GitHub App
**Idea**: Build as GitHub App that runs automatically on commits
**Pros**: No local setup, automatic monitoring
**Cons**: Major scope increase, hosting required, authentication complexity
**Decision**: CLI-first for v1.5, GitHub App for future if demand exists

### Approach 3: Separate CLI Tool
**Idea**: Build as standalone tool (`gh-audit`) instead of gpm feature
**Pros**: Focused tool, independent versioning
**Cons**: Duplicate infrastructure (GitHubService, auth, etc.)
**Decision**: Integrate into gpm - synergy with existing code, unified developer experience

---

**Last Updated**: 2025-11-14
**Author**: User + Claude (AI Assistant)
**Status**: Draft - Awaiting approval
