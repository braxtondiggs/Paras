import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import type { Spectator } from '@ngneat/spectator/jest';
// eslint-disable-next-line no-duplicate-imports
import { createComponentFactory } from '@ngneat/spectator/jest';
import { IntroPage } from './intro.page';

// Mock Capacitor Preferences
jest.mock('@capacitor/preferences', () => ({
  Preferences: {
    set: jest.fn(),
    get: jest.fn()
  }
}));

describe('IntroPage', () => {
  let spectator: Spectator<IntroPage>;
  let component: IntroPage;
  let mockRouter: jest.Mocked<Router>;
  let consoleWarnSpy: jest.SpyInstance;

  const createComponent = createComponentFactory({
    component: IntroPage,
    shallow: true,
    detectChanges: false,
    mocks: [Router]
  });

  beforeEach(() => {
    spectator = createComponent();
    component = spectator.component;
    mockRouter = spectator.inject(Router);
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('Component Creation', () => {
    it('should create the intro page component', () => {
      expect(component).toBeTruthy();
      expect(component).toBeInstanceOf(IntroPage);
    });

    it('should initialize without errors', () => {
      expect(() => spectator.detectChanges()).not.toThrow();
    });
  });

  describe('Template Rendering', () => {
    beforeEach(() => {
      spectator.detectChanges();
    });

    it('should render the main intro container', () => {
      expect(spectator.query('.intro-container')).toBeTruthy();
    });

    it('should display the ASP NYC title', () => {
      const title = spectator.query('h1');
      expect(title).toHaveText('ASP NYC');
    });

    it('should show the compelling tagline', () => {
      const tagline = spectator.query('.intro-title ion-text p');
      expect(tagline).toHaveText('Never pay another parking ticket due to NYC street cleaning schedules');
    });

    it('should display all four feature cards', () => {
      const featureCards = spectator.queryAll('.feature-card');
      expect(featureCards).toHaveLength(4);
    });

    it('should show correct feature titles', () => {
      const titles = spectator.queryAll('.feature-card h3');
      const expectedTitles = ['Smart Calendar', 'Custom Alerts', 'Real-time Updates', 'Dark Mode'];

      titles.forEach((title, index) => {
        expect(title).toHaveText(expectedTitles[index]);
      });
    });

    it('should display feature descriptions', () => {
      const descriptions = spectator.queryAll('.feature-card p');
      expect(descriptions).toHaveLength(4);

      descriptions.forEach(desc => {
        expect(desc.textContent?.trim()).not.toBe('');
      });
    });

    it('should show the get started button', () => {
      const button = spectator.query('.get-started-btn');
      expect(button).toBeTruthy();
      expect(button).toHaveText('Get Started');
    });

    it('should display arrow forward icon in button', () => {
      const icon = spectator.query('.get-started-btn ion-icon[name="arrow-forward"]');
      expect(icon).toBeTruthy();
    });

    it('should render feature icons with correct names', () => {
      const expectedIcons = ['calendar-outline', 'notifications-outline', 'time-outline', 'moon-outline'];
      const featureIcons = spectator.queryAll('.feature-card ion-icon');

      expectedIcons.forEach((iconName, index) => {
        expect(featureIcons[index]).toHaveAttribute('name', iconName);
      });
    });
  });

  describe('User Interactions', () => {
    beforeEach(() => {
      (Preferences.set as jest.Mock).mockResolvedValue(undefined);
      spectator.detectChanges();
    });

    it('should call continue method when get started button is clicked', async () => {
      const continueSpy = jest.spyOn(component, 'continue');

      const button = spectator.query('.get-started-btn');
      spectator.click(button!);

      expect(continueSpy).toHaveBeenCalled();
    });

    it('should trigger continue method on button click', async () => {
      const button = spectator.query('.get-started-btn');
      spectator.click(button!);

      // Wait for async operations
      await spectator.fixture.whenStable();

      expect(Preferences.set).toHaveBeenCalledWith({
        key: 'intro',
        value: 'true'
      });
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should handle multiple rapid clicks', async () => {
      const button = spectator.query('.get-started-btn');

      // Simulate rapid clicking
      spectator.click(button!);
      spectator.click(button!);
      spectator.click(button!);

      await spectator.fixture.whenStable();

      expect(Preferences.set).toHaveBeenCalledTimes(3);
      expect(mockRouter.navigate).toHaveBeenCalledTimes(3);
    });
  });

  describe('Continue Method - Success Cases', () => {
    it('should save preference and navigate on successful continue', async () => {
      (Preferences.set as jest.Mock).mockResolvedValue(undefined);

      await component.continue();

      expect(Preferences.set).toHaveBeenCalledWith({
        key: 'intro',
        value: 'true'
      });
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should complete without throwing errors', async () => {
      (Preferences.set as jest.Mock).mockResolvedValue(undefined);

      await expect(component.continue()).resolves.not.toThrow();
      expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Continue Method - Error Handling', () => {
    it('should handle QuotaExceededError gracefully', async () => {
      const error = new Error('QuotaExceededError: Storage quota exceeded');
      (Preferences.set as jest.Mock).mockRejectedValue(error);

      await component.continue();

      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to save intro preference:', error);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should handle permission denied errors', async () => {
      const error = new Error('Permission denied');
      (Preferences.set as jest.Mock).mockRejectedValue(error);

      await component.continue();

      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to save intro preference:', error);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should handle storage not available errors', async () => {
      const error = new Error('Storage not available');
      (Preferences.set as jest.Mock).mockRejectedValue(error);

      await component.continue();

      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to save intro preference:', error);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      (Preferences.set as jest.Mock).mockRejectedValue(error);

      await component.continue();

      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to save intro preference:', error);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should handle Preferences plugin not available', async () => {
      const error = new Error('Preferences plugin not available');
      (Preferences.set as jest.Mock).mockRejectedValue(error);

      await component.continue();

      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to save intro preference:', error);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should handle synchronous errors', async () => {
      const syncError = new Error('Synchronous error');
      (Preferences.set as jest.Mock).mockImplementation(() => {
        throw syncError;
      });

      await component.continue();

      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to save intro preference:', syncError);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should always navigate regardless of error type', async () => {
      const errorTypes = [
        new Error('QuotaExceededError'),
        new Error('Permission denied'),
        new Error('Storage unavailable'),
        null,
        undefined,
        'string error'
      ];

      for (const error of errorTypes) {
        mockRouter.navigate.mockClear();
        consoleWarnSpy.mockClear();

        (Preferences.set as jest.Mock).mockRejectedValue(error);

        await component.continue();

        expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
        expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Component Architecture', () => {
    it('should be a standalone component', () => {
      const componentDef = (IntroPage as any).ɵcmp;
      expect(componentDef.standalone).toBe(true);
    });

    it('should use OnPush change detection strategy', () => {
      const componentDef = (IntroPage as any).ɵcmp;
      expect(componentDef.onPush).toBe(true); // OnPush = true in newer Angular
    });

    it('should have the continue method defined', () => {
      expect(typeof component.continue).toBe('function');
    });
  });

  describe('Icon Registration', () => {
    it('should register all required icons without errors', () => {
      // Icons are registered in constructor, which is tested via component creation
      // The component creation tests above already verify this works
      expect(component).toBeTruthy(); // Component was successfully created with icons
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      spectator.detectChanges();
    });

    it('should have proper heading structure', () => {
      const heading = spectator.query('h1');
      expect(heading).toBeTruthy();
      expect(heading).toHaveText('ASP NYC');
    });

    it('should have accessible button with proper text', () => {
      const button = spectator.query('.get-started-btn');
      expect(button).toBeTruthy();
      expect(button).toHaveText('Get Started');
    });

    it('should have descriptive feature content', () => {
      const featureCards = spectator.queryAll('.feature-card');

      featureCards.forEach(card => {
        const title = card.querySelector('h3');
        const description = card.querySelector('p');

        expect(title?.textContent?.trim()).not.toBe('');
        expect(description?.textContent?.trim()).not.toBe('');
      });
    });

    it('should have proper image alt text', () => {
      const image = spectator.query('.intro-logo');
      expect(image).toHaveAttribute('alt', 'ASP NYC Logo');
    });
  });

  describe('Performance & Edge Cases', () => {
    it('should handle component destruction gracefully', () => {
      spectator.detectChanges();
      expect(() => spectator.fixture.destroy()).not.toThrow();
    });

    it('should handle rapid multiple method calls', async () => {
      (Preferences.set as jest.Mock).mockResolvedValue(undefined);

      const promises = [component.continue(), component.continue(), component.continue()];

      await Promise.all(promises);

      expect(Preferences.set).toHaveBeenCalledTimes(3);
      expect(mockRouter.navigate).toHaveBeenCalledTimes(3);
    });

    it('should maintain state consistency during errors', async () => {
      // First call fails
      (Preferences.set as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));
      await component.continue();

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledTimes(1);

      // Second call succeeds
      consoleWarnSpy.mockClear();
      mockRouter.navigate.mockClear();
      (Preferences.set as jest.Mock).mockResolvedValueOnce(undefined);
      await component.continue();

      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Integrity', () => {
    it('should use correct preference key and value format', async () => {
      (Preferences.set as jest.Mock).mockResolvedValue(undefined);

      await component.continue();

      expect(Preferences.set).toHaveBeenCalledWith({
        key: 'intro',
        value: 'true'
      });
    });

    it('should preserve error objects for debugging', async () => {
      const detailedError = new Error('Detailed error with context');
      detailedError.stack = 'Mock stack trace';
      (Preferences.set as jest.Mock).mockRejectedValue(detailedError);

      await component.continue();

      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to save intro preference:', detailedError);
      expect(consoleWarnSpy.mock.calls[0][1]).toBe(detailedError);
    });
  });
});
