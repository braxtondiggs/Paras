import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { introGuard } from './intro.guard';

// Mock Capacitor Preferences
jest.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: jest.fn()
  }
}));

describe('introGuard', () => {
  let mockRouter: jest.Mocked<Router>;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    mockRouter = {
      navigate: jest.fn()
    } as any;

    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: mockRouter }]
    });

    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('Successful Navigation Cases', () => {
    it('should return true when intro preference is set to "true"', async () => {
      (Preferences.get as jest.Mock).mockResolvedValue({ value: 'true' });

      const result = await TestBed.runInInjectionContext(() => introGuard());

      expect(result).toBe(true);
      expect(Preferences.get).toHaveBeenCalledWith({ key: 'intro' });
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle preference value as string "true" correctly', async () => {
      (Preferences.get as jest.Mock).mockResolvedValue({ value: 'true' });

      const result = await TestBed.runInInjectionContext(() => introGuard());

      expect(result).toBe(true);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('Redirect to Intro Cases', () => {
    it('should redirect to intro page when preference is null', async () => {
      (Preferences.get as jest.Mock).mockResolvedValue({ value: null });

      const result = await TestBed.runInInjectionContext(() => introGuard());

      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should redirect to intro page when preference is undefined', async () => {
      (Preferences.get as jest.Mock).mockResolvedValue({ value: undefined });

      const result = await TestBed.runInInjectionContext(() => introGuard());

      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should redirect to intro page when preference is empty string', async () => {
      (Preferences.get as jest.Mock).mockResolvedValue({ value: '' });

      const result = await TestBed.runInInjectionContext(() => introGuard());

      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should redirect to intro page when preference is "false"', async () => {
      (Preferences.get as jest.Mock).mockResolvedValue({ value: 'false' });

      const result = await TestBed.runInInjectionContext(() => introGuard());

      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should redirect to intro page when preference has unexpected value', async () => {
      (Preferences.get as jest.Mock).mockResolvedValue({ value: 'some-other-value' });

      const result = await TestBed.runInInjectionContext(() => introGuard());

      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should redirect to intro page when response has no value property', async () => {
      (Preferences.get as jest.Mock).mockResolvedValue({});

      const result = await TestBed.runInInjectionContext(() => introGuard());

      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling Cases', () => {
    it('should handle QuotaExceededError gracefully', async () => {
      const error = new Error('QuotaExceededError: Storage quota exceeded');
      (Preferences.get as jest.Mock).mockRejectedValue(error);

      const result = await TestBed.runInInjectionContext(() => introGuard());

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to check intro preference:', error);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
    });

    it('should handle permission denied errors', async () => {
      const error = new Error('Permission denied');
      (Preferences.get as jest.Mock).mockRejectedValue(error);

      const result = await TestBed.runInInjectionContext(() => introGuard());

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to check intro preference:', error);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
    });

    it('should handle storage not available errors', async () => {
      const error = new Error('Storage not available');
      (Preferences.get as jest.Mock).mockRejectedValue(error);

      const result = await TestBed.runInInjectionContext(() => introGuard());

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to check intro preference:', error);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      (Preferences.get as jest.Mock).mockRejectedValue(error);

      const result = await TestBed.runInInjectionContext(() => introGuard());

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to check intro preference:', error);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
    });

    it('should handle Preferences plugin not available', async () => {
      const error = new Error('Preferences plugin not available');
      (Preferences.get as jest.Mock).mockRejectedValue(error);

      const result = await TestBed.runInInjectionContext(() => introGuard());

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to check intro preference:', error);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
    });

    it('should handle synchronous errors', async () => {
      const syncError = new Error('Synchronous error');
      (Preferences.get as jest.Mock).mockImplementation(() => {
        throw syncError;
      });

      const result = await TestBed.runInInjectionContext(() => introGuard());

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to check intro preference:', syncError);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
    });

    it('should handle various error types gracefully', async () => {
      const errorTypes = [new Error('Generic error'), null, undefined, 'string error', { message: 'object error' }, 42];

      for (const error of errorTypes) {
        mockRouter.navigate.mockClear();
        consoleWarnSpy.mockClear();

        (Preferences.get as jest.Mock).mockRejectedValue(error);

        const result = await TestBed.runInInjectionContext(() => introGuard());

        expect(result).toBe(false);
        expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
        expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
        expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to check intro preference:', error);
      }
    });
  });

  describe('Data Integrity', () => {
    it('should use correct preference key format', async () => {
      (Preferences.get as jest.Mock).mockResolvedValue({ value: 'true' });

      await TestBed.runInInjectionContext(() => introGuard());

      expect(Preferences.get).toHaveBeenCalledWith({ key: 'intro' });
    });

    it('should preserve error objects for debugging', async () => {
      const detailedError = new Error('Detailed error with context');
      detailedError.stack = 'Mock stack trace';
      (Preferences.get as jest.Mock).mockRejectedValue(detailedError);

      await TestBed.runInInjectionContext(() => introGuard());

      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to check intro preference:', detailedError);
      expect(consoleWarnSpy.mock.calls[0][1]).toBe(detailedError);
    });

    it('should handle malformed preference responses', async () => {
      const malformedResponses = [null, undefined, 'string instead of object', 42, [], { wrongProperty: 'value' }];

      for (const response of malformedResponses) {
        mockRouter.navigate.mockClear();

        (Preferences.get as jest.Mock).mockResolvedValue(response);

        const result = await TestBed.runInInjectionContext(() => introGuard());

        expect(result).toBe(false);
        expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
      }
    });
  });

  describe('Performance & Edge Cases', () => {
    it('should handle multiple concurrent calls', async () => {
      (Preferences.get as jest.Mock).mockResolvedValue({ value: 'true' });

      const promises = [
        TestBed.runInInjectionContext(() => introGuard()),
        TestBed.runInInjectionContext(() => introGuard()),
        TestBed.runInInjectionContext(() => introGuard())
      ];

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result).toBe(true);
      });
      expect(Preferences.get).toHaveBeenCalledTimes(3);
    });

    it('should handle rapid sequential calls with different outcomes', async () => {
      // First call succeeds
      (Preferences.get as jest.Mock).mockResolvedValueOnce({ value: 'true' });
      const result1 = await TestBed.runInInjectionContext(() => introGuard());
      expect(result1).toBe(true);

      // Second call fails
      (Preferences.get as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));
      const result2 = await TestBed.runInInjectionContext(() => introGuard());
      expect(result2).toBe(false);

      // Third call redirects
      (Preferences.get as jest.Mock).mockResolvedValueOnce({ value: 'false' });
      const result3 = await TestBed.runInInjectionContext(() => introGuard());
      expect(result3).toBe(false);
    });

    it('should maintain state consistency during errors', async () => {
      const error = new Error('Storage error');

      // First call with error
      (Preferences.get as jest.Mock).mockRejectedValueOnce(error);
      const result1 = await TestBed.runInInjectionContext(() => introGuard());

      expect(result1).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to check intro preference:', error);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);

      // Clear mocks for second call
      consoleWarnSpy.mockClear();
      mockRouter.navigate.mockClear();

      // Second call succeeds
      (Preferences.get as jest.Mock).mockResolvedValueOnce({ value: 'true' });
      const result2 = await TestBed.runInInjectionContext(() => introGuard());

      expect(result2).toBe(true);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should handle promise rejection with timeout scenarios', async () => {
      const timeoutError = new Error('Request timeout');
      (Preferences.get as jest.Mock).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(timeoutError), 100))
      );

      const result = await TestBed.runInInjectionContext(() => introGuard());

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to check intro preference:', timeoutError);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
    });
  });

  describe('Boolean Logic Edge Cases', () => {
    it('should strictly check for string "true" value', async () => {
      const falsyValues = [
        { value: true }, // boolean true instead of string
        { value: 1 }, // truthy number
        { value: 'TRUE' }, // uppercase
        { value: 'True' }, // capitalized
        { value: 'yes' }, // different truthy string
        { value: 'on' } // different truthy string
      ];

      for (const responseValue of falsyValues) {
        mockRouter.navigate.mockClear();

        (Preferences.get as jest.Mock).mockResolvedValue(responseValue);

        const result = await TestBed.runInInjectionContext(() => introGuard());

        expect(result).toBe(false);
        expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
      }
    });

    it('should handle whitespace in preference values', async () => {
      const whitespaceValues = [
        { value: ' true' }, // leading space
        { value: 'true ' }, // trailing space
        { value: ' true ' }, // both spaces
        { value: '\ttrue' }, // tab
        { value: 'true\n' } // newline
      ];

      for (const responseValue of whitespaceValues) {
        mockRouter.navigate.mockClear();

        (Preferences.get as jest.Mock).mockResolvedValue(responseValue);

        const result = await TestBed.runInInjectionContext(() => introGuard());

        expect(result).toBe(false);
        expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
      }
    });
  });

  describe('Router Navigation', () => {
    it('should navigate to correct intro route', async () => {
      (Preferences.get as jest.Mock).mockResolvedValue({ value: 'false' });

      await TestBed.runInInjectionContext(() => introGuard());

      expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
      expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
    });

    it('should not navigate when preference check succeeds', async () => {
      (Preferences.get as jest.Mock).mockResolvedValue({ value: 'true' });

      await TestBed.runInInjectionContext(() => introGuard());

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should navigate on all error scenarios', async () => {
      const errorScenarios = [new Error('Storage error'), new Error('Permission denied'), new Error('Network error')];

      for (const error of errorScenarios) {
        mockRouter.navigate.mockClear();

        (Preferences.get as jest.Mock).mockRejectedValue(error);

        await TestBed.runInInjectionContext(() => introGuard());

        expect(mockRouter.navigate).toHaveBeenCalledWith(['intro']);
        expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
      }
    });
  });
});
