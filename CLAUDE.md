# Paras (ASP NYC)

NYC Alternate Side Parking mobile app — Angular 17 + Ionic + Capacitor with Firebase as the entire backend. Runs on iOS, Android, and web from a single codebase.

## Commands

```bash
# Development
npm start                  # Angular dev server (web)
npm run ios                # Run on iOS simulator via Capacitor
npm run android            # Run on Android with livereload

# Build
npm run build              # Build + sync to Capacitor (production)
npm run build:ios          # Build + sync iOS only
npm run build:android      # Build + sync Android only
npm run copy               # Build + cap copy (no sync)

# Test
npm test                   # Jest (runs serially via --runInBand)
npm run test:coverage      # Jest with coverage report
npm run test:watch         # Jest watch + coverage

# Cloud Functions
cd functions && npm run start     # Build watch + Firebase emulator
cd functions && npm run deploy    # Build + deploy to Firebase
cd functions && npm run logs      # Tail function logs

# Analysis
npm run stats              # Build with webpack-bundle-analyzer
```

## Architecture

**Data flow:** Cloud Functions fetch NYC ASP API every 4 hours → store in Firestore `feed` collection → Angular app queries Firestore with date-range filters → display in calendar/list views.

**Push notifications:** Cloud Functions trigger at 7:30 AM (today alert) and 4 PM (tomorrow alert). Custom notification times stored per-user in Firestore `notifications` collection.

### Key Directories

```
src/app/
  core/
    components/     # Shared: ModalDetail, HorizontalCalendar, CardDetail
    guards/         # AuthGuard (anonymous Firebase auth), IntroGuard (onboarding)
    interface/      # TypeScript interfaces for Firestore data models
    services/       # AuthService, FeedService
  home/             # Main calendar/list view
  intro/            # First-launch onboarding
  settings/         # User preferences (notification times, etc.)
functions/src/
  index.ts          # Scheduled Cloud Functions (ASP data fetch, notifications)
  fcm.ts            # Firebase Cloud Messaging logic
```

### Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Angular 17 (standalone components — no NgModules) |
| Mobile | Ionic 7 + Capacitor 5 |
| Backend | Firebase (Firestore, Auth, Cloud Functions, FCM, Analytics) |
| Auth | Anonymous Firebase Auth (no login required) |
| State | RxJS — no NgRx/signals store |
| Dates | dayjs |
| Build | Angular CLI + Nx 17 (computation caching) |
| Tests | Jest 29 + Spectator 16 |

### Environments

- `src/environments/environment.ts` — dev (connects to Firebase emulators on localhost)
- `src/environments/environment.prod.ts` — prod (Firebase project `paras-293d5`)
- Firebase emulators: Firestore `:8080`, Auth `:9099`, Functions `:5001`

## Code Conventions

- **Standalone components only** — never add `NgModule`. Every component/pipe/directive uses `standalone: true`.
- **Imports array on components** — import `IonicModule`, `CommonModule`, `RouterModule`, etc. directly on the component, not a shared module.
- **TypeScript strict mode** is on — no `any` without justification.
- No `.prettierrc` or `.eslintrc` in the frontend — maintain the existing style (2-space indent, single quotes, no semicolons in templates).
- Cloud Functions use TSLint (`functions/tslint.json`) — run `npm run lint` in `/functions` before deploying.
- Bundle budget: 1.8 MB warning, 2 MB error — check `npm run stats` before shipping large dependencies.

## Testing

Tests live alongside source files (`*.spec.ts`). Spectator is the preferred way to create Angular testing harnesses. Jest globals (`describe`, `it`, `expect`) are available without imports.

Run the full suite before opening a PR:
```bash
npm test
```

## Mobile / Native

After any change to `src/`:
```bash
npm run copy     # sync web assets to native projects
```

Capacitor plugins in use: `@capacitor/push-notifications`, `@capacitor/network`, `@capacitor/preferences`, `@capacitor/haptics`, `@capacitor/device`, `cordova-plugin-purchase`.

## CI / CD

- `.github/workflows/claude-code-review.yml` — automated Claude review on every PR (runs `npm run test`, `npm run lint`, `npm run typecheck`)
- `.github/workflows/claude.yml` — interactive Claude triggered by `@claude` mentions in issues/PRs
- Deployments are manual (`firebase deploy` or Xcode/Android Studio)
