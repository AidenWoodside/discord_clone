# Deployment Architecture Review: Current State vs. Best Practices

## Overview

This document analyzes the current Docker Compose + GitHub Actions deployment pipeline for the Discord Clone project against industry best practices for deploying to a single AWS EC2 instance. Each section covers what exists today, what best practices recommend, the gap analysis, and concrete recommendations.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Docker Image Management](#2-docker-image-management)
3. [Docker Compose Configuration](#3-docker-compose-configuration)
4. [Network Architecture](#4-network-architecture)
5. [GitHub Actions Pipeline](#5-github-actions-pipeline)
6. [Deployment Strategy & Zero-Downtime](#6-deployment-strategy--zero-downtime)
7. [Rollback Mechanism](#7-rollback-mechanism)
8. [Secret Management](#8-secret-management)
9. [SSL/TLS Certificate Management](#9-ssltls-certificate-management)
10. [Security Hardening](#10-security-hardening)
11. [Monitoring & Observability](#11-monitoring--observability)
12. [Infrastructure Reproducibility](#12-infrastructure-reproducibility)
13. [Prioritized Action Plan](#13-prioritized-action-plan)

---

## 1. Executive Summary

The current deployment pipeline is functional and covers the core workflow: tag a release, build Electron apps, deploy the server to EC2 with health checks and rollback. That is a solid foundation. However, there are several areas where the architecture diverges from best practices in ways that introduce real risk or limit operational capability.

### What You're Doing Well

- **Multi-stage Docker build** with non-root user and pruned devDependencies
- **Health checks** in both Docker Compose and the deployment script
- **Automatic rollback** when health checks fail after deploy
- **Concurrency control** on the release workflow (`cancel-in-progress: false`)
- **TLS termination** with modern cipher suites and HSTS
- **Rate limiting** on API endpoints via nginx
- **Certbot auto-renewal** with 12-hour loop
- **Version validation** ensuring git tag matches package.json

### Critical Gaps

| Gap | Risk | Effort to Fix |
|-----|------|---------------|
| Building Docker images on the EC2 instance | Consumes production resources, no image history for rollback | Medium |
| `network_mode: host` on all services | Zero network isolation between containers | Low |
| SSH-based deployment with static key | Key rotation burden, port 22 exposure, no audit trail | Medium |
| `.env` file for secrets on disk | Secrets at rest on the filesystem, manual rotation | Medium |
| No resource limits on containers | One container can OOM-kill the others | Low |
| No log rotation or aggregation | Disk will fill, no centralized debugging | Low |
| Downtime during every deploy | `docker compose up -d` restarts the container | Medium-High |
| No container registry | Cannot roll back to a specific image by tag | Medium |

---

## 2. Docker Image Management

### Current State

Images are built directly on the EC2 instance during deployment:

```yaml
# release.yml, deploy-server job
sudo docker compose build app    # Builds ON the EC2 instance
sudo docker compose up -d app nginx
```

The rollback mechanism tags the current running image as `app:rollback` before deploying, then restores it if health checks fail.

### Best Practice

**Never build images on the production instance.** Use a container registry (GHCR or ECR) to build in CI, push once, and pull everywhere.

**Why this matters:**
- **Resource contention**: `docker compose build` on EC2 consumes CPU/memory that your running application needs. With mediasoup (WebRTC SFU) running, a build could cause voice call degradation.
- **No image provenance**: You cannot trace which exact code is running. With a registry, every image is tagged with both a git SHA and a semver tag.
- **Slow rollbacks**: Current rollback requires the `app:rollback` tag to exist locally. If someone runs `docker image prune`, the rollback image is gone. With a registry, you always have every version available.
- **No vulnerability scanning**: CI-built images can be scanned by Trivy or GitHub's built-in scanner before they ever reach production.

### Recommended Architecture

```
CI (GitHub Actions)                    EC2 (Production)
┌─────────────────────┐                ┌──────────────────┐
│ 1. Build image      │                │                  │
│ 2. Scan with Trivy  │──push──────>   │ 3. Pull image    │
│ 3. Tag: sha + semver│   (GHCR)       │ 4. Restart       │
│ 4. Push to GHCR     │                │                  │
└─────────────────────┘                └──────────────────┘
```

**Recommended registry: GitHub Container Registry (GHCR)**
- Free for your use case (public repo or included in GitHub plan)
- Zero additional configuration — authenticates with `GITHUB_TOKEN`
- Native integration with GitHub Actions
- ECR is a valid alternative if you want VPC endpoints (private image pulls without internet), but GHCR is simpler for your setup

### Recommended Image Tagging Strategy

Apply multiple tags to every image:

```yaml
tags: |
  ghcr.io/aidenwoodside/discord-clone-server:${{ github.sha }}
  ghcr.io/aidenwoodside/discord-clone-server:${{ github.ref_name }}
  ghcr.io/aidenwoodside/discord-clone-server:latest
```

- **Git SHA** (`abc1234`): Immutable. Guarantees exact code traceability. Use this as the primary deployment tag.
- **Semver** (`v1.2.3`): Human-readable. Maps to releases. Use for rollback reference.
- **`latest`**: Convenience only. Never pin to `latest` in production compose files.

### Recommended CI Build Step

```yaml
build-server-image:
  needs: [validate-version]
  runs-on: ubuntu-latest
  permissions:
    contents: read
    packages: write
  steps:
    - uses: actions/checkout@v4

    - uses: docker/setup-buildx-action@v3

    - uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - uses: docker/build-push-action@v5
      with:
        context: .
        file: server/Dockerfile
        push: true
        tags: |
          ghcr.io/aidenwoodside/discord-clone-server:${{ github.sha }}
          ghcr.io/aidenwoodside/discord-clone-server:${{ github.ref_name }}
          ghcr.io/aidenwoodside/discord-clone-server:latest
        cache-from: type=gha
        cache-to: type=gha,mode=max

    - name: Scan image for vulnerabilities
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: ghcr.io/aidenwoodside/discord-clone-server:${{ github.sha }}
        format: 'sarif'
        output: 'trivy-results.sarif'
        severity: 'CRITICAL,HIGH'
```

### Recommended docker-compose.yml Change

```yaml
services:
  app:
    image: ghcr.io/aidenwoodside/discord-clone-server:${IMAGE_TAG:-latest}
    # Remove: build: ...
```

On EC2, deployment becomes:

```bash
IMAGE_TAG=v1.2.3 docker compose pull app
IMAGE_TAG=v1.2.3 docker compose up -d app
```

---

## 3. Docker Compose Configuration

### Current State

```yaml
services:
  app:
    build:
      context: .
      dockerfile: server/Dockerfile
    env_file: .env
    network_mode: host
    volumes:
      - ./data/sqlite:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

### Issues & Recommendations

#### 3a. No Resource Limits

**Problem**: Without memory/CPU limits, a memory leak in the app or a mediasoup spike can consume all host resources, killing nginx, coturn, and certbot along with it.

**Recommendation**:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 256M

  nginx:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

  coturn:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
```

Tune these based on your EC2 instance size and actual usage. Run `docker stats` under load to baseline.

#### 3b. No Log Rotation

**Problem**: Default `json-file` logging with no rotation will eventually fill your disk. Pino outputs structured JSON to stdout, and Docker captures every line.

**Recommendation**:

```yaml
services:
  app:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
```

Apply this to all services. Alternatively, use the `awslogs` driver to ship logs to CloudWatch (see [Section 11](#11-monitoring--observability)).

#### 3c. Health Check Missing `start_period`

**Problem**: Your app takes time to start (compile migrations, initialize mediasoup workers). Without `start_period`, Docker may mark the container as unhealthy before it finishes booting.

**Recommendation**:

```yaml
healthcheck:
  test: ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:3000/api/health"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 30s
```

#### 3d. Bind Mounts vs Named Volumes

**Problem**: `./data/sqlite:/app/data` is a bind mount. If the host path doesn't exist or has wrong permissions, the container silently fails. Named volumes are managed by Docker and survive `docker compose down`.

**Recommendation**:

```yaml
services:
  app:
    volumes:
      - sqlite_data:/app/data

volumes:
  sqlite_data:
    driver: local
```

Keep bind mounts only for read-only configuration files (nginx.conf, coturn.conf) — which you're already doing correctly with `:ro`.

#### 3e. `depends_on` Should Use Health Conditions

**Problem**: `nginx` has `depends_on: [app]`, but this only waits for the container to *start*, not for the app to be *healthy*. Nginx could start proxying before the app is ready.

**Recommendation**:

```yaml
nginx:
  depends_on:
    app:
      condition: service_healthy
```

#### 3f. Image Pinning

**Problem**: `nginx:alpine` and `coturn/coturn:latest` are unpinned. A `docker compose pull` could introduce a breaking nginx or coturn update into production with no warning.

**Recommendation**: Pin to specific versions:

```yaml
nginx:
  image: nginx:1.27-alpine

coturn:
  image: coturn/coturn:4.6.3
```

Update these deliberately and test before deploying.

---

## 4. Network Architecture

### Current State

Every service uses `network_mode: host`:

```yaml
app:
  network_mode: host
nginx:
  network_mode: host
coturn:
  network_mode: host
```

### Why This Is a Problem

`network_mode: host` completely removes Docker's network isolation. Every container shares the host's network namespace. This means:

1. **No isolation**: If the app is compromised, the attacker has direct access to every port on the host — including coturn, any SSH agent, any local service.
2. **Port conflicts**: If two containers try to bind the same port, one fails silently.
3. **CIS Docker Benchmark violation**: The CIS Docker Benchmark (Section 5.9) explicitly recommends against host networking in production.

### Why You're Probably Using Host Mode

Coturn and mediasoup require broad UDP port ranges (49152-49252 for TURN, 40000-49999 for mediasoup). Publishing 10,000+ UDP ports with `-p` is impractical and slow. Host mode bypasses this.

### Recommended Architecture

Use a **hybrid approach**: custom bridge networks for services that don't need raw port access, host mode only for the services that genuinely require it.

```yaml
services:
  app:
    networks:
      - backend
    ports:
      - "3000:3000"                    # API + WebSocket
      - "40000-40099:40000-40099/udp"  # mediasoup RTP (reduced range)
    # Remove: network_mode: host

  nginx:
    networks:
      - backend
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      app:
        condition: service_healthy
    # Remove: network_mode: host

  coturn:
    network_mode: host                 # Justified: needs 100+ UDP ports
    # Keep host mode for coturn — the UDP port range makes bridge impractical

  certbot:
    networks:
      - backend
    # No ports needed — only accesses shared volumes

networks:
  backend:
    driver: bridge
```

**Key trade-off for mediasoup**: You'll need to reduce `MEDIASOUP_MIN_PORT`/`MEDIASOUP_MAX_PORT` to a manageable range (e.g., 100 ports instead of 10,000). For a single-server Discord clone, 100 concurrent media streams is plenty. If you genuinely need 10,000 ports, keep `app` on host mode too — but document *why*.

**Alternative**: If you decide the mediasoup port range makes bridge mode impractical for `app`, keep `app` and `coturn` on host mode but move `nginx` and `certbot` off host mode. Even partial isolation is better than none.

---

## 5. GitHub Actions Pipeline

### Current State

The deploy step uses SSH to connect to EC2:

```yaml
- name: Deploy to EC2
  uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.EC2_HOST }}
    username: ${{ secrets.EC2_USER }}
    key: ${{ secrets.EC2_SSH_KEY }}
    script: |
      cd "${{ secrets.EC2_DEPLOY_PATH }}"
      git pull origin main
      sudo docker compose build app
      sudo docker compose up -d app nginx
```

### Issues

1. **Static SSH key**: The `EC2_SSH_KEY` secret is a long-lived private key. If compromised, the attacker has full SSH access to your EC2 instance. These keys must be manually rotated — and realistically, they never are.

2. **Port 22 must be open**: Your security group must allow inbound SSH from *somewhere*. Even if restricted to GitHub's IP ranges, that's a moving target.

3. **No audit trail**: SSH commands are not logged in any centralized service. You can't answer "who deployed what, when?" without parsing shell history on the EC2 instance.

4. **`git pull` on production**: The EC2 instance is treated as a working copy of the repo. This is fragile — merge conflicts, dirty state, or partial pulls can break deployments.

5. **No environment protection rules**: Anyone who can push a tag can trigger a production deployment. There's no approval gate.

### Recommended: AWS SSM (Systems Manager) + OIDC

**Replace SSH with SSM Run Command.** This is the AWS-recommended approach for managing EC2 instances:

```
GitHub Actions                         AWS
┌───────────────┐                     ┌──────────────────┐
│ Assume role   │──OIDC───────────>   │ IAM Role         │
│ via OIDC      │                     │ (no static keys) │
│               │──SSM Run Command──> │ EC2 Instance     │
│               │                     │ (no port 22)     │
└───────────────┘                     └──────────────────┘
```

**Benefits:**
- **No SSH keys at all**: OIDC provides short-lived credentials that expire in 1 hour. Nothing to rotate.
- **Port 22 closed**: SSM communicates through the SSM Agent (pre-installed on Amazon Linux, installable on Ubuntu). No inbound ports required.
- **Full audit trail**: Every command is logged in AWS CloudTrail.
- **IAM-based access control**: You can scope the IAM role to only allow `ssm:SendCommand` on specific instances.

### Recommended GitHub Actions Setup

#### Step 1: Configure OIDC in AWS

Create an IAM OIDC Identity Provider:
- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

Create an IAM Role with trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID::oidc-provider/token.actions.githubusercontent.com"
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
    }
  ]
}
```

Attach a policy granting:
- `ssm:SendCommand` on your EC2 instance
- `ssm:GetCommandInvocation` (to read command output)
- `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer` (if using ECR)

#### Step 2: Install SSM Agent on EC2

```bash
# Ubuntu
sudo snap install amazon-ssm-agent --classic
sudo systemctl enable amazon-ssm-agent
sudo systemctl start amazon-ssm-agent
```

The EC2 instance also needs an IAM Instance Profile with `AmazonSSMManagedInstanceCore` policy.

#### Step 3: Updated Deploy Job

```yaml
deploy-server:
  needs: [publish-release, build-server-image]
  runs-on: ubuntu-latest
  permissions:
    id-token: write
    contents: read
  environment:
    name: production
    url: https://discweeds.com
  steps:
    - uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
        aws-region: us-east-1

    - name: Deploy via SSM
      run: |
        COMMAND_ID=$(aws ssm send-command \
          --instance-ids "${{ secrets.EC2_INSTANCE_ID }}" \
          --document-name "AWS-RunShellScript" \
          --parameters "commands=[
            'cd /home/ubuntu/discord_clone',
            'export IMAGE_TAG=${{ github.ref_name }}',
            'docker compose pull app',
            'docker compose up -d app nginx',
            'for i in $(seq 1 30); do curl -sf http://127.0.0.1:3000/api/health > /dev/null 2>&1 && echo SUCCESS && exit 0; sleep 2; done',
            'echo HEALTH_CHECK_FAILED && exit 1'
          ]" \
          --query "Command.CommandId" --output text)

        # Wait for command to complete
        aws ssm wait command-executed \
          --command-id "$COMMAND_ID" \
          --instance-id "${{ secrets.EC2_INSTANCE_ID }}" || true

        # Get output
        aws ssm get-command-invocation \
          --command-id "$COMMAND_ID" \
          --instance-id "${{ secrets.EC2_INSTANCE_ID }}" \
          --query "[Status, StandardOutputContent, StandardErrorContent]" \
          --output text
```

#### Step 4: Add Environment Protection Rules

In GitHub Settings > Environments > `production`:
- **Required reviewers**: Add yourself (or a teammate). Forces manual approval before deploying.
- **Branch restrictions**: Only allow deployments from tags matching `v*`.

This ensures a stray tag push doesn't automatically deploy to production.

### If You Want to Keep SSH (Simpler Short-Term)

If SSM feels like too much infrastructure for now, at minimum:

1. **Restrict the security group**: Allow port 22 only from GitHub Actions IP ranges (available via `api.github.com/meta`), or better, only from your personal IP.
2. **Use ED25519 keys**: `ssh-keygen -t ed25519` — stronger and faster than RSA.
3. **Add environment protection rules**: Still add the `environment: production` gate with required reviewers.
4. **Stop doing `git pull` on production**: Switch to the registry-based approach so the EC2 instance only pulls images, never source code.

---

## 6. Deployment Strategy & Zero-Downtime

### Current State

The deploy does:

```bash
sudo docker compose build app          # App is still running
sudo docker compose up -d app nginx    # Stops old container, starts new one
# Health check loop...
```

**This causes downtime.** When `docker compose up -d app` runs, Docker stops the old container and starts the new one. During that window (typically 5-15 seconds, longer if the new container is slow to boot), the app is unreachable. WebSocket connections are dropped. Active voice calls are interrupted.

### Best Practice: Blue-Green Deployment

For a single EC2 instance, the proven zero-downtime pattern is blue-green deployment with a reverse proxy handling traffic switching.

```
                   ┌──────────────┐
  Clients ────────>│    Nginx     │
                   │  (port 443)  │
                   └──────┬───────┘
                          │
                   ┌──────┴───────┐
                   │   upstream   │
                   │              │
              ┌────┴────┐   ┌────┴────┐
              │  Blue   │   │  Green  │
              │ (active)│   │ (idle)  │
              │ :3001   │   │ :3002   │
              └─────────┘   └─────────┘
```

### Recommended Implementation

#### docker-compose.yml

```yaml
services:
  app-blue:
    image: ghcr.io/aidenwoodside/discord-clone-server:${IMAGE_TAG:-latest}
    env_file: .env
    environment:
      - PORT=3001
    networks:
      - backend
    ports:
      - "3001:3001"
    volumes:
      - sqlite_data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:3001/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"

  app-green:
    image: ghcr.io/aidenwoodside/discord-clone-server:${IMAGE_TAG:-latest}
    env_file: .env
    environment:
      - PORT=3002
    networks:
      - backend
    ports:
      - "3002:3002"
    volumes:
      - sqlite_data:/app/data
    restart: "no"       # Only running during deployments
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:3002/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
    profiles:
      - deploy         # Only started during deployments

  nginx:
    image: nginx:1.27-alpine
    networks:
      - backend
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./docker/nginx/landing:/usr/share/nginx/landing:ro
      - ./data/downloads:/usr/share/nginx/downloads:ro
      - certbot_certs:/etc/letsencrypt:ro
      - certbot_webroot:/var/www/certbot:ro
    depends_on:
      app-blue:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"

  # ... coturn and certbot remain as-is ...

networks:
  backend:
    driver: bridge

volumes:
  sqlite_data:
  certbot_certs:
  certbot_webroot:
```

#### Deployment Script (scripts/deploy.sh)

```bash
#!/usr/bin/env bash
set -euo pipefail

IMAGE_TAG="${1:?Usage: deploy.sh <image-tag>}"

export IMAGE_TAG

echo "Deploying image tag: $IMAGE_TAG"

# 1. Pull the new image
docker compose pull app-blue app-green

# 2. Determine which slot is active
ACTIVE=$(cat /tmp/active-slot 2>/dev/null || echo "blue")
if [ "$ACTIVE" = "blue" ]; then
  NEW="green"
  NEW_PORT=3002
else
  NEW="blue"
  NEW_PORT=3001
fi

echo "Active: $ACTIVE, deploying to: $NEW"

# 3. Start the new slot
docker compose --profile deploy up -d "app-$NEW"

# 4. Wait for health check
echo "Waiting for app-$NEW to become healthy..."
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$NEW_PORT/api/health" > /dev/null 2>&1; then
    echo "app-$NEW is healthy (attempt $i)"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "FAILED: app-$NEW did not pass health checks. Stopping it."
    docker compose stop "app-$NEW"
    exit 1
  fi
  sleep 2
done

# 5. Switch nginx upstream to the new slot
sed -i "s/127.0.0.1:[0-9]*/127.0.0.1:$NEW_PORT/" /home/ubuntu/discord_clone/docker/nginx/nginx.conf
docker compose exec nginx nginx -s reload

echo "Traffic switched to app-$NEW"

# 6. Stop the old slot
docker compose stop "app-$ACTIVE"

# 7. Record new active slot
echo "$NEW" > /tmp/active-slot

echo "Deploy complete. Active: $NEW ($IMAGE_TAG)"
```

#### Nginx Upstream Change

```nginx
upstream app_backend {
    server 127.0.0.1:3001;  # Updated by deploy script
}
```

### SQLite Caveat

Since both blue and green share the same SQLite volume, be careful with migrations. SQLite supports only one writer at a time, so the brief overlap during blue-green switching (both containers running) is safe — but if a migration adds/removes columns, the old container may error during the overlap. For this project, the overlap is seconds, so this is acceptable. If it becomes a concern, run migrations as a separate step before starting the new container.

### Alternative: If Blue-Green Feels Like Overkill

At minimum, add `stop_grace_period` to let the app finish in-flight requests before being killed:

```yaml
app:
  stop_grace_period: 30s
  stop_signal: SIGTERM
```

And ensure your Fastify server handles SIGTERM gracefully (calls `fastify.close()`). This won't eliminate downtime but reduces dropped connections.

---

## 7. Rollback Mechanism

### Current State

```bash
# Save current image before deploying
CURRENT_IMAGE_ID=$(sudo docker compose images app -q 2>/dev/null || echo "")
if [ -n "$CURRENT_IMAGE_ID" ]; then
  sudo docker tag "$CURRENT_IMAGE_ID" app:rollback
fi

# On failure: restore the tagged image
sudo docker tag app:rollback "${COMPOSE_PROJECT}-app:latest"
sudo docker compose up -d --force-recreate app
```

### Issues

1. **Single rollback point**: Only one `app:rollback` tag exists. You can only roll back one version.
2. **Fragile**: If anyone runs `docker image prune -a`, the rollback image is deleted.
3. **Git-based**: The deployment also does `git checkout "$PREV_COMMIT"` to restore files. This means the EC2 instance's git state must match the running container — a coupling that's easy to break.

### Recommended: Registry-Based Rollback

With a container registry, rollback becomes trivial:

```bash
# Roll back to previous version
IMAGE_TAG=v1.2.2 docker compose pull app
IMAGE_TAG=v1.2.2 docker compose up -d app
```

Every version ever built exists in the registry. You can roll back to any version at any time. No local image tags to manage.

With blue-green deployment, rollback is even simpler: the old container is still running. Just switch nginx back:

```bash
# Instant rollback — old container never stopped
sed -i "s/127.0.0.1:[0-9]*/127.0.0.1:$OLD_PORT/" docker/nginx/nginx.conf
docker compose exec nginx nginx -s reload
```

### Recommended: GHCR Retention

Configure a GHCR retention policy to keep the last 10 tagged versions and expire untagged images after 30 days. This prevents registry bloat while keeping rollback history.

---

## 8. Secret Management

### Current State

Secrets are stored in a `.env` file on the EC2 instance, generated by `scripts/setup.sh`:

```bash
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
TURN_SECRET=$(openssl rand -hex 32)
```

The `.env` file has `chmod 600` permissions.

### Issues

1. **Secrets at rest on disk**: If the EC2 instance is compromised, the `.env` file is immediately available. No encryption at rest beyond filesystem permissions.
2. **No rotation**: Secrets are generated once during setup and never rotated. JWT secrets, in particular, should be rotatable.
3. **No centralized management**: If you add a second server or need to update a secret, you must SSH in and manually edit `.env`.
4. **Backup risk**: If you snapshot the EC2 instance (AMI), secrets are included in the snapshot.

### Recommended: AWS SSM Parameter Store

SSM Parameter Store is **free** for standard parameters and provides encryption via KMS:

```bash
# Store secrets (one-time setup)
aws ssm put-parameter \
  --name "/discord-clone/prod/JWT_ACCESS_SECRET" \
  --value "$(openssl rand -hex 32)" \
  --type SecureString

aws ssm put-parameter \
  --name "/discord-clone/prod/JWT_REFRESH_SECRET" \
  --value "$(openssl rand -hex 32)" \
  --type SecureString

aws ssm put-parameter \
  --name "/discord-clone/prod/TURN_SECRET" \
  --value "$(openssl rand -hex 32)" \
  --type SecureString
```

On the EC2 instance, fetch secrets at deploy time:

```bash
# In deploy script
export JWT_ACCESS_SECRET=$(aws ssm get-parameter \
  --name "/discord-clone/prod/JWT_ACCESS_SECRET" \
  --with-decryption --query "Parameter.Value" --output text)

export JWT_REFRESH_SECRET=$(aws ssm get-parameter \
  --name "/discord-clone/prod/JWT_REFRESH_SECRET" \
  --with-decryption --query "Parameter.Value" --output text)

export TURN_SECRET=$(aws ssm get-parameter \
  --name "/discord-clone/prod/TURN_SECRET" \
  --with-decryption --query "Parameter.Value" --output text)

# Pass to Docker Compose
docker compose up -d
```

Docker Compose can use environment variables directly — no `.env` file needed. The secrets exist only in memory during the container's lifetime.

### If You Want to Keep .env (Simpler Short-Term)

At minimum:
1. Encrypt the EBS volume (default for new EC2 instances, but verify)
2. Don't include `.env` in AMI snapshots
3. Document a rotation procedure

---

## 9. SSL/TLS Certificate Management

### Current State

Your certbot setup is solid:

```yaml
certbot:
  image: certbot/certbot
  entrypoint: /bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done'
  volumes:
    - ./data/certs:/etc/letsencrypt
    - ./data/certbot-webroot:/var/www/certbot
```

### Recommendations

#### 9a. Reload Nginx After Renewal

Currently, certbot renews the certificate but nginx keeps serving the old cert until it's restarted. Add a deploy hook:

```yaml
certbot:
  image: certbot/certbot
  entrypoint: /bin/sh -c 'trap exit TERM; while :; do certbot renew --deploy-hook "wget -qO- http://127.0.0.1:80/nginx-reload || true"; sleep 12h & wait $${!}; done'
```

Or more practically, since certbot can't directly signal nginx in a different container, use a shared volume with a flag file that a cron job on the host checks, or simply add a daily cron on the host:

```bash
# /etc/cron.daily/reload-nginx
docker compose -f /home/ubuntu/discord_clone/docker-compose.yml exec -T nginx nginx -s reload
```

#### 9b. Use Named Volumes for Certs

Switch from bind mounts to named volumes for certificate storage (as shown in the compose example in Section 6). This is more robust and survives accidental `rm -rf data/`.

#### 9c. OCSP Stapling (2025 Change)

As of May 2025, Let's Encrypt certificates **no longer include OCSP URLs**. If you have `ssl_stapling on;` in your nginx config, you should remove it. Your current config doesn't include it, so you're fine — just don't add it.

---

## 10. Security Hardening

### Current State — What's Good

- Non-root user (`appuser:appgroup`) in Dockerfile
- `.dockerignore` excludes `.git`, `.env`, `node_modules`
- Read-only config mounts (`:ro`) for nginx and coturn
- HSTS with 2-year max-age
- Rate limiting on `/api/`

### Recommendations

#### 10a. Add Security Options to Containers

```yaml
services:
  app:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp

  nginx:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE    # Needed for ports 80/443
    read_only: true
    tmpfs:
      - /tmp
      - /var/cache/nginx
      - /var/run
```

- **`no-new-privileges`**: Prevents privilege escalation via setuid/setgid binaries
- **`cap_drop: ALL`**: Drops all Linux capabilities by default
- **`read_only: true`**: Prevents writing to the container filesystem (use `tmpfs` for temp dirs)

#### 10b. Pin Base Image Digests for Supply Chain Security

For maximum security, pin to image digests instead of tags:

```dockerfile
FROM node:20-alpine@sha256:abc123... AS builder
```

This ensures your build is reproducible even if the `node:20-alpine` tag is re-pushed with different contents. Use Dependabot or Renovate to automate digest updates.

#### 10c. Coturn Secret in Production Config

The coturn production config has secrets in a file that's committed to git:

```
static-auth-secret=change-me-turn-secret
```

While `setup.sh` replaces this, the file still contains a placeholder that could be accidentally used. Consider templating this at deploy time rather than sed-replacing in a committed file.

---

## 11. Monitoring & Observability

### Current State

- Pino structured logging with redaction
- Health check endpoint (`/api/health`) verifying database connectivity
- Docker health check using `wget`
- No log aggregation
- No alerting
- No metrics

### Recommendations

#### 11a. Ship Logs to CloudWatch (Simplest)

```yaml
services:
  app:
    logging:
      driver: awslogs
      options:
        awslogs-region: us-east-1
        awslogs-group: /discord-clone/production/app
        awslogs-stream-prefix: app
        awslogs-create-group: "true"

  nginx:
    logging:
      driver: awslogs
      options:
        awslogs-region: us-east-1
        awslogs-group: /discord-clone/production/nginx
        awslogs-stream-prefix: nginx
        awslogs-create-group: "true"
```

The EC2 instance needs an IAM policy with `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`.

**Cost**: CloudWatch Logs pricing is $0.50/GB ingested + $0.03/GB stored. For a small app, this is typically under $5/month.

#### 11b. Deploy Failure Notifications

Add a notification step to the GitHub Actions workflow:

```yaml
- name: Notify on failure
  if: failure()
  run: |
    # Post to a Discord webhook (you're building Discord, after all)
    curl -H "Content-Type: application/json" \
      -d '{"content": "Deployment of ${{ github.ref_name }} FAILED. Check: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"}' \
      "${{ secrets.DEPLOY_WEBHOOK_URL }}"
```

#### 11c. Uptime Monitoring

Use a free external uptime monitor (UptimeRobot, Better Stack, etc.) to hit `https://discweeds.com/api/health` every 60 seconds. This catches issues that your internal health checks miss (nginx misconfiguration, DNS issues, certificate expiry).

---

## 12. Infrastructure Reproducibility

### Current State

The EC2 instance is manually provisioned. `scripts/setup.sh` configures the application, but the EC2 instance itself (security groups, IAM roles, EBS volumes, instance type) is configured through the AWS Console.

### The Risk

If the EC2 instance is terminated (accidental, or AWS retiring the underlying hardware), you must manually recreate everything from memory: security groups, IAM roles, instance profile, EBS encryption, SSM agent installation, Docker installation, etc.

### Recommendation: Minimum Viable Terraform

Even for a single instance, ~100 lines of Terraform saves hours of disaster recovery:

```hcl
# infrastructure/main.tf

provider "aws" {
  region = "us-east-1"
}

resource "aws_security_group" "app" {
  name_prefix = "discord-clone-"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 3478
    to_port     = 3478
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 49152
    to_port     = 49252
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "app" {
  ami                  = "ami-0c7217cdde317cfec"  # Ubuntu 22.04 LTS
  instance_type        = "t3.medium"
  iam_instance_profile = aws_iam_instance_profile.app.name

  vpc_security_group_ids = [aws_security_group.app.id]

  root_block_device {
    volume_size = 30
    encrypted   = true
  }

  user_data = file("init.sh")

  tags = {
    Name = "discord-clone-production"
  }
}

resource "aws_iam_role" "app" {
  name = "discord-clone-ec2"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "app" {
  name = "discord-clone-ec2"
  role = aws_iam_role.app.name
}
```

Store the Terraform state in an S3 bucket with DynamoDB locking for safety.

This is a "nice to have" — but when you need it, you'll be very glad you have it.

---

## 13. Prioritized Action Plan

### Phase 1: Quick Wins (Low Effort, High Impact)

These can be done in a single PR with no architectural changes:

| Change | Files Modified | Impact |
|--------|---------------|--------|
| Add resource limits to all services | `docker-compose.yml` | Prevents OOM cascading failures |
| Add log rotation to all services | `docker-compose.yml` | Prevents disk fill |
| Add `start_period` to health checks | `docker-compose.yml` | Prevents false-negative health during boot |
| Add `stop_grace_period: 30s` to app | `docker-compose.yml` | Fewer dropped connections during deploy |
| Pin nginx and coturn image versions | `docker-compose.yml` | Prevents surprise breaking changes |
| Add `depends_on: condition: service_healthy` | `docker-compose.yml` | Nginx waits for app to be ready |
| Add `security_opt: no-new-privileges` | `docker-compose.yml` | Blocks privilege escalation |
| Add environment protection rules | GitHub Settings | Manual approval gate for deploys |

### Phase 2: Container Registry (Medium Effort, High Impact)

Eliminates building on production and enables image-based rollback:

1. Add `build-server-image` job to `release.yml` (builds and pushes to GHCR)
2. Change `docker-compose.yml` to use `image:` instead of `build:`
3. Update deploy script to `docker compose pull` instead of `docker compose build`
4. Remove `git pull` from deploy — EC2 no longer needs the source code
5. Add Trivy scanning in CI

### Phase 3: Network Isolation (Medium Effort, Medium Impact)

Move nginx and certbot off host networking:

1. Create custom bridge network in `docker-compose.yml`
2. Move nginx, certbot, and app (if mediasoup port range is manageable) to bridge
3. Update nginx upstream to use Docker DNS (`app:3000` instead of `127.0.0.1:3000`)
4. Test WebSocket and API proxy behavior

### Phase 4: SSM + OIDC (Medium Effort, High Impact)

Replace SSH-based deployment with AWS-native tooling:

1. Create OIDC Identity Provider in AWS IAM
2. Create deploy IAM Role with trust policy scoped to repo + tags
3. Install SSM Agent on EC2, attach instance profile
4. Update `release.yml` to use `aws-actions/configure-aws-credentials` + `ssm send-command`
5. Remove `EC2_SSH_KEY` secret from GitHub
6. Close port 22 in security group

### Phase 5: Zero-Downtime Deploys (Higher Effort, Medium Impact)

Implement blue-green deployment:

1. Add `app-blue` and `app-green` services to `docker-compose.yml`
2. Create `scripts/deploy.sh` with traffic switching logic
3. Update nginx upstream to be dynamically switchable
4. Test rollback by deploying a broken image

### Phase 6: Operational Maturity (Ongoing)

- Move secrets to SSM Parameter Store
- Set up CloudWatch log shipping
- Add external uptime monitoring
- Write Terraform for infrastructure reproducibility
- Add deploy failure notifications

---

## Summary: Current vs. Recommended

| Aspect | Current | Recommended |
|--------|---------|-------------|
| **Image build location** | On EC2 (`docker compose build`) | In CI, push to GHCR |
| **Image rollback** | Local `app:rollback` tag | Any version from registry |
| **Network mode** | `host` on all services | Bridge network, host only for coturn |
| **Deployment method** | SSH with static key | AWS SSM + OIDC (no keys, no port 22) |
| **Deployment strategy** | Stop old, start new (downtime) | Blue-green (zero downtime) |
| **Secret storage** | `.env` file on disk | SSM Parameter Store (encrypted, centralized) |
| **Resource limits** | None | CPU + memory limits on all services |
| **Log management** | None (unbounded growth) | Rotation + CloudWatch shipping |
| **Deploy gate** | Anyone who pushes a tag | Environment protection rules with approvers |
| **Infrastructure** | Manual AWS Console | Terraform (reproducible) |
| **Image scanning** | None | Trivy in CI |
| **Image tags** | None (local builds) | Git SHA + semver + latest |
