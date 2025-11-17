#!/bin/bash
# Verify npm package publication after semantic-release
# Based on CKEditor's solution: https://github.com/ckeditor/ckeditor5/issues/16625
#
# This script checks if a package was successfully published even if
# semantic-release reported an error (common with E409 packument errors)

set -e

PACKAGE_NAME="$1"
MAX_WAIT=60  # Maximum seconds to wait for package to appear
CHECK_INTERVAL=5  # Seconds between checks

if [ -z "$PACKAGE_NAME" ]; then
  echo "Usage: $0 <package-name>"
  exit 1
fi

echo "🔍 Verifying publication of ${PACKAGE_NAME}..."

# Get the version that should have been published from package.json
EXPECTED_VERSION=$(node -p "require('./package.json').version")

echo "📦 Expected version: ${EXPECTED_VERSION}"

# Check if package exists in registry
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
  if npm show "${PACKAGE_NAME}@${EXPECTED_VERSION}" version >/dev/null 2>&1; then
    PUBLISHED_VERSION=$(npm show "${PACKAGE_NAME}@${EXPECTED_VERSION}" version)
    echo "✅ Package ${PACKAGE_NAME}@${PUBLISHED_VERSION} found in registry"
    echo "✅ Publication verified successfully"
    exit 0
  fi

  echo "⏳ Package not yet visible in registry, waiting ${CHECK_INTERVAL}s... (${ELAPSED}/${MAX_WAIT}s elapsed)"
  sleep $CHECK_INTERVAL
  ELAPSED=$((ELAPSED + CHECK_INTERVAL))
done

echo "❌ Package ${PACKAGE_NAME}@${EXPECTED_VERSION} not found in registry after ${MAX_WAIT}s"
exit 1
