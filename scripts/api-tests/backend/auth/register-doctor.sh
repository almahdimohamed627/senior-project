#!/bin/bash
# Doctor Registration Test

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../" && pwd)"
source "$PROJECT_ROOT/scripts/api-tests/utils/test-config.sh"
source "$PROJECT_ROOT/scripts/api-tests/utils/auth-helper.sh"
source "$PROJECT_ROOT/scripts/api-tests/utils/cleanup-helper.sh"
source "$PROJECT_ROOT/scripts/api-tests/utils/response-validator.sh"

TEST_NAME="register-doctor"
START_TIME=$(date +%s)

echo "Testing doctor registration..."

# Register doctor
REGISTER_RESPONSE=$(register_doctor "$TEST_DOCTOR_EMAIL")
if validate_registration "$REGISTER_RESPONSE" "doctor"; then
    USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.fusionUserId')

    # Cleanup
    TOKEN=$(login_user "$TEST_DOCTOR_EMAIL")
    cleanup_created_data "$TOKEN"

    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    RESULT_JSON=$(generate_test_result "$TEST_NAME" "passed" "$DURATION" "{\"userId\":\"$USER_ID\"}")
    log_test_result "$RESULT_JSON"
    echo "$RESULT_JSON"
    echo "✅ Doctor registration test passed"
    exit 0
else
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    RESULT_JSON=$(generate_test_result "$TEST_NAME" "failed" "$DURATION" "{\"error\":\"Registration failed\"}")
    log_test_result "$RESULT_JSON"
    echo "$RESULT_JSON"
    echo "❌ Doctor registration test failed"
    exit 1
fi