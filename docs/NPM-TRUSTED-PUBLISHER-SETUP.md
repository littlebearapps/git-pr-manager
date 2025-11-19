# npm Trusted Publisher Setup Guide

**Project**: git-pr-manager
**Package**: @littlebearapps/git-pr-manager
**Date**: 2025-11-16

---

## Overview

This guide walks through setting up **npm Trusted Publishers with OIDC** to enable secure, token-less publishing from GitHub Actions.

### Benefits of OIDC Publishing

✅ **No token management** - No NPM_TOKEN needed in GitHub secrets
✅ **Enhanced security** - Short-lived tokens auto-generated per workflow run
✅ **Audit trail** - Clear connection between package and repository verified by npm
✅ **Zero rotation** - No need to rotate credentials
✅ **Provenance attestation** - Cryptographic proof of package origin

---

## Part 1: Configure Trusted Publisher on npmjs.com

### Step 1: Navigate to Package Settings

1. Go to https://www.npmjs.com/package/@littlebearapps/git-pr-manager
2. Click the "Settings" tab
3. Find the "Publishing access" section
4. Click "Add trusted publisher"

### Step 2: Configure GitHub Actions Provider

Enter the following values in the form:

| Field                 | Value                                     |
| --------------------- | ----------------------------------------- |
| **Provider**          | GitHub Actions                            |
| **Organization/User** | `littlebearapps`                          |
| **Repository**        | `git-pr-manager`                          |
| **Workflow filename** | `publish.yml`                             |
| **Environment name**  | `Production` _(optional but recommended)_ |

### Step 3: Save Configuration

1. Click "Add publisher"
2. Verify the configuration appears in the "Trusted publishers" list
3. npm will now accept OIDC tokens from this specific workflow

**Important**: The workflow filename must match exactly (`publish.yml`), and if you specified an environment name, it must match the `environment:` field in the GitHub Actions workflow.

---

## Part 2: GitHub Actions Workflow Changes

### What Changed in `.github/workflows/publish.yml`

The workflow has been updated with the following changes:

#### 1. Added OIDC Permissions and Environment

```yaml
jobs:
  publish:
    name: Publish to npm
    runs-on: ubuntu-latest
    environment: Production # ← NEW: Match npm trusted publisher configuration
    permissions:
      id-token: write # ← NEW: Required for OIDC authentication
      contents: read # ← NEW: Required to checkout code
```

**Why**:

- `id-token: write` - Allows GitHub Actions to request OIDC tokens
- `environment: Production` - Matches the environment name configured on npmjs.com
- `contents: read` - Explicit permission to read repository code

#### 2. Removed NPM_TOKEN Secret

```yaml
# OLD (removed):
env:
  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

# NEW:
npm publish --tag $TAG --provenance
# OIDC authentication - no token needed!
# npm will automatically use OIDC when NODE_AUTH_TOKEN is not provided
```

**Why**:

- npm CLI automatically detects OIDC availability when no token is provided
- `--provenance` flag adds cryptographic attestation proving the package came from this workflow

---

## Part 3: GitHub Environment Setup (Optional)

If you used `environment: Production` in the workflow, you should configure environment protection rules:

### Step 1: Create Production Environment

1. Go to repository Settings → Environments
2. Click "New environment"
3. Name it **exactly** `Production` (case-sensitive)

### Step 2: Configure Protection Rules (Recommended)

**Recommended settings**:

- ✅ **Required reviewers**: Add yourself or trusted maintainers
- ✅ **Deployment branches**: Only allow `main` branch
- ⬜ **Wait timer**: Not needed for npm publishing

**Why use environment protection**:

- Adds extra approval gate before publishing to npm
- Prevents accidental publishes from feature branches
- Provides audit log of who approved each publish

### Step 3: Save Environment

Click "Configure environment" to save the settings.

---

## Part 4: Migration and Testing

### Pre-Migration Checklist

- [ ] npm package exists and you have publish access
- [ ] Trusted publisher configured on npmjs.com
- [ ] Workflow updated with OIDC permissions
- [ ] Environment created in GitHub (if using environment protection)
- [ ] `NPM_TOKEN` secret still exists (for rollback if needed)

### Testing the New Workflow

#### Option A: Test with Manual Workflow Dispatch

1. Go to Actions → Publish to npm → Run workflow
2. Select branch: `main`
3. Choose dist-tag: `next` (safer for testing)
4. Click "Run workflow"

**Expected behavior**:

- Workflow runs successfully
- npm CLI authenticates via OIDC automatically
- Package publishes with `next` tag
- No errors about missing NPM_TOKEN

#### Option B: Test with GitHub Release (Recommended)

1. Create a prerelease version:

   ```bash
   npm version prerelease --preid=beta
   # Example: 1.4.0 → 1.4.1-beta.0
   ```

2. Create GitHub release:

   ```bash
   git push --tags
   # Then create release from tag in GitHub UI
   ```

3. Workflow triggers automatically
4. Publishes with `next` tag (prerelease detected)

### Verify Published Package

After successful publish:

1. **Check npm registry**:

   ```bash
   npm view @littlebearapps/git-pr-manager
   ```

2. **Verify provenance** (OIDC bonus feature):

   ```bash
   npm view @littlebearapps/git-pr-manager --json | jq '.publishConfig'
   ```

3. **Check package page**: Visit https://www.npmjs.com/package/@littlebearapps/git-pr-manager
   - Look for "Provenance" badge (appears for OIDC-published packages)

---

## Part 5: Cleanup (After Successful Migration)

### Optional: Remove NPM_TOKEN Secret

Once you've confirmed OIDC publishing works:

1. Go to repository Settings → Secrets and variables → Actions
2. Find `NPM_TOKEN` secret
3. Click "Remove"

**Note**: Keep the token for a few releases to ensure stability, then remove it.

---

## Troubleshooting

### Error: "Unable to authenticate with npm registry"

**Cause**: Trusted publisher not configured correctly on npmjs.com

**Fix**:

1. Verify configuration on npmjs.com matches workflow exactly:
   - Organization: `littlebearapps`
   - Repository: `git-pr-manager`
   - Workflow: `publish.yml`
   - Environment: `Production` (if used)
2. Check for typos in any field

### Error: "Missing required permission: id-token: write"

**Cause**: Workflow doesn't have OIDC permissions

**Fix**: Verify `.github/workflows/publish.yml` includes:

```yaml
permissions:
  id-token: write
  contents: read
```

### Error: "Environment protection rule failed"

**Cause**: Environment configured with protection rules but approval not given

**Fix**:

1. Go to Actions → Workflow run
2. Click "Review deployments"
3. Select "Production" and click "Approve and deploy"

### Warning: "Provenance not available"

**Cause**: Publishing succeeded but provenance attestation failed (non-critical)

**Fix**: Ensure `--provenance` flag is included in `npm publish` command. This is cosmetic - publishing still works without it.

---

## Rollback Plan

If OIDC publishing causes issues, you can quickly rollback:

### Step 1: Restore NPM_TOKEN Authentication

Edit `.github/workflows/publish.yml`:

```yaml
# Remove these lines:
environment: Production
permissions:
  id-token: write
  contents: read

# Add back:
env:
  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Step 2: Remove Provenance Flag

```yaml
npm publish --tag $TAG --provenance # Remove --provenance
```

### Step 3: Commit and Push

```bash
git add .github/workflows/publish.yml
git commit -m "Rollback to token-based npm publishing"
git push
```

---

## Security Benefits Explained

### Before (Token-Based):

- ❌ Long-lived npm token stored in GitHub secrets
- ❌ Token has unlimited validity until manually rotated
- ❌ If token leaked, attacker can publish to package indefinitely
- ❌ No audit trail connecting publishes to specific workflows
- ❌ Manual token rotation required periodically

### After (OIDC):

- ✅ Short-lived tokens generated per workflow run (~15 min validity)
- ✅ Tokens automatically expire after use
- ✅ If token leaked, very limited time window for abuse
- ✅ Cryptographic proof linking package to workflow
- ✅ Zero credential management - fully automated

---

## Additional Resources

- [npm Trusted Publishers Documentation](https://docs.npmjs.com/trusted-publishers/)
- [GitHub Actions OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [npm Provenance Documentation](https://docs.npmjs.com/generating-provenance-statements)

---

## Summary

You've successfully migrated from token-based authentication to OIDC trusted publishing! This provides:

- 🔒 **Better security** - No long-lived tokens
- 🤖 **Less maintenance** - Zero credential rotation
- 📝 **Better audit trail** - Cryptographic provenance
- ✅ **Same functionality** - Publishing works exactly the same

**Next steps**:

1. Complete trusted publisher configuration on npmjs.com
2. Test with a prerelease or manual workflow dispatch
3. Monitor first few publishes for issues
4. Remove NPM_TOKEN secret after confirming stability

---

**Maintained by**: Little Bear Apps
**Last Updated**: 2025-11-16
