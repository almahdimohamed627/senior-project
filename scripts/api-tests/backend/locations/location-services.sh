#!/bin/bash
# Location Services Test

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../" && pwd)"
source "$PROJECT_ROOT/scripts/api-tests/utils/test-config.sh"
source "$PROJECT_ROOT/scripts/api-tests/utils/auth-helper.sh"
source "$PROJECT_ROOT/scripts/api-tests/utils/cleanup-helper.sh"
source "$PROJECT_ROOT/scripts/api-tests/utils/response-validator.sh"

TEST_NAME="location-services"
START_TIME=$(date +%s)

echo "Testing location services..."

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

# Test cities endpoint
echo "Testing cities retrieval..."
CITIES_RESPONSE=$(curl -s --max-time $REQUEST_TIMEOUT -X GET "$BACKEND_URL/locations/return-cities" \
    -H "Authorization: Bearer $TOKEN")

if ! validate_fields "$CITIES_RESPONSE" "0"; then
    echo "❌ Cities retrieval failed"
    cleanup_created_data "$TOKEN"
    exit 1
fi

CITY_COUNT=$(echo "$CITIES_RESPONSE" | jq -r 'length')
echo "✅ Retrieved $CITY_COUNT cities"

# Verify city structure
FIRST_CITY=$(echo "$CITIES_RESPONSE" | jq -r '.[0]')
if ! validate_fields "$FIRST_CITY" "id" "nameA" "nameE"; then
    echo "❌ City structure validation failed"
    cleanup_created_data "$TOKEN"
    exit 1
fi
echo "✅ City data structure is valid"

# Cleanup
cleanup_created_data "$TOKEN"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

RESULT_JSON=$(generate_test_result "$TEST_NAME" "passed" "$DURATION" "{\"citiesFound\":$CITY_COUNT}")
log_test_result "$RESULT_JSON"
echo "$RESULT_JSON"
echo "✅ Location services test passed"