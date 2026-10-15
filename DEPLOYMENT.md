# 🚀 Deployment Guide

## Releases (current flow, Forgejo Actions)

Two buttons, nothing else:

1. **Cut**: Actions → _Cut release_ → Run workflow (`bump`: auto from conventional commits, or patch/minor/major; `dry_run: true` to preview). It refuses if an `ai/*` PR is open or checks are red on `dev`. Otherwise it bumps `package.json` + `CHANGELOG.md`, writes the Android `versionName`/`versionCode`, and opens a **Release x.y.z** PR from `release/x.y.z` into `master`.
2. **Merge that PR.** The _Release_ workflow then tags `vx.y.z`, publishes the Forgejo release with the changelog, builds the Android bundle (signed when the `ANDROID_KEYSTORE_*` secrets exist, debug APK otherwise) and deploys Cloud Functions **only if `functions/` changed since the previous tag** (needs `FIREBASE_TOKEN`).

`package.json` is the single source of truth for the version; Android follows it. Functions are never deployed on an ordinary push to `master`; use the _Deployment Pipeline_ workflow's manual run for an out-of-band functions deploy. iOS is not part of the automated flow. Scripts: `scripts/release-cut.sh`, `scripts/release-tag.sh`.

## Required secrets and variables

Set these under the repository's Actions settings. A workflow that needs a missing secret fails with a notification rather than silently skipping.

**Secrets**

- `AGENT_TOKEN`: Forgejo token for the agent bot (opens PRs, posts reviews, dispatches workflows).
- `CLAUDE_CODE_OAUTH_TOKEN`: Claude Code auth for the agent, review and fix workflows. `ANTHROPIC_API_KEY` is passed through as well and is used when the OAuth token is unset.
- `NOTIFY_WEBHOOK`: where alerts are posted: an ntfy topic URL (default) or, with `NOTIFY_FORMAT=json`, a Home Assistant / Discord / Slack style webhook. `NOTIFY_TOKEN` is an optional ntfy access token sent as a Bearer header.
- `ANDROID_KEYSTORE_FILE` (base64), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`: sign the release bundle. Without them the Release workflow builds a debug APK instead.
- `FIREBASE_TOKEN`: deploys Cloud Functions from the Release workflow when `functions/` changed since the previous tag.

**Variables**

- `AGENT_PAUSED`: set to `1` to stop the agent, review and fix workflows from starting.
- `NOTIFY_FORMAT`: `ntfy` (default when unset) or `json`, matching what `NOTIFY_WEBHOOK` expects.
