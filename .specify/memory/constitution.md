# Paras (ASP NYC) Constitution

## Core Principles

### I. User-Centric Design
Every feature must solve a real problem for NYC residents managing alternate side parking. User experience takes precedence over technical convenience. The app must be accessible, performant, and reliable for users in urgent parking situations.

### II. Mobile-First Performance
Application must load in under 3 seconds and work offline. Bundle size must be monitored and optimized. Native mobile patterns preferred over web-first approaches. Battery usage must be minimal for background operations.

### III. Data Accuracy (NON-NEGOTIABLE)
Parking rule data must be accurate and real-time. All data sources must be verified and have fallback mechanisms. No feature ships without comprehensive error handling for data failures. User notifications must be reliable and timely.

### IV. Modern Angular Architecture
Use Angular 20+ standalone components, signals for state management, and strict TypeScript. Components must use OnPush change detection. RxJS patterns required for async operations with proper cleanup using takeUntilDestroyed.

### V. Testing & Code Quality
Jest unit tests required for all services and complex components. ESLint and Prettier must pass before commits. TypeScript strict mode enforced. Critical user flows must have integration tests.

## Security & Privacy Standards

User data minimization is mandatory. No personal information stored beyond necessary preferences. Firebase security rules must be audited regularly. Push notification tokens handled securely. No tracking beyond essential analytics.

## Technical Standards

### Framework Requirements
- Angular 20+ with Ionic 8+
- Capacitor for native functionality
- Firebase/Firestore for backend
- Day.js for date handling
- Signal-based reactive patterns

### Code Standards
- Standalone component architecture
- TypeScript interfaces for all data models
- Error boundaries and graceful degradation
- Accessibility compliance (WCAG 2.1)
- Dark mode support

## Governance

This constitution supersedes all development practices. Feature requests must align with core principles. Technical debt requires justification and migration plan. All code changes must pass linting, type checking, and testing gates.

Performance regression requires immediate attention. User-reported bugs prioritized over new features. Community feedback drives roadmap decisions.

**Version**: 1.0.0 | **Ratified**: 2025-09-15 | **Last Amended**: 2025-09-15