---
allowed-tools: mcp__forgejo__issue__list, mcp__forgejo__issue__get_by_index, mcp__forgejo__issue__comment_list, mcp__forgejo__issue__add_labels, mcp__forgejo__issue__edit, mcp__forgejo__pull_request__list, mcp__forgejo__issue_label__list, Read, Grep, Glob, Bash(git *)
argument-hint: [--count N] [--milestone <name>] [--dry-run]
description: Suggest which open issues the agent should take next, then label the ones you pick ai-ready
model: opus
effort: medium
---

# Triage: what should the agent work on next?

Go through the open issues in `braxton/Paras`, recommend a few the unattended agent can take now, and after
confirmation label them `ai-ready`. Arguments: $ARGUMENTS

- `--count N`: how many suggestions (default 3)
- `--milestone <name>`: only consider issues in that milestone
- `--dry-run`: suggest only; never label

## Step 1: Current state (do all of these before judging anything)

1. Open PRs via `mcp__forgejo__pull_request__list` (state `open`). Count those whose head starts with `ai/`.
   The pipeline's cap is `PR_CAP` in `.forgejo/workflows/agent.yml` (read it; default 2). Free slots =
   cap minus open `ai/` PRs. Say this number up front; if it is 0, say so and still suggest, but explain that
   nothing runs until a PR merges or closes.
2. Open issues via `mcp__forgejo__issue__list` (state `open`, limit 50). Drop any already labeled `ai-ready`,
   `ai-in-progress` or `ai-failed` from the candidates, but list them in a "queued / stuck" line so the user sees
   the whole picture. Also drop anything labeled `human-only` (a developer owns those; the pipeline ignores them
   even if `ai-ready` is added) and summarize them in one "human-only" line with their priorities. Issues labeled
   `needs-decision` are not candidates either, but list them in their own "waiting on a decision" line with the
   question each one asks, so the maintainer can answer and unblock them.
3. For each remaining issue, read the body, and the comments via `mcp__forgejo__issue__comment_list` if there are
   any (a maintainer comment often narrows or kills the scope).
4. `git fetch origin && git log --oneline -15 origin/dev` to know what just merged; an issue may already be done.

## Step 2: Score each candidate

Judge against the agent-readiness checklist (same one `/create-issue` uses):

| Signal | Weight |
|---|---|
| Names concrete files, or they are obvious from the title | required for agent-ready |
| One behavior; expected diff under ~150 lines, 1–3 files | required |
| Intended behavior stated (not just the mechanical edit) | strong plus |
| No `ios/` / `android/`, no `.forgejo/`, no Firestore structure, no notification defaults, no store or signing work, no design decision | required (protected or out of scope; the pipeline rejects them). Dependency changes are fine: the draft PR flags them for review |
| `priority: urgent` > `high` > `medium` > `low` | ordering |
| Labeled `bug` or `security` | plus |
| In the "fixes" bucket of the current release (small, user-visible, no platform churn) rather than the platform-upgrade or feature buckets | plus |
| Already fixed on dev (verify with Grep/Read against the code) | exclude; say so |
| Blocked by or overlapping an open PR | exclude for now |

Spot-check the top candidates against the code: open the files the issue names and confirm the problem is still
there and the line numbers roughly hold. Don't recommend from the title alone.

## Step 3: Recommend

Print a short table of the top `--count` candidates:

```
#N  title                     priority  why it's a good agent ticket             readiness
```

`readiness` is one of:
- **ready**: label as is.
- **needs rewrite**: good candidate but the body fails the checklist (no files, no intended behavior, bundled
  scope). Say in one line what's missing. Offer to rewrite the body (in the `/create-issue` format: Summary,
  Files, Change, Done when, Out of scope) before labeling; rewrite only after the user agrees, via
  `mcp__forgejo__issue__edit`, and keep the original text under a `<details>` block at the bottom.
- **human**: worth doing but not for the agent (native platform upgrades, Firebase config, deploys, anything under
  `.forgejo/`). Mention at most two of these in one line so they aren't
  forgotten; don't count them toward `--count`. Offer to apply the `human-only` label to them (via
  `mcp__forgejo__issue__add_labels`) so they stop showing up as candidates; apply only after the user agrees.
- **decision**: agent-sized work blocked on a product or design question. Offer the `needs-decision` label and
  state the question in one line; once answered it becomes `ai-ready`.

Then **ask** which to label (numbers, "all", or "none"). Do not label anything before the answer.

## Step 4: Label

For each chosen issue: `mcp__forgejo__issue__add_labels` with `["ai-ready"]`. Labeling only queues the issue:
the agent picks queued issues up on its 6-hourly schedule or when the user presses Run workflow on "Local agent"
(there is deliberately no label trigger). Skip this entirely under `--dry-run`.

Report:

```
Labeled ai-ready: #a, #b
Queue now: <n> ai-ready, <m> open ai/ PRs, <k> free slot(s)
Starts: next scheduled run at <next 00/06/12/18 UTC>, or now via Actions -> Local agent -> Run workflow.
Expect: ~5 min per issue once a run starts (ntfy "draft PR for #a"); the rest wait for a free slot.
```

## Notes

- Keep the agent's plate small. Two or three labeled issues at a time is plenty; the cap holds the rest anyway.
- If every candidate is "human", say so plainly instead of forcing a suggestion.
- Never create labels; never close issues; never touch PRs here.
