# Verification Command Issue

**Date**: 2025-11-15
**Status**: ✅ **RESOLVED**
**Resolution Date**: 2025-11-15
**Fix Version**: v1.4.0

## ✅ Resolution

The issue has been **RESOLVED** by modifying VerifyService to use JSON mode for subprocess calls.

**Root Cause**: Ora spinner conflicts between parent process (ship) and subprocess (verify).

**Solution**: Changed VerifyService.ts line 81 from `'gwm verify'` to `'gwm verify --json'`, which:
- Disables spinners in the subprocess
- Outputs machine-readable JSON instead
- Eliminates stdio conflicts with parent spinner

**Testing**: Verified with test script simulating active spinner + subprocess - works perfectly.

---

## Summary (Original Issue)

The `gwm verify` command worked perfectly when run standalone, but failed with exit code 1 when called via `VerifyService.executeScript()` from within `gwm ship`.

## Evidence

### ✅ Works Standalone
```bash
$ gwm verify
▸ Running Verification Checks
────────────────────────────────────────────────────────────────────────────────
- Running Lint (ESLint)...
✔ Lint (ESLint) passed (2.6s)
- Running Type Check (TypeScript)...
✔ Type Check (TypeScript) passed (2.4s)
- Running Tests (Jest)...
✔ Tests (Jest) passed (12.5s)
- Running Build (TypeScript)...
✔ Build (TypeScript) passed (2.9s)

✅ All verification checks passed! (20.3s)
Exit code: 0
```

### ✅ All Tests Pass
```bash
$ npm test
Test Suites: 31 passed, 31 total
Tests:       678 passed, 678 total
```

### ✅ VerifyService Works Directly
```javascript
const verifyService = new VerifyService();
const result = await verifyService.runChecks();
// Result: { success: true, errors: [], duration: 21825 }
```

### ❌ Fails When Called from gwm ship

**OLD ERROR (not descriptive):**
```bash
$ gwm ship
- Running verification checks...
✖ Verification checks failed
❌ Verification errors:
  Verification failed with exit code 1
```

**NEW ERROR (improved in v1.4.0):**
```bash
$ gwm ship
- Running verification checks...
✖ Verification checks failed
❌ Verification errors:
  Command failed: gwm verify
  Exit code: 1

  Unable to parse specific errors. Raw output:
    (no output captured)

  Debug info:
    stdout length: 0 chars
    stderr length: 0 chars

  This may indicate a subprocess stdio conflict.
  Try running the command directly: gwm verify
```

The improved error message now shows:
- **What command failed** - makes it clear which command had the issue
- **Exit code** - provides the actual return code
- **Debug information** - shows if output was captured or not
- **Helpful suggestion** - points user to try the command directly
- **Root cause hint** - suggests it might be a subprocess stdio conflict

**When actual errors exist** (lint/test failures), the output is even more helpful:
```bash
❌ Verification errors:
  Command failed: npm test
  Exit code: 1

  Test failures:
  FAIL src/utils/example.test.ts
  ● Example test suite › should do something
    Expected 5 to equal 6

  Linting errors:
  src/services/Example.ts:42:15 - error TS2345: Argument of type 'string' not assignable
```

## Root Cause Analysis

The issue appears to be related to **subprocess environment/context** when gwm calls itself:

1. **VerifyService discovers**: `gwm verify` (correct)
2. **VerifyService executes**: `child_process.exec('gwm verify')`
3. **Subprocess exits with**: code 1 (incorrect)
4. **But direct execution**: exits with code 0 (correct)

Potential factors:
- Spinner output interference (ora active during subprocess)
- Environment variable differences in subprocess
- TTY/stdio handling differences
- Output buffering timing issues

## ~~Workaround~~ (No Longer Needed)

~~Use `--skip-verify` flag when running `gwm ship`:~~

```bash
# ✅ NOW WORKS: No workaround needed!
$ gwm ship

# Verification runs successfully as subprocess
```

The `--skip-verify` flag is still available if you want to skip verification for other reasons.

## Impact (Original)

**Low** - This was a testing/development quirk, not a production issue:
- ✅ `gwm verify` command worked perfectly for developers
- ✅ All tests passed (678/678)
- ✅ Documentation is complete
- ⚠️  Only failed when gwm called gwm (subprocess inception)

## ~~Recommendation~~ (Issue Resolved)

~~This is **not blocking** for release because:~~
~~1. The verify command itself is fully functional~~
~~2. Developers can run `gwm verify` separately before `gwm ship --skip-verify`~~
~~3. All tests pass and code quality is verified~~
~~4. This appears to be an environmental quirk, not a code bug~~

**✅ UPDATE**: Issue has been resolved. `gwm ship` now works correctly with verification enabled.

## Implementation Details

**Files Changed**:
1. **src/services/VerifyService.ts** (line 81)
   - Changed: `return 'gwm verify';`
   - To: `return 'gwm verify --json';`
   - Also improved error messages with command context, exit codes, and debug info

2. **src/utils/logger.ts** (lines 122-127)
   - Added `isJsonMode()` method for checking JSON mode

3. **src/commands/verify.ts** (lines 41-42, 50, 59, 72, 81, 92)
   - Changed from checking `options.json` to using `logger.isJsonMode()`
   - Ensures global `--json` flag is respected

**Testing**:
- Created `test-subprocess-issue.ts` to simulate the issue
- Verified fix works with active spinner + subprocess
- All 678 tests still pass

## Related Files

- `src/commands/verify.ts` - Verify command implementation (✅ works)
- `src/services/VerifyService.ts` - Service that calls verify (⚠️ subprocess issue)
- `src/commands/ship.ts` - Ship command that uses VerifyService (⚠️ triggers issue)
