# Data Model: NYC Alternate Side Parking Tracking System

**Phase 1 Design Output** | **Date**: 2025-09-15

## Overview
Data model design for NYC alternate side parking tracking system with entities, relationships, and validation rules derived from functional requirements and research findings.

## Core Entities

### ParkingRule
Represents ASP regulations for specific streets with schedule and status information.

**Fields**:
- `id`: string (document ID)
- `active`: boolean (whether parking rule is currently active)
- `created`: Timestamp (creation date)
- `date`: Timestamp (rule effective date)
- `metered`: boolean (whether parking is metered during restrictions)
- `reason`: string (reason for suspension/rule - "Street Cleaning", "Holiday", etc.)
- `text`: string (human-readable rule description)
- `type`: 'NYC' | 'OTHER' (rule type, strictly typed)
- `streetAddress`: string (specific street or address range)
- `borough`: string (NYC borough - Manhattan, Brooklyn, Queens, Bronx, Staten Island)
- `zipCode`: string (postal code for location-based queries)
- `coordinates`: GeoPoint (latitude/longitude for mapping)
- `timeStart`: string (start time in HH:MM format)
- `timeEnd`: string (end time in HH:MM format)
- `daysOfWeek`: number[] (0-6, Sunday=0, days when rule applies)
- `suspendedUntil`: Timestamp | null (temporary suspension end date)

**Validation Rules**:
- `date` must be valid future or current date
- `type` must be enum value ('NYC' | 'OTHER')
- `timeStart` and `timeEnd` must be valid 24-hour format
- `daysOfWeek` array must contain valid day numbers (0-6)
- `streetAddress` must not be empty
- `borough` must be valid NYC borough name

**State Transitions**:
- Active → Suspended (when city suspends rules)
- Suspended → Active (when rules are reinstated)
- Active → Inactive (when rule expires or is removed)

### UserProfile
Represents app users with notification preferences and tracked locations.

**Fields**:
- `uid`: string (Firebase Auth UID, document ID)
- `email`: string | null (optional email for account sync)
- `createdAt`: Timestamp (account creation date)
- `lastActiveAt`: Timestamp (last app usage)
- `notificationSettings`: NotificationSettings (user preferences)
- `trackedLocations`: TrackedLocation[] (user's parking locations)
- `deviceTokens`: string[] (FCM tokens for push notifications)
- `timezone`: string (user's timezone for notification scheduling)
- `isAnonymous`: boolean (whether using anonymous auth)

**Validation Rules**:
- `email` must be valid email format when provided
- `trackedLocations` array maximum 5 items
- `deviceTokens` array must contain valid FCM tokens
- `timezone` must be valid IANA timezone string

### NotificationSettings
User preferences for parking notifications.

**Fields**:
- `enabled`: boolean (master notification toggle)
- `advanceTime`: number (minutes before restriction - 30, 60, 120, 180, 360, 720, 1440)
- `notifyToday`: boolean (notifications for today's rules)
- `notifyTomorrow`: boolean (notifications for next day's rules)
- `notifyExceptionsOnly`: boolean (only suspension/change notifications)
- `notifyWeekends`: boolean (weekend rule notifications)
- `quietHours`: QuietHours | null (do not disturb time range)

**Validation Rules**:
- `advanceTime` must be one of allowed values
- All boolean flags default to reasonable values
- `quietHours` must have valid start/end times if provided

### QuietHours
Time range when notifications should be silenced.

**Fields**:
- `startTime`: string (HH:MM format)
- `endTime`: string (HH:MM format)
- `enabled`: boolean

**Validation Rules**:
- Times must be valid 24-hour format
- Handles overnight ranges (23:00 to 07:00)

### TrackedLocation
User's saved parking locations with display preferences.

**Fields**:
- `id`: string (unique identifier)
- `name`: string (user-defined name - "Home", "Work", etc.)
- `streetAddress`: string (full street address)
- `coordinates`: GeoPoint (latitude/longitude)
- `borough`: string (NYC borough)
- `zipCode`: string (postal code)
- `isDefault`: boolean (primary parking location)
- `addedAt`: Timestamp (when location was saved)

**Validation Rules**:
- `name` must not be empty, max 50 characters
- `streetAddress` must be valid NYC address
- Only one location can have `isDefault: true`
- Coordinates must be within NYC bounds

### RuleSuspension
Represents temporary suspensions of ASP rules.

**Fields**:
- `id`: string (document ID)
- `ruleIds`: string[] (affected parking rule IDs)
- `reason`: string (suspension reason)
- `startDate`: Timestamp (suspension start)
- `endDate`: Timestamp (suspension end)
- `borough`: string | null (borough-specific or city-wide)
- `announced`: Timestamp (when suspension was announced)
- `isEmergency`: boolean (weather/emergency suspension)

**Validation Rules**:
- `endDate` must be after `startDate`
- `ruleIds` array must not be empty
- `reason` must not be empty

### NotificationLog
Tracks sent notifications for analytics and debugging.

**Fields**:
- `id`: string (document ID)
- `userId`: string (recipient user ID)
- `ruleId`: string (related parking rule)
- `type`: 'UPCOMING' | 'SUSPENSION' | 'CHANGE' (notification type)
- `sentAt`: Timestamp (when notification was sent)
- `scheduledFor`: Timestamp (when rule takes effect)
- `title`: string (notification title)
- `body`: string (notification body)
- `success`: boolean (delivery success)
- `error`: string | null (error message if failed)

**Validation Rules**:
- `type` must be enum value
- `sentAt` must be before `scheduledFor` for upcoming notifications
- Either `success: true` or `error` must be provided

## Entity Relationships

### User → TrackedLocations (1:many)
- User can have up to 5 tracked locations
- Locations are embedded in UserProfile document
- One location can be marked as default

### ParkingRule → TrackedLocation (many:many)
- Multiple rules can apply to same location
- Same rule can affect multiple user locations
- Queried by geographic proximity and address matching

### RuleSuspension → ParkingRule (many:many)
- One suspension can affect multiple rules
- Rules can have multiple suspensions over time
- Temporal relationship based on date ranges

### User → NotificationLog (1:many)
- All notifications for a user are tracked
- Used for preventing duplicate notifications
- Analytics for notification effectiveness

## Firebase Firestore Collections

### `/rules` Collection
- Document per parking rule
- Indexed on: `date`, `active`, `borough`, `zipCode`
- Real-time listeners for rule changes
- TTL for expired rules (90 days)

### `/users/{uid}` Documents
- Document per user profile
- Subcollections: none (embedded data)
- Security rules: user can only read/write own document

### `/suspensions` Collection
- Document per rule suspension
- Indexed on: `startDate`, `endDate`, `borough`
- Real-time listeners for suspension changes

### `/notifications/{uid}/logs` Subcollection
- Document per sent notification
- Partitioned by user for scalability
- TTL for old logs (30 days)

## Data Access Patterns

### Real-time Rule Updates
```typescript
// Query active rules for user locations
rules.where('active', '==', true)
     .where('date', '>=', today)
     .where('zipCode', 'in', userZipCodes)
```

### Notification Queries
```typescript
// Find rules needing notifications
rules.where('date', '==', tomorrow)
     .where('active', '==', true)
     .where('coordinates', 'near', userLocation)
```

### Historical Data
```typescript
// User parking history
rules.where('date', '>=', thirtyDaysAgo)
     .where('date', '<=', today)
     .orderBy('date', 'desc')
```

## Data Validation Strategy

### Client-side Validation
- TypeScript interfaces enforce structure
- Angular reactive forms with validators
- Real-time validation feedback

### Server-side Validation
- Firebase security rules enforce data integrity
- Cloud Functions validate business rules
- Input sanitization for user data

### Data Consistency
- Firestore transactions for critical updates
- Optimistic updates with rollback on failure
- Conflict resolution for offline edits

## Performance Considerations

### Indexing Strategy
- Composite indexes for complex queries
- Single-field indexes for simple filters
- Query optimization based on usage patterns

### Data Partitioning
- User data partitioned by UID
- Geographic partitioning for rule queries
- Date-based partitioning for historical data

### Caching Strategy
- Client-side caching with Firestore offline
- 30-day retention for offline access
- Predictive caching for next day's rules

---
**Data Model Complete** | Ready for Contract Generation