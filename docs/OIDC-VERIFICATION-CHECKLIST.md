# OIDC Publishing Verification Checklist

**Status**: Testing v1.4.3 publication with OIDC
**Last Error**: `npm error code ENEEDAUTH` (Run 19403947509)
**Date**: 2025-11-16

---

## Current Configuration Summary

### GitHub Actions Workflow
✅ **File**: `.github/workflows/publish.yml`
✅ **Permissions**: `id-token: write`, `contents: read`
✅ **Environment**: NONE (blank)
✅ **Workflow filename**: `publish.yml`
✅ **Repository**: `littlebearapps/git-pr-manager`
✅ **NODE_AUTH_TOKEN**: Removed (allows OIDC)
✅ **Publish command**: `npm publish --tag $TAG --provenance --access public`

**Comment in workflow (line 21)**:
```yaml
# No environment specified - matches npm trusted publisher config (blank environment)
```

This indicates the intended configuration is **no environment**.

---

## Required: npm Trusted Publisher Configuration

**⚠️ ACTION NEEDED**: Verify the trusted publisher is configured on npmjs.com

### Step 1: Check if Trusted Publisher Exists

1. Go to: https://www.npmjs.com/package/@littlebearapps/git-pr-manager
2. Click the "Settings" tab
3. Scroll to "Publishing access" section
4. Look for "Trusted publishers" list

**Question**: Is there a GitHub Actions trusted publisher configured?
- ❓ **If NO** → Go to Step 2 (Add trusted publisher)
- ❓ **If YES** → Go to Step 3 (Verify configuration)

---

### Step 2: Add Trusted Publisher (If Not Configured)

**This is the most likely fix for the ENEEDAUTH error**

Click "Add trusted publisher" and enter these **exact** values:

| Field | Value | Notes |
|-------|-------|-------|
| **Provider** | `GitHub Actions` | Select from dropdown |
| **Organization/User** | `littlebearapps` | Must match exactly |
| **Repository** | `git-pr-manager` | Must match exactly |
| **Workflow filename** | `publish.yml` | Must match exactly (case-sensitive) |
| **Environment name** | *(leave blank)* | **CRITICAL: Leave this blank** |

**Why blank environment?**
- The workflow has NO `environment:` field configured
- npm requires exact match between workflow and trusted publisher
- Blank on both sides = valid configuration

Click "Add publisher" to save.

---

### Step 3: Verify Existing Configuration (If Already Configured)

If a trusted publisher already exists, verify **ALL** fields match:

| Field | Expected Value | Check |
|-------|---------------|-------|
| Provider | GitHub Actions | ☐ |
| Organization/User | `littlebearapps` | ☐ |
| Repository | `git-pr-manager` | ☐ |
| Workflow filename | `publish.yml` | ☐ |
| Environment name | *(blank/none)* | ☐ |

**Common mistakes**:
- ❌ Environment name set to "Production" (should be blank)
- ❌ Repository name includes organization (should be just `git-pr-manager`)
- ❌ Workflow filename has `.github/workflows/` prefix (should be just `publish.yml`)
- ❌ Case mismatch in any field

If ANY field doesn't match, **click "Remove"** and add a new trusted publisher with correct values.

---

## Alternative Configuration Option

If you prefer to use a **GitHub Environment** for additional protection:

### Option A: Add Environment to Workflow (Recommended by npm)

**Pros**:
- Additional approval gate before publishing
- Deployment protection rules
- Better audit trail

**Changes needed**:

1. **Edit `.github/workflows/publish.yml` line 21**:
   ```yaml
   # Before:
   # No environment specified - matches npm trusted publisher config (blank environment)

   # After:
   environment: Production
   ```

2. **Create GitHub Environment** (Settings → Environments → New environment):
   - Name: **exactly** `Production` (case-sensitive)
   - Protection rules (optional):
     - Required reviewers: Add yourself
     - Deployment branches: Only `main`

3. **Update npm trusted publisher**:
   - Remove existing publisher (if exists)
   - Add new publisher with:
     - Environment name: `Production`
     - All other fields same as above

4. **Test workflow**: Next run will require environment approval

---

## Testing After Configuration

Once the trusted publisher is configured on npmjs.com:

### Test 1: Manual Workflow Dispatch

```bash
# Trigger workflow manually
gh workflow run publish.yml -f tag=next

# Watch the run
gh run watch
```

**Expected result**:
- ✅ Workflow completes successfully
- ✅ No ENEEDAUTH error
- ✅ Package published to npm with `next` tag
- ✅ Provenance badge appears on npm package page

### Test 2: Check Published Package

```bash
npm view @littlebearapps/git-pr-manager@next

# Check for provenance
npm view @littlebearapps/git-pr-manager@next --json | jq '.dist.integrity'
```

---

## Current Workflow Runs

### Run 19403947509 (FAILED - Current)
- **Error**: `npm error code ENEEDAUTH`
- **Error message**: "This command requires you to be logged in to https://registry.npmjs.org/"
- **Root cause**: Trusted publisher likely not configured on npmjs.com
- **Fix**: Complete Step 2 above

### Previous Runs (All Fixed)
- ✅ Run 19402982972: Fixed postinstall script issue
- ✅ Run 19403014336: Fixed CI-sensitive test failures
- ✅ Run 19403040124: Fixed prepublishOnly hook
- ✅ Run 19403085998: Fixed missing --access public flag
- ✅ Run 19403922855: Fixed NODE_AUTH_TOKEN preventing OIDC

---

## Next Steps

1. **⚠️ REQUIRED**: Configure trusted publisher on npmjs.com (Step 2 above)
2. **Test**: Trigger workflow with `gh workflow run publish.yml -f tag=next`
3. **Verify**: Check that package appears on npm with `next` tag
4. **Confirm**: Look for provenance badge on npm package page
5. **Update**: Mark this checklist complete when publishing succeeds

---

## Troubleshooting

### Still Getting ENEEDAUTH After Configuration?

**Check**:
1. Wait 5 minutes after adding trusted publisher (npm propagation delay)
2. Verify exact match of ALL fields (case-sensitive)
3. Try removing and re-adding the trusted publisher
4. Check GitHub Actions logs for OIDC token request (should see "Requesting token" in logs)

### Getting "Environment protection rules failed"?

**If you added `environment: Production` to workflow**:
- Go to Actions → Your workflow run
- Click "Review deployments"
- Select "Production" and click "Approve and deploy"

---

## Documentation References

- **Setup Guide**: `docs/NPM-TRUSTED-PUBLISHER-SETUP.md` (full instructions)
- **Workflow File**: `.github/workflows/publish.yml`
- **npm Docs**: https://docs.npmjs.com/trusted-publishers/
- **GitHub OIDC Docs**: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect

---

**Last Updated**: 2025-11-16
**Next Action**: Configure npm trusted publisher on npmjs.com
