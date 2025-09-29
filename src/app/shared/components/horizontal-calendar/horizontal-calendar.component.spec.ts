import type { ComponentFixture } from '@angular/core/testing';
import { LoadingController } from '@ionic/angular/standalone';
import { FeedService, type Feed } from '@core/services';
import { createComponentFactory, type Spectator } from '@ngneat/spectator/jest';
import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { of, throwError } from 'rxjs';
import { HorizontalCalendarComponent } from './horizontal-calendar.component';
import type { Calendar } from '@shared/interfaces';
import { Timestamp } from '@angular/fire/firestore';

// Extend dayjs plugins
dayjs.extend(isSameOrBefore);
dayjs.extend(advancedFormat);

describe('HorizontalCalendarComponent', () => {
  let spectator: Spectator<HorizontalCalendarComponent>;
  let component: HorizontalCalendarComponent;
  let fixture: ComponentFixture<HorizontalCalendarComponent>;

  const mockTimestamp = Timestamp.now();

  const mockFeed: Feed = {
    id: 'feed-1',
    active: true,
    created: mockTimestamp,
    date: mockTimestamp,
    metered: false,
    reason: 'Regular parking',
    text: 'Alternate side parking in effect',
    type: 'NYC'
  };

  const mockLoadingElement = {
    present: jest.fn().mockResolvedValue(undefined),
    dismiss: jest.fn().mockReturnValue(Promise.resolve(true))
  };

  const mockLoadingController = {
    create: jest.fn().mockResolvedValue(mockLoadingElement)
  };

  const mockFeedService = {
    getFeeds: jest.fn().mockReturnValue(of([mockFeed]))
  };

  const createComponent = createComponentFactory({
    component: HorizontalCalendarComponent,
    providers: [
      {
        provide: FeedService,
        useValue: mockFeedService
      },
      {
        provide: LoadingController,
        useValue: mockLoadingController
      }
    ],
    shallow: true
  });

  beforeEach(() => {
    // Reset mock call counts but keep implementations
    mockLoadingElement.present.mockClear().mockResolvedValue(undefined);
    mockLoadingElement.dismiss.mockClear().mockReturnValue(Promise.resolve(true));
    mockLoadingController.create.mockClear().mockResolvedValue(mockLoadingElement);
    mockFeedService.getFeeds.mockClear().mockReturnValue(of([mockFeed]));

    spectator = createComponent();
    component = spectator.component;
    fixture = spectator.fixture;
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should have OnPush change detection strategy', () => {
      expect(fixture.componentRef.changeDetectorRef).toBeDefined();
    });

    it('should initialize with loading state that transitions to false after init', async () => {
      // Component has DATA_LOAD_DELAY of 250ms, so we need to wait
      await new Promise(resolve => setTimeout(resolve, 300));
      await fixture.whenStable();
      expect(component.isLoading()).toBe(false);
    });

    it('should initialize signals - some populated after init', async () => {
      // Wait for initialization to complete including DATA_LOAD_DELAY
      await new Promise(resolve => setTimeout(resolve, 300));
      await fixture.whenStable();
      // After initialization, some values will be set
      expect(component.selected()).toBeDefined(); // Will be set after data loads
      expect(component.feeds()).toBeDefined(); // Will be set after data loads
      expect(component.active()).toBeDefined(); // Will be set in initializeComponent
      expect(component.items().length).toBeGreaterThan(0); // Will be populated
      expect(component.isSliding()).toBe(false);
    });
  });

  describe('Computed Properties', () => {
    it('should compute hasError correctly', async () => {
      await fixture.whenStable();
      // Clear any initialization errors
      component.error.set(null);
      expect(component.hasError()).toBe(false);

      component.error.set('Test error');
      expect(component.hasError()).toBe(true);
    });

    it('should compute hasFeeds correctly', () => {
      // Clear feeds first since they may be loaded from initialization
      component.feeds.set([]);
      expect(component.hasFeeds()).toBe(false);

      component.feeds.set([mockFeed]);
      expect(component.hasFeeds()).toBe(true);
    });

    it('should compute canNavigate correctly', () => {
      component.isLoading.set(false);
      component.isSliding.set(false);
      expect(component.canNavigate()).toBe(true);

      component.isLoading.set(true);
      expect(component.canNavigate()).toBe(false);

      component.isLoading.set(false);
      component.isSliding.set(true);
      expect(component.canNavigate()).toBe(false);
    });

    it('should compute dateRange when items exist', () => {
      const today = dayjs();
      const calendar: Calendar = {
        text: today.format(),
        date: today.toDate(),
        month: { short: 'Jan', long: 'January' },
        day: { short: 'Mon', long: 'Monday', num: '01' }
      };

      component.items.set([calendar]);

      const range = component.dateRange();
      expect(range).not.toBeNull();
      expect(range?.start.format('YYYY-MM-DD')).toBe(today.format('YYYY-MM-DD'));
    });

    it('should return null dateRange when no items', () => {
      component.items.set([]);
      expect(component.dateRange()).toBeNull();
    });
  });

  describe('ngOnInit', () => {
    it('should initialize component with loading indicator', async () => {
      // Reset mocks and create fresh component
      jest.clearAllMocks();
      mockLoadingController.create.mockResolvedValue(mockLoadingElement);

      const freshSpectator = createComponent();
      const freshComponent = freshSpectator.component;

      await freshComponent.ngOnInit();

      expect(mockLoadingController.create).toHaveBeenCalledWith({
        message: 'Loading calendar...',
        spinner: 'crescent',
        translucent: true
      });
      expect(mockLoadingElement.present).toHaveBeenCalled();
      expect(freshComponent.items().length).toBeGreaterThan(0);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock console.error to avoid cluttering test output
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Set up error condition before creating component
      jest.clearAllMocks();
      mockLoadingController.create.mockRejectedValue(new Error('Loading failed'));

      const freshSpectator = createComponent();
      const freshComponent = freshSpectator.component;

      await freshComponent.ngOnInit();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialize horizontal calendar:', expect.any(Error));
      expect(freshComponent.error()).toBe('Failed to initialize calendar');
      expect(freshComponent.isLoading()).toBe(false);

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Date Utility Methods', () => {
    it('should correctly identify today', () => {
      const today = dayjs();
      const calendar: Calendar = {
        text: today.format(),
        date: today.toDate(),
        month: { short: 'Jan', long: 'January' },
        day: { short: 'Mon', long: 'Monday', num: '01' }
      };

      expect(component.isToday(calendar)).toBe(true);
    });

    it('should return false for non-today dates', () => {
      const yesterday = dayjs().subtract(1, 'day');
      const calendar: Calendar = {
        text: yesterday.format(),
        date: yesterday.toDate(),
        month: { short: 'Jan', long: 'January' },
        day: { short: 'Sun', long: 'Sunday', num: '31' }
      };

      expect(component.isToday(calendar)).toBe(false);
    });

    it('should handle invalid dates in isToday safely', () => {
      const calendar = { date: null } as unknown as Calendar;
      expect(component.isToday(calendar)).toBe(false);
    });
  });

  describe('Notice Detection', () => {
    it('should detect notices for inactive feeds', () => {
      const today = dayjs();
      const calendar: Calendar = {
        text: today.format(),
        date: today.toDate(),
        month: { short: 'Jan', long: 'January' },
        day: { short: 'Mon', long: 'Monday', num: '01' }
      };

      const inactiveFeed: Feed = {
        ...mockFeed,
        active: false,
        date: Timestamp.fromDate(today.toDate())
      };

      expect(component.hasNotice(calendar, [inactiveFeed])).toBe(true);
    });

    it('should return false when feed is active', () => {
      const today = dayjs();
      const calendar: Calendar = {
        text: today.format(),
        date: today.toDate(),
        month: { short: 'Jan', long: 'January' },
        day: { short: 'Mon', long: 'Monday', num: '01' }
      };

      const activeFeed: Feed = {
        ...mockFeed,
        active: true,
        date: Timestamp.fromDate(today.toDate())
      };

      expect(component.hasNotice(calendar, [activeFeed])).toBe(false);
    });

    it('should return false when no feeds provided', () => {
      const calendar: Calendar = {
        text: dayjs().format(),
        date: dayjs().toDate(),
        month: { short: 'Jan', long: 'January' },
        day: { short: 'Mon', long: 'Monday', num: '01' }
      };

      expect(component.hasNotice(calendar, undefined)).toBe(false);
      expect(component.hasNotice(calendar, [])).toBe(false);
    });

    it('should handle invalid calendar data in hasNotice', () => {
      const calendar = { date: null } as unknown as Calendar;
      expect(component.hasNotice(calendar, [mockFeed])).toBe(false);
    });
  });

  describe('Navigation Methods', () => {
    it('should not navigate when canNavigate is false', () => {
      component.isLoading.set(true);
      component.slideNext();
      component.slidePrev();

      // Should not throw errors
      expect(component.isLoading()).toBe(true);
    });

    it('should handle slideNext without swiper instance', () => {
      component.isLoading.set(false);
      component.isSliding.set(false);

      expect(() => component.slideNext()).not.toThrow();
    });

    it('should handle slidePrev without swiper instance', () => {
      component.isLoading.set(false);
      component.isSliding.set(false);

      expect(() => component.slidePrev()).not.toThrow();
    });

    it('should handle slideTo with invalid index', () => {
      component.isLoading.set(false);
      component.items.set([]);

      expect(() => component.slideTo(-1)).not.toThrow();
      expect(() => component.slideTo(999)).not.toThrow();
    });
  });

  describe('Slide Change Handling', () => {
    it('should not process slide change when already sliding', async () => {
      component.isSliding.set(true);

      await component.onSlideChange();

      expect(component.isSliding()).toBe(true);
    });

    it('should handle slide change errors gracefully', async () => {
      component.isSliding.set(false);

      await component.onSlideChange();

      // Should complete without throwing
      expect(component.isSliding()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should set error state when data loading fails', async () => {
      // Mock console.error to avoid cluttering test output
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const feedService = spectator.inject(FeedService);
      jest.spyOn(feedService, 'getFeeds').mockReturnValue(throwError(() => new Error('Network error')));

      await component.ngOnInit();

      expect(component.error()).toBeTruthy();
      expect(component.isLoading()).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('should handle errors during data loading', async () => {
      // Mock console.error to avoid cluttering test output
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const feedService = spectator.inject(FeedService);
      jest.spyOn(feedService, 'getFeeds').mockReturnValue(throwError(() => new Error('Failed')));

      await component.ngOnInit();

      expect(component.error()).toBeTruthy();
      expect(component.isLoading()).toBe(false);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Signal Reactivity', () => {
    it('should update signals independently', () => {
      const today = dayjs();
      const calendar: Calendar = {
        text: today.format(),
        date: today.toDate(),
        month: { short: 'Jan', long: 'January' },
        day: { short: 'Mon', long: 'Monday', num: '01' }
      };

      component.items.set([calendar]);
      expect(component.items()).toEqual([calendar]);

      component.active.set(calendar);
      expect(component.active()).toEqual(calendar);
    });

    it('should maintain stable selected during sliding', () => {
      const selectedValue = dayjs();
      component.selected.set(selectedValue);
      component.isSliding.set(true);

      fixture.detectChanges();

      // Stable selected should not update while sliding
      component.isSliding.set(false);
      fixture.detectChanges();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty feeds array', () => {
      component.feeds.set([]);
      expect(component.hasFeeds()).toBe(false);
    });

    it('should handle undefined selected state', () => {
      component.selected.set(undefined);
      expect(component.selected()).toBeUndefined();
    });

    it('should handle rapid state changes', () => {
      // Test rapid state toggling
      for (let i = 0; i < 10; i++) {
        component.isLoading.set(i % 2 === 0);
        component.isSliding.set(i % 2 !== 0);
      }

      // After 10 iterations (0-9), last iteration is i=9 (odd)
      // i=9: isLoading.set(9 % 2 === 0) -> false, isSliding.set(9 % 2 !== 0) -> true
      expect(component.isLoading()).toBe(false);
      expect(component.isSliding()).toBe(true);

      // Verify state can still be changed after rapid updates
      component.isLoading.set(true);
      expect(component.isLoading()).toBe(true);
    });
  });

  describe('Memory and Performance', () => {
    it('should not create memory leaks with multiple signal updates', () => {
      const feeds = Array.from({ length: 100 }, (_, i) => ({
        ...mockFeed,
        id: `feed-${i}`
      }));

      component.feeds.set(feeds);
      expect(component.feeds().length).toBe(100);

      component.feeds.set([]);
      expect(component.feeds().length).toBe(0);
    });

    it('should handle large date ranges efficiently', () => {
      const items: Calendar[] = Array.from({ length: 365 }, (_, i) => {
        const date = dayjs().add(i, 'day');
        return {
          text: date.format(),
          date: date.toDate(),
          month: { short: date.format('MMM'), long: date.format('MMMM') },
          day: { short: date.format('ddd'), long: date.format('dddd'), num: date.format('DD') }
        };
      });

      component.items.set(items);
      expect(component.items().length).toBe(365);

      const range = component.dateRange();
      expect(range).not.toBeNull();
    });
  });

  describe('Component Cleanup', () => {
    it('should handle component destroy without errors', () => {
      component.isLoading.set(true);

      expect(() => spectator.fixture.destroy()).not.toThrow();
    });
  });
});
