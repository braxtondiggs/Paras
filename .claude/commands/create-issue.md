---
allowed-tools: mcp__forgejo__issue__create, mcp__forgejo__issue__list, mcp__forgejo__issue_label__list, mcp__forgejo__issue__add_labels, Read, Grep, Glob, Bash(git *), Bash(npm run typecheck*), Bash(npx tsc*)
argument-hint: <title> [--ai] [--priority low|medium|high|urgent] [--milestone <name>] [--dry-run]
description: Create a Forgejo issue written for the unattended agent (files, intended behavior, done-when)
model: opus
effort: medium
---

# Create Issue (agent-ready)

Create a Forgejo issue for `braxton/Paras`: $ARGUMENTS

The issue will most likely be implemented by the unattended agent (`scripts/agent.sh`, Claude Code headless) and
reviewed by a bot before a human sees it. Write it so a competent engineer with **no access to this conversation**
and **no way to ask questions** can finish it in one sitting.

## Current repository

- Branch: !`git branch --show-current`
- Last commits: !`git log --oneline -5`
- Working tree: !`git status --porcelain | head -20`

## Step 1: Arguments

- `<title>`: imperative, conventional-commit style (`fix: …`, `feat: …`, `refactor: …`, `chore: …`), under 72 chars.
  Generate one from the conversation if omitted.
- `--ai`: also add the `ai-ready` label so the pipeline picks it up on its next scheduled run (every 6 h) or the next
  manual "Run workflow"; labeling does not start a run by itself. Only when the issue meets the checklist in Step 3.
  Without `--ai`, the issue is created for a human (or for labelling later).
- `--priority`: maps to the existing `priority: low|medium|high|urgent` labels. Default `low`.
- `--milestone <name>`: set if it exists (look it up; never create one).
- `--dry-run`: print the full issue instead of creating it.

## Step 2: Gather and verify context

From the conversation: the problem, the intended behavior, files and symbols mentioned, constraints, anything the
user said is out of scope.

Then **verify every concrete claim against the code at write time**:

- Open each file you will name. Record the real path, the enclosing function/method, and current line numbers.
  Stale line numbers and wrong method names are the top cause of bad agent PRs.
- If you quote a code snippet as "before", copy it from the file, do not reconstruct it.
- If the ticket is a bug, confirm the bug still exists on the current branch (grep/read); if it is already fixed,
  stop and say so instead of filing.
- Check the existing spec next to the file (`*.spec.ts`) so "add a test" can name the describe block to extend.
- Search open issues for a duplicate (`mcp__forgejo__issue__list` with a keyword); if one exists, report it and stop
  unless the user says to proceed.

## Step 3: Agent-readiness checklist

An issue gets `--ai` only if all of these hold. Otherwise create it without `ai-ready` and tell the user which item
fails:

- One behavior. Not "and also…". Split otherwise.
- 1–3 files, each named with a path. Under ~150 changed lines expected.
- **Intended behavior stated**, not just the edit. ("On error, `isLoading` must become `false` and `items` `[]`",
  not "remove the duplicate handler".) The agent does what the ticket says, including wrong mechanics.
- "Done when" is checkable by a test or a command.
- Nothing under AGENTS.md "Always clarify before changing" / "Out of Scope for Agents": Firestore structure,
  notification default times, `capacitor.config.json`, `environment.prod.ts`, `ios/`, `android/`, Firestore rules,
  Firebase project ID. Dependency changes are allowed; name the exact package and version in the issue.
- Nothing that needs a device, a store, a credential, or a design decision.

## Step 4: Body

Use exactly this structure (it mirrors `.forgejo/ISSUE_TEMPLATE/ai-task.md`):

```markdown
## Summary
One or two sentences: what is wrong or missing, and the user-visible effect. For bugs, why the current code
misbehaves (mechanism, not just symptom).

## Files
- `src/app/...` — `methodName()` (lines N–M): what to change there
- `src/app/....spec.ts` — add test under `describe('...')`

## Change
Concrete description of the intended result. Include a short before/after code block copied from the file when it
removes ambiguity. State the behavior the change must preserve.

## Done when
- [ ] Behavioral statement a test can check
- [ ] Test added/updated in `<file>.spec.ts` (name the case)
- [ ] `npm run typecheck && npm run lint:check && npm test` pass

## Out of scope
- Things nearby that must not be touched, with the issue number if one exists (e.g. logger work is #123)
```

Keep it under ~60 lines. No "as discussed", no references to this chat, no plan-tier words.

## Step 5: Labels

Fetch labels with `mcp__forgejo__issue_label__list` and use **only existing ones**:

| Content | Label |
| --- | --- |
| broken behavior, error, crash, wrong data | `bug` |
| new capability | `enhancement` |
| restructure without behavior change | `refactor` |
| aria, screen reader, keyboard, contrast | `a11y` |
| cleanup, tooling, CI, scripts | `chore` |
| vulnerability, hardening, secrets | `security` |
| dependency / tooling version bump | `upgrade` |
| docs only | `documentation` |

Plus exactly one `priority: …` label, plus `ai-ready` when `--ai` and Step 3 passes. If Step 3 fails because the
work is inherently not for the pipeline (deploys, `ios/`/`android/`, `.forgejo/`, Firebase config,
design decisions), add `human-only` instead so `/triage` and the agent skip it. Never create labels.

## Step 6: Create and report

Create with `mcp__forgejo__issue__create` (owner `braxton`, repo `Paras`), then print:

```
## Issue created
#{number} {title}
{url}
Labels: {labels}
Agent-ready: yes | no — {failing checklist item if no}{; labeled human-only if the work is inherently a developer's}
Next: {if ai-ready: "queued; runs on the next 6-hourly schedule or Actions -> Local agent -> Run workflow (PR cap permitting)"}
      {else: "add `ai-ready` when you want the agent to take it, or /implement-issue {number} to do it here"}
```

## Errors

- No title and no usable context: ask for a one-line description, do not invent a ticket.
- Claim can't be verified (file/method not found): say what is missing; do not file with guessed paths.
- Duplicate found: show it and stop.
