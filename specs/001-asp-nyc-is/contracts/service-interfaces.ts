/**
 * Service Interface Contracts for NYC ASP Tracking System
 * Defines service layer contracts for Angular services
 */

import { Observable } from 'rxjs';
import {
  ParkingRule,
  UserProfile,
  RuleSuspension,
  NotificationLog,
  TrackedLocation,
  NotificationSettings,
  RuleQuery,
  NotificationQuery
} from './firestore-schema';

// Feed Service - Main data service for parking rules
export interface IFeedService {
  // Real-time rule subscriptions
  getActiveRules(query?: RuleQuery): Observable<ParkingRule[]>;
  getRulesForDate(date: Date): Observable<ParkingRule[]>;
  getRulesForLocation(location: TrackedLocation): Observable<ParkingRule[]>;

  // Rule management
  subscribeToRuleChanges(): Observable<ParkingRule[]>;
  getHistoricalRules(startDate: Date, endDate: Date): Observable<ParkingRule[]>;

  // Suspension management
  getActiveSuspensions(): Observable<RuleSuspension[]>;
  getSuspensionsForRules(ruleIds: string[]): Observable<RuleSuspension[]>;

  // Cache management
  refreshCache(): Promise<void>;
  getCacheStatus(): Observable<{ lastUpdated: Date; isStale: boolean }>;
}

// User Service - User profile and preferences management
export interface IUserService {
  // Profile management
  getCurrentUser(): Observable<UserProfile | null>;
  updateProfile(updates: Partial<UserProfile>): Promise<void>;
  deleteProfile(): Promise<void>;

  // Location management
  addTrackedLocation(location: Omit<TrackedLocation, 'id' | 'addedAt'>): Promise<void>;
  updateTrackedLocation(locationId: string, updates: Partial<TrackedLocation>): Promise<void>;
  removeTrackedLocation(locationId: string): Promise<void>;
  setDefaultLocation(locationId: string): Promise<void>;

  // Notification preferences
  updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<void>;
  testNotificationSettings(): Promise<boolean>;
}

// Notification Service - Push notification management
export interface INotificationService {
  // Permission management
  requestPermission(): Promise<boolean>;
  getPermissionStatus(): Observable<'granted' | 'denied' | 'default'>;

  // Token management
  getDeviceToken(): Promise<string | null>;
  updateDeviceToken(token: string): Promise<void>;

  // Notification scheduling
  scheduleRuleNotifications(rules: ParkingRule[], userSettings: NotificationSettings): Promise<void>;
  cancelScheduledNotifications(ruleIds: string[]): Promise<void>;

  // Local notifications (fallback)
  showLocalNotification(title: string, body: string, data?: any): Promise<void>;

  // Notification history
  getNotificationLogs(query?: NotificationQuery): Observable<NotificationLog[]>;
  markNotificationAsRead(notificationId: string): Promise<void>;
}

// Location Service - Geographic functionality
export interface ILocationService {
  // Address validation
  validateNYCAddress(address: string): Promise<{ isValid: boolean; coordinates?: { lat: number; lng: number } }>;

  // Geocoding
  getCoordinatesFromAddress(address: string): Promise<{ lat: number; lng: number } | null>;
  getAddressFromCoordinates(lat: number, lng: number): Promise<string | null>;

  // Borough detection
  getBoroughFromCoordinates(lat: number, lng: number): Promise<string | null>;
  getZipCodeFromCoordinates(lat: number, lng: number): Promise<string | null>;

  // Distance calculations
  calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number;
  findNearbyRules(location: { lat: number; lng: number }, radiusMeters: number): Observable<ParkingRule[]>;
}

// Analytics Service - Usage tracking and insights
export interface IAnalyticsService {
  // Event tracking
  trackAppOpen(): void;
  trackRuleView(ruleId: string): void;
  trackNotificationReceived(notificationId: string): void;
  trackLocationAdded(borough: string): void;
  trackSettingsChanged(settingType: string): void;

  // Performance tracking
  trackLoadTime(screenName: string, loadTimeMs: number): void;
  trackError(error: Error, context: string): void;

  // User behavior insights
  getUserEngagementMetrics(): Observable<{
    dailyActiveUsers: number;
    averageSessionDuration: number;
    notificationOpenRate: number;
  }>;
}

// Sync Service - Offline/online synchronization
export interface ISyncService {
  // Sync status
  getSyncStatus(): Observable<'online' | 'offline' | 'syncing'>;
  getLastSyncTime(): Observable<Date | null>;

  // Manual sync
  forcSync(): Promise<void>;
  syncUserData(): Promise<void>;

  // Conflict resolution
  resolveConflicts(): Promise<void>;
  getConflictCount(): Observable<number>;

  // Offline queue
  getQueuedOperations(): Observable<any[]>;
  clearQueue(): Promise<void>;
}

// Error handling types
export interface ServiceError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

export type ServiceResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: ServiceError;
};

// Service configuration
export interface ServiceConfig {
  firebase: {
    apiKey: string;
    projectId: string;
    messagingSenderId: string;
  };
  notification: {
    vapidKey: string;
    defaultIcon: string;
  };
  location: {
    nycBounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
  };
  cache: {
    maxAge: number; // milliseconds
    maxSize: number; // MB
  };
}

// Service factory type
export type ServiceFactory<T> = (config: ServiceConfig) => T;