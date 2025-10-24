#!/bin/bash

# Test script for Vercel Edge Function API endpoint
# Usage: ./scripts/test-api-endpoint.sh

set -e

API_URL="https://api.yipyap.wtf/api/categorize-message"

echo "🧪 Testing Vercel Edge Function API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Check DNS resolution
echo "1️⃣  Checking DNS resolution for api.yipyap.wtf..."
if nslookup api.yipyap.wtf > /dev/null 2>&1; then
    echo "   ✅ DNS resolved successfully"
    echo ""
else
    echo "   ❌ DNS not resolved yet"
    echo "   ⏳ Please wait for DNS propagation (5 min - 48 hours)"
    echo "   💡 Check status at: https://dnschecker.org/#A/api.yipyap.wtf"
    echo ""
    exit 1
fi

# Step 2: Check HTTPS connectivity
echo "2️⃣  Checking HTTPS connectivity..."
if curl -s -I "$API_URL" > /dev/null 2>&1; then
    echo "   ✅ HTTPS connection successful"
    echo ""
else
    echo "   ⚠️  HTTPS connection failed (might be normal during SSL provisioning)"
    echo ""
fi

# Step 3: Test the API endpoint
echo "3️⃣  Testing /api/categorize-message endpoint..."
echo ""

# Test 1: Business Opportunity Message
echo "   Test 1: Business Opportunity Message"
echo "   ────────────────────────────────────"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-user-token" \
  -d '{
    "messageId": "test-001",
    "messageText": "Hey! Love your content, would you be interested in a brand partnership?",
    "conversationId": "conv-001",
    "senderId": "user-001"
  }' 2>&1)

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS:")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✅ Status: $HTTP_STATUS OK"
    echo "   Response:"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo ""
else
    echo "   ❌ Status: $HTTP_STATUS"
    echo "   Response: $BODY"
    echo ""
fi

# Test 2: Fan Engagement Message
echo "   Test 2: Fan Engagement Message"
echo "   ────────────────────────────────"
RESPONSE2=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-user-token" \
  -d '{
    "messageId": "test-002",
    "messageText": "I love your videos! You inspired me to start my own channel!",
    "conversationId": "conv-002",
    "senderId": "user-002"
  }' 2>&1)

HTTP_STATUS2=$(echo "$RESPONSE2" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY2=$(echo "$RESPONSE2" | grep -v "HTTP_STATUS:")

if [ "$HTTP_STATUS2" = "200" ]; then
    echo "   ✅ Status: $HTTP_STATUS2 OK"
    echo "   Response:"
    echo "$BODY2" | python3 -m json.tool 2>/dev/null || echo "$BODY2"
    echo ""
else
    echo "   ❌ Status: $HTTP_STATUS2"
    echo "   Response: $BODY2"
    echo ""
fi

# Test 3: Spam Message
echo "   Test 3: Spam Detection"
echo "   ────────────────────────"
RESPONSE3=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-user-token" \
  -d '{
    "messageId": "test-003",
    "messageText": "Click here to win $1000!!! Limited time offer!",
    "conversationId": "conv-003",
    "senderId": "user-003"
  }' 2>&1)

HTTP_STATUS3=$(echo "$RESPONSE3" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY3=$(echo "$RESPONSE3" | grep -v "HTTP_STATUS:")

if [ "$HTTP_STATUS3" = "200" ]; then
    echo "   ✅ Status: $HTTP_STATUS3 OK"
    echo "   Response:"
    echo "$BODY3" | python3 -m json.tool 2>/dev/null || echo "$BODY3"
    echo ""
else
    echo "   ❌ Status: $HTTP_STATUS3"
    echo "   Response: $BODY3"
    echo ""
fi

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ API Testing Complete"
echo ""
echo "📊 Expected Categories:"
echo "   • Test 1: business_opportunity"
echo "   • Test 2: fan_engagement"
echo "   • Test 3: spam"
echo ""
echo "💡 Next Steps:"
echo "   1. Verify categorization accuracy"
echo "   2. Check response times (should be < 500ms)"
echo "   3. Test from your React Native app"
echo "   4. Monitor OpenAI usage at: https://platform.openai.com/usage"
echo ""
