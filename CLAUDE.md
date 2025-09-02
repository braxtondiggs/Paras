# Claude Code Instructions for Paras

## App Overview

**Paras** (codename) is a mobile application (version 2.0.3) also known as **ASP NYC** (short name) or **"Alternate side parking - New York City"** (full name). Built with Angular 20 and Ionic 8, it helps NYC residents track alternate side parking (ASP) rules and schedules. The app provides notifications and calendar views to help users avoid parking tickets due to street cleaning schedules.

### Core Purpose
- Monitor NYC alternate side parking rules and suspensions
- Send customizable push notifications about parking regulations
- Display calendar view of parking restrictions
- Track street cleaning schedules and exceptions

## Technical Stack

### Frontend Framework
- **Angular 20.1.8** with standalone components
- **Ionic 8.7.3** for mobile UI components
- **TypeScript 5.8.0** with strict typing
- **RxJS 7.8.1** for reactive programming
- **Day.js 1.11.14** for date/time handling

### Mobile Platform
- **Capacitor 7.4.3** for native functionality
- **iOS and Android** support
- Push notifications via `@capacitor/push-notifications`
- Native features: haptics, preferences, network status

### Backend & Data
- **Firebase/Firestore** for data storage and real-time updates
- **Angular Fire 20.0.1** for Firebase integration
- Performance monitoring and analytics
- Offline support with caching

### Testing & Quality
- **Jest 29.5.0** with Angular preset
- **ESLint 9.34.0** with Angular and TypeScript rules
- **Prettier 3.6.2** for code formatting
- **@ngneat/spectator 21.0.1** for component testing

## Architecture

### Project Structure
```
src/
├── app/
│   ├── features/           # Feature modules
│   │   ├── onboarding/    # Intro/welcome screens
│   │   ├── parking/       # Main parking features
│   │   └── settings/      # User preferences
│   ├── shared/            # Shared components and utilities
│   │   ├── components/    # Reusable UI components
│   │   ├── guards/        # Route guards
│   │   ├── interfaces/    # TypeScript interfaces
│   │   └── services/      # Shared services
│   └── data/              # Data layer
│       ├── services/      # API and data services
│       └── models/        # Data models
```

### Key Components

#### HomePage (`src/app/features/parking/home/home.page.ts`)
- Main interface with dual view: list and calendar
- Displays parking feed data with date navigation
- Uses signals for reactive state management
- Integrates with Firestore for real-time updates
- Features horizontal calendar component and modal details

#### SettingsPage (`src/app/features/settings/settings/settings.page.ts`)
- User notification preferences
- Custom notification timing
- Dark mode toggle
- In-app purchases for donations
- Push notification permission handling

#### FeedService (`src/app/data/services/feed.service.ts`)
- Manages parking data from Firestore
- Caches feeds for performance
- Handles offline state
- Filters active and metered parking rules
- Provides reactive data streams

### Data Models

#### Feed Interface (`src/app/shared/interfaces/feed.interface.ts`)
```typescript
interface Feed {
  active: boolean;      // Whether parking rule is active
  created: Timestamp;   // Creation date
  date: Timestamp;      // Rule effective date
  id: number;           // Unique identifier
  metered: boolean;     // Whether parking is metered
  reason: string;       // Reason for suspension/rule
  text: string;         # Rule description
  type: string;         // Rule type (NYC)
}
```

## Key Features

### 1. Parking Schedule Tracking
- Real-time parking rule updates from NYC data
- Calendar view with highlighted restriction dates
- Date-based filtering and navigation
- Historical and future rule viewing

### 2. Push Notifications
- Customizable notification timing
- Today's rules and next day alerts
- Exception-only notifications option
- Weekend rule notifications

### 3. Offline Support
- Cached data for offline viewing
- Network state handling
- Automatic retry mechanisms
- Performance optimization

### 4. User Preferences
- Dark mode support
- Notification customization
- Time picker for custom alerts
- Exception and weekend filtering

## Development Commands

### Build & Development
```bash
npm run start          # Development server
npm run build          # Production build
npm run build:ios      # iOS build with sync
npm run build:android  # Android build with sync
```

### Testing & Quality
```bash
npm run test           # Run Jest tests
npm run test:watch     # Watch mode testing
npm run test:coverage  # Coverage reports
npm run lint           # ESLint checking and fixes
npm run format         # Prettier formatting
npm run type-check     # TypeScript checking
```

### Mobile Development
```bash
npm run ios            # Run on iOS simulator
npm run android        # Run on Android with livereload
npm run copy           # Copy web assets to native
```

## Firebase Configuration

The app uses Firebase for:
- **Firestore**: Parking rule data storage
- **Analytics**: User behavior tracking
- **Performance**: App performance monitoring
- **Push Notifications**: Custom notification delivery

### Data Structure
- `feed` collection: Contains parking rules and schedules
- `notifications/${uid}` documents: User notification preferences

## Route Structure

### Main Routes
- `/` → Redirects to `/home`
- `/intro` → Onboarding/welcome screen
- `/home` → Main parking schedule view
- `/home/calendar` → Calendar-focused view
- `/settings` → User preferences and settings

### Route Guards
- `authGuard`: Ensures user authentication
- `introGuard`: Manages onboarding flow

## State Management

### Reactive Patterns
- **Signals**: Primary state management (Angular 20 feature)
- **RxJS**: Async data streams and operations
- **Computed signals**: Derived state calculations
- **takeUntilDestroyed**: Automatic subscription cleanup

### Performance Optimizations
- OnPush change detection strategy
- Cached Firestore queries with `shareReplay`
- Lazy-loaded route components
- Optimized bundle analysis available

## Key Dependencies & Features

### UI/UX Libraries
- **Swiper 11.0.5**: Touch slider for calendar/list toggle
- **Ionicons**: Icon library integration
- **Capacitor plugins**: Native device features

### Development Tools
- **Webpack Bundle Analyzer**: Bundle size optimization
- **Jest JUnit**: CI/CD test reporting
- **Angular DevKit**: Build and development tools

## Common Development Patterns

### Component Architecture
- Standalone components (Angular 20)
- Signal-based reactive state
- Dependency injection with `inject()`
- OnPush change detection for performance

### Error Handling
- RxJS error operators (`catchError`, `retry`)
- Graceful degradation for offline states
- User feedback via toast notifications
- Network state monitoring

### Data Flow
1. Services fetch data from Firebase
2. Components subscribe to reactive streams
3. Signals update UI reactively
4. User actions trigger service calls
5. State updates propagate automatically

## Testing Strategy

### Unit Testing
- Jest with Angular preset
- Spectator for component testing
- Firebase and Ionic mocks provided
- Coverage reporting and CI integration

### Component Testing
- Mock external dependencies
- Test user interactions
- Verify state changes
- Check navigation flows

## Build & Deployment

### Production Build
```bash
npm run build  # Creates optimized www/ directory
```

### Platform Sync
```bash
ionic capacitor sync  # Updates native platforms
```

### Bundle Analysis
```bash
npm run stats  # Analyze bundle size and composition
```

## CI / CD

Workflows live in `.forgejo/workflows/` (Forgejo Actions):
- `ci.yml` — typecheck, Jest, production build with bundle budget check, functions lint/build, security audit
- `claude-code-review.yml` — automated Claude PR review (inline comments, severity labels, skips drafts/WIP)
- `claude.yml` — interactive Claude triggered by `@claude` mentions in issues/PRs

Deployments are manual (`firebase deploy` for functions, Xcode/Android Studio for mobile).

## Code Conventions

- **Standalone components only** — never add `NgModule`
- **Dependency injection** — use `inject()`, not constructor injection
- **Dates** — always use `dayjs`, never native `Date`, `moment`, or `date-fns`
- **Firestore calls** — belong in `data/services/` only, not in components
- **Capacitor APIs** — guard with `Capacitor.isNativePlatform()` where the API doesn't exist in a browser
- **No god files** — files over ~200 lines or mixing multiple concerns should be split
- **TypeScript strict mode** is on — no `any` without justification
- Bundle budget: 1.8 MB warning, 2 MB error — check `npm run stats` before shipping large dependencies