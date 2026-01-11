# Post-Verifier Microservice Development Session

## Summary of Changes
- **Created** `components/post-verifier/` directory with full microservice setup.
- **Docker Setup**: Dockerfile (Node.js 18 Alpine), docker-compose.yml (Traefik labels, named volumes, separate ports).
- **Environment**: .env with DASHBOARD_PORT, API_PORT, TRAEFIK_DOMAIN, DASHBOARD_PASSWORD.
- **Dependencies**: express, exiftool-vendored, multer, express-basic-auth, http-proxy-middleware, winston.
- **App Structure**: Two Express apps (dashboard on port 3001 with auth, API on port 3000 LAN-only).
- **Features**:
  - EXIF verification for device, software, time checks with configurable states (disabled/not_necessary/necessary).
  - Statuses: accepted, not accepted, unstable.
  - Dashboard for prefs editing (protected by basic auth).
  - API endpoints: /verify (multipart upload), /api/prefs (GET/POST), /docs (HTML docs).
  - Proxy /api from dashboard to API port for CORS-free prefs saving.
  - Logging with winston (file + console, viewable via docker logs).
  - Config persistence via named volume (auto-creates defaults if missing).
- **Security**: Separate ports, auth on dashboard, API internal.
- **Watch**: Configured for file watching in compose.

## Todos
- [ ] Fixing and testing apis, adding reverse geocoding to check country