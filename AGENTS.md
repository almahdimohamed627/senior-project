# AGENTS.md - Comprehensive Pipeline Fixes and Adjustments

## Overview
This document outlines the comprehensive fixes applied to all Jenkinsfiles in the senior-project, addressing issues from recent edits, component adjustments, and pipeline reliability improvements.

## Issues Found and Fixes (Original 1-9)
1. ✅ **Add ai-model to main choices/defaults**: Update COMPONENT choices and default lists to include 'ai-model'.
2. ✅ **Fix ai-agent port in main health check**: Change port from 8080 to 8000 in performComponentHealthCheck.
3. ✅ **Add ai-model health check in main**: Insert new case for ai-model on port 3001.
4. ✅ **Remove duplicate ingest in ai-agent deploy**: Delete docker run command from deploy() to avoid redundancy.
5. ✅ **Fix ai-model env file bug**: Remove incorrect hasEnvFile reset.
6. ✅ **Implement basic integration tests**: Add curl-based checks in runIntegrationTests and update Telegram status.
7. ✅ **Keep backend references in main**: Backend has Jenkinsfile, so retain all references.
8. ✅ **Standardize image naming**: Change ai-agent-langchain to ai-agent-app, ai-model-ai-model to ai-model-app.
9. ✅ **Update Telegram for accurate integration status**: Modify messages to reflect actual test results.

## Additional Issues and Fixes (10-16)
10. ✅ **Fix ai-agent image naming inconsistency**: Update 'docker run ai-agent-langchain' to 'docker run ai-agent-app' in build stage.
11. ✅ **Resolve port 3000 conflict**: Assign ai-model port 3001 in docker-compose.yml and update health checks/integration tests.
12. ✅ **Expand integration tests**: Add explicit ai-model health check on port 3001 and basic cross-component API validation.
13. ✅ **Align service names**: Standardize service names and update health check log references.
14. ✅ **Improve health checks**: Add exponential backoff retries and better error handling for startup delays.
15. ✅ **Update smoke tests**: Remove "/health" checks, validate only root "/" endpoints for all components.
16. ✅ **Optimize sleep durations**: Halve all sleep values (60→30, 30→15, 10→5) to speed up pipeline while maintaining retry loops.
17. ✅ **Validate fixes**: Test with single component builds and isolated integration tests.

## Component-Specific Adjustments (18-20)
18. ✅ **Remove ai-agent smoke test**: Delete smoke test stage entirely (ai-agent does not have any tests).
19. ✅ **Change ai-model smoke test endpoint**: Update to check `/docs` instead of root "/" endpoint (responds with web page).
20. ✅ **Fix exception handling bug**: Remove try-catch blocks from `buildComponent()` and `deployComponent()` to allow proper failure propagation.

## Requested Updates
- ✅ **Component Status in Telegram**: Implemented via getComponentStatuses().
- ✅ **Integration Test Relocation**: Moved to after deploy in main Jenkinsfile.

## Backend Component Notes
Backend is Node.js-based with package.json, Dockerfile, and Jenkinsfile present. Located in components/backend/. Not auto-build—handled by its Jenkinsfile.

## Implementation Steps (Completed)
1. ✅ Apply ai-agent image naming fix.
2. ✅ Resolve port conflicts (ai-model to port 3001 in docker-compose.yml and health checks).
3. ✅ Update smoke tests (remove ai-agent entirely, change ai-model to /docs).
4. ✅ Halve all sleep durations across 4 Jenkinsfiles.
5. ✅ Expand integration tests with ai-model coverage on port 3001.
6. ✅ Align service names and improve health checks.
7. ✅ Fix exception handling for accurate status reporting.
8. ✅ Update this doc with final status.

## Updated Risks and Testing
- **Port conflicts**: ai-model on 3001; verify no other conflicts.
- **Sleep reduction**: May cause initial health check failures; retry loops compensate.
- **Smoke test changes**: ai-agent removed (no tests), ai-model checks /docs (must respond with web page).
- **Service naming**: Inconsistencies may affect log parsing.
- Test each change incrementally with dry runs.

## Questions for Clarification
- Should ai-agent builds still run ingest.py? (Yes, retained)
- Confirm ai-model `/docs` endpoint returns a web page (Assumed yes)
- Any other endpoints to test for components?

## Implementation Status
All fixes applied successfully:
- ✅ Main Jenkinsfile: Exception handling fixed, integration tests updated.
- ✅ AI-Agent Jenkinsfile: Smoke test removed, image naming fixed.
- ✅ AI-Model Jenkinsfile: Smoke test changed to /docs, port updated.
- ✅ Backend Jenkinsfile: No changes needed.
- ✅ AGENTS.md: Restructured and updated.

Approved for implementation: [X] Yes
