#!/usr/bin/env bash
# Reviews one pull request with Claude Code (headless) and posts the result as a Forgejo PR review.
# Env (from .forgejo/workflows/pr-review.yml): TOKEN, API, PR_NUMBER, BASE_REF, HEAD_SHA,
#   CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY. Optional: REVIEW_MODEL.
set -uo pipefail

: "${TOKEN:?AGENT_TOKEN secret not set}"; : "${API:?}"; : "${PR_NUMBER:?}"
TOKEN_VAL="$TOKEN"; unset TOKEN                      # keep it out of the agent's environment
[ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && unset ANTHROPIC_API_KEY
MODEL="${REVIEW_MODEL:-claude-sonnet-5-5}"

api() { curl -sS -H "Authorization: token $TOKEN_VAL" -H "Content-Type: application/json" "$@"; }
log() { echo "[review] $*"; }

if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  log "No CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY secret; skipping review."; exit 0
fi

RUN_URL="${GITHUB_SERVER_URL:-}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"
notify() {  # same contract as agent.sh: ntfy gets text + headers, anything else gets JSON
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
ping=$(timeout 3m claude -p --output-format text --model claude-haiku-5-5 --max-turns 1 "Reply with exactly: ok" </dev/null 2>&1)
if ! echo "$ping" | grep -qiw 'ok'; then
  log "Claude preflight FAILED (auth or rate limit): $(echo "$ping" | tail -n 3)"
  notify "Paras PR review: Claude auth failed" "claude -p could not run for PR #$PR_NUMBER. If the token expired, run 'claude setup-token' and update CLAUDE_CODE_OAUTH_TOKEN. $(echo "$ping" | tail -n 2 | head -c 300)" high
  exit 2
fi

# Resolve the PR from the API so a manual re-run (workflow_dispatch with a PR number) works the same way.
pr_json=$(api "$API/pulls/$PR_NUMBER")
BASE_REF="${BASE_REF:-$(echo "$pr_json" | jq -r .base.ref)}"
HEAD_SHA="${HEAD_SHA:-$(echo "$pr_json" | jq -r .head.sha)}"
pr_title=$(echo "$pr_json" | jq -r '.title // ""'); pr_body=$(echo "$pr_json" | jq -r '.body // ""' | head -c 4000)
# The linked issue ("Closes #N") is what the PR is supposed to do; review against it, not just the diff.
issue_ctx="(no linked issue)"
issue_n=$(printf '%s\n%s' "$pr_title" "$pr_body" | grep -oiE '(closes|fixes|resolves) #[0-9]+' | head -n1 | grep -oE '[0-9]+' || true)
if [ -n "$issue_n" ]; then
  issue_ctx=$(api "$API/issues/$issue_n" | jq -r '"Issue #\(.number): \(.title)\n\n\(.body // "")"' | head -c 4000)
fi
git fetch -q origin "$BASE_REF" "refs/pull/$PR_NUMBER/head:refs/remotes/pr/$PR_NUMBER"
git checkout -q "pr/$PR_NUMBER"
range="origin/$BASE_REF...pr/$PR_NUMBER"
files=$(git diff --name-only "$range")
[ -n "$files" ] || { log "Empty diff; nothing to review."; exit 0; }
log "Reviewing PR #$PR_NUMBER ($range): $(echo "$files" | wc -l) file(s)"

out=/tmp/pr-review-$PR_NUMBER; mkdir -p "$out"
# Write is allowed so the model can save review.json into $out (the checkout is throwaway; nothing is pushed).
TOOLS='Write,Bash(git diff*),Bash(git log*),Bash(git show*),Bash(ls*),Bash(cat *),Bash(head *),Bash(tail *),Bash(grep *),Bash(rg *),Bash(find *),Bash(wc *)'

# Prompt goes through a file: a heredoc inside $( ) trips older bash on apostrophes/parens.
cat >"$out/prompt.txt" <<EOF
You are reviewing pull request #$PR_NUMBER in the Paras (ASP NYC) repo. Its branch is already checked out.
The diff to review is: git diff $range
Read ./AGENTS.md first; use its "Automated Review Agent" priorities (data correctness, notification reliability,
auth/security, bundle size, mobile compatibility, TypeScript strictness) and "Coding Guidance for Agents".
Read surrounding code beyond the diff hunks before flagging anything. Do not edit files. Do not run tests or lint.

## What the PR says it does
$pr_title

$pr_body

## The issue it closes (review against this; API the issue explicitly asks for is in scope, not speculative)
$issue_ctx

Flag only real problems: bugs, wrong date/timezone handling, Firestore calls outside FeedService, missing
Capacitor platform guards, \`any\` without a comment, missing tests for changed behavior, scope creep unrelated
to the PR's stated purpose, secrets or dependencies added. Skip style, formatting, praise and restating the diff.

When done, write ONLY a JSON file to $out/review.json with this exact shape (no markdown fences):
{"verdict": "approve" | "comment" | "request_changes",
 "summary": "2-4 sentences: what the PR does and your overall assessment",
 "comments": [{"path": "src/...", "line": <line number in the NEW file>, "severity": "CRITICAL|HIGH|MEDIUM|LOW",
               "body": "What is wrong, why it matters (user impact), and the suggested fix"}]}
Use "request_changes" only for CRITICAL/HIGH findings. An empty comments array with "approve" is a valid result.
EOF
timeout 25m claude -p --allowedTools "$TOOLS" --add-dir "$out" --output-format json --model "$MODEL" "$(cat "$out/prompt.txt")" </dev/null >"$out/agent.json" 2>"$out/agent.err"
rc=$?
jq -r '.result // ""' "$out/agent.json" 2>/dev/null | tail -n 20
cat "$out/agent.err" | tail -n 5
log "agent exit $rc; turns $(jq -r '.num_turns // "?"' "$out/agent.json" 2>/dev/null); ~\$$(jq -r '.total_cost_usd // "?"' "$out/agent.json" 2>/dev/null) API-equivalent"

# Fallback: if the file is missing, pull the JSON object out of the model's final message (it tends to
# print it in a ```json fence when it couldn't write the file).
if ! jq -e '.verdict and .summary' "$out/review.json" >/dev/null 2>&1; then
  jq -r '.result // ""' "$out/agent.json" 2>/dev/null | sed -n '/^{/,/^}/p' | jq -c '.' 2>/dev/null | head -n 1 >"$out/review.json" || true
fi
if ! jq -e '.verdict and .summary' "$out/review.json" >/dev/null 2>&1; then
  log "Agent did not produce a valid review.json; posting nothing."
  notify "Paras PR review: no result for PR #$PR_NUMBER" "The reviewer ran but produced no parsable review. $(jq -r '.result // ""' "$out/agent.json" 2>/dev/null | head -c 300)"; exit 0
fi

verdict=$(jq -r .verdict "$out/review.json")
case "$verdict" in request_changes) event=REQUEST_CHANGES;; *) event=COMMENT;; esac  # never auto-approve
n_comments=$(jq '.comments | length' "$out/review.json")
body=$(jq -r --arg m "$MODEL" --arg v "$verdict" --argjson n "$n_comments" '
  "🤖 **Claude review** (\($m)) — verdict: `\($v)`, \($n) finding(s)\n\n\(.summary)"' "$out/review.json")

# Review with inline comments; Forgejo wants the new-file line in new_position.
payload=$(jq -c --arg e "$event" --arg b "$body" --arg sha "${HEAD_SHA:-}" '{
  event: $e, body: $b, commit_id: $sha,
  comments: [.comments[] | {path, new_position: .line, body: ("[\(.severity)] " + .body)}]
}' "$out/review.json")
resp=$(api -X POST "$API/pulls/$PR_NUMBER/reviews" -d "$payload")
if echo "$resp" | jq -e .id >/dev/null 2>&1; then
  review_id=$(echo "$resp" | jq -r .id)
  log "Posted review $review_id with $n_comments inline comment(s)."
  # Review-fix loop: on agent branches with findings, hand the review to pr-fix.yml (it caps its own rounds).
  head_ref=$(echo "$pr_json" | jq -r .head.ref)
  if [ "$verdict" != approve ] && [ "$n_comments" -gt 0 ] && [[ "$head_ref" == ai/* ]]; then
    code=$(api -o /dev/null -w '%{http_code}' -X POST "$API/actions/workflows/pr-fix.yml/dispatches"       -d "$(jq -n --arg pr "$PR_NUMBER" --arg r "$review_id" '{ref:"master", inputs:{pr:$pr, review_id:$r}}')")
    log "Dispatched pr-fix for review $review_id: HTTP $code"
  fi
else
  # Inline placement can fail when a line isn't part of the diff; fall back to one plain comment.
  log "Review API rejected the inline comments ($(echo "$resp" | jq -r '.message // "unknown"' | head -c 200)); posting a plain comment."
  flat=$(jq -r '.comments[] | "- `\(.path):\(.line)` [\(.severity)] \(.body)"' "$out/review.json")
  api -X POST "$API/issues/$PR_NUMBER/comments" -d "$(jq -n --arg b "$body

$flat" '{body:$b}')" >/dev/null
fi
