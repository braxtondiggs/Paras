/**
 * Firestore Schema Contracts for NYC ASP Tracking System
 * Generated from data model - Phase 1 Design
 */

import { Timestamp, GeoPoint } from 'firebase/firestore';

// Base Firestore document interface
export interface FirestoreDocument {
  id: string;
  created?: Timestamp;
  updated?: Timestamp;
}

// Core entity interfaces
export interface ParkingRule extends FirestoreDocument {
  active: boolean;
  date: Timestamp;
  metered: boolean;
  reason: string;
  text: string;
  type: 'NYC' | 'OTHER';
  streetAddress: string;
  borough: string;
  zipCode: string;
  coordinates: GeoPoint;
  timeStart: string; // HH:MM format
  timeEnd: string;   // HH:MM format
  daysOfWeek: number[]; // 0-6, Sunday=0
  suspendedUntil?: Timestamp | null;
}

export interface NotificationSettings {
  enabled: boolean;
  advanceTime: 30 | 60 | 120 | 180 | 360 | 720 | 1440; // minutes
  notifyToday: boolean;
  notifyTomorrow: boolean;
  notifyExceptionsOnly: boolean;
  notifyWeekends: boolean;
  quietHours?: QuietHours | null;
}

export interface QuietHours {
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  enabled: boolean;
}

export interface TrackedLocation {
  id: string;
  name: string;
  streetAddress: string;
  coordinates: GeoPoint;
  borough: string;
  zipCode: string;
  isDefault: boolean;
  addedAt: Timestamp;
}

export interface UserProfile extends FirestoreDocument {
  uid: string;
  email?: string | null;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  notificationSettings: NotificationSettings;
  trackedLocations: TrackedLocation[];
  deviceTokens: string[];
  timezone: string;
  isAnonymous: boolean;
}

export interface RuleSuspension extends FirestoreDocument {
  ruleIds: string[];
  reason: string;
  startDate: Timestamp;
  endDate: Timestamp;
  borough?: string | null;
  announced: Timestamp;
  isEmergency: boolean;
}

export interface NotificationLog extends FirestoreDocument {
  userId: string;
  ruleId: string;
  type: 'UPCOMING' | 'SUSPENSION' | 'CHANGE';
  sentAt: Timestamp;
  scheduledFor: Timestamp;
  title: string;
  body: string;
  success: boolean;
  error?: string | null;
}

// Collection paths
export const COLLECTIONS = {
  RULES: 'rules',
  USERS: 'users',
  SUSPENSIONS: 'suspensions',
  NOTIFICATION_LOGS: 'notifications/{uid}/logs'
} as const;

// Query interfaces
export interface RuleQuery {
  active?: boolean;
  date?: {
    start?: Timestamp;
    end?: Timestamp;
  };
  borough?: string;
  zipCode?: string;
  coordinates?: {
    center: GeoPoint;
    radius: number; // meters
  };
}

export interface NotificationQuery {
  userId: string;
  type?: NotificationLog['type'];
  dateRange?: {
    start: Timestamp;
    end: Timestamp;
  };
  success?: boolean;
}

// Validation schemas (for runtime validation)
export const VALIDATION_RULES = {
  ParkingRule: {
    timeFormat: /^([01]\d|2[0-3]):([0-5]\d)$/,
    validBoroughs: ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'],
    validTypes: ['NYC', 'OTHER'] as const,
    validDaysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  UserProfile: {
    maxTrackedLocations: 5,
    emailFormat: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    validAdvanceTimes: [30, 60, 120, 180, 360, 720, 1440] as const,
  },
  TrackedLocation: {
    maxNameLength: 50,
    nycBounds: {
      north: 40.9176,
      south: 40.4774,
      east: -73.7004,
      west: -74.2591,
    },
  },
} as const;

// Error types
export type ValidationError = {
  field: string;
  message: string;
  value?: unknown;
};

// Type guards
export function isParkingRule(data: unknown): data is ParkingRule {
  return (
    typeof data === 'object' &&
    data !== null &&
    'active' in data &&
    'type' in data &&
    ['NYC', 'OTHER'].includes((data as any).type)
  );
}

export function isUserProfile(data: unknown): data is UserProfile {
  return (
    typeof data === 'object' &&
    data !== null &&
    'uid' in data &&
    'notificationSettings' in data
  );
}