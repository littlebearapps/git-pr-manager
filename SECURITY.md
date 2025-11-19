# Security Policy

## Supported Versions

We actively support the latest major version with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via **GitHub Security Advisories**:

1. Go to https://github.com/littlebearapps/git-pr-manager/security/advisories
2. Click "Report a vulnerability"
3. Fill out the advisory form with:
   - Description of the vulnerability
   - Steps to reproduce
   - Impact assessment
   - Suggested fix (if known)

### What to Expect

- **Initial Response**: Within 48 hours
- **Status Update**: Within 5 business days
- **Fix Timeline**:
  - Critical: 1-2 weeks
  - High: 2-4 weeks
  - Medium/Low: Next release cycle

### Disclosure Policy

- Security advisories will be published after a fix is released
- Credit will be given to reporters (unless anonymity is requested)
- CVE IDs will be requested for confirmed vulnerabilities

## Security Best Practices

When using `git-pr-manager`:

### Protect Your GitHub Token

- **Never commit tokens** to git repositories
- Use environment variables (`GITHUB_TOKEN` or `GH_TOKEN`)
- Prefer `direnv` + keychain for local development
- Use GitHub Actions secrets in CI/CD
- Rotate tokens regularly (every 90 days recommended)

### Recommended Token Scopes

Minimum required scopes for GitHub Personal Access Token:

- `repo` (full control of private repositories)

Optional scopes for enhanced features:

- `workflow` (for GitHub Actions management)
- `admin:org` (for organization-wide operations)

### Configuration Security

- **Don't commit secrets** in `.gpm.yml`
- Use `.gitignore` to exclude:
  - `.env` files
  - `.envrc` files (if using direnv)
  - Any files containing tokens or API keys

### CI/CD Security

- Use **GitHub's built-in `GITHUB_TOKEN`** in workflows
- Enable **branch protection rules** (see README.md)
- **Enable Dependabot** for automated security updates
- **Enable CodeQL** for automated security scanning (see `.github/workflows/codeql.yml`)

## Security Features

`git-pr-manager` includes built-in security features:

### 1. Secret Scanning (`gpm security`)

Detects hardcoded secrets in code:

- API keys and tokens
- Passwords and credentials
- Private keys and certificates
- Database connection strings

**Requires**: `detect-secrets` (optional dependency)

```bash
pip install detect-secrets
gpm security
```

### 2. Dependency Vulnerability Scanning

Detects known vulnerabilities in npm packages:

- Critical/High/Medium/Low severity classification
- Actionable fix suggestions
- Integration with `npm audit`

**Requires**: `npm` (included with Node.js)

```bash
gpm security --json
```

### 3. Branch Protection Validation

Ensures main branch is protected:

- Required status checks
- Prevent force pushes
- Prevent deletions

**Configure**:

```bash
gpm protect --show
```

## Third-Party Dependencies

We regularly scan dependencies for vulnerabilities:

- **Automated**: Dependabot (weekly scans)
- **Manual**: `npm audit` (on every build)
- **CodeQL**: Weekly automated code analysis

## Security Contacts

- **Primary**: GitHub Security Advisories (preferred)
- **Email**: security@littlebearapps.com (monitored weekly)
- **Response Time**: 48 hours initial, 5 days for full assessment

---

**Last Updated**: 2025-11-17
**Policy Version**: 1.0
