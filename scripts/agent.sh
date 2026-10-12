#!/usr/bin/env bash
# Paras local agent: works Forgejo issues labeled ai-ready using Pi + Ollama (Mac mini).
#
#   ai-ready ──▶ ai-in-progress ──▶ draft PR (labels cleared)
#                      └──────────▶ ai-failed + comment
#
# Env (set by the workflow): TOKEN, API, OLLAMA_URL
# Optional: BASE_BRANCH, MAX_ISSUES, PR_CAP, AGENT_MODEL, AGENT_TIME_LIMIT,
#           CHECK_CMD, REVIEW_PASS
set -uo pipefail

: "${TOKEN:?AGENT_TOKEN secret not set}"
: "${API:?API url not set}"
: "${OLLAMA_URL:?OLLAMA_URL variable not set}"

BASE="${BASE_BRANCH:-dev}"
MAX_ISSUES="${MAX_ISSUES:-2}"          # issues per run
PR_CAP="${PR_CAP:-2}"                  # max open ai/* PRs before the agent stops
MODEL="${AGENT_MODEL:-qwen3-coder-32k}"
TIME_LIMIT="${AGENT_TIME_LIMIT:-45m}"  # per Pi pass
CHECK_CMD="${CHECK_CMD:-npm run typecheck && npm run lint && npm run test}"
REVIEW_PASS="${REVIEW_PASS:-1}"        # 1 = second Pi pass reviewing its own diff

# Files the agent must never change (from AGENTS.md "Always clarify" + "Out of scope").
PROTECTED_RE='^(capacitor\.config\.json|.*environment\.prod\.ts|firestore\.rules|\.firebaserc|ios/|android/|\.forgejo/|scripts/agent\.sh|AGENTS\.md|CLAUDE\.md)'

# ---------- helpers ----------
api()     { curl -sS -H "Authorization: token $TOKEN" -H "Content-Type: application/json" "$@"; }
comment() { api -X POST "$API/issues/$1/comments" -d "$(jq -n --arg b "$2" '{body:$b}')" >/dev/null; }
add_label() { api -X POST "$API/issues/$1/labels" -d "{\"labels\":[$2]}" >/dev/null; }
del_label() { api -X DELETE "$API/issues/$1/labels/$2" >/dev/null; }
log()     { echo "[agent] $*"; }

CURRENT=""   # issue number being worked; used by the trap
fail_issue() {
  local n="$1" reason="$2"
  log "#$n failed: $reason"
  git checkout -q -f "$BASE" 2>/dev/null; git reset -q --hard "origin/$BASE"; git clean -qfd
  del_label "$n" "$L_PROGRESS"
  add_label "$n" "$L_FAILED"
  comment "$n" "🤖 AI pipeline stopped: $reason

Fix the issue description (or the blocker), remove \`ai-failed\`, and re-add \`ai-ready\` to retry."
  CURRENT=""
}
# Never leave an issue stuck on ai-in-progress, even if the job is killed or errors out.
trap '[ -n "$CURRENT" ] && fail_issue "$CURRENT" "job exited unexpectedly (timeout, crash or cancel)"' EXIT

# ---------- preflight ----------
if ! curl -sf --max-time 10 "$OLLAMA_URL/api/tags" | jq -e --arg m "$MODEL" \
     '.models[] | select(.name == $m or .name == ($m + ":latest"))' >/dev/null; then
  log "Ollama at $OLLAMA_URL unreachable or model '$MODEL' missing (Mac asleep?). Skipping run."
  exit 0
fi

labels=$(api "$API/labels?limit=100")
lid() { echo "$labels" | jq -r --arg n "$1" '.[] | select(.name==$n) | .id' | head -1; }
L_READY=$(lid ai-ready); L_PROGRESS=$(lid ai-in-progress); L_FAILED=$(lid ai-failed)
for v in L_READY L_PROGRESS L_FAILED; do
  [ -n "${!v}" ] || { log "Missing repo label for $v (ai-ready / ai-in-progress / ai-failed)."; exit 1; }
done

git config user.name  "agent-bot"
git config user.email "agent-bot@noreply.localhost"
git fetch -q origin

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
  def prio: names as $l
    | if   $l|index("priority/critical") then 0
      elif $l|index("priority/high")     then 1
      elif $l|index("priority/medium")   then 2
      elif $l|index("priority/low")      then 3
      else 4 end;
  map(select((names|index("ai-in-progress")|not) and (names|index("ai-failed")|not)))
  | sort_by(prio, .number) | .[0:$k] | .[].number')

log "Open ai/* PRs: $open_ai_prs/$PR_CAP. Taking ${#QUEUE[@]} issue(s): ${QUEUE[*]:-none}"
[ "${#QUEUE[@]}" -eq 0 ] && { log "Nothing to do."; exit 0; }

# Baseline: checks must pass on a clean $BASE first. Otherwise the agent wastes its
# fix attempt on failures it didn't cause. Issues stay ai-ready; the run shows red.
git checkout -q -f "$BASE" && git reset -q --hard "origin/$BASE" && git clean -qfd
if ! npm ci --no-audit --no-fund >/tmp/agent-baseline-npm.log 2>&1 </dev/null; then
  log "npm ci fails on clean $BASE — fix that first:"; tail -n 30 /tmp/agent-baseline-npm.log; exit 1
fi
if ! bash -c "$CHECK_CMD" </dev/null >/tmp/agent-baseline-checks.log 2>&1; then
  log "Checks already FAIL on clean $BASE (before any agent change). Fix $BASE or adjust CHECK_CMD. Tail:"
  tail -n 60 /tmp/agent-baseline-checks.log; exit 1
fi
log "Baseline checks pass on $BASE."

# ---------- per issue ----------
for n in "${QUEUE[@]}"; do
  issue=$(api "$API/issues/$n")
  title=$(echo "$issue" | jq -r .title)
  body=$(echo "$issue" | jq -r '.body // ""')
  comments=$(api "$API/issues/$n/comments" | jq -r '.[] | select(.user.login != "agent-bot") | "- \(.user.login): \(.body)"')
  is_bug=$(echo "$issue" | jq '[.labels[].name] | any(test("bug"; "i"))')
  slug=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g' | cut -c1-40 | sed -E 's/-+$//')
  branch="ai/issue-$n-$slug"
  out="/tmp/agent-$n"; rm -rf "$out"; mkdir -p "$out"

  log "=== #$n: $title → $branch ==="
  CURRENT="$n"
  add_label "$n" "$L_PROGRESS"

  git checkout -q -f "$BASE" && git reset -q --hard "origin/$BASE" && git clean -qfd
  git checkout -q -b "$branch"
  if ! npm ci --no-audit --no-fund >"$out/npm-ci.log" 2>&1 </dev/null; then
    fail_issue "$n" "\`npm ci\` failed on \`$BASE\` before any changes. Tail:
\`\`\`
$(tail -n 20 "$out/npm-ci.log")
\`\`\`"; continue
  fi

  # --- pass 1: implement ---
  timeout "$TIME_LIMIT" pi -p --no-session "$(cat <<EOF
You are the autonomous local agent working Forgejo issue #$n in the Paras repo.
Follow AGENTS.md, especially "Local Autonomous Agent (Pi)" and "Coding Guidance for Agents".

## Issue #$n: $title

$body

## Discussion
${comments:-(no comments)}

## What to do
1. Read the relevant code first, then make the smallest change that fully resolves the issue.
2. Add or update tests for behavior you change.
3. Run: $CHECK_CMD — and fix any failures you caused.
4. Write a one-line conventional commit message (e.g. "fix: handle empty schedule feed") to $out/commit-msg.txt
5. Write a short PR summary (3-6 markdown bullets: what changed and why, how it was tested) to $out/summary.md

## Outcomes other than a code change
- Already done / nothing to change (e.g. the fix is already on $BASE): make NO changes. Write the evidence
  (what you checked, file + version/line) to $out/resolved.txt.
- Needs a human (anything under "Always clarify before changing" or "Out of Scope for Agents", dependency
  changes, or too ambiguous to implement safely): make NO changes. Write the reason to $out/blocked.txt.
Never create report, summary, or documentation files (e.g. *_SUMMARY.md, *_CONFIRMATION.md) in the repo
unless the issue explicitly asks for documentation. Your notes go in the $out files above, not the repo.
Do not run git commit, git push, or create branches.
EOF
)" </dev/null >"$out/pi-implement.log" 2>&1
  pi_rc=$?
  tail -n 30 "$out/pi-implement.log"

  # Drop stray report files the model sometimes writes at the repo root (not tracked on $BASE).
  stray=$(git ls-files --others --exclude-standard | grep -E '^[^/]+\.md$' || true)
  if [ -n "$stray" ]; then log "Removing stray report files: $(echo $stray)"; echo "$stray" | xargs rm -f; fi

  if [ -s "$out/resolved.txt" ]; then
    git checkout -q -f "$BASE"; git reset -q --hard "origin/$BASE"; git clean -qfd
    del_label "$n" "$L_PROGRESS"; del_label "$n" "$L_READY"
    comment "$n" "🤖 The agent thinks this is **already resolved** on \`$BASE\`, so it made no changes:

$(head -c 2000 "$out/resolved.txt")

If that's right, close this issue. If not, add details and re-add \`ai-ready\`."
    log "#$n reported as already resolved."; CURRENT=""; continue
  fi
  if [ -s "$out/blocked.txt" ]; then
    fail_issue "$n" "needs clarification — $(head -c 1500 "$out/blocked.txt")"; continue
  fi
  if git diff --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
    fail_issue "$n" "the agent produced no changes (Pi exit $pi_rc). Try making the issue more specific: name files and describe what done looks like."; continue
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
  run_checks() { bash -c "$CHECK_CMD" </dev/null >"$out/checks.log" 2>&1; }
  if ! run_checks; then
    log "Checks failed; giving Pi one attempt to fix."
    timeout "$TIME_LIMIT" pi -p --no-session "The checks for issue #$n are failing after your change.
Fix the failures without changing what the change does. Follow AGENTS.md. Failing output (tail):
\`\`\`
$(tail -n 80 "$out/checks.log")
\`\`\`
Then re-run: $CHECK_CMD" </dev/null >"$out/pi-fix.log" 2>&1
    git add -A
  fi

  # --- pass 2: self-review (optional) ---
  if [ "$REVIEW_PASS" = "1" ]; then
    review_extra=""
    [ -f .claude/commands/code-review.md ] && review_extra="Also apply the checklist in .claude/commands/code-review.md (read it; don't slash-invoke)."
    timeout "$TIME_LIMIT" pi -p --no-session "Review the uncommitted change for issue #$n (see: git diff --cached origin/$BASE).
Use the review priorities in AGENTS.md under 'Automated Review Agent'. $review_extra
Apply only real fixes (bugs, missing guards, missing tests, \`any\` without a comment). Skip style nitpicks.
Do not expand scope. Re-run $CHECK_CMD if you change anything." </dev/null >"$out/pi-review.log" 2>&1
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
  msg=$(head -n1 "$out/commit-msg.txt" 2>/dev/null | tr -d '\r')
  echo "$msg" | grep -qE '^(feat|fix|refactor|test|docs|chore|perf|style|build|ci)(\(.+\))?: .+' || msg="$default_type: $title"
  git commit -qm "$msg" -m "Closes #$n"
  if ! git push -q -u origin "$branch" 2>"$out/push.log"; then
    fail_issue "$n" "git push failed: $(cat "$out/push.log")"; continue
  fi

  summary=$(cat "$out/summary.md" 2>/dev/null || echo "- (agent did not write a summary)")
  pr_body=$(printf '## Summary\n%s\n\n## Checks\n%s\n\nCloses #%s\n\n---\n_Draft opened by the local agent (Pi + %s). Review before undrafting._\n\n<details><summary>Check output (tail)</summary>\n\n```\n%s\n```\n</details>' \
    "$summary" "$checks" "$n" "$MODEL" "$(tail -n 40 "$out/checks.log")")
  pr=$(api -X POST "$API/pulls" -d "$(jq -n --arg h "$branch" --arg b "$BASE" --arg t "WIP: $msg" --arg body "$pr_body" \
        '{head:$h, base:$b, title:$t, body:$body}')")
  url=$(echo "$pr" | jq -r '.html_url // empty')
  if [ -z "$url" ]; then
    fail_issue "$n" "couldn't open the PR: $(echo "$pr" | jq -r '.message // .')"; continue
  fi

  del_label "$n" "$L_PROGRESS"
  del_label "$n" "$L_READY"
  comment "$n" "🤖 Opened draft PR: $url — $checks"
  log "#$n → $url"
  CURRENT=""
done

log "Done."
