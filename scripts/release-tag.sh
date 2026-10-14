#!/usr/bin/env bash
# Runs on every push to master. If package.json's version has no tag yet, this is a release merge:
# tag v<version>, publish the Forgejo release with the changelog section, and report what the follow-up
# jobs should do (outputs: version, is_release, functions_changed).
# Env (from .forgejo/workflows/release.yml): TOKEN, API, GITHUB_OUTPUT. Optional: NOTIFY_WEBHOOK, NOTIFY_FORMAT.
set -euo pipefail

: "${TOKEN:?AGENT_TOKEN secret not set}"; : "${API:?}"
TOKEN_VAL="$TOKEN"; unset TOKEN
api() { curl -sS -H "Authorization: token $TOKEN_VAL" -H "Content-Type: application/json" "$@"; }
log() { echo "[release-tag] $*"; }
out() { echo "$1=$2" >>"${GITHUB_OUTPUT:-/dev/null}"; log "output $1=$2"; }
RUN_URL="${GITHUB_SERVER_URL:-}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"
notify() {
  [ -n "${NOTIFY_WEBHOOK:-}" ] || return 0
  if [ "${NOTIFY_FORMAT:-ntfy}" = ntfy ]; then
    curl -sS -o /dev/null --max-time 15 -H "Title: $1" -H "Priority: ${3:-default}" -H "Click: ${4:-$RUN_URL}" -d "$2" "$NOTIFY_WEBHOOK"
  else
    curl -sS -o /dev/null --max-time 15 -H "Content-Type: application/json" -d "$(jq -n --arg t "$1" --arg m "$2" --arg u "${4:-$RUN_URL}" --arg p "${3:-default}" \
      '{title:$t, message:$m, text:($t+": "+$m), content:($t+": "+$m), url:$u, priority:$p}')" "$NOTIFY_WEBHOOK"
  fi
}

git fetch -q --tags origin
ver=$(node -p "require('./package.json').version"); tag="v$ver"
out version "$ver"
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  log "$tag already exists; this push is not a release."; out is_release false; out functions_changed false; exit 0
fi
[ -f CHANGELOG.md ] || { log "No CHANGELOG.md; not a release cut by release-cut.sh."; out is_release false; out functions_changed false; exit 0; }

# previous release tag (highest v* tag) decides whether functions changed
prev_tag=$(git tag --list 'v*' --sort=-v:refname | head -n1 || true)
if [ -n "$prev_tag" ] && [ -n "$(git diff --name-only "$prev_tag" HEAD -- functions/ | grep -v '^functions/imports/' || true)" ]; then fc=true; else fc=false; fi
[ -z "$prev_tag" ] && fc=true   # first tagged release: assume functions need a deploy too
out functions_changed "$fc"

section=$(awk '/^##+ \[?[0-9]/{n++} n==1{print} n==2{exit}' CHANGELOG.md | head -c 8000)
sha=$(git rev-parse HEAD)
# Tag + release through the API (annotated tag on the merge commit).
resp=$(api -X POST "$API/releases" -d "$(jq -n --arg t "$tag" --arg n "Paras $ver" --arg b "$section" --arg c "$sha" \
  '{tag_name:$t, target_commitish:$c, name:$n, body:$b, draft:false, prerelease:false}')")
url=$(echo "$resp" | jq -r '.html_url // empty')
[ -n "$url" ] || { log "release API failed: $(echo "$resp" | jq -r '.message // .')"; exit 1; }
out is_release true
notify "Paras $ver tagged" "Release published; Android build and functions deploy (changed: $fc) follow. $url" default "$url"
log "Published $url"
