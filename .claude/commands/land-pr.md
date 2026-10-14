---
allowed-tools: mcp__forgejo__pull_request__get, mcp__forgejo__pull_request__edit, mcp__forgejo__pull_request__list_reviews, mcp__forgejo__issue__comment_create, Bash(git *), Bash(curl *), Read
argument-hint: <pr-number> [--message "<subject>"] [--no-merge] [--merge-style rebase|merge|squash] [--keep-branch]
description: Land a PR - squash its commits into one conventional commit, push, undraft, merge into its base, delete the branch
model: sonnet
effort: medium
---

# Land PR

Land pull request $ARGUMENTS in `braxton/Paras`: squash its commits into a single commit with a combined
conventional message, force-push the branch (with lease), take it out of draft, merge it into its base branch,
and delete the branch. The tree must be byte-identical before and after the squash.

## Arguments

- `<pr-number>` (required)
- `--message "<subject>"`: commit subject instead of deriving it from the PR title.
- `--no-merge`: stop after the squash + undraft (old `/squash-pr` behavior).
- `--merge-style rebase|merge|squash`: how Forgejo merges. Default `rebase`: the branch is already one commit, so
  this lands exactly that commit on the base with no merge commit. `merge` adds a merge commit; `squash` lets
  Forgejo re-squash (pointless after this command, but allowed).
- `--keep-branch`: don't delete the head branch after merging.

## Step 1: Read the PR

`mcp__forgejo__pull_request__get` (owner `braxton`, repo `Paras`). Record `head.ref`, `head.sha`, `base.ref`,
`title`, `body`, `draft`, `mergeable`, `merged`, `state`. Stop if merged or closed.

## Step 2: Fetch and inspect

```bash
git fetch origin <base.ref> <head.ref>
BASE=$(git merge-base origin/<base.ref> origin/<head.ref>)
git log --format='%h %s%n%b' $BASE..origin/<head.ref>
git diff --stat $BASE origin/<head.ref>
```

If `origin/<head.ref>` differs from the API's `head.sha`, stop: the branch moved while you were looking.
If there is only one commit, skip the squash (Step 3–4) and go to Step 5 with the existing commit.

## Step 3: Compose the commit message

- **Subject:** `--message` if given; otherwise the PR title with any leading `WIP: ` removed. Must match
  `type(scope)?: description` (feat, fix, refactor, chore, test, docs, perf, ci, build, style); if the title
  isn't conventional, derive one from the first commit's subject.
- **Body:** the bullets under the PR body's `## Summary` section if present; otherwise one bullet per original
  commit subject. Fold `fix(review): address review feedback (round N)` commits into the relevant bullets (read
  their diffs if needed) rather than listing them, and correct any Summary bullet those rounds made untrue.
- **Trailer:** the `Closes #N` line from the PR body, on its own line.

Show the proposed message in a fenced block, the commits being combined, the merge style, and whether the
branch will be deleted. **Ask for confirmation.** The user may edit the message in their reply.

## Step 4: Squash and force-push

```bash
git checkout -B squash/<head.ref> origin/<head.ref>
git reset --soft $BASE
git commit -F <message file>
[ "$(git rev-parse HEAD^{tree})" = "$(git rev-parse origin/<head.ref>^{tree})" ] || echo "TREE MISMATCH, abort"
git push --force-with-lease=<head.ref>:<head.sha> origin HEAD:<head.ref>
git checkout -q -
git branch -D squash/<head.ref>
```

Abort and report on a tree mismatch or a rejected lease; never retry with plain `--force`.

## Step 5: Undraft

If `draft` is true or the title starts with `WIP: `, use `mcp__forgejo__pull_request__edit` to set `title` to the
title without the `WIP: ` prefix.

## Step 6: Merge (skip with `--no-merge`)

Re-read the PR to get the new `head.sha`. Then merge through the API (the MCP server has no merge tool;
`FORGEJO_TOKEN_MCP` is the same token it uses):

```bash
curl -sS -o /tmp/land-pr.json -w '%{http_code}' \
  -H "Authorization: token $FORGEJO_TOKEN_MCP" -H "Content-Type: application/json" \
  -X POST "https://git.braxt.in/api/v1/repos/braxton/Paras/pulls/<n>/merge" \
  -d '{"Do":"<style>","head_commit_id":"<new head.sha>","delete_branch_after_merge":<true|false>}'
```

`head_commit_id` pins the merge to the commit you just reviewed; Forgejo refuses if the branch moved again.
Expect HTTP 200. On 405 the PR is not mergeable (conflict, or a branch-protection rule): report the body and stop.
Do not loop on a "not mergeable yet" status more than three times, ten seconds apart; Forgejo recomputes
mergeability briefly after a force-push.

Verify: `mcp__forgejo__pull_request__get` shows `merged: true`; `git fetch origin <base.ref>` and confirm the
commit subject appears at the tip of `origin/<base.ref>`.

## Report

```
Landed PR #<n> into <base.ref>
<subject>
Squashed: <k> commits -> 1 (tree unchanged)   |  Merge: <style>  |  Branch deleted: yes|no
<base.ref> tip: <short sha>
Closed: #<issue>   (from the Closes trailer; confirm the issue actually closed)
Next: when an ai/ PR lands, a queued ai-ready issue can start on the next trigger.
```

## Notes

- `ai/*` branches belong to the agent; rewriting them is safe. For a human's branch, confirm with its author first.
- The force-push triggers one more PR review run before the merge; it reviews the same diff and is harmless.
- Merging into `dev` never deploys anything. Releases go through `Cut release` (see DEPLOYMENT.md).
