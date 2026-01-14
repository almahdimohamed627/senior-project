#!/bin/bash
# Response Validation Helper Functions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/test-config.sh"

# Validate HTTP response
validate_response() {
    local response=$1
    local expected_status=${2:-200}
    local test_name=$3

    # Extract status code from curl response (if available)
    # Note: This is a simplified validation

    if echo "$response" | jq . > /dev/null 2>&1; then
        local has_error=$(echo "$response" | jq -r '.error // empty')
        if [ -n "$has_error" ]; then
            echo "❌ $test_name failed: $has_error"
            return 1
        fi
    fi

    echo "✅ $test_name passed"
    return 0
}

# Validate user registration response
validate_registration() {
    local response=$1
    local role=${2:-"patient"}

    local user_id=$(echo "$response" | jq -r '.user.fusionUserId')
    local user_role=$(echo "$response" | jq -r '.user.role')

    if [ "$user_id" = "null" ] || [ -z "$user_id" ]; then
        echo "❌ Registration failed: No user ID"
        return 1
    fi

    if [ "$user_role" != "$role" ]; then
        echo "❌ Registration failed: Wrong role (expected $role, got $user_role)"
        return 1
    fi

    echo "✅ Registration successful: $user_id"
    return 0
}

# Validate login response
validate_login() {
    local response=$1

    local token=$(echo "$response" | jq -r '.access_token')

    if [ "$token" = "null" ] || [ -z "$token" ]; then
        echo "❌ Login failed: No access token"
        return 1
    fi

    echo "✅ Login successful"
    return 0
}

# Validate API response contains expected fields
validate_fields() {
    local response=$1
    local fields=("${@:2}")

    for field in "${fields[@]}"; do
        local value=$(echo "$response" | jq -r ".$field")
        if [ "$value" = "null" ] || [ -z "$value" ]; then
            echo "❌ Missing field: $field"
            return 1
        fi
    done

    echo "✅ All required fields present"
    return 0
}

# Generate simple test result text (no JSON serialization)
generate_test_result() {
    local test_name=$1
    local status=$2
    local duration=${3:-0}
    local details=${4:-"{}"}

    echo "Test: $test_name | Status: $status | Duration: ${duration}s | Details: $details"
}

# Log test result (simple text)
log_test_result() {
    local result=$1
    local log_file="$RESULTS_DIR/test-results.log"

    echo "$(date -Iseconds): $result" >> "$log_file"
}