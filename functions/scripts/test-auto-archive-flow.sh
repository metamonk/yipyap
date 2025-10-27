#!/bin/bash

###############################################################################
# Auto-Archive Full Flow Test Script (Story 6.4)
#
# Runs the complete auto-archive test flow:
# 1. Setup test user
# 2. Seed test messages
# 3. Trigger daily workflow (manual)
# 4. Verify results
# 5. Cleanup
#
# Usage:
#   chmod +x functions/scripts/test-auto-archive-flow.sh
#   ./functions/scripts/test-auto-archive-flow.sh
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check for service account key
if [ ! -f "serviceAccountKey.json" ]; then
    echo -e "${RED}❌ Error: serviceAccountKey.json not found${NC}"
    echo "Please download your Firebase service account key and save it as serviceAccountKey.json"
    exit 1
fi

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}  Auto-Archive Flow Test (Story 6.4)${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}\n"

# Step 1: Setup
echo -e "${YELLOW}Step 1/5: Setting up test user...${NC}"
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json npx ts-node functions/scripts/setupTestUser.ts
echo ""

# Step 2: Seed
echo -e "${YELLOW}Step 2/5: Seeding test messages...${NC}"
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json npx ts-node functions/scripts/seedAutoArchiveMessages.ts
echo ""

# Step 3: Trigger (Note: This step requires the workflow to be integrated)
echo -e "${YELLOW}Step 3/5: Triggering daily workflow...${NC}"
echo -e "${BLUE}⚠️  NOTE: You need to manually trigger the workflow via:${NC}"
echo -e "${BLUE}   1. Firebase Functions Shell: firebase functions:shell${NC}"
echo -e "${BLUE}   2. Call: dailyAgentWorkflow({ userId: 'test-creator-123' })${NC}"
echo -e "${BLUE}   3. OR deploy and trigger via HTTP/scheduled job${NC}\n"
echo -e "${BLUE}Press Enter when workflow has completed...${NC}"
read

# Step 4: Verify
echo -e "${YELLOW}Step 4/5: Verifying results...${NC}"
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json npx ts-node functions/scripts/verifyAutoArchive.ts
echo ""

# Step 5: Ask about cleanup
echo -e "${YELLOW}Step 5/5: Cleanup${NC}"
echo -e "Do you want to cleanup test data? (y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json npx ts-node functions/scripts/cleanupTestData.ts
else
    echo -e "${BLUE}ℹ️  Test data preserved. Run cleanup manually:${NC}"
    echo -e "${BLUE}   GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json npx ts-node functions/scripts/cleanupTestData.ts${NC}"
fi

echo ""
echo -e "${GREEN}✅ Auto-archive flow test complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}\n"
