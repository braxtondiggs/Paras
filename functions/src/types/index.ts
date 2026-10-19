// User notification preferences interface
export interface Notification {
  exceptionOnly: boolean;
  nextDay: NotificationType;
  nextDayCustom: string;
  today: NotificationType;
  todayCustom: string;
  token: string;
  type: string;
}

// Parking rule feed interface
export interface Feed {
  active: boolean;
  created: Date;
  date: string;
  id: string;
  metered: boolean;
  reason: string;
  text: string;
  type: string;
}

// NYC ASP API response status enum
export enum Status {
  Suspended = 'SUSPENDED',
  Active = 'IN EFFECT'
}

// NYC ASP API response interfaces
export interface ASPItem {
  type: string;
  exceptionName?: string;
  details: string;
  status: Status;
}

export interface ASPDay {
  today_id: string;
  items: ASPItem[];
}

export interface IASPResponse {
  days: ASPDay[];
}

// Notification type definitions
export type NotificationAction = 'today' | 'nextDay';
// Mirrors NotificationTime in src/app/core/types/firestore.types.ts:60
export type NotificationHour = '7:00' | '8:00' | '9:00' | '10:00';
export type NotificationType = 'none' | 'custom' | NotificationHour;
// Recipients of one send: a fixed hour, custom times, or every fixed hour (the interim nextDay rule, #182)
export type NotificationMatch = 'custom' | NotificationHour | 'any-hour';

// Error types
export interface ASPError extends Error {
  code?: string;
  statusCode?: number;
}

// Date range interface for batch operations
export interface DateRange {
  start: string;
  end: string;
}

// Firebase Cloud Messaging types
export interface NotificationPayload {
  title: string;
  body: string;
}

export interface NotificationMessage {
  notification: NotificationPayload;
  token: string;
}