# API Test Suite

This directory contains comprehensive API tests for the Senior Project application.

## Structure

```
api-tests/
├── backend/          # Backend API tests by module
│   ├── auth/         # Authentication tests
│   ├── profiles/     # Profile management tests
│   ├── posts/        # Post management tests
│   ├── requests/     # Consultation request tests
│   ├── chat/         # Chat system tests
│   ├── ai-agent/     # AI diagnosis tests
│   ├── notifications/ # Notification system tests
│   └── locations/    # Location services tests
├── ai-services/      # External AI service tests
│   ├── ai-agent-tests.sh
│   └── ai-model-tests.sh
├── e2e-scenarios/    # End-to-end user journey tests
│   ├── patient-journey-complete.sh
│   ├── doctor-journey-complete.sh
│   └── cross-service-integration.sh
└── utils/            # Shared utilities
    ├── test-config.sh
    ├── auth-helper.sh
    ├── cleanup-helper.sh
    ├── response-validator.sh
    └── parallel-runner.sh
```

## Usage

### Run All Tests
```bash
./scripts/run-all-scenarios.sh
```

### Run Individual Test
```bash
./scripts/api-tests/backend/auth/register-patient.sh
```

### Run Specific Module
```bash
bash scripts/api-tests/backend/auth/*.sh
```

## Test Results

Results are saved in JSON format to `scripts/test-results/`:
- `latest-run.json` - Most recent test run
- `test-results.log` - Log of all test executions

## Configuration

Edit `scripts/api-tests/utils/test-config.sh` to modify:
- API endpoints
- Test credentials
- Timeouts
- Output formats

## Test Data Management

- Tests create fixed test users for consistency
- All test data is cleaned up automatically
- No permanent data remains after test execution
- Emergency cleanup available via `cleanup-helper.sh`

## Dependencies

- `curl` - For API calls
- `jq` - For JSON processing
- Bash 4.0+ - For script execution

## Adding New Tests

1. Create script in appropriate module directory
2. Follow naming convention: `feature-test.sh`
3. Include proper error handling and cleanup
4. Add to `run-all-scenarios.sh` if it's a scenario test
5. Make script executable: `chmod +x script.sh`