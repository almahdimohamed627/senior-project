#!/bin/bash
# AI Agent Service Tests

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/test-config.sh"
source "$SCRIPT_DIR/../utils/response-validator.sh"

TEST_NAME="ai-agent-tests"
START_TIME=$(date +%s)

echo "Testing AI Agent services..."

# Test root endpoint
echo "Testing AI Agent root..."
ROOT_RESPONSE=$(curl -s --max-time $REQUEST_TIMEOUT -X GET "$AI_AGENT_URL/")
if echo "$ROOT_RESPONSE" | grep -q "Dental RAG Assistant"; then
    echo "✅ AI Agent root accessible"
else
    echo "❌ AI Agent root failed"
    exit 1
fi

# Test chat endpoint
echo "Testing AI Agent chat..."
CHAT_RESPONSE=$(curl -s --max-time $REQUEST_TIMEOUT -X POST "$AI_AGENT_URL/api/chat" \
    -H "Content-Type: application/json" \
    -d '{"message":"I have a toothache","age":30}')

if ! echo "$CHAT_RESPONSE" | jq -e '.session_id' > /dev/null 2>&1; then
    echo "❌ AI Agent chat failed - no session_id"
    exit 1
fi

SESSION_ID=$(echo "$CHAT_RESPONSE" | jq -r '.session_id')
STATE=$(echo "$CHAT_RESPONSE" | jq -r '.state')
ANSWER=$(echo "$CHAT_RESPONSE" | jq -r '.answer')

echo "✅ AI chat successful - Session: $SESSION_ID, State: $STATE"


if ! echo "$CHAT_RESPONSE" | jq -e '.triage' > /dev/null 2>&1; then
    echo "❌ AI response missing triage field"
    exit 1
fi

echo "✅ AI response structure is valid"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Simple text output - no complex JSON serialization
echo "Test: $TEST_NAME | Status: passed | Duration: ${DURATION}s | Session: $SESSION_ID | State: $STATE"
echo "✅ AI Agent tests passed"
