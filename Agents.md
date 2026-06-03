# Agents

This file documents how AI agents (Claude Code, Claude API, GitHub Actions Claude) should operate within this project.

## Project Context for Agents

**What this app does:** Paras / ASP NYC tells New Yorkers when alternate side parking rules are suspended so they don't move their cars unnecessarily. It fetches schedule data from the NYC Open Data API via Firebase Cloud Functions and surfaces it in a mobile app with push notification support.

**Audience impact:** A notification bug or wrong schedule data could cause users to get parking tickets. Treat data correctness and notification reliability as the highest-priority concerns.

## Automated Review Agent (claude-code-review.yml)

Runs on every PR. Allowed tools: `npm run test`, `npm run lint`, `npm run typecheck`.

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

## Custom Slash Commands

| Command | Purpose |
|---------|---------|
| `/deploy-functions` | Lint → build → confirm → deploy Cloud Functions safely |
| `/sync-native` | Production build → `cap sync` → prep for Xcode/Android Studio |
| `/check-schedule` | Query Firestore to verify today/tomorrow schedule data is populated |
| `/bundle-check` | Run webpack-bundle-analyzer and flag anything near the 1.8 MB budget |
| `/new-component` | Scaffold a standalone Angular component with Spectator test |
| `/debug-notifications` | Trace FCM token flow and notification scheduling end-to-end |

## MCP Servers Available

See `.mcp.json` for the full list. Key capabilities:

| Server | Use for |
|--------|---------|
| `firebase` | Query Firestore collections, manage emulators, inspect Auth users |
| `forgejo` | Read/comment on PRs and issues, check CI run status |
| `context7` | Look up current Angular, Ionic, Capacitor, and Firebase SDK docs |
| `nx` | Nx workspace graph, affected project analysis, task execution |
| `playwright` | Automated browser testing of the web version of the app |
| `claude-in-chrome` | Interactive browser testing of the web version |

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
