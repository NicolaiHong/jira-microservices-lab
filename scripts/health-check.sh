#!/usr/bin/env bash
set -euo pipefail

check() {
  local name="$1"
  local url="$2"

  echo "Checking ${name}: ${url}"
  curl --fail --silent --show-error "${url}" > /dev/null
}

check "api-gateway" "http://localhost:3000/health"
check "api-gateway-services" "http://localhost:3000/health/services"
check "iam-service" "http://localhost:8081/health"
check "project-service" "http://localhost:8082/health"
check "issue-service" "http://localhost:8083/health"
check "notification-service" "http://localhost:8084/health"

echo "All health checks passed"
