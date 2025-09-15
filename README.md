# Paras (ASP NYC) ![Paras](cryptonym.png)

**ASP NYC** is a mobile application that helps NYC residents avoid parking tickets by tracking alternate side parking (ASP) rules and schedules. Get real-time updates on NYC street cleaning schedules, parking suspensions, and rule changes.

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

- **Frontend**: Angular 20 + Ionic 8 + TypeScript 5.8 (with strict typing)
- **Architecture**: Standalone components with signal-based reactivity
- **Mobile**: Capacitor 7 for native iOS/Android features
- **Backend**: Firebase/Firestore for real-time data and push notifications
- **State Management**: Angular Signals with computed values and reactive patterns
- **UI Components**: Enhanced Ionic 8 components with skeleton loading and status indicators
- **Testing**: Jest 29 with Angular preset and Spectator for component testing
- **Code Quality**: ESLint 9 + Prettier 3 with strict TypeScript configuration
- **Date/Time**: Day.js for date manipulation and formatting

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
npm run start              # Start dev server
npm run build              # Production build
npm run build:ios          # Build and sync iOS
npm run build:android      # Build and sync Android

# Testing & Quality
npm run test               # Run tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
npm run lint               # Lint and fix code
npm run format             # Format code with Prettier

# Analysis
npm run stats              # Bundle size analysis
```

## Project Structure

```
src/
├── app/
│   ├── features/          # Feature modules (onboarding, parking, settings)
│   ├── shared/            # Shared components, guards, interfaces
│   ├── data/              # Services, models, interceptors
│   └── app.routes.ts      # Route configuration
├── assets/                # Static assets
├── environments/          # Environment configurations
└── theme/                 # Global styles and themes
```

## Key Components

- **HomePage**: Main interface with calendar/list toggle and parking data display
- **SettingsPage**: User preferences, notifications, and app settings
- **FeedService**: Manages parking data from Firebase with intelligent caching and offline support
- **HorizontalCalendar**: Custom calendar component for intuitive date navigation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run `npm run lint` and `npm run test`
6. Submit a pull request

## License

This project is private and proprietary.

## Contact

For questions or support, contact: hello@braxtondiggs.com

---

Are you tired of paying parking tickets due to alternating New York City street parking schedules? If that's the case, we are here to help you with this amazing ASP NYC app. Get updates on New York City alternate side parking rules and changes. Stay informed by the changing street cleaning schedules and parking schedules/suspensions going around the NYC.
