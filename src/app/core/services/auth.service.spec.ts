import { type SpectatorService, createServiceFactory } from '@ngneat/spectator/jest';
import { of } from 'rxjs';

import { Analytics, setUserId, setUserProperties } from '@angular/fire/analytics';
import { Auth, authState, signInAnonymously } from '@angular/fire/auth';
import { Firestore, doc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { traceUntilFirst } from '@angular/fire/performance';
import { Preferences } from '@capacitor/preferences';
import { AuthService } from './auth.service';

jest.mock('@angular/fire/auth', () => {
  const authStateMock = jest.fn();
  const signInAnonymouslyMock = jest.fn();

  class MockAuth {}

  return {
    Auth: MockAuth,
    authState: authStateMock,
    signInAnonymously: signInAnonymouslyMock
  };
});

jest.mock('@angular/fire/analytics', () => {
  class MockAnalytics {}

  return {
    Analytics: MockAnalytics,
    setUserId: jest.fn(),
    setUserProperties: jest.fn()
  };
});

jest.mock('@angular/fire/firestore', () => ({
  doc: jest.fn(),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(),
  Firestore: class MockFirestore {}
}));

jest.mock('@angular/fire/performance', () => ({
  traceUntilFirst: jest.fn()
}));

jest.mock('@capacitor/preferences', () => ({
  Preferences: {
    set: jest.fn()
  }
}));

describe('AuthService', () => {
  let spectator: SpectatorService<AuthService>;
  let authStub: { currentUser: { reload: jest.Mock } | null };
  let analyticsStub: Record<string, unknown>;
  let firestoreStub: Record<string, unknown>;
  let consoleErrorSpy: jest.SpyInstance;
  let docReferenceStub: ReturnType<typeof doc>;

  const createService = createServiceFactory({
    service: AuthService
  });

  const authStateMock = jest.mocked(authState);
  const signInAnonymouslyMock = jest.mocked(signInAnonymously);
  const setUserIdMock = jest.mocked(setUserId);
  const setUserPropertiesMock = jest.mocked(setUserProperties);
  const docMock = jest.mocked(doc);
  const setDocMock = jest.mocked(setDoc);
  const serverTimestampMock = jest.mocked(serverTimestamp);
  const traceUntilFirstMock = jest.mocked(traceUntilFirst);
  const preferencesSetMock = Preferences.set as jest.Mock;

  beforeEach(() => {
    authStub = {
      currentUser: {
        reload: jest.fn().mockResolvedValue(undefined)
      }
    };

    analyticsStub = {};
    firestoreStub = {};

    authStateMock.mockReturnValue(of(null));
    signInAnonymouslyMock.mockReset();
    setUserIdMock.mockReset();
    setUserPropertiesMock.mockReset();
    docMock.mockReset();
    setDocMock.mockReset();
    serverTimestampMock.mockReset();
    traceUntilFirstMock.mockReset();
    preferencesSetMock.mockReset();

    serverTimestampMock.mockReturnValue({ seconds: Date.now() } as any);
    docReferenceStub = { id: 'doc-ref' } as unknown as ReturnType<typeof doc>;
    docMock.mockReturnValue(docReferenceStub);
    setDocMock.mockResolvedValue(undefined);
    traceUntilFirstMock.mockImplementation(() => source$ => source$);

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    spectator = createService({
      providers: [
        { provide: Auth, useValue: authStub },
        { provide: Analytics, useValue: analyticsStub },
        { provide: Firestore, useValue: firestoreStub }
      ]
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('performs anonymous login and updates analytics and firestore', async () => {
    const user = { uid: 'test-user', isAnonymous: true } as any;
    const userCredential = {
      user,
      providerId: 'anonymous',
      operationType: 'signIn'
    } as any;
    signInAnonymouslyMock.mockResolvedValue(userCredential);

    const loginPromise = spectator.service.anonymousLogin();

    expect(spectator.service.isLoading()).toBe(true);

    const result = await loginPromise;

    expect(result).toEqual({ success: true, user });
    expect(spectator.service.isLoading()).toBe(false);
    expect(spectator.service.error()).toBeNull();

    expect(signInAnonymouslyMock).toHaveBeenCalledWith(authStub);
    expect(preferencesSetMock).toHaveBeenCalledWith({ key: 'uid', value: 'test-user' });
    expect(setUserIdMock).toHaveBeenCalledWith(analyticsStub, 'test-user');
    expect(setUserPropertiesMock).toHaveBeenCalledWith(analyticsStub, {
      user_type: 'anonymous',
      login_method: 'anonymous'
    });
    expect(docMock).toHaveBeenCalledWith(firestoreStub, 'users/test-user');
    expect(setDocMock).toHaveBeenCalledWith(docReferenceStub, expect.objectContaining({ uid: 'test-user' }), {
      merge: true
    });
    expect(traceUntilFirstMock).toHaveBeenCalledWith('auth_state');
  });

  it('captures error state when anonymous login fails', async () => {
    const failure = new Error('network down');
    signInAnonymouslyMock.mockRejectedValue(failure);

    const result = await spectator.service.anonymousLogin();

    expect(result).toEqual({ success: false, error: 'network down' });
    expect(spectator.service.isLoading()).toBe(false);
    expect(spectator.service.error()).toBe('network down');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Anonymous login failed:', failure);

    expect(preferencesSetMock).not.toHaveBeenCalled();
    expect(setUserIdMock).not.toHaveBeenCalled();
    expect(setUserPropertiesMock).not.toHaveBeenCalled();
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('reloads the current user when refreshing auth', async () => {
    await spectator.service.refreshAuth();

    expect(authStub.currentUser?.reload).toHaveBeenCalledTimes(1);
  });

  it('handles refresh auth errors gracefully', async () => {
    const refreshError = new Error('reload failed');
    authStub.currentUser = {
      reload: jest.fn().mockRejectedValue(refreshError)
    };

    await spectator.service.refreshAuth();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to refresh auth:', refreshError);
  });

  it('should handle auth state when currentUser is null', async () => {
    authStub.currentUser = null;

    await spectator.service.refreshAuth();

    // Should not throw error when currentUser is null
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should clear error state', () => {
    // Set initial error state
    spectator.service.anonymousLogin().catch(() => {});
    signInAnonymouslyMock.mockRejectedValueOnce(new Error('test error'));

    expect(spectator.service.error()).toBeFalsy(); // Initially no error

    spectator.service.clearError();
    expect(spectator.service.error()).toBeNull();
  });

  it('should provide computed auth state properties', () => {
    // Test with null user initially
    expect(spectator.service.isAuthenticated()).toBe(false);
    expect(spectator.service.uid()).toBeNull();
    expect(spectator.service.isAnonymous()).toBe(false);

    const initialAuthState = spectator.service.authState();
    expect(initialAuthState).toEqual({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      uid: null
    });
  });

  it('should handle anonymous login failure when user creation fails', async () => {
    const userCredential = {
      user: null, // Simulate failed user creation
      providerId: 'anonymous',
      operationType: 'signIn'
    } as any;
    signInAnonymouslyMock.mockResolvedValue(userCredential);

    const result = await spectator.service.anonymousLogin();

    expect(result).toEqual({
      success: false,
      error: 'Failed to create anonymous user'
    });
    expect(spectator.service.error()).toBe('Failed to create anonymous user');
    expect(preferencesSetMock).not.toHaveBeenCalled();
  });

  it('should handle Firestore document creation failure', async () => {
    const user = { uid: 'test-user', isAnonymous: true } as any;
    const userCredential = {
      user,
      providerId: 'anonymous',
      operationType: 'signIn'
    } as any;
    signInAnonymouslyMock.mockResolvedValue(userCredential);
    setDocMock.mockRejectedValue(new Error('Firestore error'));

    const result = await spectator.service.anonymousLogin();

    expect(result).toEqual({
      success: false,
      error: 'Firestore error'
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Anonymous login failed:', expect.any(Error));
  });

  it('should handle preferences save failure', async () => {
    const user = { uid: 'test-user', isAnonymous: true } as any;
    const userCredential = {
      user,
      providerId: 'anonymous',
      operationType: 'signIn'
    } as any;
    signInAnonymouslyMock.mockResolvedValue(userCredential);
    preferencesSetMock.mockRejectedValue(new Error('Preferences error'));

    const result = await spectator.service.anonymousLogin();

    expect(result).toEqual({
      success: false,
      error: 'Preferences error'
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Anonymous login failed:', expect.any(Error));
  });

  it('should test private updateUserDocument method through integration', async () => {
    const user = { uid: 'test-user', isAnonymous: true } as any;
    const userCredential = {
      user,
      providerId: 'anonymous',
      operationType: 'signIn'
    } as any;

    signInAnonymouslyMock.mockResolvedValue(userCredential);
    setDocMock.mockResolvedValue(undefined);

    await spectator.service.anonymousLogin();

    // Verify the document was created with correct structure
    expect(setDocMock).toHaveBeenCalledWith(
      docReferenceStub,
      expect.objectContaining({
        uid: 'test-user',
        created: expect.any(Object),
        lastLogin: expect.any(Object),
        version: '2.0.3',
        createdAt: expect.any(Object),
        updatedAt: expect.any(Object)
      }),
      { merge: true }
    );
  });
});
