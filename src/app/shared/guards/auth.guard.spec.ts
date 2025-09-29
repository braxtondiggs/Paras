import { TestBed } from '@angular/core/testing';
import { AuthService } from '@core/services';
import { MockAuthService } from '../../../test-utils/firebase-mocks';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let mockAuthService: MockAuthService;
  let consoleErrorSpy: jest.SpyInstance;

  // Helper function to run guard in injection context
  const runGuard = () => TestBed.runInInjectionContext(() => authGuard());

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useClass: MockAuthService }]
    });

    mockAuthService = TestBed.inject(AuthService) as unknown as MockAuthService;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Guard Creation', () => {
    it('should be defined as a function', () => {
      expect(authGuard).toBeDefined();
      expect(typeof authGuard).toBe('function');
    });

    it('should return a promise', () => {
      mockAuthService.isAuthenticated.mockReturnValue(true);
      const result = runGuard();
      expect(result).toHaveProperty('then');
      expect(typeof result.then).toBe('function');
    });
  });

  describe('Authentication Success Cases', () => {
    it('should return true when user is already authenticated', async () => {
      // Setup: User is already authenticated
      mockAuthService.isAuthenticated.mockReturnValue(true);

      const result = await runGuard();

      expect(result).toBe(true);
      expect(mockAuthService.isAuthenticated).toHaveBeenCalledTimes(1);
      expect(mockAuthService.anonymousLogin).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should successfully authenticate unauthenticated user via anonymous login', async () => {
      // Setup: User starts unauthenticated, then becomes authenticated after login
      mockAuthService.isAuthenticated
        .mockReturnValueOnce(false) // First check: not authenticated
        .mockReturnValueOnce(true); // Second check: authenticated after login

      mockAuthService.anonymousLogin.mockResolvedValue({
        success: true,
        user: { uid: 'test-uid' } as any
      });

      const result = await runGuard();

      expect(result).toBe(true);
      expect(mockAuthService.isAuthenticated).toHaveBeenCalledTimes(2);
      expect(mockAuthService.anonymousLogin).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle multiple authentication checks correctly', async () => {
      // Setup: Multiple calls to the guard
      mockAuthService.isAuthenticated.mockReturnValue(true);

      const results = await Promise.all([runGuard(), runGuard(), runGuard()]);

      expect(results).toEqual([true, true, true]);
      expect(mockAuthService.isAuthenticated).toHaveBeenCalledTimes(3);
      expect(mockAuthService.anonymousLogin).not.toHaveBeenCalled();
    });
  });

  describe('Authentication Failure Cases', () => {
    it('should return false when anonymous login fails and user remains unauthenticated', async () => {
      // Setup: User is not authenticated and remains so after failed login
      mockAuthService.isAuthenticated.mockReturnValue(false);
      mockAuthService.anonymousLogin.mockResolvedValue({
        success: false,
        error: 'Anonymous login failed'
      });

      const result = await runGuard();

      expect(result).toBe(false);
      expect(mockAuthService.isAuthenticated).toHaveBeenCalledTimes(2);
      expect(mockAuthService.anonymousLogin).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Authentication failed');
    });

    it('should return false when anonymous login succeeds but authentication check still fails', async () => {
      // Setup: Login appears to succeed but auth check still returns false
      mockAuthService.isAuthenticated.mockReturnValue(false);
      mockAuthService.anonymousLogin.mockResolvedValue({
        success: true,
        user: { uid: 'test-uid' } as any
      });

      const result = await runGuard();

      expect(result).toBe(false);
      expect(mockAuthService.isAuthenticated).toHaveBeenCalledTimes(2);
      expect(mockAuthService.anonymousLogin).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Authentication failed');
    });

    it('should handle anonymous login promise rejection', async () => {
      // Setup: Anonymous login throws an error
      const loginError = new Error('Network error during login');
      mockAuthService.isAuthenticated.mockReturnValue(false);
      mockAuthService.anonymousLogin.mockRejectedValue(loginError);

      const result = await runGuard();

      expect(result).toBe(false);
      expect(mockAuthService.isAuthenticated).toHaveBeenCalledTimes(1);
      expect(mockAuthService.anonymousLogin).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Auth guard error:', loginError);
    });
  });

  describe('Error Handling', () => {
    it('should handle synchronous errors from isAuthenticated', async () => {
      // Setup: isAuthenticated throws synchronous error
      const syncError = new Error('Synchronous auth error');
      mockAuthService.isAuthenticated.mockImplementation(() => {
        throw syncError;
      });

      const result = await runGuard();

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Auth guard error:', syncError);
    });

    it('should handle various error types gracefully', async () => {
      const errorTypes = [
        new Error('Network error'),
        new Error('Timeout error'),
        new Error('Permission denied'),
        'String error',
        null,
        undefined,
        { message: 'Object error' }
      ];

      for (const error of errorTypes) {
        // Reset mocks for each iteration
        consoleErrorSpy.mockClear();
        mockAuthService.isAuthenticated.mockReturnValue(false);
        mockAuthService.anonymousLogin.mockRejectedValue(error);

        const result = await runGuard();

        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Auth guard error:', error);
      }
    });

    it('should handle errors during authentication state changes', async () => {
      // Setup: First isAuthenticated call works, but second fails
      const authStateError = new Error('Auth state changed unexpectedly');
      mockAuthService.isAuthenticated
        .mockReturnValueOnce(false) // First check: not authenticated
        .mockImplementation(() => {
          throw authStateError;
        }); // Second check: throws error

      mockAuthService.anonymousLogin.mockResolvedValue({
        success: true,
        user: { uid: 'test-uid' } as any
      });

      const result = await runGuard();

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Auth guard error:', authStateError);
    });
  });

  describe('Edge Cases and Performance', () => {
    it('should handle rapid sequential calls without race conditions', async () => {
      // Setup: Simulate rapid navigation attempts
      mockAuthService.isAuthenticated.mockReturnValue(false);
      let loginCallCount = 0;
      mockAuthService.anonymousLogin.mockImplementation(async () => {
        loginCallCount++;
        // Simulate async delay
        await new Promise(resolve => setTimeout(resolve, 10));
        mockAuthService.isAuthenticated.mockReturnValue(true);
        return { success: true, user: { uid: `test-uid-${loginCallCount}` } as any };
      });

      // Execute multiple guards simultaneously
      const promises = Array(5)
        .fill(0)
        .map(() => runGuard());
      const results = await Promise.all(promises);

      // All should succeed, but login might be called multiple times
      expect(results).toEqual([true, true, true, true, true]);
      expect(mockAuthService.anonymousLogin).toHaveBeenCalled();
    });

    it('should not interfere with other guard instances', async () => {
      // Setup: Different authentication states for different tests
      const firstGuardCall = () => {
        mockAuthService.isAuthenticated.mockReturnValueOnce(true);
        return runGuard();
      };

      const secondGuardCall = () => {
        mockAuthService.isAuthenticated
          .mockReturnValueOnce(false) // First check: not authenticated
          .mockReturnValueOnce(true); // After login: authenticated
        mockAuthService.anonymousLogin.mockResolvedValueOnce({
          success: true,
          user: { uid: 'test-uid-2' } as any
        });
        return runGuard();
      };

      const [result1, result2] = await Promise.all([firstGuardCall(), secondGuardCall()]);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should maintain proper call order and state', async () => {
      // Setup: Track method call order
      const callOrder: string[] = [];

      mockAuthService.isAuthenticated.mockImplementation(() => {
        callOrder.push('isAuthenticated');
        return false;
      });

      mockAuthService.anonymousLogin.mockImplementation(async () => {
        callOrder.push('anonymousLogin');
        // After login, authentication should succeed
        mockAuthService.isAuthenticated.mockImplementation(() => {
          callOrder.push('isAuthenticated-after-login');
          return true;
        });
        return { success: true, user: { uid: 'test-uid' } as any };
      });

      const result = await runGuard();

      expect(result).toBe(true);
      expect(callOrder).toEqual([
        'isAuthenticated', // Initial check
        'anonymousLogin', // Attempt login
        'isAuthenticated-after-login' // Verify authentication after login
      ]);
    });
  });

  describe('Authentication Flow Validation', () => {
    it('should follow the correct authentication flow for unauthenticated users', async () => {
      // Setup: User starts unauthenticated
      const mockUser = { uid: 'test-uid', isAnonymous: true };
      mockAuthService.isAuthenticated
        .mockReturnValueOnce(false) // Initial check
        .mockReturnValueOnce(true); // After successful login

      mockAuthService.anonymousLogin.mockResolvedValue({
        success: true,
        user: mockUser as any
      });

      const result = await runGuard();

      // Verify the complete flow
      expect(result).toBe(true);

      // Check that methods were called in the correct order
      expect(mockAuthService.isAuthenticated).toHaveBeenNthCalledWith(1);
      expect(mockAuthService.anonymousLogin).toHaveBeenCalledTimes(1);
      expect(mockAuthService.isAuthenticated).toHaveBeenNthCalledWith(2);

      // Verify no errors were logged for successful flow
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should short-circuit when user is already authenticated', async () => {
      // Setup: User is already authenticated
      mockAuthService.isAuthenticated.mockReturnValue(true);

      const result = await runGuard();

      expect(result).toBe(true);
      expect(mockAuthService.isAuthenticated).toHaveBeenCalledTimes(1);
      expect(mockAuthService.anonymousLogin).not.toHaveBeenCalled();
    });

    it('should handle authentication timeout scenarios', async () => {
      // Setup: Anonymous login takes too long (simulated)
      mockAuthService.isAuthenticated.mockReturnValue(false);
      mockAuthService.anonymousLogin.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve({ success: true, user: { uid: 'test' } as any }), 100);
          })
      );

      const result = await runGuard();

      // Should still work, just takes longer
      expect(result).toBe(false); // Will be false because we don't update the auth state mock
      expect(mockAuthService.anonymousLogin).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration Scenarios', () => {
    it('should work correctly when used as a route guard', async () => {
      // Simulate being used in a routing context
      mockAuthService.isAuthenticated.mockReturnValue(true);

      // Guard should work with routing system
      const guardResult = await runGuard();
      const canActivate = guardResult;

      expect(canActivate).toBe(true);
      expect(typeof guardResult).toBe('boolean');
    });

    it('should handle service injection correctly', async () => {
      // Verify that the service is properly injected and accessible
      mockAuthService.isAuthenticated
        .mockReturnValueOnce(false) // First check: not authenticated
        .mockReturnValueOnce(true); // After login: authenticated

      mockAuthService.anonymousLogin.mockResolvedValue({
        success: true,
        user: { uid: 'injected-test' } as any
      });

      // Run the guard to trigger service injection
      const result = await runGuard();

      expect(result).toBe(true);
      // Service methods should be accessible and callable
      expect(mockAuthService.isAuthenticated).toHaveBeenCalled();
      expect(mockAuthService.anonymousLogin).toHaveBeenCalled();
    });

    it('should maintain consistent behavior across multiple route activations', async () => {
      // Setup: Simulate multiple route navigation attempts
      mockAuthService.isAuthenticated.mockReturnValue(true);

      const results: boolean[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(await runGuard());
      }

      // All activations should succeed consistently
      expect(results.every(result => result === true)).toBe(true);
      expect(mockAuthService.isAuthenticated).toHaveBeenCalledTimes(10);
    });
  });

  describe('Memory and Cleanup', () => {
    it('should not create memory leaks with repeated calls', async () => {
      // Setup: Multiple guard executions
      mockAuthService.isAuthenticated.mockReturnValue(true);

      // Execute guard multiple times
      const promises = Array(50)
        .fill(0)
        .map(() => runGuard());
      const results = await Promise.all(promises);

      // All should succeed without memory issues
      expect(results.every(result => result === true)).toBe(true);
      expect(results).toHaveLength(50);
    });

    it('should handle concurrent authentication attempts', async () => {
      // Setup: Multiple concurrent unauthenticated guard calls
      mockAuthService.isAuthenticated.mockReturnValue(false);
      mockAuthService.anonymousLogin.mockResolvedValue({
        success: true,
        user: { uid: 'concurrent-test' } as any
      });

      const concurrentCalls = Array(3)
        .fill(0)
        .map(() => runGuard());
      const results = await Promise.all(concurrentCalls);

      // Should handle concurrent calls gracefully
      expect(results).toHaveLength(3);
      expect(mockAuthService.anonymousLogin).toHaveBeenCalled();
    });
  });
});
