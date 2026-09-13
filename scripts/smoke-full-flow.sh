#!/usr/bin/env bash
set -euo pipefail

gateway_url="${GATEWAY_URL:-http://localhost:3000}"
suffix="$(date +%s%3N)"
password='Learning123!'
owner_email="owner-${suffix}@example.com"
member_email="member-${suffix}@example.com"
correlation="smoke-${suffix}"
project_key="S${suffix: -5}"

call_api() {
  local method="$1" path="$2" body="$3" token="${4:-}" cookie_jar="${5:-}"
  local args=(-sS -f -X "$method" -H "x-correlation-id: $correlation")
  [[ -n "$token" ]] && args+=(-H "authorization: Bearer $token")
  [[ -n "$cookie_jar" ]] && args+=(-b "$cookie_jar" -c "$cookie_jar")
  [[ -n "$body" ]] && args+=(-H "content-type: application/json" -d "$body")
  curl "${args[@]}" "$gateway_url$path"
}

ready_deadline=$((SECONDS + ${SMOKE_READY_TIMEOUT_SECONDS:-180}))
until [[ "$(curl -sS "$gateway_url/health/services" 2>/dev/null | jq -r '.status // empty' 2>/dev/null)" == "ok" ]]; do
  (( SECONDS < ready_deadline )) || { echo "Services did not report ok:" >&2; curl -sS "$gateway_url/health/services" >&2 || true; exit 1; }
  sleep 3
done

owner="$(call_api POST /api/auth/register "{\"email\":\"$owner_email\",\"password\":\"$password\"}")"
member="$(call_api POST /api/auth/register "{\"email\":\"$member_email\",\"password\":\"$password\"}")"
owner_cookie="$(mktemp)"
member_cookie="$(mktemp)"
trap 'rm -f "$owner_cookie" "$member_cookie"' EXIT
owner_session="$(call_api POST /api/auth/login "{\"email\":\"$owner_email\",\"password\":\"$password\"}" '' "$owner_cookie")"
member_session="$(call_api POST /api/auth/login "{\"email\":\"$member_email\",\"password\":\"$password\"}" '' "$member_cookie")"
owner_token="$(jq -r .accessToken <<<"$owner_session")"
member_token="$(jq -r .accessToken <<<"$member_session")"
member_id="$(jq -r .user.id <<<"$member")"

workspace="$(call_api POST /api/workspaces "{\"name\":\"Smoke Workspace $suffix\",\"slug\":\"smoke-$suffix\"}" "$owner_token")"
workspace_id="$(jq -r .workspace.id <<<"$workspace")"
call_api POST "/api/workspaces/$workspace_id/members" "{\"email\":\"$member_email\",\"role\":\"MEMBER\"}" "$owner_token" >/dev/null
members="$(call_api GET "/api/workspaces/$workspace_id/members" '' "$member_token")"
[[ "$(jq -r --arg id "$member_id" '.items[] | select(.userId == $id) | .email' <<<"$members")" == "$member_email" ]] \
  || { echo "Workspace members did not resolve the member email through IAM" >&2; exit 1; }
project="$(call_api POST "/api/workspaces/$workspace_id/projects" "{\"name\":\"Smoke Project $suffix\",\"key\":\"$project_key\"}" "$owner_token")"
project_id="$(jq -r .project.id <<<"$project")"
issue="$(call_api POST "/api/projects/$project_id/issues" "{\"summary\":\"Trace the full event flow\",\"type\":\"TASK\",\"priority\":\"HIGH\",\"assigneeUserId\":\"$member_id\"}" "$owner_token")"
issue_id="$(jq -r .issue.id <<<"$issue")"
issue_version="$(jq -r .issue.version <<<"$issue")"
call_api POST "/api/issues/$issue_id/transitions" "{\"status\":\"IN_PROGRESS\",\"expectedVersion\":$issue_version}" "$owner_token" >/dev/null
call_api POST "/api/issues/$issue_id/comments" '{"body":"Member received the task."}' "$member_token" >/dev/null

notification_id=''
for _ in {1..30}; do
  sleep 2
  notifications="$(call_api GET /api/notifications '' "$member_token")"
  notification_id="$(jq -r --arg issue "$issue_id" \
    'first(.items[] | select(.issueId == $issue and .type == "issue.transitioned") | .id) // empty' <<<"$notifications")"
  [[ -n "$notification_id" ]] && break
done
[[ -n "$notification_id" ]] || { echo "No issue.transitioned notification arrived through Kafka" >&2; exit 1; }
call_api PATCH "/api/notifications/$notification_id/read" '' "$member_token" >/dev/null

rotated_session="$(call_api POST /api/auth/refresh '' '' "$owner_cookie")"
[[ -n "$(jq -r '.accessToken // empty' <<<"$rotated_session")" ]] || { echo "Refresh token rotation failed" >&2; exit 1; }

call_api POST /api/auth/logout '' '' "$owner_cookie" >/dev/null

echo "Full smoke flow passed: workspace=$workspace_id project=$project_id issue=$issue_id correlation=$correlation"
