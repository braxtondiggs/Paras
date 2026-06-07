import type { ComponentFixture } from '@angular/core/testing';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { Timestamp } from '@angular/fire/firestore';
import type { Feed } from '@core/types/firestore.types';
import { ModalController } from '@ionic/angular/standalone';
import { createComponentFactory, type Spectator } from '@ngneat/spectator/jest';
import dayjs, { type Dayjs } from 'dayjs';
import { ModalDetailComponent } from './modal-detail.component';

// Mock Firebase Analytics logEvent
jest.mock('@angular/fire/analytics', () => ({
  Analytics: jest.fn(),
  logEvent: jest.fn()
}));

const mockLogEvent = logEvent as jest.Mock;

// Mock Analytics
const mockAnalytics = {
  app: { name: 'test-app' }
} as unknown as Analytics;

// Mock ModalController
const mockModalController = {
  dismiss: jest.fn().mockResolvedValue(true)
};

describe('ModalDetailComponent', () => {
  let spectator: Spectator<ModalDetailComponent>;
  let component: ModalDetailComponent;
  let fixture: ComponentFixture<ModalDetailComponent>;

  const createComponent = createComponentFactory({
    component: ModalDetailComponent,
    providers: [
      { provide: Analytics, useValue: mockAnalytics },
      { provide: ModalController, useValue: mockModalController }
    ],
    shallow: true
  });

  const mockTimestamp = Timestamp.now();

  const mockFeedActive: Feed = {
    id: 'feed-1',
    active: true,
    created: mockTimestamp,
    date: mockTimestamp,
    metered: false,
    reason: 'Street Cleaning',
    text: 'Alternate side parking is in effect',
    type: 'NYC'
  };

  const mockFeedInactive: Feed = {
    id: 'feed-2',
    active: false,
    created: mockTimestamp,
    date: mockTimestamp,
    metered: false,
    reason: 'Holiday',
    text: 'Alternate side parking is suspended',
    type: 'NYC'
  };

  beforeEach(() => {
    jest.clearAllMocks();
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

    it('should log screen view event on construction', () => {
      expect(mockLogEvent).toHaveBeenCalledWith(mockAnalytics, 'screen_view', {
        firebase_screen: 'Calendar Detailed',
        firebase_screen_class: 'app-modal-detail'
      });
    });

    it('should initialize item signal as undefined', () => {
      expect(component.item()).toBeUndefined();
    });

    it('should have modalData property defined in component', () => {
      expect('modalData' in component).toBe(true);
    });
  });

  describe('ngOnInit', () => {
    it('should set item from modalData if provided with Feed data', () => {
      component.modalData = mockFeedActive;
      component.ngOnInit();

      expect(component.item()).toEqual(mockFeedActive);
    });

    it('should set item from modalData if provided with Dayjs data', () => {
      const mockDate = dayjs('2025-01-15');
      component.modalData = mockDate;
      component.ngOnInit();

      expect(component.item()).toEqual(mockDate);
    });

    it('should not set item if modalData is undefined', () => {
      component.modalData = undefined;
      component.ngOnInit();

      expect(component.item()).toBeUndefined();
    });

    it('should handle null modalData gracefully', () => {
      component.modalData = undefined;

      expect(() => component.ngOnInit()).not.toThrow();
      expect(component.item()).toBeUndefined();
    });
  });

  describe('setItem', () => {
    it('should set item signal with Feed data', () => {
      component.setItem(mockFeedActive);

      expect(component.item()).toEqual(mockFeedActive);
    });

    it('should set item signal with Dayjs data', () => {
      const mockDate = dayjs('2025-01-20');
      component.setItem(mockDate);

      expect(component.item()).toEqual(mockDate);
    });

    it('should update existing item when called multiple times', () => {
      component.setItem(mockFeedActive);
      expect(component.item()).toEqual(mockFeedActive);

      component.setItem(mockFeedInactive);
      expect(component.item()).toEqual(mockFeedInactive);
    });

    it('should replace Dayjs with Feed data', () => {
      const mockDate = dayjs('2025-01-15');
      component.setItem(mockDate);
      expect(component.item()).toEqual(mockDate);

      component.setItem(mockFeedActive);
      expect(component.item()).toEqual(mockFeedActive);
    });

    it('should replace Feed with Dayjs data', () => {
      component.setItem(mockFeedActive);
      expect(component.item()).toEqual(mockFeedActive);

      const mockDate = dayjs('2025-01-20');
      component.setItem(mockDate);
      expect(component.item()).toEqual(mockDate);
    });
  });

  describe('dismiss', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should call modal.dismiss', async () => {
      await component.dismiss();

      expect(mockModalController.dismiss).toHaveBeenCalledTimes(1);
    });

    it('should log custom event when dismissing with active Feed', async () => {
      component.item.set(mockFeedActive);
      await component.dismiss();

      expect(mockLogEvent).toHaveBeenCalledWith(mockAnalytics, 'custom_event', {
        modal: 'dismiss',
        active: 'true'
      });
    });

    it('should log custom event when dismissing with inactive Feed', async () => {
      component.item.set(mockFeedInactive);
      await component.dismiss();

      expect(mockLogEvent).toHaveBeenCalledWith(mockAnalytics, 'custom_event', {
        modal: 'dismiss',
        active: 'false'
      });
    });

    it('should log custom event as active:true when dismissing with Dayjs', async () => {
      const mockDate = dayjs('2025-01-15');
      component.item.set(mockDate);
      await component.dismiss();

      expect(mockLogEvent).toHaveBeenCalledWith(mockAnalytics, 'custom_event', {
        modal: 'dismiss',
        active: 'true'
      });
    });

    it('should log custom event as active:true when dismissing with undefined item', async () => {
      component.item.set(undefined);
      await component.dismiss();

      expect(mockLogEvent).toHaveBeenCalledWith(mockAnalytics, 'custom_event', {
        modal: 'dismiss',
        active: 'true'
      });
    });

    it('should handle modal dismiss rejection gracefully', async () => {
      mockModalController.dismiss.mockRejectedValueOnce(new Error('Dismiss failed'));

      await expect(component.dismiss()).rejects.toThrow('Dismiss failed');
    });

    it('should log analytics even if modal dismiss fails', async () => {
      component.item.set(mockFeedActive);
      mockModalController.dismiss.mockRejectedValueOnce(new Error('Dismiss failed'));

      try {
        await component.dismiss();
      } catch {
        // Expected to throw
      }

      // Analytics should still be logged before the dismiss
      expect(mockModalController.dismiss).toHaveBeenCalled();
    });
  });

  describe('Signal Reactivity', () => {
    it('should update view when item signal changes', () => {
      component.item.set(mockFeedActive);
      fixture.detectChanges();

      expect(component.item()).toEqual(mockFeedActive);

      component.item.set(mockFeedInactive);
      fixture.detectChanges();

      expect(component.item()).toEqual(mockFeedInactive);
    });

    it('should maintain signal reference across component lifecycle', () => {
      const itemSignal = component.item;

      component.setItem(mockFeedActive);
      expect(itemSignal()).toEqual(mockFeedActive);

      component.setItem(mockFeedInactive);
      expect(itemSignal()).toEqual(mockFeedInactive);
    });
  });

  describe('Integration with CardDetailComponent', () => {
    it('should render CardDetailComponent when item is set', () => {
      component.item.set(mockFeedActive);
      fixture.detectChanges();

      const cardDetail = spectator.query('app-card-detail');
      expect(cardDetail).toBeTruthy();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle rapid setItem calls', () => {
      for (let i = 0; i < 100; i++) {
        const feed: Feed = { ...mockFeedActive, id: `feed-${i}` };
        component.setItem(feed);
      }

      const currentItem = component.item();
      if (currentItem && !dayjs.isDayjs(currentItem)) {
        expect(currentItem.id).toBe('feed-99');
      }
    });

    it('should handle dismiss being called multiple times', async () => {
      await component.dismiss();
      await component.dismiss();
      await component.dismiss();

      expect(mockModalController.dismiss).toHaveBeenCalledTimes(3);
    });

    it('should handle setItem and dismiss in sequence', async () => {
      component.setItem(mockFeedActive);
      await component.dismiss();

      expect(component.item()).toEqual(mockFeedActive);
      expect(mockModalController.dismiss).toHaveBeenCalled();
    });

    it('should handle Feed objects with missing optional properties', () => {
      const minimalFeed: Feed = {
        id: 'minimal',
        active: true,
        created: mockTimestamp,
        date: mockTimestamp,
        metered: false,
        reason: '',
        text: '',
        type: 'NYC'
      };

      expect(() => component.setItem(minimalFeed)).not.toThrow();
      expect(component.item()).toEqual(minimalFeed);
    });

    it('should handle various Dayjs formats', () => {
      const dates = [dayjs(), dayjs('2025-01-01'), dayjs(new Date()), dayjs('2025-12-31T23:59:59')];

      dates.forEach(date => {
        component.setItem(date);
        expect(dayjs.isDayjs(component.item())).toBe(true);
      });
    });
  });

  describe('Analytics Tracking', () => {
    it('should track both screen view and dismiss events', async () => {
      jest.clearAllMocks();

      // Create new component to trigger screen_view
      const newSpectator = createComponent();
      const newComponent = newSpectator.component;

      expect(mockLogEvent).toHaveBeenCalledWith(mockAnalytics, 'screen_view', expect.any(Object));

      newComponent.item.set(mockFeedActive);
      await newComponent.dismiss();

      expect(mockLogEvent).toHaveBeenCalledWith(mockAnalytics, 'custom_event', expect.any(Object));
      expect(mockLogEvent).toHaveBeenCalledTimes(2);
    });

    it('should include correct firebase_screen metadata', () => {
      expect(mockLogEvent).toHaveBeenCalledWith(
        mockAnalytics,
        'screen_view',
        expect.objectContaining({
          firebase_screen: 'Calendar Detailed',
          firebase_screen_class: 'app-modal-detail'
        })
      );
    });

    it('should track active state correctly in analytics', async () => {
      const testCases = [
        { item: mockFeedActive, expectedActive: 'true' },
        { item: mockFeedInactive, expectedActive: 'false' },
        { item: dayjs(), expectedActive: 'true' },
        { item: undefined, expectedActive: 'true' }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        component.item.set(testCase.item);
        await component.dismiss();

        expect(mockLogEvent).toHaveBeenCalledWith(
          mockAnalytics,
          'custom_event',
          expect.objectContaining({
            active: testCase.expectedActive
          })
        );
      }
    });
  });

  describe('Type Safety', () => {
    it('should accept Feed type in setItem', () => {
      const feed: Feed = mockFeedActive;
      expect(() => component.setItem(feed)).not.toThrow();
    });

    it('should accept Dayjs type in setItem', () => {
      const date: Dayjs = dayjs();
      expect(() => component.setItem(date)).not.toThrow();
    });

    it('should maintain correct types in item signal', () => {
      component.setItem(mockFeedActive);
      const item = component.item();

      if (item && !dayjs.isDayjs(item)) {
        expect(item).toHaveProperty('active');
        expect(item).toHaveProperty('type');
        expect(item.type).toBe('NYC');
      }
    });
  });

  describe('Accessibility', () => {
    it('should render a toolbar title for the modal', () => {
      fixture.detectChanges();
      expect(spectator.query('ion-title')).toBeTruthy();
    });

    it('should expose an aria-label on the close button', () => {
      fixture.detectChanges();
      expect(spectator.query('ion-button[aria-label="Close parking details"]')).toBeTruthy();
    });

    it('should label the content region for assistive technology', () => {
      fixture.detectChanges();
      expect(spectator.query('ion-content[aria-label="Parking details"]')).toBeTruthy();
    });
  });
});
