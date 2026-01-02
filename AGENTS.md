# AGENTS.md - Plan for Jenkinsfile Fixes and Updates

## Overview
This document outlines the plan to validate and fix all Jenkinsfiles in the senior-project, addressing issues from recent edits and implementing requested updates (component status in Telegram, integration test relocation). Based on exploration, 9 issues were identified across main, ai-agent, and ai-model Jenkinsfiles. Fixes are prioritized by impact and designed to be non-breaking.

## Issues Found and Fixes
1. **Add ai-model to main choices/defaults**: Update COMPONENT choices and default lists to include 'ai-model'.
2. **Fix ai-agent port in main health check**: Change port from 8080 to 8000 in performComponentHealthCheck.
3. **Add ai-model health check in main**: Insert new case for ai-model on port 3001.
4. **Remove duplicate ingest in ai-agent deploy**: Delete docker run command from deploy() to avoid redundancy.
5. **Fix ai-model env file bug**: Remove incorrect hasEnvFile reset.
6. **Implement basic integration tests**: Add curl-based checks in runIntegrationTests and update Telegram status.
7. **Keep backend references in main**: Backend has Jenkinsfile, so retain all references.
8. **Standardize image naming**: Change ai-agent-langchain to ai-agent-app, ai-model-ai-model to ai-model-app.
9. **Update Telegram for accurate integration status**: Modify messages to reflect actual test results.

## Additional Issues and Fixes
10. **Fix ai-agent image naming inconsistency**: Update 'docker run ai-agent-langchain' to 'docker run ai-agent-app' in build stage.
11. **Resolve port 3000 conflict**: Assign ai-model port 3001 in docker-compose.yml and update health checks/integration tests.
12. **Expand integration tests**: Add explicit ai-model health check on port 3001 and basic cross-component API validation.
13. **Align service names**: Standardize service names (e.g., langchain → ai-agent-app) and update health check log references.
14. **Improve health checks**: Add exponential backoff retries and better error handling for startup delays.
15. **Update smoke tests**: Remove "/health" checks, validate only root "/" endpoints for all components.
16. **Optimize sleep durations**: Halve all sleep values (60→30, 30→15, 10→5) to speed up pipeline while maintaining retry loops.
17. **Validate fixes**: Test with single component builds and isolated integration tests.

## Requested Updates
- **Component Status in Telegram**: Already implemented via getComponentStatuses(). Working.
- **Integration Test Relocation**: Moved to after deploy in main Jenkinsfile. Implement basic logic for cross-component checks.

## Backend Component Notes
Backend is Node.js-based with package.json, Dockerfile, and Jenkinsfile present. Keep all references in main Jenkinsfile. Not auto-build—handled by its Jenkinsfile.

## Updated Implementation Steps
1. Apply ai-agent image naming fix.
2. Resolve port conflicts (change ai-model to port 3001 in docker-compose.yml and health checks).
3. Update smoke tests to check only "/" endpoints.
4. Halve all sleep durations across 4 Jenkinsfiles.
5. Expand integration tests with ai-model coverage on port 3001.
6. Align service names and improve health checks.
7. Test pipeline changes with limited scope.
8. Update this doc with final status.

## Updated Risks and Testing
- **Port conflicts**: Changed ai-model to port 3001; verify no other conflicts.
- **Sleep reduction**: May cause initial health check failures; retry loops should compensate.
- **Smoke test changes**: Components must have functional root endpoints; verify before applying.
- **Service naming**: Inconsistencies may affect log parsing and debugging.
- Test each change incrementally with dry runs to avoid breaking builds.

## Questions for Clarification
- What port should ai-model use instead of 3000? (Resolved: 3001)
- Do all components have functional root "/" endpoints? (Assume yes)
- Are there specific API endpoints for cross-component testing? (Basic health checks added)
- Should we keep minimum sleep durations (e.g., 5 seconds) for critical waits? (Yes, halved)

## Implementation Status
Original fixes applied with updates:
- Main Jenkinsfile: Added ai-model, fixed ai-agent port, added ai-model health check on 3001, implemented integration tests, updated Telegram messages.
- AI-Agent Jenkinsfile: Standardized image to ai-agent-app, fixed naming inconsistency.
- AI-Model Jenkinsfile: Fixed env file bug, port changed to 3001.
- Backend Jenkinsfile: Located in components/backend/, references intact.
- Additional fixes: Smoke tests updated, sleeps halved, integration expanded.

Approved for implementation: [X] Yes
