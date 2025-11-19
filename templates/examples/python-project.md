# Python Project Integration Example

This example shows how to integrate git-pr-manager into a Python project.

## Installation

```bash
pip install git-pr-manager
```

## Configuration

Create `.gpm.yml` in your project root:

```yaml
branchProtection:
  enabled: true
  requireReviews: 1
  requireStatusChecks:
    - ci
    - test
    - lint
    - type-check
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
  templatePath: ".github/PULL_REQUEST_TEMPLATE.md"
  autoAssign: ["tech-lead"]
  autoLabel: ["needs-review"]
```

## Verification Script

Create `verify.sh` in your project root:

```bash
#!/bin/bash
set -e

echo "Running tests..."
pytest tests/ -v --cov=src --cov-report=term-missing

echo "Running lint..."
ruff check src/ tests/

echo "Running type check..."
mypy src/

echo "Running format check..."
black --check src/ tests/

echo "✅ All verification checks passed!"
```

Make it executable:

```bash
chmod +x verify.sh
```

## Tox Configuration

Create `tox.ini`:

```ini
[tox]
envlist = py311,lint,type,format

[testenv]
deps =
    pytest
    pytest-cov
commands =
    pytest tests/ -v --cov=src --cov-report=term-missing

[testenv:lint]
deps = ruff
commands = ruff check src/ tests/

[testenv:type]
deps = mypy
commands = mypy src/

[testenv:format]
deps = black
commands = black --check src/ tests/
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
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: |
          pip install -U pip
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
          pip install git-pr-manager

      - name: Install security tools
        run: |
          pip install detect-secrets pip-audit

      - name: Run verification
        run: ./verify.sh

      - name: Run security scan
        run: gpm security scan --working-dir .

      - name: Validate PR
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gpm pr validate \
            --owner "${{ github.repository_owner }}" \
            --repo "${{ github.event.repository.name }}" \
            --pr-number "${{ github.event.pull_request.number }}"
```

## Pre-commit Configuration

Create `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: local
    hooks:
      - id: verify
        name: Run verification checks
        entry: ./verify.sh
        language: system
        pass_filenames: false

      - id: security-scan
        name: Security scan
        entry: gpm security scan --working-dir .
        language: system
        pass_filenames: false
```

Install pre-commit hooks:

```bash
pre-commit install
```

## Usage

### Initialize Configuration

```bash
gpm config init --preset standard
```

### Validate Configuration

```bash
gpm config validate
```

### Setup Branch Protection

```bash
gpm protection setup \
  --owner your-org \
  --repo your-repo \
  --branch main \
  --preset standard
```

### Run Security Scan

```bash
gpm security scan --working-dir .
```

### Validate PR Readiness

```bash
gpm pr validate \
  --owner your-org \
  --repo your-repo \
  --pr-number 123
```

## Best Practices

1. **Use virtual environments**: Keep dependencies isolated
2. **Pin versions**: Use `requirements.txt` with pinned versions
3. **Run security scans**: Install `detect-secrets` and `pip-audit`
4. **Type checking**: Use `mypy` for static type checking
5. **Code formatting**: Use `black` and `ruff` for consistent code style

## Troubleshooting

### Security scan finds false positives

Edit `.gpm.yml` to allow specific vulnerabilities:

```yaml
security:
  scanSecrets: true
  scanDependencies: true
  allowedVulnerabilities:
    - "CVE-2023-1234" # Justified: Not exploitable in our use case
```

### Type checking errors

```bash
# Generate type stubs for dependencies
stubgen -p <package_name> -o typings/
```

### Pre-commit hook too slow

```bash
# Skip hooks for WIP commits
git commit --no-verify -m "WIP: work in progress"

# But always run before pushing
./verify.sh
gpm security scan --working-dir .
```

## Example Project Structure

```
my-python-project/
├── .github/
│   ├── workflows/
│   │   └── pr.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── src/
│   └── my_package/
│       ├── __init__.py
│       └── main.py
├── tests/
│   └── test_main.py
├── .gpm.yml
├── .pre-commit-config.yaml
├── tox.ini
├── verify.sh
├── requirements.txt
├── requirements-dev.txt
└── README.md
```
