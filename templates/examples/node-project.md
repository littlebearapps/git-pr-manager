# Node.js Project Integration Example

This example shows how to integrate git-workflow-manager into a Node.js/TypeScript project.

## Installation

```bash
npm install --save-dev @your-org/git-workflow-manager
```

## Configuration

Create `.gwm.yml` in your project root:

```yaml
branchProtection:
  enabled: true
  requireReviews: 1
  requireStatusChecks:
    - ci
    - test
    - lint
    - typecheck
  enforceAdmins: false

ci:
  waitForChecks: true
  failFast: false
  retryFlaky: true
  timeout: 30

security:
  scanSecrets: true
  scanDependencies: true
  allowedVulnerabilities: []

pr:
  templatePath: '.github/PULL_REQUEST_TEMPLATE.md'
  autoAssign: ['tech-lead']
  autoLabel: ['needs-review']
```

## Package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "verify": "npm test && npm run lint && npm run typecheck",
    "gwm:init": "gwm config init --preset standard",
    "gwm:validate": "gwm config validate",
    "gwm:check": "gwm pr validate --pr-number $PR_NUMBER"
  }
}
```

## GitHub Actions Workflow

Create `.github/workflows/pr.yml`:

```yaml
name: PR Validation

on:
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run verify

      - name: Validate PR
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          npm run gwm:check -- \
            --owner "${{ github.repository_owner }}" \
            --repo "${{ github.event.repository.name }}" \
            --pr-number "${{ github.event.pull_request.number }}"
```

## Pre-commit Hook

Create `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run verification checks
npm run verify

# Run security scan
npx gwm security scan --working-dir .
```

## Usage

### Initialize Configuration

```bash
npm run gwm:init
```

### Validate Configuration

```bash
npm run gwm:validate
```

### Setup Branch Protection

```bash
npx gwm protection setup \
  --owner your-org \
  --repo your-repo \
  --branch main \
  --preset standard
```

### Validate PR Readiness

```bash
npx gwm pr validate \
  --owner your-org \
  --repo your-repo \
  --pr-number 123
```

## Best Practices

1. **Commit the configuration**: Check `.gwm.yml` into version control
2. **Use presets**: Start with `standard` preset and customize as needed
3. **Run locally first**: Test workflows locally before pushing
4. **Incremental adoption**: Start with basic protection, upgrade gradually
5. **Document exceptions**: If you allow specific vulnerabilities, document why

## Troubleshooting

### Tests failing in CI but not locally

```bash
# Run with same environment
CI=true npm test
```

### Security scan blocking merge

```bash
# Check what was detected
npx gwm security scan --working-dir . --verbose

# Review findings and either:
# 1. Fix the issue
# 2. Add to allowedVulnerabilities (with justification)
```

### Branch protection not enforced

```bash
# Verify protection settings
npx gwm protection get --owner your-org --repo your-repo --branch main

# Re-apply if needed
npx gwm protection setup --owner your-org --repo your-repo --branch main --preset standard
```
