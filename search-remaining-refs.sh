#!/bin/bash
# Search script to find remaining gwm/git-workflow-manager references
# Usage: ./search-remaining-refs.sh

set -e

echo "========================================="
echo "Searching for remaining gwm references"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Directories to exclude
EXCLUDE_DIRS=(
  "node_modules"
  ".git"
  "dist"
  "coverage"
  ".next"
  ".cache"
  "build"
)

# Build exclude pattern for grep
EXCLUDE_PATTERN=""
for dir in "${EXCLUDE_DIRS[@]}"; do
  EXCLUDE_PATTERN="${EXCLUDE_PATTERN} --exclude-dir=${dir}"
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Searching for 'gwm' (case-insensitive)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

GWM_COUNT=$(grep -ri "gwm" . ${EXCLUDE_PATTERN} \
  --exclude="*.log" \
  --exclude="package-lock.json" \
  --exclude="search-remaining-refs.sh" \
  | grep -v "gwm → gpm" \
  | grep -v "gwm/git-workflow-manager to gpm/git-pr-manager" \
  | grep -v "rename.*gwm.*gpm" \
  | wc -l | tr -d ' ')

if [ "$GWM_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ No 'gwm' references found!${NC}"
else
  echo -e "${RED}⚠️  Found ${GWM_COUNT} 'gwm' reference(s):${NC}"
  echo ""
  grep -rin "gwm" . ${EXCLUDE_PATTERN} \
    --exclude="*.log" \
    --exclude="package-lock.json" \
    --exclude="search-remaining-refs.sh" \
    --color=always \
    | grep -v "gwm → gpm" \
    | grep -v "gwm/git-workflow-manager to gpm/git-pr-manager" \
    | grep -v "rename.*gwm.*gpm" \
    | head -50

  if [ "$GWM_COUNT" -gt 50 ]; then
    echo ""
    echo -e "${YELLOW}... and $((GWM_COUNT - 50)) more${NC}"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Searching for 'git-workflow-manager'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

GWM_FULL_COUNT=$(grep -ri "git-workflow-manager" . ${EXCLUDE_PATTERN} \
  --exclude="*.log" \
  --exclude="package-lock.json" \
  --exclude="search-remaining-refs.sh" \
  | grep -v "git-workflow-manager → git-pr-manager" \
  | grep -v "git-workflow-manager to git-pr-manager" \
  | grep -v "rename.*git-workflow-manager.*git-pr-manager" \
  | wc -l | tr -d ' ')

if [ "$GWM_FULL_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ No 'git-workflow-manager' references found!${NC}"
else
  echo -e "${RED}⚠️  Found ${GWM_FULL_COUNT} 'git-workflow-manager' reference(s):${NC}"
  echo ""
  grep -rin "git-workflow-manager" . ${EXCLUDE_PATTERN} \
    --exclude="*.log" \
    --exclude="package-lock.json" \
    --exclude="search-remaining-refs.sh" \
    --color=always \
    | grep -v "git-workflow-manager → git-pr-manager" \
    | grep -v "git-workflow-manager to git-pr-manager" \
    | grep -v "rename.*git-workflow-manager.*git-pr-manager" \
    | head -50

  if [ "$GWM_FULL_COUNT" -gt 50 ]; then
    echo ""
    echo -e "${YELLOW}... and $((GWM_FULL_COUNT - 50)) more${NC}"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Searching for '.gwm.yml'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

GWM_YML_COUNT=$(grep -ri "\.gwm\.yml" . ${EXCLUDE_PATTERN} \
  --exclude="*.log" \
  --exclude="package-lock.json" \
  --exclude="search-remaining-refs.sh" \
  | grep -v ".gwm.yml → .gpm.yml" \
  | grep -v ".gwm.yml to .gpm.yml" \
  | grep -v "rename.*.gwm.yml.*.gpm.yml" \
  | wc -l | tr -d ' ')

if [ "$GWM_YML_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ No '.gwm.yml' references found!${NC}"
else
  echo -e "${RED}⚠️  Found ${GWM_YML_COUNT} '.gwm.yml' reference(s):${NC}"
  echo ""
  grep -rin "\.gwm\.yml" . ${EXCLUDE_PATTERN} \
    --exclude="*.log" \
    --exclude="package-lock.json" \
    --exclude="search-remaining-refs.sh" \
    --color=always \
    | grep -v ".gwm.yml → .gpm.yml" \
    | grep -v ".gwm.yml to .gpm.yml" \
    | grep -v "rename.*.gwm.yml.*.gpm.yml" \
    | head -50

  if [ "$GWM_YML_COUNT" -gt 50 ]; then
    echo ""
    echo -e "${YELLOW}... and $((GWM_YML_COUNT - 50)) more${NC}"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Searching for '@littlebearapps/git-workflow-manager'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

NPM_PKG_COUNT=$(grep -ri "@littlebearapps/git-workflow-manager" . ${EXCLUDE_PATTERN} \
  --exclude="*.log" \
  --exclude="package-lock.json" \
  --exclude="search-remaining-refs.sh" \
  | wc -l | tr -d ' ')

if [ "$NPM_PKG_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ No '@littlebearapps/git-workflow-manager' references found!${NC}"
else
  echo -e "${RED}⚠️  Found ${NPM_PKG_COUNT} '@littlebearapps/git-workflow-manager' reference(s):${NC}"
  echo ""
  grep -rin "@littlebearapps/git-workflow-manager" . ${EXCLUDE_PATTERN} \
    --exclude="*.log" \
    --exclude="package-lock.json" \
    --exclude="search-remaining-refs.sh" \
    --color=always \
    | head -50

  if [ "$NPM_PKG_COUNT" -gt 50 ]; then
    echo ""
    echo -e "${YELLOW}... and $((NPM_PKG_COUNT - 50)) more${NC}"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Searching for 'isGwmHook'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

IS_GWM_HOOK_COUNT=$(grep -ri "isGwmHook" . ${EXCLUDE_PATTERN} \
  --exclude="*.log" \
  --exclude="package-lock.json" \
  --exclude="search-remaining-refs.sh" \
  | wc -l | tr -d ' ')

if [ "$IS_GWM_HOOK_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ No 'isGwmHook' references found!${NC}"
else
  echo -e "${RED}⚠️  Found ${IS_GWM_HOOK_COUNT} 'isGwmHook' reference(s):${NC}"
  echo ""
  grep -rin "isGwmHook" . ${EXCLUDE_PATTERN} \
    --exclude="*.log" \
    --exclude="package-lock.json" \
    --exclude="search-remaining-refs.sh" \
    --color=always \
    | head -50
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL_ISSUES=$((GWM_COUNT + GWM_FULL_COUNT + GWM_YML_COUNT + NPM_PKG_COUNT + IS_GWM_HOOK_COUNT))

if [ "$TOTAL_ISSUES" -eq 0 ]; then
  echo -e "${GREEN}✅ SUCCESS! No remaining references found.${NC}"
  echo -e "${GREEN}   The codebase is ready for Phase 7 (directory/repo rename).${NC}"
  exit 0
else
  echo -e "${RED}⚠️  FOUND ${TOTAL_ISSUES} TOTAL REFERENCE(S):${NC}"
  echo ""
  echo "   gwm references:                      $GWM_COUNT"
  echo "   git-workflow-manager references:     $GWM_FULL_COUNT"
  echo "   .gwm.yml references:                 $GWM_YML_COUNT"
  echo "   npm package references:              $NPM_PKG_COUNT"
  echo "   isGwmHook references:                $IS_GWM_HOOK_COUNT"
  echo ""
  echo -e "${YELLOW}   Please review and fix the references above before proceeding to Phase 7.${NC}"
  exit 1
fi
