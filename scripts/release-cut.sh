#!/usr/bin/env bash
# Cut a release from dev: bump version + CHANGELOG from conventional commits, sync the Android version,
# commit on release/<version>, push, open a PR into master. Merging that PR is the release breakpoint;
# release-tag.sh (on push to master) tags, builds and deploys.
#
# Env (from .forgejo/workflows/release-cut.yml): TOKEN, API, BUMP (auto|patch|minor|major), DRY_RUN (true|false),
#   RELEASE_BRANCH (default master), DEV_BRANCH (default dev), CHECK_CMD, NOTIFY_WEBHOOK, NOTIFY_FORMAT
set -euo pipefail

: "${TOKEN:?AGENT_TOKEN secret not set}"; : "${API:?}"
TOKEN_VAL="$TOKEN"; unset TOKEN
GIT_AUTH="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$TOKEN_VAL" | base64 | tr -d '\n')"
gitauth() { git -c "http.extraheader=$GIT_AUTH" "$@"; }
BUMP="${BUMP:-auto}"; DRY_RUN="${DRY_RUN:-false}"
TARGET="${RELEASE_BRANCH:-master}"; DEV="${DEV_BRANCH:-dev}"
CHECK_CMD="${CHECK_CMD:-npm run typecheck && npm run lint:check && npm test && npx ng build --configuration production}"

api() { curl -sS -H "Authorization: token $TOKEN_VAL" -H "Content-Type: application/json" "$@"; }
log() { echo "[release-cut] $*"; }
RUN_URL="${GITHUB_SERVER_URL:-}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"
notify() {
  [ -n "${NOTIFY_WEBHOOK:-}" ] || return 0
  local auth=(); [ -n "${NOTIFY_TOKEN:-}" ] && auth=(-H "Authorization: Bearer $NOTIFY_TOKEN")
  if [ "${NOTIFY_FORMAT:-ntfy}" = ntfy ]; then
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "${auth[@]}" -H "Title: $1" -H "Priority: ${3:-default}" -H "Click: ${4:-$RUN_URL}" -d "$2" "$NOTIFY_WEBHOOK" || echo 000)
  else
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "${auth[@]}" -H "Content-Type: application/json" -d "$(jq -n --arg t "$1" --arg m "$2" --arg u "${4:-$RUN_URL}" --arg p "${3:-default}" \
      '{title:$t, message:$m, text:($t+": "+$m), content:($t+": "+$m), url:$u, priority:$p}')" "$NOTIFY_WEBHOOK" || echo 000)
  fi
  case "$code" in 2*) ;; *) echo "[notify] FAILED HTTP $code posting to NOTIFY_WEBHOOK (check URL/auth)";; esac
}
fail() { log "$1"; notify "Paras release cut: refused" "$1" high; exit 1; }

# ---------- guards ----------
gitauth fetch -q origin "$DEV" "$TARGET" --tags
git checkout -q -B "$DEV" "origin/$DEV"
open_ai=$(api "$API/pulls?state=open&limit=50" | jq -r '[.[] | select(.head.ref|startswith("ai/")) | "#\(.number)"] | join(" ")')
[ -z "$open_ai" ] || fail "open agent PR(s) against $DEV: $open_ai. Merge or close them first."
open_rel=$(api "$API/pulls?state=open&limit=50" | jq -r '[.[] | select(.head.ref|startswith("release/")) | "#\(.number)"] | join(" ")')
[ -z "$open_rel" ] || fail "a release PR is already open: $open_rel"
[ "$(git rev-list --count "origin/$TARGET..origin/$DEV")" -gt 0 ] || fail "$DEV has nothing that $TARGET doesn't."

log "Checks on clean $DEV ($(git rev-parse --short HEAD))"
npm ci --no-audit --no-fund >/tmp/release-npm.log 2>&1 </dev/null || { tail -n 20 /tmp/release-npm.log; fail "npm ci failed on $DEV"; }
bash -c "$CHECK_CMD" </dev/null >/tmp/release-checks.log 2>&1 || { tail -n 60 /tmp/release-checks.log; fail "checks are red on $DEV; not cutting"; }

# ---------- version + changelog ----------
git config user.name "agent-bot"; git config user.email "agent-bot@noreply.localhost"
prev=$(node -p "require('./package.json').version")
args=(--tag-prefix v --skip.commit --skip.tag)
[ "$BUMP" = auto ] || args+=(--release-as "$BUMP")
npx -y commit-and-tag-version "${args[@]}" >/tmp/release-bump.log 2>&1 || { cat /tmp/release-bump.log; fail "version bump failed"; }
ver=$(node -p "require('./package.json').version")
[ "$ver" != "$prev" ] || fail "version did not change ($prev); no releasable commits?"
log "Version $prev -> $ver"

# Android: versionName follows package.json; versionCode is date-based and monotonic (yymmdd + 2-digit run no).
code="$(date -u +%y%m%d)$(printf '%02d' $(( ${GITHUB_RUN_NUMBER:-0} % 100 )))"
sed -E -i.bak -e "s/versionName \"[^\"]*\"/versionName \"$ver\"/" -e "s/versionCode [0-9]+/versionCode $code/" android/app/build.gradle && rm -f android/app/build.gradle.bak
grep -nE "versionCode|versionName" android/app/build.gradle

# changelog section for this version (between the first two version headings)
section=$(awk '/^##+ \[?[0-9]/{n++} n==1{print} n==2{exit}' CHANGELOG.md | head -c 6000)

if [ "$DRY_RUN" = true ]; then
  log "DRY RUN — would open release/$ver -> $TARGET with:"; echo "$section"; git --no-pager diff --stat; exit 0
fi

# ---------- branch, commit, PR ----------
branch="release/$ver"
git checkout -q -B "$branch"
git add package.json package-lock.json CHANGELOG.md android/app/build.gradle
git commit -qm "chore(release): $ver"
gitauth push -q -f -u origin "$branch"
body=$(printf '%s\n\n---\nMerging this PR tags `v%s` on `%s`, publishes the Forgejo release, builds the Android bundle, and deploys Cloud Functions only if `functions/` changed since the previous tag. Cut by the release workflow from `%s` @ %s (%s).' \
  "$section" "$ver" "$TARGET" "$DEV" "$(git rev-parse --short "origin/$DEV")" "$RUN_URL")
pr=$(api -X POST "$API/pulls" -d "$(jq -n --arg h "$branch" --arg b "$TARGET" --arg t "Release $ver" --arg body "$body" '{head:$h, base:$b, title:$t, body:$body}')")
url=$(echo "$pr" | jq -r '.html_url // empty')
[ -n "$url" ] || fail "could not open the release PR: $(echo "$pr" | jq -r '.message // .')"
notify "Paras release $ver cut" "Review the changelog and merge to release. $url" default "$url"
log "Release PR: $url"
