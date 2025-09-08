import type { FieldValue, Timestamp } from '@angular/fire/firestore';

export interface FirestoreDocument {
  id: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Feed extends FirestoreDocument {
  active: boolean;
  created: Timestamp;
  date: Timestamp;
  metered: boolean;
  reason: string;
  text: string;
  type: 'NYC' | 'OTHER';
}

export interface Setting extends FirestoreDocument {
  exceptionOnly?: boolean;
  nextDay?: NotificationTime;
  nextDayCustom?: string;
  today?: NotificationTime;
  todayCustom?: string;
  token?: string;
  type?: 'NYC' | 'OTHER';
  weekend?: boolean;
  darkMode?: boolean;
  updateAt?: Timestamp;
}

export interface User extends FirestoreDocument {
  uid: string;
  created: Timestamp;
  lastLogin: Timestamp;
  version: string;
  email?: string;
  displayName?: string;
}

export interface UserCreateData extends Omit<User, 'id' | 'created' | 'lastLogin' | 'createdAt' | 'updatedAt'> {
  created: Timestamp | FieldValue;
  lastLogin: Timestamp | FieldValue;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

export interface NotificationConfig extends FirestoreDocument {
  userId: string;
  token: string;
  exceptionOnly: boolean;
  today: NotificationTime;
  todayCustom?: string;
  nextDay: NotificationTime;
  nextDayCustom?: string;
  type: 'NYC' | 'OTHER';
  active: boolean;
}

export type NotificationTime = 'none' | 'custom' | '7:00' | '8:00' | '9:00' | '10:00';

export type FirestoreCollection = 'feed' | 'users' | 'notifications' | 'settings';

export interface QueryResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
}
