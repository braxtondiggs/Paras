# Paras (ASP NYC) ![Paras](cryptonym.png)

**ASP NYC** (also known as "Alternate side parking - New York City") is a mobile application (v2.0.3) that helps NYC residents avoid parking tickets by tracking alternate side parking (ASP) rules and schedules. Get real-time updates on NYC street cleaning schedules, parking suspensions, and rule changes.

## Features

- 📅 **Calendar & List Views**: Switch between calendar and chronological list views of parking rules
- 🔔 **Custom Notifications**: Set personalized alerts for today's rules and next-day reminders
- 📱 **Mobile-First**: Built with modern Ionic 8 and Capacitor for native iOS and Android experience
- 🌙 **Dark Mode**: Toggle between light and dark themes with system preference support
- 📍 **NYC-Specific**: Focused exclusively on New York City alternate side parking rules
- 💾 **Offline Support**: View cached parking data even when offline
- ⚡ **Real-time Updates**: Live data from NYC parking authorities via Firebase
- 🎨 **Enhanced UI**: Modern card-based interface with loading states and status indicators
- ♿ **Accessibility**: WCAG compliant with screen reader support and high contrast mode
- 📊 **Status Indicators**: Color-coded badges and icons for quick rule status identification
- 🔄 **Skeleton Loading**: Smooth loading experience with skeleton placeholder UI
- 📐 **Responsive Design**: Optimized for all screen sizes with mobile-first approach

## Tech Stack

### Frontend Framework
- **Angular 20.1.8** with standalone components and modern control flow syntax
- **Ionic 8.7.3** for mobile UI components
- **TypeScript 5.8.0** with strict typing enabled
- **RxJS 7.8.1** for reactive programming patterns
- **Day.js 1.11.14** for date/time handling

### Mobile Platform
- **Capacitor 7.4.3** for native functionality (push notifications, haptics, preferences)
- **iOS and Android** support with native features
- **@capacitor/push-notifications** for custom notification delivery

### Backend & Data
- **Firebase/Firestore** for real-time data storage and updates
- **Angular Fire 20.0.1** for Firebase integration
- **Performance monitoring** and analytics
- **Offline support** with intelligent caching

### Testing & Quality
- **Jest 29.5.0** with Angular preset
- **@ngneat/spectator 21.0.1** for enhanced component testing
- **ESLint 9.34.0** with Angular and TypeScript rules
- **Prettier 3.6.2** for consistent code formatting

## Quick Start

### Prerequisites

- Node.js 20
- npm or yarn
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run start

# Run on iOS simulator
npm run ios

# Run on Android device/emulator
npm run android
```

### Available Commands

```bash
# Development
npm run start              # Development server
npm run build              # Production build
npm run build:ios          # iOS build with sync
npm run build:android      # Android build with sync

# Testing & Quality
npm run test               # Run Jest tests
npm run test:watch         # Watch mode testing
npm run test:coverage      # Coverage reports
npm run lint               # ESLint checking and fixes
npm run format             # Prettier formatting

# Mobile Development
npm run ios                # Run on iOS simulator
npm run android            # Run on Android with livereload
npm run copy               # Copy web assets to native

# Analysis
npm run stats              # Bundle size analysis
```

## Project Structure

```
src/
├── app/
│   ├── features/           # Feature modules
│   │   ├── onboarding/    # Intro/welcome screens
│   │   ├── parking/       # Main parking features
│   │   └── settings/      # User preferences
│   ├── shared/            # Shared components and utilities
│   │   ├── components/    # Reusable UI components
│   │   ├── guards/        # Route guards (authGuard, introGuard)
│   │   ├── interfaces/    # TypeScript interfaces
│   │   └── services/      # Shared services
│   ├── data/              # Data layer
│   │   ├── services/      # API and data services
│   │   └── models/        # Data models
│   └── core/              # Core types and configurations
├── assets/                # Static assets
├── environments/          # Environment configurations
└── theme/                 # Global styles and themes
```

## Key Components

### Core Pages
- **HomePage** (`src/app/features/parking/home/home.page.ts`): Main interface with dual view (list/calendar), signals-based state management, and real-time Firestore integration
- **SettingsPage** (`src/app/features/settings/settings/settings.page.ts`): User notification preferences, dark mode toggle, in-app purchases, and push notification management

### Services
- **FeedService** (`src/app/data/services/feed.service.ts`): Manages parking data from Firestore with caching, offline handling, and reactive data streams
- **NotificationService**: Handles push notifications with customizable timing and preferences

### UI Components
- **HorizontalCalendar**: Custom calendar component for intuitive date navigation
- **Skeleton Components**: Loading states with `IonSkeletonText` for smooth UX

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the architecture patterns
4. Add tests if applicable
5. Run `npm run lint` and `npm run test`
6. Submit a pull request

## License

This project is private and proprietary.

## Contact

For questions or support, contact: hello@braxtondiggs.com

---

Are you tired of paying parking tickets due to alternating New York City street parking schedules? If that's the case, we are here to help you with this amazing ASP NYC app. Get updates on New York City alternate side parking rules and changes. Stay informed by the changing street cleaning schedules and parking schedules/suspensions going around the NYC.
