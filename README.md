# Paras (ASP NYC) ![Paras](cryptonym.png)

**ASP NYC** is a mobile application that helps NYC residents avoid parking tickets by tracking alternate side parking (ASP) rules and schedules. Get real-time updates on NYC street cleaning schedules, parking suspensions, and rule changes.

## Features

- 📅 **Calendar & List Views**: Switch between calendar and chronological list views of parking rules
- 🔔 **Custom Notifications**: Set personalized alerts for today's rules and next-day reminders
- 📱 **Mobile-First**: Built with Ionic and Capacitor for native iOS and Android experience
- 🌙 **Dark Mode**: Toggle between light and dark themes
- 📍 **NYC-Specific**: Focused exclusively on New York City alternate side parking rules
- 💾 **Offline Support**: View cached parking data even when offline
- ⚡ **Real-time Updates**: Live data from NYC parking authorities via Firebase

## Tech Stack

- **Frontend**: Angular 20 + Ionic 8 + TypeScript
- **Mobile**: Capacitor 7 for native iOS/Android features
- **Backend**: Firebase/Firestore for real-time data and push notifications
- **State**: Angular Signals for reactive state management
- **Testing**: Jest with Angular preset and Spectator
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
npm run type-check         # TypeScript type checking

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

- **HomePage**: Main interface with calendar/list toggle and parking data
- **SettingsPage**: User preferences, notifications, and app settings
- **FeedService**: Manages parking data from Firebase with caching
- **HorizontalCalendar**: Custom calendar component for date navigation

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
