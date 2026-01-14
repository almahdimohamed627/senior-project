#!/bin/bash
# Cleanup Helper Functions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/test-config.sh"

# Track created resources for cleanup
declare -a created_users=()
declare -a created_posts=()
declare -a created_requests=()
declare -a created_conversations=()

add_created_user() {
    local user_id=$1
    created_users+=("$user_id")
}

add_created_post() {
    local post_id=$1
    created_posts+=("$post_id")
}

add_created_request() {
    local request_id=$1
    created_requests+=("$request_id")
}

add_created_conversation() {
    local conversation_id=$1
    created_conversations+=("$conversation_id")
}

cleanup_created_data() {
    local token=$1

    echo "Starting cleanup..."

    # Clean up conversations (if any)
    for conv_id in "${created_conversations[@]}"; do
        echo "Cleaning conversation: $conv_id"
        # Note: No direct delete endpoint for conversations
    done

    # Clean up requests
    for req_id in "${created_requests[@]}"; do
        echo "Cleaning request: $req_id"
        # Cancel request if possible
        curl -s -X POST $BACKEND_URL/request/cancel \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "{\"senderId\":\"test-user\",\"receiverId\":\"test-doctor\"}" > /dev/null 2>&1
    done

    # Clean up posts
    for post_id in "${created_posts[@]}"; do
        echo "Cleaning post: $post_id"
        # Note: No delete post endpoint found
    done

    # Clean up users (must be last)
    for user_id in "${created_users[@]}"; do
        echo "Cleaning user: $user_id"
        curl -s -X DELETE $BACKEND_URL/profile/$user_id \
            -H "Authorization: Bearer $token" > /dev/null 2>&1
    done

    echo "Cleanup completed"
}

# Initialize cleanup tracking
init_cleanup() {
    created_users=()
    created_posts=()
    created_requests=()
    created_conversations=()
}

# Emergency cleanup function
emergency_cleanup() {
    echo "Emergency cleanup triggered"
    # Clean up known test users
    local test_users=("test-patient-fixed@example.com" "test-doctor-fixed@example.com")

    for email in "${test_users[@]}"; do
        # Try to login and delete
        local token=$(login_user "$email")
        if [ "$token" != "null" ] && [ -n "$token" ]; then
            # Find user ID and delete
            local profile_response=$(curl -s -X GET $BACKEND_URL/profile/profiles \
                -H "Authorization: Bearer $token" | jq -r ".[] | select(.email==\"$email\") | .fusionAuthId")
            if [ -n "$profile_response" ]; then
                curl -s -X DELETE $BACKEND_URL/profile/$profile_response \
                    -H "Authorization: Bearer $token" > /dev/null 2>&1
            fi
        fi
    done
}