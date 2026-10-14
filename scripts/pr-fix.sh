#!/usr/bin/env bash
# Review-fix loop: address review findings on an ai/* PR with Claude Code (headless), push a fix commit,
# label the PR ai-handed-off. Env (from .forgejo/workflows/pr-fix.yml): TOKEN, API, PR_NUMBER, REVIEW_ID,
# CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY. Optional: AGENT_MODEL, AGENT_EFFORT, AGENT_TIME_LIMIT,
# MAX_FIX_ROUNDS, CHECK_CMD, FUNCTIONS_CHECK_CMD, NOTIFY_WEBHOOK, NOTIFY_FORMAT.
set -uo pipefail

: "${TOKEN:?AGENT_TOKEN secret not set}"; : "${API:?}"; : "${PR_NUMBER:?}"
TOKEN_VAL="$TOKEN"; unset TOKEN
GIT_AUTH="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$TOKEN_VAL" | base64 | tr -d '\n')"
gitauth() { git -c "http.extraheader=$GIT_AUTH" "$@"; }
[ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && unset ANTHROPIC_API_KEY

MODEL="${AGENT_MODEL:-claude-opus-5-5}"
EFFORT="${AGENT_EFFORT:-high}"
TIME_LIMIT="${AGENT_TIME_LIMIT:-25m}"
MAX_ROUNDS="${MAX_FIX_ROUNDS:-2}"
CHECK_CMD="${CHECK_CMD:-npm run typecheck && npm run lint:check && npm test}"
FUNCTIONS_CHECK_CMD="${FUNCTIONS_CHECK_CMD:-npx tsc --noEmit && npm run lint}"  # inside functions/, only if the PR touches it
L_HANDED_OFF="ai-handed-off"
PROTECTED_RE='^(capacitor\.config\.json|.*environment\.prod\.ts|firestore\.rules|\.firebaserc|ios/|android/|\.forgejo/|scripts/(agent|pr-review|pr-fix|release-cut|release-tag)\.sh|AGENTS\.md|CLAUDE\.md)'
AGENT_TOOLS='Bash(npm install*),Bash(npm i *),Bash(npm uninstall*),Bash(npm ci*),Bash(npm run typecheck*),Bash(npm run lint*),Bash(npm run test*),Bash(npm test*),Bash(npx tsc*),Bash(npx eslint*),Bash(npx prettier*),Bash(npx jest*),Bash(npx ng build*),Bash(git diff*),Bash(git status*),Bash(git log*),Bash(git show*),Bash(git ls-files*),Bash(ls*),Bash(cat *),Bash(head *),Bash(tail *),Bash(grep *),Bash(rg *),Bash(find *),Bash(wc *),Bash(sed -n *),Bash(mkdir *)'

api() { curl -sS -H "Authorization: token $TOKEN_VAL" -H "Content-Type: application/json" "$@"; }
log() { echo "[pr-fix] $*"; }
RUN_URL="${GITHUB_SERVER_URL:-}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"
notify() {
  echo "$1 — $2" >>/tmp/agent-notify.log
  [ -n "${NOTIFY_WEBHOOK:-}" ] || return 0
  local auth=(); [ -n "${NOTIFY_TOKEN:-}" ] && auth=(-H "Authorization: Bearer $NOTIFY_TOKEN")
  if [ "${NOTIFY_FORMAT:-ntfy}" = ntfy ]; then
    code=$(curl -sS -o /tmp/notify-body -w '%{http_code}' --max-time 15 "${auth[@]}" -H "Title: $1" -H "Priority: ${3:-default}" -H "Click: $RUN_URL" -d "$2" "$NOTIFY_WEBHOOK" || echo 000)
  else
    code=$(curl -sS -o /tmp/notify-body -w '%{http_code}' --max-time 15 "${auth[@]}" -H "Content-Type: application/json" -d "$(jq -n --arg t "$1" --arg m "$2" --arg u "$RUN_URL" --arg p "${3:-default}" \
      '{title:$t, message:$m, text:($t+": "+$m), content:($t+": "+$m), url:$u, priority:$p}')" "$NOTIFY_WEBHOOK" || echo 000)
  fi
  case "$code" in 2*) ;; *) echo "[notify] FAILED HTTP $code posting to NOTIFY_WEBHOOK (check URL/auth): $(head -c 200 /tmp/notify-body 2>/dev/null | tr -d '\n')";; esac
}
comment() { api -X POST "$API/issues/$PR_NUMBER/comments" -d "$(jq -n --arg b "$1" '{body:$b}')" >/dev/null; }

# ---------- which review, and is it actionable? ----------
pr=$(api "$API/pulls/$PR_NUMBER")
head_ref=$(echo "$pr" | jq -r .head.ref); base_ref=$(echo "$pr" | jq -r .base.ref); pr_url=$(echo "$pr" | jq -r .html_url)
[ "$(echo "$pr" | jq -r .state)" = open ] || { log "PR not open; nothing to do."; exit 0; }
case "$head_ref" in ai/*) ;; *) log "Not an agent branch ($head_ref); nothing to do."; exit 0;; esac

reviews=$(api "$API/pulls/$PR_NUMBER/reviews")
if [ -n "${REVIEW_ID:-}" ] && echo "$reviews" | jq -e --argjson id "$REVIEW_ID" '.[] | select(.id==$id)' >/dev/null 2>&1; then
  review=$(echo "$reviews" | jq -c --argjson id "$REVIEW_ID" '.[] | select(.id==$id)')
else
  review=$(echo "$reviews" | jq -c 'map(select(.state!="PENDING")) | sort_by(.submitted_at // .created_at) | last')
fi
rid=$(echo "$review" | jq -r .id); rstate=$(echo "$review" | jq -r .state); rbody=$(echo "$review" | jq -r '.body // ""'); rwho=$(echo "$review" | jq -r .user.login)
[ "$rstate" != "APPROVED" ] || { log "Review $rid is an approval; nothing to fix."; exit 0; }
inline=$(api "$API/pulls/$PR_NUMBER/reviews/$rid/comments" | jq -r '.[] | "- \(.path) (line \(.position // .original_position // "?")): \(.body)"')
if [ -z "$inline" ] && echo "$rbody" | grep -qE 'verdict: `approve`|0 finding\(s\)'; then
  log "Review $rid has no findings; nothing to fix."; exit 0
fi
[ -n "$inline$rbody" ] || { log "Review $rid is empty; nothing to fix."; exit 0; }

# ---------- round cap: never loop forever with the reviewer ----------
gitauth fetch -q origin "$base_ref" "$head_ref"
git checkout -q -B "$head_ref" "origin/$head_ref"
if git log --format=%b "origin/$base_ref..HEAD" | grep -q "Review $rid by"; then
  log "Review $rid was already addressed by an earlier fix commit; nothing to do."; exit 0
fi
rounds=$(git log --format=%s "origin/$base_ref..HEAD" | grep -c '^fix(review):' || true)
if [ "$rounds" -ge "$MAX_ROUNDS" ]; then
  log "Already $rounds fix round(s) on this branch (cap $MAX_ROUNDS); handing off."
  comment "🤖 Review by @$rwho noted, but this PR already had $rounds automated fix round(s). Handing off to a human."
  api -X POST "$API/issues/$PR_NUMBER/labels" -d "$(jq -n --arg l "$L_HANDED_OFF" '{labels:[$l]}')" >/dev/null
  exit 0
fi
round=$(( rounds + 1 ))
log "PR #$PR_NUMBER ($head_ref): addressing review $rid by $rwho, round $round/$MAX_ROUNDS"

git config user.name "agent-bot"; git config user.email "agent-bot@noreply.localhost"
npm ci --no-audit --no-fund >/tmp/npm-ci.log 2>&1 </dev/null || { tail -n 20 /tmp/npm-ci.log; notify "Paras pr-fix: npm ci failed on PR #$PR_NUMBER" "$(tail -n 3 /tmp/npm-ci.log | head -c 300)" high; exit 1; }

# The linked issue is the source of truth for scope: a reviewer can be wrong about what was asked for.
pr_body=$(echo "$pr" | jq -r '.body // ""' | head -c 3000)
issue_ctx="(no linked issue)"
issue_n=$(printf '%s\n%s' "$(echo "$pr" | jq -r .title)" "$pr_body" | grep -oiE '(closes|fixes|resolves) #[0-9]+' | head -n1 | grep -oE '[0-9]+' || true)
[ -n "$issue_n" ] && issue_ctx=$(api "$API/issues/$issue_n" | jq -r '"Issue #\(.number): \(.title)\n\n\(.body // "")"' | head -c 4000)

out=/tmp/pr-fix-$PR_NUMBER; mkdir -p "$out"
cat >"$out/prompt.txt" <<EOF
You are the autonomous agent on the Paras repo, working on the branch of pull request #$PR_NUMBER (already checked out).
A reviewer ($rwho) left feedback. Nobody can answer questions mid-run. First read ./AGENTS.md and follow it.

## The issue this PR implements (source of truth for scope; API it explicitly asks for is NOT unused/speculative)
$issue_ctx

## Review summary
$rbody

## Inline comments
${inline:-(none)}

## What to do
1. For each finding: fix it if it is correct and in scope for this PR. If it is wrong, out of scope, or the issue
   explicitly asked for what is being flagged, do not change code for it and say so in the response.
2. Keep the PR's purpose unchanged. No refactors beyond what the findings ask. Dependency changes only if a finding requires one, and say so in response.md.
3. Run: $CHECK_CMD — and fix any failures you caused. \`npm run lint\` and \`npx prettier --write <files>\` are fine.
   If you changed anything under functions/, also run inside functions/: npm ci && $FUNCTIONS_CHECK_CMD
4. Write $out/response.md: one bullet per finding, starting with "Fixed:" or "Not changed:" and one sentence why.
Do not run git commit or git push (denied anyway).
EOF
SID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen)   # shared with the repair turn below
timeout "$TIME_LIMIT" claude -p --allowedTools "$AGENT_TOOLS" --add-dir "$out" --output-format json --permission-mode acceptEdits \
  --model "$MODEL" --effort "$EFFORT" --session-id "$SID" "$(cat "$out/prompt.txt")" </dev/null >"$out/agent.json" 2>"$out/agent.err"
rc=$?
jq -r '.result // ""' "$out/agent.json" 2>/dev/null | tail -n 20; tail -n 5 "$out/agent.err"
turns=$(jq -r '.num_turns // "?"' "$out/agent.json" 2>/dev/null); cost=$(jq -r '.total_cost_usd // 0' "$out/agent.json" 2>/dev/null | awk '{ printf "%.3f", $1 }')

git ls-files --others --exclude-standard | grep -E '^[^/]+\.md$|\.(bak|orig|rej|tmp)$|~$' | xargs -r rm -f
git add -A
if git diff --cached --quiet; then
  log "Agent changed nothing."
  comment "🤖 Looked at the review by @$rwho (round $round) and made no code changes.

$(cat "$out/response.md" 2>/dev/null || echo "(no response written; agent exit $rc)")"
  api -X POST "$API/issues/$PR_NUMBER/labels" -d "$(jq -n --arg l "$L_HANDED_OFF" '{labels:[$l]}')" >/dev/null
  exit 0
fi
if git diff --cached --name-only | grep -qE "$PROTECTED_RE"; then
  git reset -q --hard; log "Fix touched protected files; discarded."
  comment "🤖 The automated fix for the review by @$rwho touched protected files, so it was discarded. Needs a human."
  notify "Paras pr-fix: PR #$PR_NUMBER needs a human" "Fix round $round touched protected files/dependencies and was discarded." ; exit 0
fi

# --- checks (root, plus functions/ when the PR touches it), with one repair turn; a red fix is never pushed ---
run_checks() {
  bash -c "$CHECK_CMD" </dev/null >"$out/checks.log" 2>&1 || return 1
  if git diff --cached --name-only "origin/$base_ref" | grep -q '^functions/'; then
    log "PR touches functions/; running functions checks too."
    ( cd functions && npm ci --no-audit --no-fund && bash -c "$FUNCTIONS_CHECK_CMD" ) </dev/null >>"$out/checks.log" 2>&1 || return 1
  fi
}
if ! run_checks; then
  log "Checks failed after the fix; giving the agent one attempt to repair."
  timeout "$TIME_LIMIT" claude -p --allowedTools "$AGENT_TOOLS" --add-dir "$out" --output-format json --permission-mode acceptEdits \
    --model "$MODEL" --effort "$EFFORT" --resume "$SID" "The checks are failing after your review fixes. Repair them without changing what the fixes do; follow AGENTS.md.
If you touched functions/, also run inside functions/: npm ci && $FUNCTIONS_CHECK_CMD. Failing output (tail):
\`\`\`
$(tail -n 80 "$out/checks.log")
\`\`\`" </dev/null >"$out/agent2.json" 2>>"$out/agent.err"
  turns=$(( ${turns/\?/0} + $(jq -r '.num_turns // 0' "$out/agent2.json" 2>/dev/null || echo 0) ))
  cost=$(jq -r '.total_cost_usd // 0' "$out/agent.json" "$out/agent2.json" 2>/dev/null | awk '{ s += $1 } END { printf "%.3f", s }')
  git ls-files --others --exclude-standard | grep -E '^[^/]+\.md$|\.(bak|orig|rej|tmp)$|~$' | xargs -r rm -f
  git add -A
  if git diff --cached --name-only | grep -qE "$PROTECTED_RE"; then
    git reset -q --hard; log "Repair touched protected files; discarded."
    comment "🤖 The automated fix for the review by @$rwho touched protected files while repairing failing checks, so it was discarded. Needs a human."
    notify "Paras pr-fix: PR #$PR_NUMBER needs a human" "Fix round $round touched protected files/dependencies and was discarded." ; exit 0
  fi
  if ! run_checks; then
    git reset -q --hard
    log "Checks still red after the repair; nothing pushed."
    comment "🤖 Tried to address the review by @$rwho (round $round/$MAX_ROUNDS) but the checks stayed red, so nothing was pushed. Needs a human.

\`\`\`
$(tail -n 40 "$out/checks.log")
\`\`\`"
    api -X POST "$API/issues/$PR_NUMBER/labels" -d "$(jq -n --arg l "$L_HANDED_OFF" '{labels:[$l]}')" >/dev/null
    notify "Paras pr-fix: PR #$PR_NUMBER checks red after fix" "Round $round discarded; nothing pushed. $pr_url" high
    exit 0
  fi
fi
checks="✅ checks passing"

git commit -qm "fix(review): address review feedback (round $round)" -m "Review $rid by $rwho on #$PR_NUMBER"
if ! gitauth push -q origin "$head_ref" 2>"$out/push.log"; then
  log "push failed: $(cat "$out/push.log")"; notify "Paras pr-fix: push failed on PR #$PR_NUMBER" "$(head -c 300 "$out/push.log")" high; exit 1
fi
comment "🤖 Addressed the review by @$rwho (round $round/$MAX_ROUNDS) — $checks — $MODEL, $turns turns, ~\$$cost API-equivalent

$(cat "$out/response.md" 2>/dev/null || echo "(agent did not write a per-finding response)")"
api -X POST "$API/issues/$PR_NUMBER/labels" -d "$(jq -n --arg l "$L_HANDED_OFF" '{labels:[$l]}')" >/dev/null
notify "Paras pr-fix: PR #$PR_NUMBER round $round pushed" "$checks — $pr_url" low
log "Done: $pr_url"
