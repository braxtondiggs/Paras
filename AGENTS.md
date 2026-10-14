# Agents

This file documents how AI agents (Claude Code, Claude API, GitHub Actions Claude) should operate within this project.

## Project Context for Agents

**What this app does:** Paras / ASP NYC tells New Yorkers when alternate side parking rules are suspended so they don't move their cars unnecessarily. It fetches schedule data from the NYC Open Data API via Firebase Cloud Functions and surfaces it in a mobile app with push notification support.

**Audience impact:** A notification bug or wrong schedule data could cause users to get parking tickets. Treat data correctness and notification reliability as the highest-priority concerns.

## Automated Review Agent (claude-code-review.yml)

Runs on every PR. Allowed tools: `npm run typecheck`, `npm run lint:check`, `npm run test`.

**Review priorities (in order):**

1. **Data correctness** — Any change touching `functions/src/index.ts` or `FeedService` that could affect schedule data parsing or Firestore reads/writes.
2. **Notification reliability** — Changes to `fcm.ts`, notification scheduling logic, or Capacitor push plugin usage.
3. **Auth/security** — Firestore security rules are not in this repo, but flag any client-side code that assumes a logged-in user when `AuthService` may return anonymous or null.
4. **Bundle size** — Flag new dependencies that would push the initial bundle past 1.8 MB.
5. **Mobile compatibility** — Flag web-only APIs (`localStorage`, `window.location`, DOM APIs) used outside a browser platform check. The app runs on iOS and Android via Capacitor.
6. **TypeScript strictness** — No `any` without a comment explaining why.

**What to skip:** Stylistic nitpicks, comment formatting, alphabetical ordering of imports.

## Interactive Agent (@claude mentions)

When mentioned in issues or PRs, the agent has read access to the repo.

**Common tasks this agent handles well:**

- Diagnosing why a Firestore query returns stale or missing data
- Explaining the Cloud Functions scheduled job flow
- Suggesting fixes for Capacitor plugin version mismatches
- Reviewing notification payload structure against FCM API requirements
- Identifying Angular standalone import errors

**Always clarify before changing:**

- Firestore collection/document structure (changes affect production data)
- Notification trigger times (users set custom times; defaults are 7:30 AM and 4 PM)
- `capacitor.config.json` App ID (changing `com.cymbit.paras` breaks store listings)
- `environment.prod.ts` Firebase config values

## Local Autonomous Agent (Claude Code, headless)

A scheduled Forgejo Actions job (`.forgejo/workflows/agent.yml` → `scripts/agent.sh`, both on `master`) works issues labeled `ai-ready` by running Claude Code in print mode (`claude -p`) inside the job container. Opus implements and fixes, Sonnet does the self-review (`AGENT_MODEL` / `REVIEW_MODEL` in the workflow); auth is the `CLAUDE_CODE_OAUTH_TOKEN` secret from `claude setup-token`. It runs unattended: **nobody is available to answer questions mid-run.** The prompt tells the agent to read this file first, so keep the name `AGENTS.md`.

**How it works:** on its 6-hourly schedule or a manual Run workflow (labeling alone does not start a run), the script picks up to 2 `ai-ready` issues (never ones labeled `human-only`, which mark work a developer must do: deploys, native projects, dependencies, protected files, design calls) by `priority: *` label (urgent → high → medium → low), labels them `ai-in-progress`, runs the agent on a fresh `ai/issue-N-<slug>` branch off `dev`, runs checks, does a self-review pass, then opens a **draft** (`WIP:`) PR. Failures get `ai-failed` and a comment. It stops if 2 `ai/*` PRs are already open. The script handles git, labels and PRs — the agent only edits files and runs commands. Permissions are `acceptEdits` plus a Bash allow-list (`npm run/test`, `npx tsc/eslint/prettier/jest`, read-only `git`, `ls/cat/grep/...`); anything else, including `git commit`, `git push` and `npm install`, is denied.

**After the PR:** `pr-review.yml` has Sonnet review every PR and post a Forgejo review. On `ai/*` branches with findings it dispatches `pr-fix.yml`, which resumes the agent on the branch to address each finding, pushes a `fix(review):` commit and labels the PR `ai-handed-off`; at most 2 fix rounds per branch, then a human takes over. Write agent-ready issues with `/create-issue` (`.claude/commands/create-issue.md`).

**Rules for the agent:**

- Work only on the issue you were given. Smallest change that fully resolves it; no drive-by refactors.
- Read the relevant files before editing. Follow "Coding Guidance for Agents" below.
- Add or update tests for behavior you change (standalone components use Spectator).
- Checks: `npm run typecheck && npm run lint:check && npm test && npx ng build --configuration development` (the build is what type-checks templates). Fix failures you caused. You may run `npm run lint`
  (eslint `--fix`) and `npx prettier --write <files you changed>` to auto-fix formatting before the checks. Do not run
  `npm run build` (it runs `cap sync`) or `npm run format` (it rewrites the whole repo).
- **Do not** run `git commit`, `git push`, create branches, or call the Forgejo API.
- **Do not** add, remove or upgrade dependencies (`package.json` / lockfiles). The script rejects these changes.
- **Do not** edit: `capacitor.config.json`, `environment.prod.ts`, `ios/`, `android/`, Firestore rules, `.forgejo/`, `scripts/agent.sh`, `AGENTS.md`, `CLAUDE.md`. The script rejects these changes.
- Anything under "Always clarify before changing" or "Out of Scope for Agents", or an issue too ambiguous to implement safely: make **no** changes and write the reason to the `blocked.txt` path given in your prompt. A human will clarify.
- MCP servers and slash commands listed below are **not available** in the unattended job.
- Don't run deploys, `cap sync`, emulators, or anything that touches Firebase or the network beyond `npm`.

## Custom Slash Commands

| Command                | Purpose                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| `/deploy-functions`    | Lint → build → confirm → deploy Cloud Functions safely               |
| `/sync-native`         | Production build → `cap sync` → prep for Xcode/Android Studio        |
| `/check-schedule`      | Query Firestore to verify today/tomorrow schedule data is populated  |
| `/bundle-check`        | Run webpack-bundle-analyzer and flag anything near the 1.8 MB budget |
| `/new-component`       | Scaffold a standalone Angular component with Spectator test          |
| `/debug-notifications` | Trace FCM token flow and notification scheduling end-to-end          |

## MCP Servers Available

See `.mcp.json` for the full list. Key capabilities:

| Server             | Use for                                                           |
| ------------------ | ----------------------------------------------------------------- |
| `firebase`         | Query Firestore collections, manage emulators, inspect Auth users |
| `forgejo`          | Read/comment on PRs and issues, check CI run status               |
| `context7`         | Look up current Angular, Ionic, Capacitor, and Firebase SDK docs  |
| `nx`               | Nx workspace graph, affected project analysis, task execution     |
| `playwright`       | Automated browser testing of the web version of the app           |
| `claude-in-chrome` | Interactive browser testing of the web version                    |

## Coding Guidance for Agents

- Use **standalone Angular components** — never suggest NgModule-based patterns.
- Prefer **RxJS operators** over async/await in Angular services (existing code is reactive).
- Use **dayjs** for all date manipulation — not `Date`, `moment`, or `date-fns`.
- Firestore queries go in `FeedService` — don't add Firestore calls to components directly.
- Capacitor calls must be guarded with `Capacitor.isNativePlatform()` or platform checks where the API doesn't exist in a browser.
- When adding a new Capacitor plugin, remind the user to run `npx cap sync` and update both `ios/` and `android/` native projects.
- Cloud Functions deploy to Node.js 18 — do not use Node 20+ APIs.

## Out of Scope for Agents

- Modifying Firestore security rules (managed separately in Firebase Console)
- App Store / Google Play submission steps
- Signing certificates or provisioning profiles
- Changing the Firebase project ID (`paras-293d5`)
