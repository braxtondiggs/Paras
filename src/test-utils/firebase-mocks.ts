import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

// Mock Firebase Auth
@Injectable({ providedIn: 'root' })
export class MockAuthService {
  userSignal = jest.fn().mockReturnValue(null);
  isAuthenticated = jest.fn().mockReturnValue(false);
  userId = jest.fn().mockReturnValue(null);
  user$ = of(null);

  anonymousLogin = jest.fn().mockResolvedValue(undefined);
  getUser = jest.fn().mockResolvedValue(null);
  uid = jest.fn().mockResolvedValue(null);
  signOut = jest.fn().mockResolvedValue(undefined);
  isValidSession = jest.fn().mockResolvedValue(false);
}

// Mock Firebase Firestore Service
@Injectable({ providedIn: 'root' })
export class MockFeedService {
  get = jest.fn().mockReturnValue(of([]));
  getLast = jest.fn().mockReturnValue(
    of({
      id: 'test',
      date: { toDate: () => new Date() },
      active: false,
      metered: false,
      type: 'NYC',
      reason: 'Test reason'
    })
  );
  offlineStatus = jest.fn().mockReturnValue(false);
  retryConnection = jest.fn().mockResolvedValue(undefined);
}

// Mock Firebase Analytics
export const mockAnalytics = {
  logEvent: jest.fn(),
  setUserId: jest.fn(),
  setUserProperties: jest.fn()
};

// Mock Firebase Performance
export const mockPerformance = {
  trace: jest.fn().mockReturnValue({
    start: jest.fn(),
    stop: jest.fn()
  })
};

// Firebase module mocks
export const firebaseMocks = {
  '@angular/fire/analytics': {
    Analytics: jest.fn().mockReturnValue(mockAnalytics),
    setUserId: jest.fn(),
    setUserProperties: jest.fn(),
    logEvent: jest.fn()
  },
  '@angular/fire/auth': {
    Auth: jest.fn(),
    authState: jest.fn().mockReturnValue(of(null)),
    signInAnonymously: jest.fn().mockResolvedValue({ user: { uid: 'test-uid' } })
  },
  '@angular/fire/firestore': {
    Firestore: jest.fn(),
    collection: jest.fn(),
    collectionData: jest.fn().mockReturnValue(of([])),
    doc: jest.fn(),
    setDoc: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    serverTimestamp: jest.fn().mockReturnValue({ seconds: 0, nanoseconds: 0 })
  },
  '@angular/fire/performance': {
    Performance: jest.fn().mockReturnValue(mockPerformance),
    traceUntilFirst: jest.fn().mockReturnValue((source: Observable<any>) => source)
  }
};
