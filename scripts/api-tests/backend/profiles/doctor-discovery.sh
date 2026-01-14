#!/bin/bash
# Doctor Discovery Test

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../" && pwd)"
source "$PROJECT_ROOT/scripts/api-tests/utils/test-config.sh"
source "$PROJECT_ROOT/scripts/api-tests/utils/auth-helper.sh"
source "$PROJECT_ROOT/scripts/api-tests/utils/cleanup-helper.sh"
source "$PROJECT_ROOT/scripts/api-tests/utils/response-validator.sh"

TEST_NAME="doctor-discovery"
START_TIME=$(date +%s)

echo "Testing doctor discovery..."

# Generate unique email for this test
TEST_EMAIL=$(generate_patient_email)

# Register test patient for authentication
REGISTER_RESPONSE=$(register_patient "$TEST_EMAIL")
USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.fusionUserId')

if [ "$USER_ID" = "null" ] || [ -z "$USER_ID" ]; then
    echo "❌ Could not create test user"
    exit 1
fi

# Login (use token from registration if available)
REGISTER_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.access_token')
if [ "$REGISTER_TOKEN" != "null" ] && [ -n "$REGISTER_TOKEN" ]; then
    TOKEN="$REGISTER_TOKEN"
    echo "✅ Using token from registration"
else
    TOKEN=$(login_user "$TEST_EMAIL")
    if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
        echo "❌ Login failed"
        cleanup_created_data "$TOKEN"
        exit 1
    fi
fi

# Test doctor discovery
echo "Testing doctor profiles..."
DOCTORS_RESPONSE=$(curl -s --max-time $REQUEST_TIMEOUT -X GET "$BACKEND_URL/profile/doctorsProfiles?page=1&limit=5" \
    -H "Authorization: Bearer $TOKEN")

if ! validate_fields "$DOCTORS_RESPONSE" "doctors"; then
    echo "❌ Doctor discovery failed"
    cleanup_created_data "$TOKEN"
    exit 1
fi

DOCTOR_COUNT=$(echo "$DOCTORS_RESPONSE" | jq -r '.doctors | length')
echo "✅ Found $DOCTOR_COUNT doctors"

# Test doctor profile by ID
if [ $DOCTOR_COUNT -gt 0 ]; then
    FIRST_DOCTOR_ID=$(echo "$DOCTORS_RESPONSE" | jq -r '.doctors[0].fusionAuthId')
    echo "Testing individual doctor profile..."
    PROFILE_RESPONSE=$(curl -s --max-time $REQUEST_TIMEOUT -X GET "$BACKEND_URL/profile/$FIRST_DOCTOR_ID" \
        -H "Authorization: Bearer $TOKEN")

    if ! validate_fields "$PROFILE_RESPONSE" "profile"; then
        echo "❌ Doctor profile fetch failed"
        cleanup_created_data "$TOKEN"
        exit 1
    fi
    echo "✅ Doctor profile retrieved successfully"
fi

# Cleanup
cleanup_created_data "$TOKEN"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

RESULT_JSON=$(generate_test_result "$TEST_NAME" "passed" "$DURATION" "{\"doctorsFound\":$DOCTOR_COUNT}")
log_test_result "$RESULT_JSON"
echo "$RESULT_JSON"
echo "✅ Doctor discovery test passed"