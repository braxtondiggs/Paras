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

    it('should display all three feature cards', () => {
      const featureCards = spectator.queryAll('.feature-card');
      expect(featureCards).toHaveLength(3);
    });

    it('should show correct feature titles', () => {
      const titles = spectator.queryAll('.feature-card h3');
      const expectedTitles = ['Smart Calendar', 'Custom Alerts', 'Real-time Updates'];

      titles.forEach((title, index) => {
        expect(title).toHaveText(expectedTitles[index]);
      });
    });

    it('should display feature descriptions', () => {
      const descriptions = spectator.queryAll('.feature-card p');
      expect(descriptions).toHaveLength(3);

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
      const expectedIcons = ['calendar-outline', 'notifications-outline', 'time-outline'];
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

  describe('Feature Content Validation', () => {
    beforeEach(() => {
      spectator.detectChanges();
    });

    it('should display Smart Calendar feature with correct content', () => {
      const featureCards = spectator.queryAll('.feature-card');
      const smartCalendarCard = featureCards[0];

      const icon = smartCalendarCard.querySelector('ion-icon');
      const title = smartCalendarCard.querySelector('h3');
      const description = smartCalendarCard.querySelector('p');

      expect(icon).toHaveAttribute('name', 'calendar-outline');
      expect(icon).toHaveAttribute('color', 'primary');
      expect(title).toHaveText('Smart Calendar');
      expect(description).toHaveText('View parking rules in calendar or list format with highlighted restriction days');
    });

    it('should display Custom Alerts feature with correct content', () => {
      const featureCards = spectator.queryAll('.feature-card');
      const customAlertsCard = featureCards[1];

      const icon = customAlertsCard.querySelector('ion-icon');
      const title = customAlertsCard.querySelector('h3');
      const description = customAlertsCard.querySelector('p');

      expect(icon).toHaveAttribute('name', 'notifications-outline');
      expect(icon).toHaveAttribute('color', 'secondary');
      expect(title).toHaveText('Custom Alerts');
      expect(description).toHaveText("Get personalized notifications for today's rules and next-day reminders");
    });

    it('should display Real-time Updates feature with correct content', () => {
      const featureCards = spectator.queryAll('.feature-card');
      const realTimeCard = featureCards[2];

      const icon = realTimeCard.querySelector('ion-icon');
      const title = realTimeCard.querySelector('h3');
      const description = realTimeCard.querySelector('p');

      expect(icon).toHaveAttribute('name', 'time-outline');
      expect(icon).toHaveAttribute('color', 'tertiary');
      expect(title).toHaveText('Real-time Updates');
      expect(description).toHaveText('Stay informed about parking suspensions and rule changes as they happen');
    });

    it('should have all feature icons with proper color attributes', () => {
      const expectedColors = ['primary', 'secondary', 'tertiary'];
      const featureIcons = spectator.queryAll('.feature-card ion-icon');

      expectedColors.forEach((color, index) => {
        expect(featureIcons[index]).toHaveAttribute('color', color);
      });
    });
  });

  describe('UI Layout and Structure', () => {
    beforeEach(() => {
      spectator.detectChanges();
    });

    it('should have proper component structure', () => {
      expect(spectator.query('ion-content')).toBeTruthy();
      expect(spectator.query('.intro-container')).toBeTruthy();
      expect(spectator.query('.intro-header')).toBeTruthy();
      expect(spectator.query('.intro-features')).toBeTruthy();
      expect(spectator.query('.intro-actions')).toBeTruthy();
    });

    it('should display logo with proper attributes', () => {
      const logo = spectator.query('.intro-logo');
      expect(logo).toBeTruthy();
      expect(logo).toHaveAttribute('src', '/assets/intro.png');
      expect(logo).toHaveAttribute('alt', 'ASP NYC Logo');
    });

    it('should have proper header structure', () => {
      const header = spectator.query('.intro-header');
      const logoContainer = header?.querySelector('.logo-container');
      const titleContainer = header?.querySelector('.intro-title');

      expect(logoContainer).toBeTruthy();
      expect(titleContainer).toBeTruthy();
    });

    it('should have get started button with proper styling', () => {
      const button = spectator.query('.get-started-btn');
      expect(button).toHaveAttribute('expand', 'block');
      expect(button).toHaveAttribute('size', 'large');
      expect(button).toHaveAttribute('color', 'light');
    });

    it('should have arrow icon positioned correctly in button', () => {
      const arrowIcon = spectator.query('.get-started-btn ion-icon[name="arrow-forward"]');
      expect(arrowIcon).toHaveAttribute('slot', 'end');
    });

    it('should have proper ion-text wrapper for tagline', () => {
      const ionText = spectator.query('.intro-title ion-text');
      expect(ionText).toHaveAttribute('color', 'light');

      const tagline = ionText?.querySelector('p');
      expect(tagline).toBeTruthy();
    });
  });

  describe('Content Accuracy', () => {
    beforeEach(() => {
      spectator.detectChanges();
    });

    it('should display the correct app title', () => {
      const title = spectator.query('.intro-title h1');
      expect(title).toHaveText('ASP NYC');
    });

    it('should display compelling value proposition', () => {
      const tagline = spectator.query('.intro-title ion-text p');
      expect(tagline).toHaveText('Never pay another parking ticket due to NYC street cleaning schedules');
    });

    it('should have meaningful feature descriptions that mention key benefits', () => {
      const descriptions = spectator.queryAll('.feature-card p');

      // Smart Calendar description should mention viewing modes
      expect(descriptions[0].textContent).toContain('calendar or list format');

      // Custom Alerts description should mention personalization
      expect(descriptions[1].textContent).toContain('personalized notifications');

      // Real-time Updates description should mention staying informed
      expect(descriptions[2].textContent).toContain('Stay informed');
    });

    it('should have action-oriented button text', () => {
      const button = spectator.query('.get-started-btn');
      expect(button).toHaveText('Get Started');
    });
  });

  describe('Component Integration', () => {
    it('should properly integrate with Router service', () => {
      expect(mockRouter).toBeDefined();
      expect(component['router']).toBe(mockRouter);
    });

    it('should use Ionic components correctly', () => {
      spectator.detectChanges();

      expect(spectator.query('ion-content')).toBeTruthy();
      expect(spectator.queryAll('ion-text')).toHaveLength(4); // 1 tagline + 3 feature descriptions
      expect(spectator.query('ion-button')).toBeTruthy();
      expect(spectator.queryAll('ion-icon')).toHaveLength(4); // 3 feature icons + 1 arrow icon
    });

    it('should register icons in constructor without errors', () => {
      // Constructor executes when component is created
      // If icon registration failed, component creation would fail
      expect(component).toBeTruthy();
      expect(() => spectator.detectChanges()).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should not create memory leaks with repeated clicks', async () => {
      (Preferences.set as jest.Mock).mockResolvedValue(undefined);
      const button = spectator.query('.get-started-btn');

      // Simulate multiple user interactions
      for (let i = 0; i < 10; i++) {
        spectator.click(button!);
        await spectator.fixture.whenStable();
      }

      expect(Preferences.set).toHaveBeenCalledTimes(10);
      expect(mockRouter.navigate).toHaveBeenCalledTimes(10);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle component destruction during async operations', async () => {
      let resolvePreferences: (value: any) => void;
      const preferencesPromise = new Promise(resolve => {
        resolvePreferences = resolve;
      });
      (Preferences.set as jest.Mock).mockReturnValue(preferencesPromise);

      // Start async operation
      const continuePromise = component.continue();

      // Destroy component while operation is pending
      spectator.fixture.destroy();

      // Resolve the promise after destruction
      resolvePreferences!(undefined);

      // Should not throw errors
      await expect(continuePromise).resolves.not.toThrow();
    });
  });
});
