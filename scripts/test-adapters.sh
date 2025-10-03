#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "[adapter-tests] Docker is required to run adapter tests." >&2
  exit 1
fi

COMPOSE_FILE="docker-compose.adapters.yml"

docker compose -f "$COMPOSE_FILE" up -d

cleanup() {
  docker compose -f "$COMPOSE_FILE" down >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_for() {
  local service=$1
  local cmd=$2
  local max_attempts=${3:-60}
  local attempt=1

  echo "[adapter-tests] Waiting for $service..."
  until docker compose -f "$COMPOSE_FILE" exec -T "$service" sh -c "$cmd" >/dev/null 2>&1; do
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "[adapter-tests] $service did not become ready after $((max_attempts * 2))s. Failing." >&2
      exit 1
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
}

wait_for mysql "mysqladmin ping -h127.0.0.1 -pexample --silent"
wait_for postgres "pg_isready -U postgres"
wait_for mongo "mongosh --quiet --eval 'db.adminCommand({ping:1})' --username root --password example --authenticationDatabase admin"

export TEST_MYSQL_URL="mysql://root:example@127.0.0.1:3316/safecriteria"
export TEST_POSTGRES_URL="postgres://postgres:example@127.0.0.1:5436/safecriteria"
export TEST_MONGO_URL="mongodb://root:example@127.0.0.1:27117/safecriteria?authSource=admin"

npm run test:adapters:raw
