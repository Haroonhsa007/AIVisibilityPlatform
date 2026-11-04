#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:5000}"
BASE_URL="${BASE_URL%/}"
trap 'echo "Smoke failed at line $LINENO" >&2' ERR
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
# Match Compose's IPv4 loopback binding, including on macOS with IPv6 AirPlay.
api() { curl --ipv4 --fail-with-body --silent --show-error --max-time 30 "$@"; }
domain="smoke-$(date +%s)-${RANDOM}.example.com"
payload=$(jq -nc --arg domain "$domain" '{name:"Surfer SEO",domain:$domain,industry:"SEO Software",description:"AI-powered SEO content optimization tool",competitors:["clearscope.io","marketmuse.com","frase.io"]}')
profile=$(api -X POST "$BASE_URL/api/v1/profiles" -H 'Content-Type: application/json' -d "$payload")
profile_uuid=$(jq -er '.profile_uuid' <<<"$profile")
run=$(api -X POST "$BASE_URL/api/v1/profiles/$profile_uuid/run")
run_uuid=$(jq -er '.run_uuid' <<<"$run")
deadline=$((SECONDS + 120))
while (( SECONDS < deadline )); do
  run=$(api "$BASE_URL/api/v1/runs/$run_uuid")
  status=$(jq -er '.status' <<<"$run")
  case "$status" in
    completed) break ;;
    partial|failed) echo "Pipeline $status: $run" >&2; exit 1 ;;
  esac
  sleep 1
done
[[ "$status" == completed ]] || { echo "Pipeline timed out after 120s" >&2; exit 1; }
queries=$(api "$BASE_URL/api/v1/profiles/$profile_uuid/queries?per_page=100")
jq -e '.items | length >= 10' <<<"$queries" >/dev/null
jq -e 'all(.items[]; .opportunity_score != null and .opportunity_score >= 0 and .opportunity_score <= 1)' <<<"$queries" >/dev/null
hidden=$(api "$BASE_URL/api/v1/profiles/$profile_uuid/queries?status=not_visible")
jq -e '(.items | length > 0) and all(.items[]; .domain_visible == false)' <<<"$hidden" >/dev/null
recommendations=$(api "$BASE_URL/api/v1/profiles/$profile_uuid/recommendations")
jq -e '.items | length > 0' <<<"$recommendations" >/dev/null
query_uuid=$(jq -er '.items[0].query_uuid' <<<"$queries")
rechecked=$(api -X POST "$BASE_URL/api/v1/queries/$query_uuid/recheck")
jq -e '.last_checked_at != null and .opportunity_score != null' <<<"$rechecked" >/dev/null
dashboard=$(api "$BASE_URL/api/v1/dashboard")
jq -e '.total_profiles >= 1 and .total_queries >= 10 and (.recent_runs | length > 0)' <<<"$dashboard" >/dev/null
echo "Smoke passed: profile=$profile_uuid run=$run_uuid queries=$(jq '.total' <<<"$queries") recommendations=$(jq '.items | length' <<<"$recommendations")"
