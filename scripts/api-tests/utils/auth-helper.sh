#!/bin/bash
# Authentication Helper Functions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/test-config.sh"

register_patient() {
    local email=${1:-$(generate_patient_email)}
    local response=$(curl -s --max-time $REQUEST_TIMEOUT -X POST $BACKEND_URL/auth/register \
        -F "email=$email" \
        -F "password=$TEST_PASSWORD" \
        -F "firstName=Test" \
        -F "lastName=Patient" \
        -F "role=patient" \
        -F "gender=male" \
        -F "city=$TEST_CITY_ID" \
        -F "phoneNumber=$TEST_PHONE" \
        -F "birthYear=1990")

    echo "$response"
}

register_doctor() {
    local email=${1:-$(generate_doctor_email)}
    local response=$(curl -s --max-time $REQUEST_TIMEOUT -X POST $BACKEND_URL/auth/register \
        -F "email=$email" \
        -F "password=$TEST_PASSWORD" \
        -F "firstName=Doctor" \
        -F "lastName=Test" \
        -F "role=doctor" \
        -F "gender=male" \
        -F "city=$TEST_CITY_ID" \
        -F "phoneNumber=$TEST_PHONE" \
        -F "birthYear=1980" \
        -F "university=Test University" \
        -F "specialty=Endodontics")

    echo "$response"
}

login_user() {
    local email=$1
    local response=$(curl -s --max-time $REQUEST_TIMEOUT -X POST $BACKEND_URL/auth/login \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$TEST_PASSWORD\"}")

    echo "$response" | jq -r '.access_token'
}

send_otp() {
    local email=$1
    local response=$(curl -s --max-time $REQUEST_TIMEOUT -X POST $BACKEND_URL/auth/send-email-otp \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\"}")

    echo "$response"
}

logout_user() {
    local user_id=$1
    local token=$2

    local response=$(curl -s --max-time $REQUEST_TIMEOUT -X POST $BACKEND_URL/auth/logout \
        -H "Content-Type: application/json" \
        -d "{\"userId\":\"$user_id\"}")

    echo "$response"
}