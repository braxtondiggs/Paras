---
name: AI task (local agent)
about: A small, well-scoped change for the unattended local agent (Pi + Qwen3-Coder 30B). Label it `ai-ready` when it is ready.
title: 'fix: '
labels:
  - 'priority: low'
---

<!--
The agent is a 30B local model with a 32k context. It cannot ask questions, browse, or install packages.
Good tasks: one behavior, 1-3 files, done in under ~150 changed lines, verifiable by tests.
Bad tasks: new dependencies, native (ios/, android/) or Firebase config changes, large refactors, "investigate X".
Remove this comment before submitting.
-->

## Summary

One or two sentences: what is wrong (or missing) and what the user-visible effect is.

## Files

Name the exact files and, if you can, the functions or line ranges to change:

- `src/app/...`

## Change

Describe the change concretely. Code snippets of the intended result help a lot.

```ts
// before / after
```

## Done when

- [ ] Specific, checkable statement (e.g. "`FeedService.getActiveFeeds()` returns `[]` instead of throwing when the collection is empty")
- [ ] Tests added or updated in `<file>.spec.ts`
- [ ] `npm run typecheck && npm run lint:check && npm test` pass

## Out of scope

Anything the agent should **not** touch (e.g. "do not change the notification default times").
