#!/bin/bash
# Patient Complete Journey Test
# Tests full patient workflow with cleanup

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/test-config.sh"
source "$SCRIPT_DIR/../utils/auth-helper.sh"
source "$SCRIPT_DIR/../utils/cleanup-helper.sh"
source "$SCRIPT_DIR/../utils/response-validator.sh"

TEST_NAME="patient-journey-complete"
START_TIME=$(date +%s)

# Initialize cleanup tracking
init_cleanup

echo "Starting $TEST_NAME..."

# 1. Register patient
echo "1. Registering patient..."
TEST_EMAIL=$(generate_patient_email)
REGISTER_RESPONSE=$(register_patient "$TEST_EMAIL")
if ! validate_registration "$REGISTER_RESPONSE" "patient"; then
    echo "❌ Registration failed"
    exit 1
fi

USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.fusionUserId')
add_created_user "$USER_ID"
echo "✅ Patient registered: $USER_ID"

# 2. Get token (from registration or login)
echo "2. Getting token..."
REGISTER_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.access_token')
if [ "$REGISTER_TOKEN" != "null" ] && [ -n "$REGISTER_TOKEN" ]; then
    TOKEN="$REGISTER_TOKEN"
    echo "✅ Using token from registration"
else
    TOKEN=$(login_user "$TEST_EMAIL")
    if ! validate_login "{\"access_token\":\"$TOKEN\"}"; then
        echo "❌ Login failed"
        cleanup_created_data "$TOKEN"
        exit 1
    fi
fi
echo "✅ Login successful"

# 3. Browse doctors
echo "3. Browsing doctors..."
DOCTORS_RESPONSE=$(curl -s --max-time $REQUEST_TIMEOUT -X GET "$BACKEND_URL/profile/doctorsProfiles?page=1&limit=5" \
    -H "Authorization: Bearer $TOKEN")

if ! validate_fields "$DOCTORS_RESPONSE" "doctors"; then
    echo "❌ Doctor browsing failed"
    cleanup_created_data "$TOKEN"
    exit 1
fi

DOCTOR_COUNT=$(echo "$DOCTORS_RESPONSE" | jq -r '.doctors | length')
echo "✅ Found $DOCTOR_COUNT doctors"

# 4. Send consultation request
echo "4. Sending consultation request..."
FIRST_DOCTOR_ID=$(echo "$DOCTORS_RESPONSE" | jq -r '.doctors[0].fusionAuthId')
REQUEST_RESPONSE=$(curl -s --max-time $REQUEST_TIMEOUT -X POST "$BACKEND_URL/request/send" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"senderId\":\"$USER_ID\",\"receiverId\":\"$FIRST_DOCTOR_ID\"}")

REQUEST_ID=$(echo "$REQUEST_RESPONSE" | jq -r '.id')
if [ "$REQUEST_ID" = "null" ] || [ -z "$REQUEST_ID" ]; then
    echo "❌ Request creation failed"
    cleanup_created_data "$TOKEN"
    exit 1
fi

add_created_request "$REQUEST_ID"
echo "✅ Request sent: $REQUEST_ID"

# 5. Test AI diagnosis
echo "5. Testing AI diagnosis..."
CHAT_RESPONSE=$(curl -s --max-time $REQUEST_TIMEOUT -X POST "$AI_AGENT_URL/api/chat" \
    -H "Content-Type: application/json" \
    -d '{"message":"I have tooth pain","age":30}')

SESSION_ID=$(echo "$CHAT_RESPONSE" | jq -r '.session_id')
if [ "$SESSION_ID" = "null" ] || [ -z "$SESSION_ID" ]; then
    echo "❌ AI chat failed"
    cleanup_created_data "$TOKEN"
    exit 1
fi
echo "✅ AI chat successful: $SESSION_ID"

# 6. View posts
echo "6. Viewing posts..."
POSTS_RESPONSE=$(curl -s --max-time $REQUEST_TIMEOUT -X GET "$BACKEND_URL/post" \
    -H "Authorization: Bearer $TOKEN")

if ! validate_fields "$POSTS_RESPONSE" "0"; then
    echo "❌ Post viewing failed"
    cleanup_created_data "$TOKEN"
    exit 1
fi

POST_COUNT=$(echo "$POSTS_RESPONSE" | jq -r 'length')
echo "✅ Found $POST_COUNT posts"

# 7. View cities
echo "7. Viewing cities..."
CITIES_RESPONSE=$(curl -s --max-time $REQUEST_TIMEOUT -X GET "$BACKEND_URL/locations/return-cities" \
    -H "Authorization: Bearer $TOKEN")

CITY_COUNT=$(echo "$CITIES_RESPONSE" | jq -r 'length')
echo "✅ Found $CITY_COUNT cities"

# 8. Logout
echo "8. Logging out..."
LOGOUT_RESPONSE=$(logout_user "$USER_ID")
echo "✅ Logout completed"

# 9. Cleanup
echo "9. Cleaning up test data..."
cleanup_created_data "$TOKEN"
echo "✅ Cleanup completed"

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Generate JSON result
RESULT_JSON=$(generate_test_result "$TEST_NAME" "passed" "$DURATION" "{\"userEmail\":\"$TEST_EMAIL\",\"userId\":\"$USER_ID\",\"requestId\":\"$REQUEST_ID\",\"aiSession\":\"$SESSION_ID\",\"postsFound\":$POST_COUNT,\"citiesFound\":$CITY_COUNT}")

# Log result
log_test_result "$RESULT_JSON"

# Output result for runner
echo "$RESULT_JSON"

echo "✅ $TEST_NAME completed successfully in ${DURATION}s"