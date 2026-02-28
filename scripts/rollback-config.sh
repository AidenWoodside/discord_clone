#!/usr/bin/env bash
set -euo pipefail
TARGET_REF="${1:?Usage: rollback-config.sh <git-ref>}"
DEPLOY_DIR="/home/ubuntu/discord_clone"
cd "$DEPLOY_DIR"

echo "Rolling back config files to $TARGET_REF..."
git fetch origin
git checkout "$TARGET_REF" -- docker-compose.yml docker/ scripts/

# Fetch secrets — try SSM first (Phase 6+), fall back to .env (Phase 1-5)
if command -v aws &>/dev/null && aws ssm get-parameter \
    --name "/discord-clone/prod/DATABASE_URL" \
    --query "Parameter.Value" --output text &>/dev/null 2>&1; then
  echo "Fetching secrets from SSM..."
  export JWT_ACCESS_SECRET=$(aws ssm get-parameter --name "/discord-clone/prod/JWT_ACCESS_SECRET" --with-decryption --query "Parameter.Value" --output text)
  export JWT_REFRESH_SECRET=$(aws ssm get-parameter --name "/discord-clone/prod/JWT_REFRESH_SECRET" --with-decryption --query "Parameter.Value" --output text)
  export TURN_SECRET=$(aws ssm get-parameter --name "/discord-clone/prod/TURN_SECRET" --with-decryption --query "Parameter.Value" --output text)
  export GROUP_ENCRYPTION_KEY=$(aws ssm get-parameter --name "/discord-clone/prod/GROUP_ENCRYPTION_KEY" --with-decryption --query "Parameter.Value" --output text)
  export DATABASE_URL=$(aws ssm get-parameter --name "/discord-clone/prod/DATABASE_URL" --with-decryption --query "Parameter.Value" --output text)
elif [ -f "$DEPLOY_DIR/.env" ]; then
  echo "Using .env file for secrets (pre-Phase 6)"
else
  echo "FATAL: No secret source available (no SSM access, no .env file)"
  exit 1
fi

echo "Restarting services with rolled-back config..."
docker compose down
docker compose up -d

# Detect active health check port (blue-green or single app)
if docker compose ps app-blue --status running -q 2>/dev/null | grep -q .; then
  HEALTH_PORT=3001
elif docker compose ps app-green --status running -q 2>/dev/null | grep -q .; then
  HEALTH_PORT=3002
else
  HEALTH_PORT=3000  # Pre-Phase 5 single app service
fi

echo "Verifying health on port $HEALTH_PORT..."
for i in $(seq 1 15); do
  if curl -sf "http://127.0.0.1:$HEALTH_PORT/api/health" > /dev/null 2>&1; then
    echo "Health check passed"
    exit 0
  fi
  sleep 2
done
echo "WARNING: health check failed after rollback — investigate manually"
exit 1
