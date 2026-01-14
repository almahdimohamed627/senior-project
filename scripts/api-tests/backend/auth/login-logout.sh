#!/bin/bash
# Authentication Flow Test (Login/Logout)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../" && pwd)"
source "$PROJECT_ROOT/scripts/api-tests/utils/test-config.sh"
source "$PROJECT_ROOT/scripts/api-tests/utils/auth-helper.sh"
source "$PROJECT_ROOT/scripts/api-tests/utils/cleanup-helper.sh"
source "$PROJECT_ROOT/scripts/api-tests/utils/response-validator.sh"

TEST_NAME="login-logout"
START_TIME=$(date +%s)

echo "Testing authentication flow..."

# Generate unique email for this test
TEST_EMAIL=$(generate_patient_email)

# First ensure test user exists
REGISTER_RESPONSE=$(register_patient "$TEST_EMAIL")
USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.fusionUserId')

if [ "$USER_ID" = "null" ] || [ -z "$USER_ID" ]; then
    echo "❌ Could not create test user"
    exit 1
fi

# Test login (use token from registration if available)
echo "Testing login..."
REGISTER_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.access_token')
if [ "$REGISTER_TOKEN" != "null" ] && [ -n "$REGISTER_TOKEN" ]; then
    TOKEN="$REGISTER_TOKEN"
    echo "✅ Using token from registration"
else
    TOKEN=$(login_user "$TEST_EMAIL")
    if ! validate_login "{\"access_token\":\"$TOKEN\"}"; then
        cleanup_created_data "$TOKEN"
        exit 1
    fi
fi

# Test token validation (introspect)
echo "Testing token introspection..."
INTROSPECT_RESPONSE=$(curl -s --max-time $REQUEST_TIMEOUT -X POST $BACKEND_URL/auth/introspect \
    -H "Content-Type: application/json" \
    -d "{\"token\":\"$TOKEN\"}")

if ! validate_fields "$INTROSPECT_RESPONSE" "active"; then
    echo "❌ Token introspection failed"
    cleanup_created_data "$TOKEN"
    exit 1
fi
echo "✅ Token introspection successful"

# Test logout
echo "Testing logout..."
LOGOUT_RESPONSE=$(logout_user "$USER_ID")
echo "✅ Logout completed"

# Cleanup
cleanup_created_data "$TOKEN"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

RESULT_JSON=$(generate_test_result "$TEST_NAME" "passed" "$DURATION" "{\"userId\":\"$USER_ID\"}")
log_test_result "$RESULT_JSON"
echo "$RESULT_JSON"
echo "✅ Authentication flow test passed"