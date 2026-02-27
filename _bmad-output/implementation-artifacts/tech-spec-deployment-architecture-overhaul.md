---
title: 'Deployment Architecture Overhaul'
slug: 'deployment-architecture-overhaul'
created: '2026-02-27'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Docker Compose', 'GHCR', 'Trivy', 'AWS SSM', 'AWS OIDC', 'Terraform', 'CloudWatch', 'Nginx 1.27-alpine', 'GitHub Actions', 'coturn/coturn:4.6.3', 'certbot/certbot:v3.1.0', 'node:20-alpine']
files_to_modify: ['docker-compose.yml', '.github/workflows/release.yml', 'docker/nginx/nginx.conf', 'docker/nginx/nginx.conf.template', 'server/Dockerfile', 'server/src/index.ts', 'scripts/setup.sh', 'scripts/deploy.sh', '.env.example', 'docker/coturn/turnserver.prod.conf', 'infrastructure/main.tf']
code_patterns: ['GitHub Actions OIDC federation', 'AWS SSM Run Command with structured status parsing', 'Blue-green Docker deployment with split mediasoup UDP ranges', 'GHCR image tagging (SHA + semver + latest)', 'Terraform HCL for EC2 + IAM + SG', 'Fastify onClose hook for graceful shutdown', 'Docker Compose profiles for deploy-only containers', 'nginx upstream switching via template + nginx -t validation + reload', 'Transient secrets env file from SSM Parameter Store']
test_patterns: ['No automated tests — infrastructure validated by dry-run, health checks, and manual verification', 'Blue-green rollback tested by deploying broken image', 'CloudWatch verified by checking log group population']
---

# Tech-Spec: Deployment Architecture Overhaul

**Created:** 2026-02-27

## Overview

### Problem Statement

The current deployment pipeline builds images on the production EC2 instance, uses `network_mode: host` on all containers with zero isolation, deploys via static SSH keys with no audit trail, stores secrets in a plain `.env` file, has no resource limits or log rotation, and causes downtime on every deploy. These gaps introduce real operational and security risk.

### Solution

Implement the full deployment architecture review across 6 phased stories — from Docker Compose hardening through Terraform IaC — resulting in registry-based image management, bridge networking, SSM+OIDC deployment, blue-green zero-downtime deploys, centralized secrets, CloudWatch observability, and reproducible infrastructure.

### Scope

**In Scope:**
- **Phase 1:** Docker Compose hardening (resource limits, log rotation, health check start_period, image pinning, security_opt, depends_on conditions, named volumes)
- **Phase 2:** GHCR container registry + Trivy scanning + image-based rollback
- **Phase 3:** Bridge networking for app/nginx/certbot (100-port mediasoup range), host mode only for coturn
- **Phase 4:** AWS SSM + OIDC replacing SSH deployment, environment protection rules, close port 22
- **Phase 5:** Blue-green deployment (app-blue/app-green, deploy script, nginx upstream switching)
- **Phase 6:** SSM Parameter Store secrets, CloudWatch log shipping, Terraform IaC, uptime monitoring, deploy failure notifications

**Out of Scope:**
- Application code changes (Fastify, React, mediasoup logic)
- Database migrations or schema changes
- Electron client build/distribution changes
- Multi-instance / auto-scaling architecture

## Context for Development

### Codebase Patterns

**GitHub Actions:**
- Workflows use `actions/checkout@v4`, `actions/setup-node@v4` with Node 20
- `release.yml` triggers on `push: tags: ['v*']` — 4 existing jobs: `validate-version`, `build-electron` (3-OS matrix), `publish-release`, `deploy-server`
- `ci.yml` triggers on `pull_request` to `main` — runs lint, test, build
- Current deploy uses `appleboy/ssh-action@v1` and `appleboy/scp-action@v0.1.7` with secrets `EC2_SSH_KEY`, `EC2_HOST`, `EC2_USER`, `EC2_DEPLOY_PATH`
- Deploy downloads release assets via `gh CLI`, uploads to EC2 via SCP, then SSH executes: save rollback state → git pull → docker compose build → docker compose up → health check → rollback on failure
- Concurrency control: `group: release`, `cancel-in-progress: false`

**Docker Compose (current `docker-compose.yml`):**
- 4 services: `app`, `coturn`, `nginx`, `certbot`
- ALL services use `network_mode: host` — zero network isolation
- `app` builds from `server/Dockerfile` (context: `.`), env from `.env`, volume `./data/sqlite:/app/data`
- `coturn` uses `coturn/coturn:latest` (unpinned), volume mounts `turnserver.prod.conf:ro`
- `nginx` uses `nginx:alpine` (unpinned), depends on `app` (no health condition), volumes for config/landing/downloads/certs
- `certbot` uses `certbot/certbot`, renewal loop via entrypoint, depends on `nginx`
- No resource limits, no log rotation, no `start_period`, no `security_opt`
- Health check on app only: `wget --spider -q http://127.0.0.1:3000/api/health` (30s interval, 5s timeout, 3 retries)

**Nginx (`docker/nginx/nginx.conf`):**
- Upstream block: `server 127.0.0.1:3000` (hardcoded single backend)
- Rate limiting: `60r/m` with burst 20 on `/api/`
- TLS: Let's Encrypt certs at `/etc/letsencrypt/live/discweeds.com/`, TLS 1.2+1.3, HSTS 2yr
- WebSocket proxy at `/ws` with 86400s read/send timeout
- Downloads served from `/usr/share/nginx/downloads/`
- Landing page SPA with `try_files`

**Server Application:**
- `server/src/index.ts`: Entry point — NO SIGTERM handler. Calls `buildApp()` + `app.listen()` but never `app.close()` on signal
- `server/src/app.ts:55`: `onClose` hook wired to `closeMediasoup()` — will execute IF `app.close()` is called
- Health endpoint at `app.ts:59`: `GET /api/health` — checks DB connectivity via `SELECT 1`
- Mediasoup port range: `MEDIASOUP_MIN_PORT` / `MEDIASOUP_MAX_PORT` read from env (defaults 40000-49999)
- `.env.example` has all env vars including `MEDIASOUP_MIN_PORT=40000`, `MEDIASOUP_MAX_PORT=49999`

**Dockerfile (`server/Dockerfile`):**
- Multi-stage: `node:20-alpine` builder + `node:20-alpine` production
- Builder: installs build tools, `npm ci`, builds shared+server TypeScript, prunes devDeps
- Production: non-root `appuser`, copies compiled dist + node_modules + drizzle migrations
- No `STOPSIGNAL` directive (defaults to SIGTERM, which is correct)
- Exposes port 3000

**Setup (`scripts/setup.sh`):**
- Interactive: prompts for domain, email, server name, GitHub releases URL
- Auto-detects public/private IP for coturn NAT
- Generates JWT + TURN secrets via `openssl rand -hex 32`
- Creates `.env` from `.env.example` with `chmod 600`
- Updates coturn config, nginx config, landing page via `sed`
- Runs initial certbot standalone for TLS cert

**Coturn (`docker/coturn/turnserver.prod.conf`):**
- Ports: listening 3478, relay 49152-49252
- Auth: `use-auth-secret` with `static-auth-secret` (sed-replaced by setup.sh, but placeholder committed to git)
- NAT: `external-ip=PUBLIC/PRIVATE` format

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `docker-compose.yml` | 4 services: app, coturn, nginx, certbot — all on host networking, no resource limits |
| `.github/workflows/release.yml` | Release pipeline: validate, build Electron, publish, deploy to EC2 via SSH (217 lines) |
| `.github/workflows/ci.yml` | PR pipeline: test, lint, build (44 lines) — reference for workflow patterns |
| `docker/nginx/nginx.conf` | TLS termination, reverse proxy, rate limiting, upstream `127.0.0.1:3000` |
| `server/Dockerfile` | Multi-stage build: node:20-alpine, non-root user, port 3000 (56 lines) |
| `server/src/index.ts` | Server entry point — MISSING SIGTERM handler (44 lines) |
| `server/src/app.ts` | Fastify app builder, health endpoint, onClose hook for mediasoup (71 lines) |
| `server/src/plugins/voice/mediasoupManager.ts` | Reads MEDIASOUP_MIN_PORT/MAX_PORT from env (line 8-9) |
| `scripts/setup.sh` | One-time EC2 setup: secrets, .env, certbot, coturn config (155 lines) |
| `.env.example` | All env vars including mediasoup ports, secrets, domain config (60 lines) |
| `docker/coturn/turnserver.prod.conf` | TURN config: ports 49152-49252, auth secret placeholder |
| `.dockerignore` | Excludes client/, .git/, node_modules/, .env, _bmad*/ |
| `_bmad-output/planning-artifacts/deployment-architecture-review.md` | Source review document with all recommendations |

### Technical Decisions

- **Registry:** GHCR (free, native GitHub Actions integration via `GITHUB_TOKEN`, zero additional config)
- **Image tagging:** Triple-tag every build: git SHA (immutable traceability), semver (human-readable rollback), `latest` (convenience, never pinned in production)
- **Networking:** Custom `backend` bridge network for app/nginx/certbot. Host mode only for coturn (UDP relay needs raw port access). Mediasoup port range reduced from 40000-49999 to 40000-40099 (100 ports via `.env`)
- **Deployment method:** AWS SSM + OIDC — short-lived credentials, no SSH keys, no port 22, full CloudTrail audit. IAM role trust policy scoped to `repo:AidenWoodside/discord_clone:ref:refs/tags/v*`
- **Zero-downtime:** Blue-green with `app-blue` (port 3001, UDP 40000-40049) and `app-green` (port 3002, UDP 40050-40099). Deploy script determines active slot by inspecting running containers (no ephemeral state file). Nginx upstream switched via template (`nginx.conf.template` with `{{UPSTREAM}}` placeholder) + `nginx -t` validation + `nginx -s reload`, with full rollback on failure. Green uses Docker Compose `profiles: [deploy]` — only started during deploys. Both slots use `restart: unless-stopped` for crash recovery
- **Graceful shutdown:** Add SIGTERM handler to `server/src/index.ts` calling `app.close()` — prerequisite for blue-green to avoid dropped connections. `stop_grace_period: 30s` on both app containers
- **Secrets:** AWS SSM Parameter Store with `SecureString` type (KMS encryption). Fetched at deploy time, passed as env vars — no `.env` file on disk. Secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `TURN_SECRET`, `GROUP_ENCRYPTION_KEY`
- **Logging:** Phase 1 uses `json-file` driver with `max-size: 10m`, `max-file: 5`. Phase 6 switches to `awslogs` driver shipping to CloudWatch log groups `/discord-clone/production/{service}`
- **IaC:** Terraform for EC2 instance, security group (443, 80, 3478 UDP, 49152-49252 UDP, 40000-40099 UDP), IAM role + instance profile (SSM + CloudWatch), OIDC provider. State stored in S3 + DynamoDB lock
- **Uptime:** External monitoring service (UptimeRobot/Better Stack) hitting `https://discweeds.com/api/health` every 60s
- **Deploy notifications:** Discord webhook on GitHub Actions failure — POST to `DEPLOY_WEBHOOK_URL` secret
- **Cert renewal:** Add daily cron on host to `docker compose exec nginx nginx -s reload` after certbot renews
- **Image pinning:** `nginx:1.27-alpine`, `coturn/coturn:4.6.3`, `certbot/certbot:v3.1.0` (all third-party images pinned — certbot handles TLS certs and a broken upstream causes total site unavailability)

## Implementation Plan

Each phase is a separate implementation story. Phases are ordered by dependency (see dependency graph in Additional Context). Phases 3 and 4 can be executed in parallel after Phase 2; all others are sequential. A fresh dev agent should be able to implement any single phase given this spec and the deployment architecture review document.

---

### Phase 1: Docker Compose Hardening

**Story:** As the server operator, I want hardened Docker Compose configuration with resource limits, log rotation, security options, and proper dependency management so that the deployment is resilient and follows container security best practices.

**Prerequisites:** None — this phase has no external dependencies.

#### Tasks

- [ ] Task 1.1: Add resource limits to all services
  - File: `docker-compose.yml`
  - Action: Add `deploy.resources.limits` and `deploy.resources.reservations` to each service:
    - `app`: limits `cpus: '2.0'`, `memory: 1G`; reservations `cpus: '0.25'`, `memory: 256M`
    - `nginx`: limits `cpus: '0.5'`, `memory: 256M`
    - `coturn`: limits `cpus: '1.0'`, `memory: 512M`
    - `certbot`: limits `cpus: '0.25'`, `memory: 128M`
  - Notes: Tune after running `docker stats` under load. These are initial safe values for a t3.medium (2 vCPU, 4GB RAM)

- [ ] Task 1.2: Add log rotation to all services
  - File: `docker-compose.yml`
  - Action: Add `logging` config to each service:
    ```yaml
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
    ```
  - Notes: Applied to app, nginx, coturn, certbot. Prevents unbounded disk growth

- [ ] Task 1.3: Improve health check configuration
  - File: `docker-compose.yml`
  - Action: Add `start_period: 30s` to the `app` health check (allows time for migrations + mediasoup worker init). Add `stop_grace_period: 30s` and `stop_signal: SIGTERM` to app service
  - Notes: `start_period` prevents Docker marking container unhealthy during boot

- [ ] Task 1.4: Pin third-party image versions
  - File: `docker-compose.yml`
  - Action: Change `nginx:alpine` to `nginx:1.27-alpine`. Change `coturn/coturn:latest` to `coturn/coturn:4.6.3`. Change `certbot/certbot` to `certbot/certbot:v3.1.0`
  - Notes: Prevents surprise breaking changes from upstream. Update deliberately after testing. Certbot manages TLS certificates — a broken upstream image causes cert renewal failure and total site unavailability, so it must be pinned like every other image

- [ ] Task 1.5: Add `depends_on` health condition
  - File: `docker-compose.yml`
  - Action: Change nginx's `depends_on` from `- app` to:
    ```yaml
    depends_on:
      app:
        condition: service_healthy
    ```
  - Notes: Ensures nginx doesn't start proxying until the app's health check passes

- [ ] Task 1.6: Add security options to containers
  - File: `docker-compose.yml`
  - Action: Add to `app`:
    ```yaml
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    ```
    Add to `nginx`:
    ```yaml
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    ```
  - Notes: `no-new-privileges` prevents privilege escalation. `cap_drop: ALL` removes all Linux capabilities. Nginx needs `NET_BIND_SERVICE` for ports 80/443. Do NOT add `read_only: true` yet — app writes to SQLite volume and nginx needs `/var/cache/nginx`

- [ ] Task 1.7: Convert SQLite bind mount to named volume
  - File: `docker-compose.yml`
  - Action: Change `app` volume from `./data/sqlite:/app/data` to `sqlite_data:/app/data`. Add `volumes:` section at bottom:
    ```yaml
    volumes:
      sqlite_data:
        driver: local
    ```
    Keep nginx/coturn/certbot bind mounts (config files need host filesystem access)
  - Notes: Named volumes are managed by Docker, survive `docker compose down`, and avoid host permission issues

- [ ] Task 1.8: Add GitHub environment protection rules
  - File: N/A (GitHub Settings)
  - Action: In GitHub Settings > Environments, create a `production` environment. Add required reviewers (owner). Set branch restriction to tags matching `v*`. Add `environment: production` to the `deploy-server` job in `release.yml`
  - Notes: This is a manual GitHub Settings change plus a one-line addition to `release.yml`

#### Acceptance Criteria

- [ ] AC 1.1: Given the updated `docker-compose.yml`, when `docker compose config` is run, then it validates without errors and all services show resource limits, logging config, and security options
- [ ] AC 1.2: Given the app service is starting, when it takes >10s to boot (migrations + mediasoup init), then Docker does not mark it unhealthy during the `start_period` window
- [ ] AC 1.3: Given nginx depends on app with `condition: service_healthy`, when `docker compose up -d` is run, then nginx starts only after the app health check passes
- [ ] AC 1.4: Given `nginx:1.27-alpine` and `coturn/coturn:4.6.3` are pinned, when `docker compose pull` is run, then it pulls those exact versions (not latest)
- [ ] AC 1.5: Given the app container is running, when `docker inspect` is run on it, then `NoNewPrivileges` is `true` and `CapDrop` includes `ALL`
- [ ] AC 1.6: Given the SQLite named volume, when `docker compose down` is run (without `-v`), then the database data persists and is available on next `docker compose up`
- [ ] AC 1.7: Given `deploy-server` job has `environment: production`, when a tag is pushed, then GitHub requires manual approval before the deploy job runs

---

### Phase 2: Container Registry (GHCR) + Image Scanning

**Story:** As a developer, I want Docker images built in CI and pushed to GitHub Container Registry so that production never builds images locally, every image is scannable and traceable by git SHA, and rollback is as simple as pulling a previous tag.

**Prerequisites:** Phase 1 complete (hardened compose file is the baseline).

#### Tasks

- [ ] Task 2.1: Add `build-server-image` job to release workflow
  - File: `.github/workflows/release.yml`
  - Action: Add a new job `build-server-image` after `validate-version`:
    - `needs: [validate-version]`
    - `runs-on: ubuntu-latest`
    - `permissions: contents: read, packages: write`
    - Steps: checkout, `docker/setup-buildx-action@v3`, `docker/login-action@v3` (registry: `ghcr.io`, username: `${{ github.actor }}`, password: `${{ secrets.GITHUB_TOKEN }}`), `docker/build-push-action@v5` (context: `.`, file: `server/Dockerfile`, push: true, tags: `ghcr.io/aidenwoodside/discord-clone-server:${{ github.sha }}`, `ghcr.io/aidenwoodside/discord-clone-server:${{ github.ref_name }}`, `ghcr.io/aidenwoodside/discord-clone-server:latest`, cache-from: `type=gha`, cache-to: `type=gha,mode=max`)
  - Notes: Uses GitHub Actions cache for Docker layer caching. `GITHUB_TOKEN` has automatic GHCR write access

- [ ] Task 2.2: Add Trivy vulnerability scanning step
  - File: `.github/workflows/release.yml`
  - Action: Add step after `build-push-action` in `build-server-image` job:
    ```yaml
    - name: Scan image for vulnerabilities
      uses: aquasecurity/trivy-action@0.28.0  # Pin to specific version — do not use @master
      with:
        image-ref: ghcr.io/aidenwoodside/discord-clone-server:${{ github.sha }}
        format: 'table'
        severity: 'CRITICAL,HIGH'
        exit-code: '1'
    ```
  - Notes: `exit-code: 1` fails the build on CRITICAL/HIGH vulnerabilities. Use `exit-code: 0` initially if you want non-blocking scans. Pin all third-party actions to a specific version tag (or full commit SHA for maximum supply-chain security) — never use `@master` or `@main`

- [ ] Task 2.3: Switch docker-compose.yml from `build:` to `image:`
  - File: `docker-compose.yml`
  - Action: Replace the `app` service's `build:` block:
    ```yaml
    # Remove:
    build:
      context: .
      dockerfile: server/Dockerfile
    # Replace with:
    image: ghcr.io/aidenwoodside/discord-clone-server:${IMAGE_TAG:-latest}
    ```
  - Notes: `IMAGE_TAG` env var controls which version runs. Defaults to `latest` for convenience, but deploy scripts should always set an explicit tag

- [ ] Task 2.4: Update deploy-server job to pull instead of build
  - File: `.github/workflows/release.yml`
  - Action: Update `deploy-server` job:
    - Add `needs: [publish-release, build-server-image]` (depends on image being pushed)
    - Replace the SSH deploy script's `git pull` + `docker compose build` with:
      ```bash
      export IMAGE_TAG="${{ github.ref_name }}"
      docker compose pull app
      docker compose up -d app nginx
      ```
    - Remove the `git checkout`, `git clean`, `git pull` commands — EC2 no longer needs source code for the app image
    - Keep the SCP step for uploading download assets (landing page still needs installers)
    - Update rollback to use registry: on health check failure, set `IMAGE_TAG` to previous known version and `docker compose pull app && docker compose up -d app`
  - Notes: The EC2 instance still needs the `docker-compose.yml`, `nginx.conf`, coturn config, and landing page files on disk. Only the app image comes from the registry. Git pull is still needed for those config files (or they can be managed separately later)

- [ ] Task 2.5: Authenticate EC2 with GHCR for image pulls
  - File: Deploy script (within SSH action in `release.yml`)
  - Action: Before `docker compose pull`, add GHCR login:
    ```bash
    echo "$GHCR_TOKEN" | docker login ghcr.io -u aidenwoodside --password-stdin
    ```
    Add `GHCR_TOKEN` as a GitHub secret containing a Personal Access Token with `read:packages` scope (or use a fine-grained token)
  - Notes: If the repo is public, GHCR images are publicly pullable and this step can be skipped. If private, a PAT with `read:packages` is required on the EC2 instance

- [ ] Task 2.6: Update .env.example with IMAGE_TAG variable
  - File: `.env.example`
  - Action: Add `IMAGE_TAG=latest` with comment explaining it's set by the deploy pipeline

#### Acceptance Criteria

- [ ] AC 2.1: Given a tag push triggers the release workflow, when the `build-server-image` job runs, then the image is pushed to `ghcr.io/aidenwoodside/discord-clone-server` with three tags: git SHA, semver tag, and `latest`
- [ ] AC 2.2: Given the image is pushed, when Trivy scans it, then CRITICAL/HIGH vulnerabilities are reported (and optionally fail the build)
- [ ] AC 2.3: Given `docker-compose.yml` uses `image:` instead of `build:`, when `IMAGE_TAG=v1.0.0 docker compose pull app` is run on EC2, then it pulls that exact version from GHCR
- [ ] AC 2.4: Given a deploy completes, when the health check fails, then the rollback pulls the previous image tag from GHCR and restarts the app
- [ ] AC 2.5: Given the `build-server-image` job completes, when `docker compose build` is run on EC2, then it is NOT required (no `build:` directive in compose)

---

### Phase 3: Network Isolation (Bridge Networking)

**Story:** As the server operator, I want Docker containers isolated on a bridge network with only necessary ports exposed so that a compromised container cannot access other services or the host network directly.

**Prerequisites:** Phase 2 complete (app uses `image:` not `build:`, so bridge networking works with pulled images).

#### Tasks

- [ ] Task 3.1: Create bridge network and move app off host mode
  - File: `docker-compose.yml`
  - Action: Remove `network_mode: host` from `app` service. Add:
    ```yaml
    networks:
      - backend
    ports:
      - "3001:3001"
      - "40000-40099:40000-40099/udp"
    ```
    Add networks section:
    ```yaml
    networks:
      backend:
        driver: bridge
    ```
  - Notes: App port changes from 3000 to 3001 (preparation for blue-green in Phase 5 where blue=3001, green=3002). The 100-port UDP range is for mediasoup RTP. This is a key trade-off: 100 concurrent media streams max, which is plenty for this project

- [ ] Task 3.2: Update .env.example with reduced mediasoup port range
  - File: `.env.example`
  - Action: Change `MEDIASOUP_MIN_PORT=40000` and `MEDIASOUP_MAX_PORT=49999` to `MEDIASOUP_MAX_PORT=40099`. Add comment: `# Reduced to 100 ports for Docker bridge networking compatibility`
  - Notes: Also update the production `.env` on EC2 during deployment

- [ ] Task 3.3: Update app PORT environment variable
  - File: `docker-compose.yml`
  - Action: Add `environment: - PORT=3001` to the app service (overrides default 3000)
  - File: `.env.example`
  - Action: Update comment for PORT to note production uses 3001 for blue-green prep

- [ ] Task 3.4: Move nginx off host mode
  - File: `docker-compose.yml`
  - Action: Remove `network_mode: host` from `nginx`. Add:
    ```yaml
    networks:
      - backend
    ports:
      - "80:80"
      - "443:443"
    ```

- [ ] Task 3.5: Move certbot off host mode
  - File: `docker-compose.yml`
  - Action: Remove `network_mode: host` from `certbot` (if present — certbot currently inherits host mode). Add:
    ```yaml
    networks:
      - backend
    ```
    Certbot needs no ports — it only accesses shared volumes for ACME challenge

- [ ] Task 3.6: Keep coturn on host mode (justified)
  - File: `docker-compose.yml`
  - Action: Keep `network_mode: host` on `coturn`. Add a comment:
    ```yaml
    # Justified: coturn needs 100+ UDP ports for TURN relay (49152-49252).
    # Publishing this range via bridge would be impractical.
    ```
  - Notes: Coturn stays on host mode. This is the only service that genuinely needs it

- [ ] Task 3.7: Update nginx upstream to use Docker DNS
  - File: `docker/nginx/nginx.conf`
  - Action: Change upstream from `server 127.0.0.1:3000;` to `server app:3001;` (Docker DNS resolves `app` to the container's bridge IP). Note: in Phase 5 this becomes `app-blue:3001` or dynamically switched
  - Notes: Docker bridge networking provides automatic DNS resolution between containers on the same network

- [ ] Task 3.8: Update app health check URL for new port
  - File: `docker-compose.yml`
  - Action: Update health check from `http://127.0.0.1:3000/api/health` to `http://127.0.0.1:3001/api/health`

#### Acceptance Criteria

- [ ] AC 3.1: Given app, nginx, and certbot are on the `backend` bridge network, when `docker network inspect backend` is run, then all three containers are listed as connected
- [ ] AC 3.2: Given coturn remains on `network_mode: host`, when a TURN relay is established, then UDP traffic flows correctly on ports 49152-49252
- [ ] AC 3.3: Given nginx uses Docker DNS (`app:3001`), when a request hits `https://discweeds.com/api/health`, then nginx proxies it to the app container and returns 200
- [ ] AC 3.4: Given WebSocket proxy uses Docker DNS, when a client connects to `wss://discweeds.com/ws`, then the WebSocket upgrade succeeds and messages flow
- [ ] AC 3.5: Given mediasoup uses ports 40000-40099, when a voice call is established, then RTP media flows over the published UDP port range
- [ ] AC 3.6: Given the app container is compromised, when it attempts to access coturn's listening port (3478) or host SSH (22), then the bridge network prevents direct access (traffic must go through published ports only)

---

### Phase 4: AWS SSM + OIDC (Replace SSH Deployment)

**Story:** As a developer, I want GitHub Actions to deploy via AWS SSM with OIDC-federated credentials so that there are no static SSH keys, port 22 can be closed, and every deployment command is audited in CloudTrail.

**Prerequisites:** Phase 2 complete (deploy pulls images, doesn't build). AWS account access required for IAM configuration. Note: Phase 4 does not depend on Phase 3 — they can be developed in parallel after Phase 2.

#### Tasks

- [ ] Task 4.1: Create IAM OIDC Identity Provider in AWS
  - File: N/A (AWS Console or CLI)
  - Action: Create an OIDC Identity Provider:
    - Provider URL: `https://token.actions.githubusercontent.com`
    - Audience: `sts.amazonaws.com`
  - Notes: This is a one-time AWS account setup. Can be done via Console or `aws iam create-open-id-connect-provider`

- [ ] Task 4.2: Create IAM deploy role with trust policy
  - File: N/A (AWS Console or CLI)
  - Action: Create IAM Role `discord-clone-deploy` with trust policy:
    ```json
    {
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {
          "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
        },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
          "StringEquals": {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
          },
          "StringLike": {
            "token.actions.githubusercontent.com:sub": "repo:AidenWoodside/discord_clone:ref:refs/tags/v*"
          }
        }
      }]
    }
    ```
    Attach inline policy granting: `ssm:SendCommand`, `ssm:GetCommandInvocation` on the EC2 instance, and `ssm:ListCommandInvocations`
  - Notes: The `sub` condition scopes access to only tag pushes from this specific repo

- [ ] Task 4.3: Install SSM Agent on EC2 and attach instance profile
  - File: N/A (EC2 instance)
  - Action: SSH into EC2 (last time!):
    ```bash
    sudo snap install amazon-ssm-agent --classic
    sudo systemctl enable amazon-ssm-agent
    sudo systemctl start amazon-ssm-agent
    ```
    Create IAM Instance Profile with `AmazonSSMManagedInstanceCore` policy. Attach to EC2 instance via Console or CLI
  - Notes: SSM Agent must be running and the instance must have the instance profile for SSM commands to work

- [ ] Task 4.4: Replace SSH deploy with SSM in release.yml
  - File: `.github/workflows/release.yml`
  - Action: Replace the `deploy-server` job steps:
    - Remove `appleboy/ssh-action` and `appleboy/scp-action` steps
    - Add `permissions: id-token: write, contents: read`
    - Add `environment: name: production` (for approval gate)
    - Add `aws-actions/configure-aws-credentials@v4` step with `role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}`, `aws-region: us-east-1`
    - Add SSM deploy step:
      ```yaml
      - name: Deploy via SSM
        run: |
          COMMAND_ID=$(aws ssm send-command \
            --instance-ids "${{ secrets.EC2_INSTANCE_ID }}" \
            --document-name "AWS-RunShellScript" \
            --timeout-seconds 120 \
            --parameters 'commands=["bash /home/ubuntu/discord_clone/scripts/deploy.sh ${{ github.ref_name }}"]' \
            --query "Command.CommandId" --output text)

          # Poll with structured status parsing — never grep mixed output
          for i in $(seq 1 60); do
            STATUS=$(aws ssm get-command-invocation \
              --command-id "$COMMAND_ID" \
              --instance-id "${{ secrets.EC2_INSTANCE_ID }}" \
              --query "Status" --output text 2>/dev/null || echo "Pending")

            case "$STATUS" in
              Success)
                echo "Deploy succeeded"
                aws ssm get-command-invocation \
                  --command-id "$COMMAND_ID" \
                  --instance-id "${{ secrets.EC2_INSTANCE_ID }}" \
                  --query "StandardOutputContent" --output text
                break ;;
              Failed|TimedOut|Cancelled)
                echo "Deploy failed with status: $STATUS"
                aws ssm get-command-invocation \
                  --command-id "$COMMAND_ID" \
                  --instance-id "${{ secrets.EC2_INSTANCE_ID }}" \
                  --query "StandardErrorContent" --output text
                exit 1 ;;
              *) sleep 5 ;;
            esac
            [ "$i" -eq 60 ] && { echo "Timed out waiting for SSM command"; exit 1; }
          done
      ```
    - Keep the download asset upload step but convert from SCP to SSM (or use S3 as intermediary)
  - Notes: Health check URL is now port 3001 (from Phase 3). `EC2_INSTANCE_ID` is a new secret

- [ ] Task 4.5: Handle download asset upload without SCP
  - File: `.github/workflows/release.yml`
  - Action: Replace `appleboy/scp-action` with S3 intermediary:
    - Upload assets to S3 bucket in CI: `aws s3 cp downloads/ s3://discord-clone-assets/ --recursive`
    - In SSM command, pull from S3: `aws s3 sync s3://discord-clone-assets/ /home/ubuntu/discord_clone/data/downloads/`
    - Add S3 read/write permissions to the deploy IAM role
  - Notes: Alternatively, the download assets could be served directly from GitHub Releases URLs instead of being hosted on EC2. This simplifies the pipeline

- [ ] Task 4.6: Add new GitHub secrets and remove old ones
  - File: N/A (GitHub Settings)
  - Action: Add secrets: `AWS_DEPLOY_ROLE_ARN`, `EC2_INSTANCE_ID`. After verifying SSM deploy works, remove: `EC2_SSH_KEY`, `EC2_HOST`, `EC2_USER`, `EC2_DEPLOY_PATH`

- [ ] Task 4.7: Close port 22 in EC2 security group
  - File: N/A (AWS Console)
  - Action: Remove the inbound rule allowing TCP port 22 from the EC2 security group
  - Notes: Do this AFTER verifying SSM access works. Keep SSM as the only remote access method. If you need interactive shell access, use `aws ssm start-session`

#### Acceptance Criteria

- [ ] AC 4.1: Given a tag is pushed, when the `deploy-server` job runs, then it authenticates via OIDC (no static AWS keys) and assumes the deploy IAM role
- [ ] AC 4.2: Given SSM Agent is running on EC2, when `aws ssm send-command` executes the deploy script, then Docker pulls the new image and restarts the app
- [ ] AC 4.3: Given the deploy completes, when CloudTrail is checked, then the SSM command and its output are logged with full audit trail
- [ ] AC 4.4: Given port 22 is closed in the security group, when an SSH connection is attempted, then it is refused
- [ ] AC 4.5: Given the `production` environment has required reviewers, when a tag is pushed, then the deploy job waits for manual approval before executing
- [ ] AC 4.6: Given the health check fails after deploy via SSM, when the command exits with code 1, then the GitHub Actions job is marked as failed

---

### Phase 5: Blue-Green Zero-Downtime Deployment

**Story:** As the server operator, I want zero-downtime deployments via blue-green container switching so that users never experience dropped WebSocket connections or interrupted voice calls during deploys.

**Prerequisites:** Phase 2 (registry images), Phase 3 (bridge networking), Phase 4 (SSM deploy). Also requires SIGTERM handler in server code.

#### Tasks

- [ ] Task 5.1: Add SIGTERM handler to server entry point
  - File: `server/src/index.ts`
  - Action: After `await app.listen(...)`, add:
    ```typescript
    const shutdown = async () => {
      app.log.info('SIGTERM received, shutting down gracefully...');
      await app.close();
      process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    ```
  - Notes: This ensures `app.close()` is called, which triggers the `onClose` hook that calls `closeMediasoup()`. Without this, Docker's SIGTERM is ignored and the process is force-killed after `stop_grace_period`

- [ ] Task 5.2: Replace single app service with blue-green pair
  - File: `docker-compose.yml`
  - Action: Replace the `app` service with `app-blue` and `app-green`:
    - `app-blue`: image `ghcr.io/aidenwoodside/discord-clone-server:${IMAGE_TAG:-latest}`, port 3001, networks `backend`, `restart: unless-stopped`, all resource limits/logging/security from Phase 1, health check on port 3001, mediasoup ports 40000-40049
    - `app-green`: identical but port 3002, health check on port 3002, `restart: unless-stopped`, `profiles: [deploy]` (only started during deploys), mediasoup ports 40050-40099
    - Both share the `sqlite_data` volume
    - Both have `stop_grace_period: 30s`
    - Published ports: `3001:3001` for blue, `3002:3002` for green
    - UDP ports: `40000-40049:40000-40049/udp` for blue, `40050-40099:40050-40099/udp` for green (split ranges allow simultaneous binding during switchover)
  - Notes: Green uses `profiles: [deploy]` so it doesn't start on regular `docker compose up -d`. Only `docker compose --profile deploy up -d app-green` starts it. Both slots use `restart: unless-stopped` so that whichever slot is active will auto-recover on crash or EC2 reboot. The `profiles` directive controls initial startup only — it does not affect restart behavior of already-running containers. The deploy script stops the old slot after switchover, so only one slot is running at steady state

- [ ] Task 5.3: Split mediasoup UDP port ranges for blue-green
  - File: `docker-compose.yml`
  - Action: Use separate UDP ranges so both slots can bind simultaneously during switchover:
    ```yaml
    app-blue:
      environment:
        - PORT=3001
        - MEDIASOUP_MIN_PORT=40000
        - MEDIASOUP_MAX_PORT=40049
      ports:
        - "3001:3001"
        - "40000-40049:40000-40049/udp"

    app-green:
      environment:
        - PORT=3002
        - MEDIASOUP_MIN_PORT=40050
        - MEDIASOUP_MAX_PORT=40099
      ports:
        - "3002:3002"
        - "40050-40099:40050-40099/udp"
    ```
  - File: `.env.example`
  - Action: Update comments to document the split: `# Blue: 40000-40049, Green: 40050-40099 (50 ports each for blue-green)`
  - Notes: 50 ports per slot supports 50 concurrent media streams each. Both slots can bind their ranges simultaneously, enabling true zero-downtime switchover where existing voice calls on the old slot drain naturally while new calls land on the new slot. The security group and Terraform config already allow the full 40000-40099 range, so no infrastructure changes are needed

- [ ] Task 5.4: Create deploy script
  - File: `scripts/deploy.sh` (new file)
  - Action: Create deployment script:
    ```bash
    #!/usr/bin/env bash
    set -euo pipefail
    DEPLOY_DIR="/home/ubuntu/discord_clone"
    IMAGE_TAG="${1:?Usage: deploy.sh <image-tag>}"
    export IMAGE_TAG

    # 1. Pull the new image
    docker compose pull app-blue app-green

    # 2. Determine active slot by inspecting running containers (not a file)
    if docker compose ps app-blue --status running -q 2>/dev/null | grep -q .; then
      ACTIVE="blue"; ACTIVE_PORT=3001
      NEW="green"; NEW_PORT=3002
    elif docker compose ps app-green --status running -q 2>/dev/null | grep -q .; then
      ACTIVE="green"; ACTIVE_PORT=3002
      NEW="blue"; NEW_PORT=3001
    else
      echo "No active slot detected — cold start, defaulting to blue"
      ACTIVE="none"
      NEW="blue"; NEW_PORT=3001
    fi
    echo "Active: $ACTIVE -> Deploying: $NEW"

    # 3. Start new slot (no traffic routed yet — nginx still points at old slot)
    docker compose --profile deploy up -d "app-$NEW"

    # 4. Health check new slot
    for i in $(seq 1 30); do
      if curl -sf "http://127.0.0.1:$NEW_PORT/api/health" > /dev/null 2>&1; then
        echo "app-$NEW healthy (attempt $i)"
        break
      fi
      if [ "$i" -eq 30 ]; then
        echo "FAILED: app-$NEW unhealthy after 60s"
        docker compose stop "app-$NEW"
        exit 1
      fi
      sleep 2
    done

    # 5. Switch nginx upstream via template (not in-place sed)
    NGINX_CONF="$DEPLOY_DIR/docker/nginx/nginx.conf"
    NGINX_TEMPLATE="$DEPLOY_DIR/docker/nginx/nginx.conf.template"
    cp "$NGINX_CONF" "$NGINX_CONF.bak"
    sed "s/{{UPSTREAM}}/app-$NEW:$NEW_PORT/" "$NGINX_TEMPLATE" > "$NGINX_CONF"

    # 6. Validate nginx config before reload
    if ! docker compose exec -T nginx nginx -t 2>&1; then
      echo "FATAL: nginx config validation failed — restoring backup"
      cp "$NGINX_CONF.bak" "$NGINX_CONF"
      docker compose stop "app-$NEW"
      exit 1
    fi

    # 7. Reload nginx
    if ! docker compose exec -T nginx nginx -s reload 2>&1; then
      echo "FATAL: nginx reload failed — restoring backup"
      cp "$NGINX_CONF.bak" "$NGINX_CONF"
      docker compose exec -T nginx nginx -s reload || true
      docker compose stop "app-$NEW"
      exit 1
    fi

    # 8. Post-switchover verification
    sleep 2
    if ! curl -sf "https://127.0.0.1/api/health" -k > /dev/null 2>&1; then
      echo "WARNING: post-switchover health check via nginx failed — verify manually"
    fi

    # 9. Drain and stop old slot
    if [ "$ACTIVE" != "none" ]; then
      echo "Draining app-$ACTIVE for 5s..."
      sleep 5
      docker compose stop "app-$ACTIVE"
    fi

    # 10. Cleanup
    rm -f "$NGINX_CONF.bak"
    echo "Deploy complete: app-$NEW ($IMAGE_TAG)"
    ```
  - Notes: Active slot is determined by inspecting which container is actually running (survives reboots, no stale file). Nginx config uses a template file with `{{UPSTREAM}}` placeholder — never raw sed on the live config. `nginx -t` validates before reload, with full rollback on failure at every step. The old slot is stopped only after nginx has switched and been verified, ensuring SQLite is never accessed by two containers simultaneously under load

- [ ] Task 5.5: Create nginx config template for blue-green
  - File: `docker/nginx/nginx.conf.template` (new file)
  - Action: Copy `docker/nginx/nginx.conf` to `docker/nginx/nginx.conf.template`. In the template, replace the upstream block with:
    ```nginx
    upstream app_backend {
        server {{UPSTREAM}};  # Managed by scripts/deploy.sh — do not edit manually
    }
    ```
    Set the initial `nginx.conf` (non-template) to `app-blue:3001` as the default. Add `nginx.conf.bak` to `.gitignore`
  - Notes: The deploy script generates `nginx.conf` from the template by replacing `{{UPSTREAM}}` with the target slot (e.g., `app-green:3002`). This is explicit, auditable, and immune to pattern-matching drift. The template is the source of truth; the generated `nginx.conf` is a deployment artifact

- [ ] Task 5.6: Update SSM deploy command to use deploy script
  - File: `.github/workflows/release.yml`
  - Action: Update the SSM command in `deploy-server` job to call the deploy script:
    ```
    'cd /home/ubuntu/discord_clone',
    'bash scripts/deploy.sh ${{ github.ref_name }}'
    ```
  - Notes: The deploy script handles all blue-green logic. SSM just invokes it

- [ ] Task 5.7: Update nginx depends_on for blue-green
  - File: `docker-compose.yml`
  - Action: Change nginx `depends_on` from `app` to `app-blue` with `condition: service_healthy`

#### Acceptance Criteria

- [ ] AC 5.1: Given SIGTERM is sent to the app container, when `docker stop` is called, then `app.close()` executes, mediasoup workers are shut down, and in-flight requests complete before exit
- [ ] AC 5.2: Given blue is active, when `deploy.sh v1.2.3` runs, then green starts on port 3002, passes health check, nginx switches upstream via template, and blue is stopped only after nginx reload succeeds
- [ ] AC 5.3: Given green is active, when `deploy.sh v1.2.4` runs, then blue starts on port 3001, passes health check, nginx switches upstream via template, and green is stopped only after nginx reload succeeds
- [ ] AC 5.4: Given a deploy is in progress, when a client is connected via WebSocket, then the connection is maintained until nginx switches upstream (no dropped connections during the overlap window)
- [ ] AC 5.5: Given the new slot fails health checks, when the deploy script detects failure, then it stops the new slot and exits with code 1 (old slot remains active, zero impact, nginx config unchanged)
- [ ] AC 5.6: Given a rollback is needed, when the old container was already stopped, then the operator can run `deploy.sh <previous-tag>` to deploy the previous version from the registry
- [ ] AC 5.7: Given the EC2 instance reboots, when Docker starts, then the active slot restarts automatically via `restart: unless-stopped` (no dependency on ephemeral state files)
- [ ] AC 5.8: Given the deploy script generates nginx config from template, when `nginx -t` validation fails, then the backup config is restored, the new slot is stopped, and the script exits with code 1
- [ ] AC 5.9: Given blue uses mediasoup ports 40000-40049 and green uses 40050-40099, when both slots are briefly running during switchover, then both can bind their UDP ranges simultaneously without conflict

---

### Phase 6: Operational Maturity

**Story:** As the server operator, I want centralized secrets in SSM Parameter Store, CloudWatch log shipping, Terraform IaC, external uptime monitoring, and deploy failure notifications so that the infrastructure is observable, reproducible, and self-alerting.

**Prerequisites:** Phase 4 (SSM + OIDC already configured, IAM roles exist).

#### Tasks

- [ ] Task 6.1: Store secrets in SSM Parameter Store
  - File: N/A (AWS CLI)
  - Action: Create SSM SecureString parameters:
    ```bash
    aws ssm put-parameter --name "/discord-clone/prod/JWT_ACCESS_SECRET" \
      --value "$(openssl rand -hex 32)" --type SecureString
    aws ssm put-parameter --name "/discord-clone/prod/JWT_REFRESH_SECRET" \
      --value "$(openssl rand -hex 32)" --type SecureString
    aws ssm put-parameter --name "/discord-clone/prod/TURN_SECRET" \
      --value "$(openssl rand -hex 32)" --type SecureString
    aws ssm put-parameter --name "/discord-clone/prod/GROUP_ENCRYPTION_KEY" \
      --value "<current-value-from-env>" --type SecureString
    ```
  - Notes: Migrate the existing values from the EC2 `.env` file. `GROUP_ENCRYPTION_KEY` must be preserved (changing it invalidates all encrypted messages)

- [ ] Task 6.2: Update deploy script to fetch secrets from SSM into a transient env file
  - File: `scripts/deploy.sh`
  - Action: Before `docker compose up`, fetch secrets from SSM and write to a transient env file with restrictive permissions (never export as shell environment variables, which are visible in `/proc/<pid>/environ` and `docker inspect`):
    ```bash
    SECRETS_FILE="/home/ubuntu/discord_clone/.secrets.env"

    # Fetch all secrets from SSM path and write to transient file
    aws ssm get-parameters-by-path \
      --path "/discord-clone/prod/" \
      --with-decryption \
      --query "Parameters[*].[Name,Value]" \
      --output text | while IFS=$'\t' read -r name value; do
        key=$(basename "$name")
        echo "$key=$value"
    done > "$SECRETS_FILE"
    chmod 600 "$SECRETS_FILE"
    ```
    Update `docker-compose.yml` app services to use `env_file: .secrets.env` instead of the old `.env`. After containers start and read their env, securely delete the file:
    ```bash
    # After docker compose up succeeds and health check passes:
    shred -u "$SECRETS_FILE" 2>/dev/null || rm -f "$SECRETS_FILE"
    ```
  - Notes: EC2 instance profile needs `ssm:GetParameter` and `ssm:GetParametersByPath` permissions with `kms:Decrypt` for the SSM KMS key. Add these to the instance profile IAM role. The transient file approach keeps secrets off the process environment table and out of `docker inspect` output. The file is shredded after container startup. Add `.secrets.env` to `.gitignore` and `.dockerignore`

- [ ] Task 6.3: Update coturn to use SSM secret
  - File: `scripts/deploy.sh`, `docker/coturn/turnserver.prod.conf`
  - Action: At deploy time, template the coturn config with the TURN_SECRET from SSM:
    ```bash
    sed "s|static-auth-secret=.*|static-auth-secret=$TURN_SECRET|" \
      docker/coturn/turnserver.prod.conf.template > docker/coturn/turnserver.prod.conf
    ```
    Create a `.template` version of the coturn config with a placeholder instead of the committed secret

- [ ] Task 6.3.1: Securely delete the legacy `.env` file from EC2
  - File: N/A (EC2 instance)
  - Action: After verifying SSM-based deploys work on at least 2 consecutive deployments:
    ```bash
    # 1. Back up the .env to SSM for emergency recovery
    aws ssm put-parameter --name "/discord-clone/prod/env-backup" \
      --value "$(cat /home/ubuntu/discord_clone/.env)" --type SecureString --overwrite

    # 2. Securely delete the .env file
    shred -vfz -n 5 /home/ubuntu/discord_clone/.env
    rm -f /home/ubuntu/discord_clone/.env

    # 3. Verify the app still starts correctly from SSM secrets
    bash /home/ubuntu/discord_clone/scripts/deploy.sh <current-tag>
    ```
  - Notes: The entire purpose of the SSM migration is to eliminate plaintext secrets on disk. Leaving the old `.env` file in place defeats this goal. This task must not be skipped

- [ ] Task 6.4: Switch logging to CloudWatch awslogs driver
  - File: `docker-compose.yml`
  - Action: Replace `json-file` logging on `app` and `nginx` with:
    ```yaml
    logging:
      driver: awslogs
      options:
        awslogs-region: us-east-1
        awslogs-group: /discord-clone/production/app
        awslogs-stream-prefix: app
        awslogs-create-group: "true"
    ```
    (Similar for nginx with group `/discord-clone/production/nginx`)
    Keep `json-file` on coturn and certbot (lower priority, less useful in CloudWatch)
  - Notes: EC2 instance profile needs `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` permissions. Cost: ~$0.50/GB ingested + $0.03/GB stored

- [ ] Task 6.5: Add deploy failure notification
  - File: `.github/workflows/release.yml`
  - Action: Add notification step at the end of `deploy-server` job:
    ```yaml
    - name: Notify on failure
      if: failure()
      run: |
        curl -H "Content-Type: application/json" \
          -d '{"content": "**Deploy FAILED:** `${{ github.ref_name }}` — [View logs](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})"}' \
          "${{ secrets.DEPLOY_WEBHOOK_URL }}"
    ```
  - Notes: `DEPLOY_WEBHOOK_URL` is a Discord webhook URL. Create a webhook in your Discord server's settings

- [ ] Task 6.6: Create Terraform infrastructure code
  - File: `infrastructure/main.tf` (new file)
  - Action: Create Terraform config defining:
    - `aws_security_group` with inbound rules: 443/tcp, 80/tcp, 3478/udp, 49152-49252/udp (TURN), 40000-40099/udp (mediasoup). All egress
    - `aws_instance` with `ami` (Ubuntu 22.04), `instance_type` (t3.medium), `iam_instance_profile`, encrypted root volume (30GB), user_data script for Docker + SSM agent installation
    - `aws_iam_role` for EC2 instance with `AmazonSSMManagedInstanceCore` + CloudWatch Logs + SSM Parameter Store read permissions
    - `aws_iam_instance_profile` attaching the role
    - `aws_iam_openid_connect_provider` for GitHub Actions OIDC
    - `aws_iam_role` for GitHub Actions deploy with trust policy scoped to repo + tags, and SSM + S3 permissions
  - File: `infrastructure/variables.tf` (new file)
  - Action: Define variables for `aws_region`, `instance_type`, `ami_id`, `github_repo`
  - File: `infrastructure/outputs.tf` (new file)
  - Action: Output `instance_id`, `security_group_id`, `deploy_role_arn`, `instance_public_ip`
  - File: `infrastructure/backend.tf` (new file)
  - Action: Configure S3 backend for state:
    ```hcl
    terraform {
      backend "s3" {
        bucket         = "discord-clone-terraform-state"
        key            = "production/terraform.tfstate"
        region         = "us-east-1"
        dynamodb_table = "terraform-locks"
        encrypt        = true
      }
    }
    ```
  - Notes: Create the S3 bucket and DynamoDB table manually before running `terraform init`. Add `infrastructure/.terraform/` to `.gitignore`

- [ ] Task 6.7: Set up external uptime monitoring
  - File: N/A (External service)
  - Action: Configure UptimeRobot (free tier) or Better Stack to monitor `https://discweeds.com/api/health` every 60 seconds. Set up email/Discord notifications on downtime
  - Notes: This catches issues that internal health checks miss: DNS failures, certificate expiry, nginx misconfiguration, complete EC2 outage

- [ ] Task 6.8: Add nginx cert reload cron
  - File: N/A (EC2 crontab) or `scripts/setup.sh`
  - Action: Add to EC2 crontab:
    ```bash
    0 3 * * * docker compose -f /home/ubuntu/discord_clone/docker-compose.yml exec -T nginx nginx -s reload 2>/dev/null
    ```
  - Notes: Runs daily at 3am. After certbot renews the cert, nginx picks it up on reload. Currently nginx serves the old cert until manually restarted

- [ ] Task 6.9: Update .gitignore for Terraform
  - File: `.gitignore`
  - Action: Add:
    ```
    infrastructure/.terraform/
    infrastructure/*.tfstate
    infrastructure/*.tfstate.backup
    ```

#### Acceptance Criteria

- [ ] AC 6.1: Given secrets are stored in SSM Parameter Store, when the deploy script runs, then it fetches secrets from SSM into a transient `.secrets.env` file (chmod 600), passes them to containers, and shreds the file after startup
- [ ] AC 6.1.1: Given SSM-based deploys are verified working, when the legacy `.env` file is checked on EC2, then it does not exist (securely deleted after migration)
- [ ] AC 6.2: Given the app uses `awslogs` driver, when the app writes a log line via Pino, then it appears in CloudWatch log group `/discord-clone/production/app` within 30 seconds
- [ ] AC 6.3: Given a deploy fails, when the GitHub Actions job detects failure, then a Discord webhook notification is sent with the failure details and a link to the run
- [ ] AC 6.4: Given `terraform plan` is run against `infrastructure/main.tf`, when applied, then it creates/manages the EC2 instance, security groups, IAM roles, and OIDC provider matching the manually configured infrastructure
- [ ] AC 6.5: Given the external uptime monitor is configured, when `https://discweeds.com/api/health` returns non-200 for >60 seconds, then an alert notification is sent
- [ ] AC 6.6: Given certbot renews the TLS certificate, when the daily cron triggers nginx reload, then nginx serves the renewed certificate without manual intervention

---

## Additional Context

### Dependencies

```
Phase 1 (Compose hardening) — no dependencies
  ↓
Phase 2 (GHCR + scanning) — depends on Phase 1
  ↓              ↓
Phase 3          Phase 4
(Bridge net)     (SSM+OIDC)     ← can run in parallel after Phase 2
  ↓                ↓
  →  Phase 5  ←  (Blue-green — depends on Phases 2, 3, and 4)
       ↓
    Phase 6 (Operational maturity — depends on Phase 4)
```

**Phase 1:** None
**Phase 2:** Phase 1 complete. GHCR access (included with GitHub plan). If repo is private, a PAT with `read:packages` scope for EC2 image pulls
**Phase 3:** Phase 2 complete (app uses `image:` not `build:`)
**Phase 4:** Phase 2 complete. AWS account access for IAM (OIDC provider, roles, instance profile). SSM Agent installed on EC2. Secrets: `AWS_DEPLOY_ROLE_ARN`, `EC2_INSTANCE_ID`. **Note:** Phases 3 and 4 may be executed in parallel after Phase 2
**Phase 5:** Phases 2, 3, and 4 all complete. SIGTERM handler added to server code
**Phase 6:** Phase 4 complete (SSM + OIDC already configured, IAM roles exist). AWS account access for SSM Parameter Store, CloudWatch, S3 (Terraform state). Terraform CLI installed locally. Discord webhook URL for notifications

### Testing Strategy

**Phase 1:** Run `docker compose config` to validate YAML. Deploy and verify `docker stats` shows resource limits. Check `docker inspect` for security options. Verify health check `start_period` by watching container startup logs
**Phase 2:** Push a test tag. Verify image appears in GHCR with all three tags. Verify EC2 can `docker compose pull` the image. Test rollback by setting `IMAGE_TAG` to a previous version
**Phase 3:** Deploy and verify: `docker network inspect backend` shows containers. Test API (`/api/health`), WebSocket (`/ws`), and voice (mediasoup RTP on UDP 40000-40099). Test that coturn TURN relay still works
**Phase 4:** Push a test tag. Verify OIDC auth succeeds in GitHub Actions logs. Verify SSM command executes on EC2. Check CloudTrail for audit entry. Verify SSH is refused after port 22 is closed
**Phase 5:** Deploy a known-good image. Verify traffic switches without dropped connections. Deploy a broken image (bad health check). Verify rollback leaves the old container active. Monitor WebSocket connections during deploy
**Phase 6:** Verify secrets load from SSM (check app startup logs, not the secret values). Verify CloudWatch log group has entries. Run `terraform plan` and verify it matches existing infrastructure. Trigger a failed deploy and verify Discord notification arrives. Check uptime monitor dashboard

### Notes

- **Migration path for SQLite volume:** Phase 1 changes from bind mount (`./data/sqlite`) to named volume (`sqlite_data`). Data migration must be performed with all containers stopped to avoid copying a corrupted database:
  ```bash
  # 1. Stop all containers
  docker compose down

  # 2. Create the named volume
  docker volume create sqlite_data

  # 3. Copy data with read-only source mount
  docker run --rm \
    -v $(pwd)/data/sqlite:/src:ro \
    -v sqlite_data:/dst \
    alpine cp -a /src/. /dst/

  # 4. Verify SQLite integrity on the copy
  docker run --rm -v sqlite_data:/data keinos/sqlite3:latest \
    sqlite3 /data/discord.db "PRAGMA integrity_check;"

  # 5. Start with new compose config
  docker compose up -d

  # 6. Keep old bind mount directory for 7 days as backup, then remove
  # rm -rf ./data/sqlite
  ```
- **Phase ordering follows the dependency graph:** 1→2→(3∥4)→5→6. Phases 3 and 4 may run in parallel after Phase 2. Phase 5 requires all of 2, 3, and 4. Do not skip phases
- **Rollback between phases:** Each phase should be deployable and rollback-able independently. If Phase 3 (networking) breaks voice, revert `docker-compose.yml` to Phase 2 state
- **EC2 still needs config files:** Even with registry images, the EC2 instance needs `docker-compose.yml`, `nginx.conf`, coturn config, landing page, and deploy scripts. These files are managed via git (the repo is still cloned on EC2) or could be managed via SSM documents in the future
- **Phase 5 SQLite safety:** The deploy script is designed so that the old container is stopped before the new container receives any production traffic via nginx. During the brief window where both containers are running (health check phase), only the old container receives traffic through nginx — the new container is only accessed by the health check endpoint (`GET /api/health` which reads via `SELECT 1`). This avoids concurrent SQLite writers. **Critical:** Database migrations must NOT run automatically at container startup. Instead, add a `SKIP_MIGRATIONS=true` environment variable or run migrations as an explicit pre-switchover step in the deploy script (`docker compose exec -T "app-$NEW" npm run db:migrate`) after health check but before nginx switchover. This ensures migrations run while only one container is writing to the database
- **Cost impact:** GHCR is free. SSM is free. CloudWatch Logs ~$5/month. Terraform state S3 <$1/month. UptimeRobot free tier. Total incremental cost: ~$5-6/month
