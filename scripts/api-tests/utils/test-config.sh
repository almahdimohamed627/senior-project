#!/bin/bash
# API Test Configuration

# Base URLs
BACKEND_URL="https://app.almahdi.cloud"
AI_AGENT_URL="https://ai-agent.almahdi.cloud"
AI_MODEL_URL="https://ai-model.almahdi.cloud"

# Test Data Functions (Generate unique for each run)
generate_patient_email() {
    echo "test-patient-$(date +%s%N)@example.com"
}

generate_doctor_email() {
    echo "test-doctor-$(date +%s%N)@example.com"
}

TEST_PASSWORD="TestPass123!"
TEST_PHONE="1234567890"
TEST_CITY_ID=1

# File Paths (relative to project root)
TEST_AUDIO_FILE="test-files/Assassin-s-Creed-2-Soundtrack-Ezio-s-Family-HD.m4a"
TEST_IMAGE_FILE="test-files/0307.jpg"

# Timeouts (seconds)
REQUEST_TIMEOUT=30
TEST_TIMEOUT=300

# Output Settings
OUTPUT_FORMAT="json"
LOG_LEVEL="info"

# Test Results Directory (relative to scripts/)
RESULTS_DIR="test-results"
LATEST_RESULTS="$RESULTS_DIR/latest-run.json"