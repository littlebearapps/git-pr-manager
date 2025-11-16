#!/bin/bash

# verify.sh - Pre-ship verification script for git-pr-manager
# Runs lint, typecheck, tests, and build to ensure quality before shipping

set -e  # Exit on any error

echo "Running verification checks..."

# 1. Lint
echo "→ Running ESLint..."
npm run lint

# 2. TypeScript type checking
echo "→ Running TypeScript type check..."
npx tsc --noEmit

# 3. Run tests
echo "→ Running tests..."
npm test

# 4. Build
echo "→ Building project..."
npm run build

echo "✅ All verification checks passed!"
exit 0
