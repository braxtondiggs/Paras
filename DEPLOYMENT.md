# 🚀 Deployment Guide

## Releases (current flow, Forgejo Actions)

Two buttons, nothing else:

1. **Cut**: Actions → _Cut release_ → Run workflow (`bump`: auto from conventional commits, or patch/minor/major; `dry_run: true` to preview). It refuses if an `ai/*` PR is open or checks are red on `dev`. Otherwise it bumps `package.json` + `CHANGELOG.md`, writes the Android `versionName`/`versionCode`, and opens a **Release x.y.z** PR from `release/x.y.z` into `master`.
2. **Merge that PR.** The _Release_ workflow then tags `vx.y.z`, publishes the Forgejo release with the changelog, builds the signed Android bundle (fails and alerts if the `ANDROID_*` secrets are missing) and deploys Cloud Functions **only if `functions/` changed since the previous tag** (needs `FIREBASE_SERVICE_ACCOUNT`).

`package.json` is the single source of truth for the version; Android follows it. Functions are never deployed on an ordinary push to `master`; use the _Deployment Pipeline_ workflow's manual run for an out-of-band functions deploy. iOS is not part of the automated flow. Scripts: `scripts/release-cut.sh`, `scripts/release-tag.sh`.

## Required secrets and variables

Set these under the repository's Actions settings. A workflow that needs a missing secret fails with a notification rather than silently skipping.

**Secrets**

- `AGENT_TOKEN`: Forgejo token for the agent bot (opens PRs, posts reviews, dispatches workflows).
- `CLAUDE_CODE_OAUTH_TOKEN`: Claude Code auth for the agent, review and fix workflows. `ANTHROPIC_API_KEY` is passed through as well and is used when the OAuth token is unset.
- `NOTIFY_WEBHOOK`: where alerts are posted: an ntfy topic URL (default) or, with `NOTIFY_FORMAT=json`, a Home Assistant / Discord / Slack style webhook. `NOTIFY_TOKEN` is an optional ntfy access token sent as a Bearer header.
- `ANDROID_KEYSTORE_FILE` (base64 of the upload keystore), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`: the Release workflow decodes the keystore to a temp file, `android/app/build.gradle` signs the bundle with it, and `jarsigner -verify` must pass before the `.aab` is uploaded. All four are required; a release without them fails the Android job and posts a high-priority alert rather than shipping an unsigned or debug build.
- `FIREBASE_SERVICE_ACCOUNT`: JSON key of a Google Cloud service account; deploys Cloud Functions from the Release workflow when `functions/` changed since the previous tag. `FIREBASE_TOKEN` (from `firebase login:ci`, deprecated by Google) is accepted as a fallback when the service account is unset.

**Variables**

- `AGENT_PAUSED`: set to `1` to stop the agent, review and fix workflows from starting.
- `NOTIFY_FORMAT`: `ntfy` (default when unset) or `json`, matching what `NOTIFY_WEBHOOK` expects.

### Creating the release secrets

**Keystore**: the app already has one (`release.keystore`, alias `cymbit`); keep using it, since Play ties the package to its fingerprint. Store it in a password manager, never in the repo (`*.jks` / `*.keystore` are gitignored). Only a brand-new app would generate one (`keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`).

```sh
base64 -i release.keystore | pbcopy   # paste as ANDROID_KEYSTORE_FILE
```

Then add `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`cymbit`) and `ANDROID_KEY_PASSWORD`. All four must be set; the key password is usually the same as the keystore password.

**Firebase service account** for project `paras-293d5`: Google Cloud console → IAM & Admin → Service Accounts → create `forgejo-deploy` with the roles _Firebase Admin_, _Cloud Functions Admin_ and _Service Account User_ (add any further role the first deploy's error message names). Create a JSON key and paste its contents as `FIREBASE_SERVICE_ACCOUNT`.

**Smoke test**: Actions → _Release_ → Run workflow on `dev`, `master` or a `release/*` branch. That path builds and signs the bundle (no tag or release), uploads it as the `android-smoke` artifact with `jar verified` in the log, and runs `firebase projects:list` with the service account instead of deploying functions (so it checks the credential, not every role a deploy needs). Other refs are refused unless the repository owner dispatches them, since the jobs hold the upload keystore and Firebase credentials; that check is a guard against mistakes, not a security boundary, because it lives in the dispatched branch's own workflow file. Don't dispatch from a branch whose workflow or build files you haven't read.

## Privacy policy page

`legal/privacy.html` is the policy linked from the Play Store listing. It is served by Firebase Hosting on the app's project at
https://paras-293d5.web.app/privacy.html (the site root redirects there). Nothing else is hosted there; the web app is not
deployed. After editing the page, redeploy from the folder:

```bash
cd legal && npx firebase-tools@14 deploy --only hosting --project paras-293d5
```

Keep the page in step with the Play Console Data safety form whenever a new Firebase service, permission or data field is added.

The root `firebase.json` also has a `hosting` block (`public: www`, SPA rewrite) for the same default site. **Never run
`firebase deploy` or `firebase deploy --only hosting` from the repo root**: it would replace the privacy page with the web
app and break the URL on the Play listing. Functions deploys (`--only functions`) are unaffected. If the web app is ever
hosted, give it its own site (`firebase hosting:sites:create`) and a `site` field, and leave the default site to `legal/`.
