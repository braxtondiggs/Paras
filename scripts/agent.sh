#!/usr/bin/env bash
# Paras agent: works Forgejo issues labeled ai-ready using Claude Code in headless mode (claude -p).
#
#   ai-ready ──▶ ai-in-progress ──▶ draft PR (labels cleared)
#                      └──────────▶ ai-failed + comment
#
# Env (set by the workflow): TOKEN, API, and CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY
# Optional: BASE_BRANCH, MAX_ISSUES, PR_CAP, AGENT_MODEL, REVIEW_MODEL, AGENT_TIME_LIMIT,
#           CHECK_CMD, FUNCTIONS_CHECK_CMD, REVIEW_PASS
# Run as a copy (cp scripts/agent.sh /tmp/agent.sh && bash /tmp/agent.sh): it checks out $BASE mid-run.
set -uo pipefail

: "${TOKEN:?AGENT_TOKEN secret not set}"
: "${API:?API url not set}"

# Keep secrets out of the agent's reach: the Forgejo token moves into a non-exported variable (child
# processes can't see it) and git never stores it (the workflow checks out with persist-credentials: false);
# it is attached per command through gitauth. Issue text is untrusted input to the model.
TOKEN_VAL="$TOKEN"; unset TOKEN
GIT_AUTH="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$TOKEN_VAL" | base64 | tr -d '\n')"
gitauth() { git -c "http.extraheader=$GIT_AUTH" "$@"; }
# If both credentials are present, use the subscription token so billing is unambiguous.
[ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && unset ANTHROPIC_API_KEY

BASE="${BASE_BRANCH:-dev}"
MAX_ISSUES="${MAX_ISSUES:-2}"          # issues per run
PR_CAP="${PR_CAP:-2}"                  # max open ai/* PRs before the agent stops
MODEL="${AGENT_MODEL:-claude-opus-5-5}"          # implement + fix passes
EFFORT="${AGENT_EFFORT:-high}"                    # effort for implement/fix passes
REVIEW_MODEL="${REVIEW_MODEL:-claude-sonnet-5-5}" # self-review pass
TIME_LIMIT="${AGENT_TIME_LIMIT:-20m}"  # per agent pass
CHECK_CMD="${CHECK_CMD:-npm run typecheck && npm run lint:check && npm test && npx ng build --configuration development}"
FUNCTIONS_CHECK_CMD="${FUNCTIONS_CHECK_CMD:-npx tsc --noEmit && npm run lint}"  # inside functions/, only if touched
REVIEW_PASS="${REVIEW_PASS:-1}"        # 1 = second pass reviewing its own diff

# What the agent may run without asking. Edits are auto-accepted inside the repo (acceptEdits);
# git commit/push, npm install, deploys etc. are simply not on the list, so they are denied.
AGENT_TOOLS='Bash(npm run typecheck*),Bash(npm run lint*),Bash(npm run test*),Bash(npm test*),Bash(npx tsc*),Bash(npx eslint*),Bash(npx prettier*),Bash(npx jest*),Bash(npx ng build*),Bash(git diff*),Bash(git status*),Bash(git log*),Bash(git show*),Bash(git ls-files*),Bash(ls*),Bash(cat *),Bash(head *),Bash(tail *),Bash(grep *),Bash(rg *),Bash(find *),Bash(wc *),Bash(sed -n *),Bash(mkdir *)'

# Files the agent must never change (from AGENTS.md "Always clarify" + "Out of scope").
PROTECTED_RE='^(capacitor\.config\.json|.*environment\.prod\.ts|firestore\.rules|\.firebaserc|ios/|android/|\.forgejo/|scripts/(agent|pr-review|pr-fix)\.sh|AGENTS\.md|CLAUDE\.md)'

# ---------- helpers ----------
api()     { curl -sS -H "Authorization: token $TOKEN_VAL" -H "Content-Type: application/json" "$@"; }
comment() { api -X POST "$API/issues/$1/comments" -d "$(jq -n --arg b "$2" '{body:$b}')" >/dev/null; }
add_label() { api -X POST "$API/issues/$1/labels" -d "{\"labels\":[$2]}" >/dev/null; }
del_label() { api -X DELETE "$API/issues/$1/labels/$2" >/dev/null; }
log()     { echo "[agent] $*"; }

# Alerts: POST to NOTIFY_WEBHOOK when set. An ntfy topic URL gets plain text + headers; anything else
# (Home Assistant webhook, Discord, Slack) gets JSON with title/message/text/content/url/priority.
RUN_URL="${GITHUB_SERVER_URL:-}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"
notify() {  # notify <title> <message> [priority: high|default|low]
  echo "$1 — $2" >>/tmp/agent-notify.log
  [ -n "${NOTIFY_WEBHOOK:-}" ] || return 0
  if [ "${NOTIFY_FORMAT:-ntfy}" = ntfy ]; then
    curl -sS -o /dev/null --max-time 15 -H "Title: $1" -H "Priority: ${3:-default}" -H "Click: $RUN_URL" -d "$2" "$NOTIFY_WEBHOOK"
  else
    curl -sS -o /dev/null --max-time 15 -H "Content-Type: application/json" -d "$(jq -n --arg t "$1" --arg m "$2" --arg u "$RUN_URL" --arg p "${3:-default}" \
      '{title:$t, message:$m, text:($t+": "+$m), content:($t+": "+$m), url:$u, priority:$p}')" "$NOTIFY_WEBHOOK"
  fi
}

CURRENT=""   # issue number being worked; used by the trap
fail_issue() {
  local n="$1" reason="$2"
  log "#$n failed: $reason"
  git checkout -q -f "$BASE" 2>/dev/null; git reset -q --hard "origin/$BASE"; git clean -qfd
  del_label "$n" "$L_PROGRESS"
  add_label "$n" "$L_FAILED"
  comment "$n" "🤖 AI pipeline stopped: $reason

Fix the issue description (or the blocker), remove \`ai-failed\`, and re-add \`ai-ready\` to retry."
  notify "Paras agent: #$n failed" "$(echo "$reason" | head -c 300)"
  CURRENT=""
}
# Never leave an issue stuck on ai-in-progress, even if the job is killed or errors out.
trap '[ -n "$CURRENT" ] && fail_issue "$CURRENT" "job exited unexpectedly (timeout, crash or cancel)"' EXIT

# ---------- preflight ----------
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  log "No CLAUDE_CODE_OAUTH_TOKEN (from 'claude setup-token') or ANTHROPIC_API_KEY secret. Cannot run."; exit 1
fi
command -v claude >/dev/null || { log "claude CLI not installed."; exit 1; }


labels=$(api "$API/labels?limit=100")
lid() { echo "$labels" | jq -r --arg n "$1" '.[] | select(.name==$n) | .id' | head -1; }
L_READY=$(lid ai-ready); L_PROGRESS=$(lid ai-in-progress); L_FAILED=$(lid ai-failed)
for v in L_READY L_PROGRESS L_FAILED; do
  [ -n "${!v}" ] || { log "Missing repo label for $v (ai-ready / ai-in-progress / ai-failed)."; exit 1; }
done

# Only one job runs at a time (concurrency group), so any ai-in-progress label seen now was left by a
# killed job whose EXIT trap never ran. Put those issues back to ai-ready.
for s in $(api "$API/issues?state=open&type=issues&labels=ai-in-progress&limit=50" | jq -r '.[].number'); do
  log "#$s was left ai-in-progress by a killed job; resetting to ai-ready."
  del_label "$s" "$L_PROGRESS"; add_label "$s" "$L_READY"
done

git config user.name  "agent-bot"
git config user.email "agent-bot@noreply.localhost"
gitauth fetch -q origin

# ---------- pick work ----------
open_ai_prs=$(api "$API/pulls?state=open&limit=50" | jq '[.[] | select(.head.ref | startswith("ai/"))] | length')
slots=$(( PR_CAP - open_ai_prs ))
if [ "$slots" -le 0 ]; then
  log "Cap reached: $open_ai_prs open ai/* PRs (cap $PR_CAP). Review some, then the next run continues."
  exit 0
fi
take=$(( slots < MAX_ISSUES ? slots : MAX_ISSUES ))

mapfile -t QUEUE < <(api "$API/issues?state=open&type=issues&labels=ai-ready&limit=50" | jq -r --argjson k "$take" '
  def names: (.labels // [] | map(.name));
  # repo labels are "priority: high" etc.; also accept "priority/high". urgent == critical.
  def has($p): any(names[]; test("^priority[:/] *" + $p + "$"));
  def prio:
      if   has("urgent") or has("critical") then 0
      elif has("high")   then 1
      elif has("medium") then 2
      elif has("low")    then 3
      else 4 end;
  map(select((names|index("ai-in-progress")|not) and (names|index("ai-failed")|not)))
  | sort_by(prio, .number) | .[0:$k] | .[].number')

log "Open ai/* PRs: $open_ai_prs/$PR_CAP. Taking ${#QUEUE[@]} issue(s): ${QUEUE[*]:-none}"
[ "${#QUEUE[@]}" -eq 0 ] && { log "Nothing to do."; exit 0; }

# Cheap auth check now that there is work (skipped on idle scheduled runs): an expired/revoked token (or an exhausted subscription
# window) is the most likely way this pipeline silently stops working.
ping=$(timeout 3m claude -p --output-format text --model "$MODEL" --max-turns 1 "Reply with exactly: ok" </dev/null 2>&1)
if ! echo "$ping" | grep -qiw 'ok'; then
  log "Claude preflight FAILED (auth or rate limit). Output: $(echo "$ping" | tail -n 5)"
  echo "Claude auth/preflight failed" >/tmp/agent-reason.txt
  notify "Paras agent: Claude auth failed" "claude -p could not run. If the token expired or was revoked, run 'claude setup-token' and update the CLAUDE_CODE_OAUTH_TOKEN secret. $(echo "$ping" | tail -n 2 | head -c 300)" high
  exit 2
fi

# Baseline: checks must pass on a clean $BASE first. Otherwise the agent wastes its
# fix attempt on failures it didn't cause. Issues stay ai-ready; the run shows red.
git checkout -q -f "$BASE" && git reset -q --hard "origin/$BASE" && git clean -qfd
if ! npm ci --no-audit --no-fund >/tmp/agent-baseline-npm.log 2>&1 </dev/null; then
  log "npm ci fails on clean $BASE — fix that first:"; tail -n 30 /tmp/agent-baseline-npm.log
  notify "Paras agent: npm ci fails on $BASE" "$(tail -n 3 /tmp/agent-baseline-npm.log | head -c 300)" high; exit 1
fi
if ! bash -c "$CHECK_CMD" </dev/null >/tmp/agent-baseline-checks.log 2>&1; then
  log "Checks already FAIL on clean $BASE (before any agent change). Fix $BASE or adjust CHECK_CMD. Tail:"
  tail -n 60 /tmp/agent-baseline-checks.log
  notify "Paras agent: checks are red on $BASE" "Baseline failed before any agent change; issues stay ai-ready. $(grep -E 'FAIL|error' /tmp/agent-baseline-checks.log | head -n 3 | head -c 300)" high; exit 1
fi
log "Baseline checks pass on $BASE."

# ---------- per issue ----------
for n in "${QUEUE[@]}"; do
  issue=$(api "$API/issues/$n")
  title=$(echo "$issue" | jq -r .title)
  body=$(echo "$issue" | jq -r '.body // ""')
  # The API token belongs to a human, so this script's own 🤖 comments are not posted as agent-bot: skip them by prefix.
  comments=$(api "$API/issues/$n/comments" | jq -r '.[] | select(.user.login != "agent-bot" and (.body | startswith("🤖") | not)) | "- \(.user.login): \(.body)"')
  is_bug=$(echo "$issue" | jq '[.labels[].name] | any(test("bug"; "i"))')
  slug=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g' | cut -c1-40 | sed -E 's/-+$//')
  branch="ai/issue-$n-$slug"
  out="/tmp/agent-$n"; rm -rf "$out"; mkdir -p "$out"

  log "=== #$n: $title → $branch ==="
  CURRENT="$n"
  add_label "$n" "$L_PROGRESS"

  git checkout -q -f "$BASE" && git reset -q --hard "origin/$BASE" && git clean -qfd
  git checkout -q -b "$branch"
  # node_modules survives the reset (ignored; git clean has no -x) and the branch is cut from the same
  # origin/$BASE the baseline installed, so a second npm ci is only needed if it vanished.
  if [ ! -d node_modules ] && ! npm ci --no-audit --no-fund >"$out/npm-ci.log" 2>&1 </dev/null; then
    fail_issue "$n" "\`npm ci\` failed on \`$BASE\` before any changes. Tail:
\`\`\`
$(tail -n 20 "$out/npm-ci.log")
\`\`\`"; continue
  fi

  # All passes for this issue share one Claude Code session (--session-id, then --resume), so the fix and
  # review passes know what pass 1 was trying to do. $out is added as a writable dir for the outcome files.
  SID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen)
  # --allowedTools and --add-dir take multiple values; keep them before scalar options so the trailing
  # prompt argument is never swallowed as a tool/dir name.
  AGENT_BASE=(claude -p --allowedTools "$AGENT_TOOLS" --add-dir "$out" --output-format json --permission-mode acceptEdits)
  AGENT_FIRST=("${AGENT_BASE[@]}" --model "$MODEL" --effort "$EFFORT" --session-id "$SID")
  AGENT_NEXT=("${AGENT_BASE[@]}" --resume "$SID")
  cost_total=0; turns_total=0

  # run_pass <name> <claude cmd...> <prompt>: runs one pass, writes the agent's final text to $out/<name>.log
  # and accumulates the JSON envelope's num_turns / total_cost_usd (API-equivalent, even on a subscription).
  run_pass() {
    local name="$1"; shift
    timeout "$TIME_LIMIT" "$@" </dev/null >"$out/$name.json" 2>"$out/$name.err"
    local rc=$? pass_cost=0 pass_turns=0
    if jq -e . "$out/$name.json" >/dev/null 2>&1; then
      jq -r '.result // ""' "$out/$name.json" >"$out/$name.log"
      pass_cost=$(jq -r '.total_cost_usd // 0' "$out/$name.json"); pass_turns=$(jq -r '.num_turns // 0' "$out/$name.json")
    else
      cat "$out/$name.json" >"$out/$name.log"
    fi
    cat "$out/$name.err" >>"$out/$name.log"
    cost_total=$(awk -v a="$cost_total" -v b="$pass_cost" 'BEGIN { printf "%.3f", a + b }')
    turns_total=$(( turns_total + pass_turns ))
    return $rc
  }

  # --- pass 1: implement ---
  run_pass agent-implement "${AGENT_FIRST[@]}" "$(cat <<EOF
You are the autonomous agent working Forgejo issue #$n in the Paras repo. Nobody can answer questions mid-run.
First read ./AGENTS.md and follow it, especially "Local Autonomous Agent" and "Coding Guidance for Agents".

## Issue #$n: $title

$body

## Discussion
${comments:-(no comments)}

## What to do
1. Read the relevant code first, then make the smallest change that fully resolves the issue.
2. Add or update tests for behavior you change.
3. Run: $CHECK_CMD — and fix any failures you caused. To auto-fix lint/formatting you may run
   \`npm run lint\` and \`npx prettier --write <files you changed>\`. Never run \`npm run build\` or \`npm run format\`.
   If you changed anything under functions/, also run inside functions/: npm ci && $FUNCTIONS_CHECK_CMD
4. Write a one-line conventional commit message (e.g. "fix: handle empty schedule feed") to $out/commit-msg.txt
5. Write a short PR summary (3-6 markdown bullets: what changed and why, how it was tested) to $out/summary.md

## Outcomes other than a code change (ONLY if you edited no files at all)
- Already done / nothing to change (e.g. the fix is already on $BASE): make NO changes. Write the evidence
  (what you checked, file + version/line) to $out/resolved.txt.
- Needs a human (anything under "Always clarify before changing" or "Out of Scope for Agents", dependency
  changes, or too ambiguous to implement safely): make NO changes. Write the reason to $out/blocked.txt.
If you edited any file, do NOT write resolved.txt or blocked.txt; write commit-msg.txt and summary.md instead.
"Partially resolved" in the discussion means the remaining items still need to be implemented.
Never create report, summary, or documentation files (e.g. *_SUMMARY.md, *_CONFIRMATION.md) in the repo
unless the issue explicitly asks for documentation. Your notes go in the $out files above, not the repo.
Do not run git commit, git push, or create branches (those commands are denied anyway).
Before finishing, confirm every step (1-5) is done.
EOF
)"
  agent_rc=$?
  tail -n 30 "$out/agent-implement.log"

  # Drop stray files the model sometimes leaves behind: report .md files at the repo root (not tracked on
  # $BASE) and editor backups anywhere (#126 committed app.component.ts.bak).
  stray=$(git ls-files --others --exclude-standard | grep -E '^[^/]+\.md$|\.(bak|orig|rej|tmp)$|~$' || true)
  if [ -n "$stray" ]; then log "Removing stray files: $(echo $stray)"; echo "$stray" | xargs rm -f; fi

  # resolved/blocked notes only count when the model really made no changes. The model has written
  # resolved.txt while describing edits it made (#127); honoring it would throw away the work.
  has_changes=1
  git diff --quiet && [ -z "$(git ls-files --others --exclude-standard)" ] && has_changes=0
  agent_note=""
  if [ "$has_changes" = 1 ] && { [ -s "$out/resolved.txt" ] || [ -s "$out/blocked.txt" ]; }; then
    log "Model wrote resolved/blocked notes but also changed files; keeping the changes."
    agent_note=$(cat "$out/resolved.txt" "$out/blocked.txt" 2>/dev/null | head -c 1500)
    rm -f "$out/resolved.txt" "$out/blocked.txt"
  fi

  if [ -s "$out/resolved.txt" ]; then
    git checkout -q -f "$BASE"; git reset -q --hard "origin/$BASE"; git clean -qfd
    del_label "$n" "$L_PROGRESS"; del_label "$n" "$L_READY"
    comment "$n" "🤖 The agent thinks this is **already resolved** on \`$BASE\`, so it made no changes:

$(head -c 2000 "$out/resolved.txt")

If that's right, close this issue. If not, add details and re-add \`ai-ready\`."
    notify "Paras agent: #$n already resolved?" "The agent made no changes and says it's done on $BASE. Check the issue comment." low
    log "#$n reported as already resolved."; CURRENT=""; continue
  fi
  if [ -s "$out/blocked.txt" ]; then
    fail_issue "$n" "needs clarification — $(head -c 1500 "$out/blocked.txt")"; continue
  fi
  if [ "$has_changes" = 0 ]; then
    fail_issue "$n" "the agent produced no changes (exit $agent_rc). Try making the issue more specific: name files and describe what done looks like. Agent output (tail):
\`\`\`
$(tail -n 15 "$out/agent-implement.log")
\`\`\`"; continue
  fi

  git add -A
  touched=$(git diff --cached --name-only "origin/$BASE")
  if bad=$(echo "$touched" | grep -E "$PROTECTED_RE"); then
    fail_issue "$n" "the change touched protected files, which needs a human:
\`\`\`
$bad
\`\`\`"; continue
  fi
  if git diff --cached --name-only | grep -qE '(^|/)package(-lock)?\.json$'; then
    fail_issue "$n" "the agent changed dependencies (package.json / lockfile), which this pipeline doesn't allow. Add the dependency yourself or do this one manually."; continue
  fi

  # --- checks, with one fix-up attempt ---
  run_checks() {
    bash -c "$CHECK_CMD" </dev/null >"$out/checks.log" 2>&1 || return 1
    # Root checks don't cover Cloud Functions (own package/tsconfig). Check them only when touched.
    if git diff --cached --name-only "origin/$BASE" | grep -q '^functions/'; then
      log "Diff touches functions/; running functions checks too."
      ( cd functions && npm ci --no-audit --no-fund && bash -c "$FUNCTIONS_CHECK_CMD" ) </dev/null >>"$out/checks.log" 2>&1 || return 1
    fi
  }
  if ! run_checks; then
    log "Checks failed; giving the agent one attempt to fix."
    run_pass agent-fix "${AGENT_NEXT[@]}" --model "$MODEL" --effort "$EFFORT" "The checks for issue #$n are failing after your change.
Fix the failures without changing what the change does. Follow AGENTS.md. Failing output (tail):
\`\`\`
$(tail -n 80 "$out/checks.log")
\`\`\`
Then re-run: $CHECK_CMD"
    git add -A
  fi

  # --- pass 2: self-review (optional) ---
  if [ "$REVIEW_PASS" = "1" ]; then
    run_pass agent-review "${AGENT_NEXT[@]}" --model "$REVIEW_MODEL" "Review the uncommitted change for issue #$n: run \`git diff --cached origin/$BASE\` and read it.
Use the review priorities in ./AGENTS.md under 'Automated Review Agent' (data correctness, notification reliability,
auth/security, bundle size, mobile compatibility, TypeScript strictness) and 'Coding Guidance for Agents'.
Apply only real fixes: bugs, missing Capacitor/platform guards, missing tests for changed behavior, \`any\` without a comment.
Skip style nitpicks. Do not expand scope, refactor, or add files other than tests. If the change is fine, change nothing.
Re-run $CHECK_CMD if you change anything."
    git add -A
  fi

  if run_checks; then checks="✅ \`$CHECK_CMD\` passing"
  else checks="❌ checks failing — see log below"; fi

  # re-check guards after the fix/review passes
  if git diff --cached --name-only "origin/$BASE" | grep -qE "$PROTECTED_RE|(^|/)package(-lock)?\.json$"; then
    fail_issue "$n" "a later pass touched protected files or dependencies."; continue
  fi

  # --- commit, push, draft PR ---
  default_type=$([ "$is_bug" = "true" ] && echo fix || echo feat)
  conv_re='^(feat|fix|refactor|test|docs|chore|perf|style|build|ci)(\(.+\))?: .+'
  msg=$(head -n1 "$out/commit-msg.txt" 2>/dev/null | tr -d '\r')
  if ! echo "$msg" | grep -qE "$conv_re"; then
    # Fall back to the issue title; only prefix it when it isn't conventional already (avoids "feat: refactor: ...").
    if echo "$title" | grep -qE "$conv_re"; then msg="$title"; else msg="$default_type: $title"; fi
  fi
  git commit -qm "$msg" -m "Closes #$n"
  # ai/* branches belong to the agent; force so a stale branch from an earlier (closed) PR can't block the run.
  if ! gitauth push -q -f -u origin "$branch" 2>"$out/push.log"; then
    fail_issue "$n" "git push failed: $(cat "$out/push.log")"; continue
  fi

  summary=$(cat "$out/summary.md" 2>/dev/null || echo "- (agent did not write a summary)")
  [ -n "$agent_note" ] && summary="$summary

> ⚠️ The model also wrote a resolved/blocked note while making changes (read with care):
$(echo "$agent_note" | sed 's/^/> /')"
  agent_stats="$MODEL (implement/fix) + $REVIEW_MODEL (review): $turns_total turns, ~\$$cost_total API-equivalent"
  pr_body=$(printf '## Summary\n%s\n\n## Checks\n%s\n\nCloses #%s\n\n---\n_Draft opened by the agent (Claude Code). %s. Review before undrafting._\n\n<details><summary>Check output (tail)</summary>\n\n```\n%s\n```\n</details>' \
    "$summary" "$checks" "$n" "$agent_stats" "$(tail -n 40 "$out/checks.log")")
  pr=$(api -X POST "$API/pulls" -d "$(jq -n --arg h "$branch" --arg b "$BASE" --arg t "WIP: $msg" --arg body "$pr_body" \
        '{head:$h, base:$b, title:$t, body:$body}')")
  url=$(echo "$pr" | jq -r '.html_url // empty')
  if [ -z "$url" ]; then
    fail_issue "$n" "couldn't open the PR: $(echo "$pr" | jq -r '.message // .')"; continue
  fi

  del_label "$n" "$L_PROGRESS"
  del_label "$n" "$L_READY"
  comment "$n" "🤖 Opened draft PR: $url — $checks"
  notify "Paras agent: draft PR for #$n" "$msg — $checks — $agent_stats $url" low
  log "#$n → $url"
  CURRENT=""
done

log "Done."
