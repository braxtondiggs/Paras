import type { ComponentFixture } from '@angular/core/testing';
import { Timestamp } from '@angular/fire/firestore';
import type { Feed } from '@core/types/firestore.types';
import { createComponentFactory, type Spectator } from '@ngneat/spectator/jest';
import dayjs, { type Dayjs } from 'dayjs';
import { CardDetailComponent } from './card-detail.component';

describe('CardDetailComponent', () => {
  let spectator: Spectator<CardDetailComponent>;
  let component: CardDetailComponent;
  let fixture: ComponentFixture<CardDetailComponent>;

  const createComponent = createComponentFactory({
    component: CardDetailComponent,
    shallow: true
  });

  const mockTimestamp = Timestamp.now();
  const yesterdayTimestamp = Timestamp.fromDate(dayjs().subtract(1, 'day').toDate());
  const tomorrowTimestamp = Timestamp.fromDate(dayjs().add(1, 'day').toDate());

  const mockFeedActive: Feed = {
    id: 'feed-1',
    active: true,
    created: mockTimestamp,
    date: mockTimestamp,
    metered: true,
    reason: 'Street Cleaning',
    text: 'Alternate side parking is in effect',
    type: 'NYC'
  };

  const mockFeedInactive: Feed = {
    id: 'feed-2',
    active: false,
    created: yesterdayTimestamp,
    date: yesterdayTimestamp,
    metered: false,
    reason: 'Holiday',
    text: 'Alternate side parking is suspended',
    type: 'NYC'
  };

  const mockFeedTomorrow: Feed = {
    id: 'feed-3',
    active: true,
    created: tomorrowTimestamp,
    date: tomorrowTimestamp,
    metered: true,
    reason: '',
    text: 'Tomorrow parking rules',
    type: 'NYC'
  };

  beforeEach(() => {
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

    it('should initialize item input as undefined', () => {
      expect(component.item()).toBeUndefined();
    });

    it('should initialize showBorder input as true by default', () => {
      expect(component.showBorder()).toBe(true);
    });

    it('should initialize isLoading signal as false', () => {
      expect(component.isLoading()).toBe(false);
    });

    it('should have correct host attributes for accessibility', () => {
      const hostElement = spectator.element;
      expect(hostElement.getAttribute('role')).toBe('region');
      expect(hostElement.getAttribute('aria-label')).toBe('Parking details card');
    });
  });

  describe('detail computed signal', () => {
    it('should return undefined when item is not set', () => {
      expect(component.detail()).toBeUndefined();
    });

    it('should create view model from Feed data', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const detail = component.detail();
      expect(detail).toBeDefined();
      expect(detail?.active).toBe(true);
      expect(detail?.metered).toBe(true);
      expect(detail?.reason).toBe('Street Cleaning');
      expect(detail?.text).toBe('Alternate side parking is in effect');
      expect(detail?.type).toBe('NYC');
      expect(detail?.date).toContain(dayjs().format('MMMM'));
    });

    it('should create view model from Dayjs data', () => {
      const mockDate = dayjs('2025-01-15');
      spectator.setInput('item', mockDate);
      fixture.detectChanges();

      const detail = component.detail();
      expect(detail).toBeDefined();
      expect(detail?.active).toBe(true);
      expect(detail?.metered).toBe(true);
      expect(detail?.date).toBe('January 15th 2025');
      expect(detail?.reason).toBeUndefined();
      expect(detail?.text).toBeUndefined();
      expect(detail?.type).toBeUndefined();
    });

    it('should format dates correctly for Feed', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const detail = component.detail();
      expect(detail?.date).toMatch(/^[A-Z][a-z]+ \d{1,2}(st|nd|rd|th) \d{4}$/);
    });

    it('should calculate relative time correctly', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const detail = component.detail();
      expect(detail?.created).toMatch(/^(a few seconds|a minute|minutes|an hour|hours|a day) ago$/);
    });

    it('should detect recently updated items (today)', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const detail = component.detail();
      expect(detail?.lastUpdated).toBe(true);
    });

    it('should detect recently updated items (tomorrow)', () => {
      spectator.setInput('item', mockFeedTomorrow);
      fixture.detectChanges();

      const detail = component.detail();
      expect(detail?.lastUpdated).toBe(true);
    });

    it('should not mark yesterday items as recently updated', () => {
      spectator.setInput('item', mockFeedInactive);
      fixture.detectChanges();

      const detail = component.detail();
      expect(detail?.lastUpdated).toBe(false);
    });

    it('should handle Dayjs current date as recently updated', () => {
      const today = dayjs();
      spectator.setInput('item', today);
      fixture.detectChanges();

      const detail = component.detail();
      expect(detail?.lastUpdated).toBe(true);
    });

    it('should handle Dayjs past date as not recently updated', () => {
      const pastDate = dayjs().subtract(2, 'days');
      spectator.setInput('item', pastDate);
      fixture.detectChanges();

      const detail = component.detail();
      expect(detail?.lastUpdated).toBe(false);
    });
  });

  describe('statusColor computed signal', () => {
    it('should return medium when detail is undefined', () => {
      expect(component.statusColor()).toBe('medium');
    });

    it('should return primary for active parking rules', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      expect(component.statusColor()).toBe('primary');
    });

    it('should return danger for inactive parking rules', () => {
      spectator.setInput('item', mockFeedInactive);
      fixture.detectChanges();

      expect(component.statusColor()).toBe('danger');
    });

    it('should return primary for Dayjs items (default active)', () => {
      const mockDate = dayjs();
      spectator.setInput('item', mockDate);
      fixture.detectChanges();

      expect(component.statusColor()).toBe('primary');
    });
  });

  describe('statusIcon computed signal', () => {
    it('should return time-outline when detail is undefined', () => {
      expect(component.statusIcon()).toBe('time-outline');
    });

    it('should return checkmark-circle-outline for active rules', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      expect(component.statusIcon()).toBe('checkmark-circle-outline');
    });

    it('should return close-circle-outline for inactive rules', () => {
      spectator.setInput('item', mockFeedInactive);
      fixture.detectChanges();

      expect(component.statusIcon()).toBe('close-circle-outline');
    });

    it('should return checkmark-circle-outline for Dayjs items', () => {
      const mockDate = dayjs();
      spectator.setInput('item', mockDate);
      fixture.detectChanges();

      expect(component.statusIcon()).toBe('checkmark-circle-outline');
    });
  });

  describe('parkingStatus computed signal', () => {
    it('should return Unknown with medium class when detail is undefined', () => {
      const status = component.parkingStatus();
      expect(status.text).toBe('Unknown');
      expect(status.class).toBe('text-medium');
    });

    it('should return In Effect with success class for active rules', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const status = component.parkingStatus();
      expect(status.text).toBe('In Effect');
      expect(status.class).toBe('text-success');
    });

    it('should return Suspended with danger class for inactive rules', () => {
      spectator.setInput('item', mockFeedInactive);
      fixture.detectChanges();

      const status = component.parkingStatus();
      expect(status.text).toBe('Suspended');
      expect(status.class).toBe('text-danger');
    });

    it('should return In Effect for Dayjs items', () => {
      const mockDate = dayjs();
      spectator.setInput('item', mockDate);
      fixture.detectChanges();

      const status = component.parkingStatus();
      expect(status.text).toBe('In Effect');
      expect(status.class).toBe('text-success');
    });
  });

  describe('meterStatus computed signal', () => {
    it('should return Unknown with medium class when detail is undefined', () => {
      const status = component.meterStatus();
      expect(status.text).toBe('Unknown');
      expect(status.class).toBe('text-medium');
    });

    it('should return In Effect with success class when meters are active', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const status = component.meterStatus();
      expect(status.text).toBe('In Effect');
      expect(status.class).toBe('text-success');
    });

    it('should return Not in Effect with danger class when meters are inactive', () => {
      spectator.setInput('item', mockFeedInactive);
      fixture.detectChanges();

      const status = component.meterStatus();
      expect(status.text).toBe('Not in Effect');
      expect(status.class).toBe('text-danger');
    });

    it('should return In Effect for Dayjs items (default metered true)', () => {
      const mockDate = dayjs();
      spectator.setInput('item', mockDate);
      fixture.detectChanges();

      const status = component.meterStatus();
      expect(status.text).toBe('In Effect');
      expect(status.class).toBe('text-success');
    });
  });

  describe('cardClasses computed signal', () => {
    it('should return empty string when detail is undefined', () => {
      expect(component.cardClasses()).toBe('');
    });

    it('should return status-active for active rules', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      expect(component.cardClasses()).toContain('status-active');
    });

    it('should return status-inactive for inactive rules', () => {
      spectator.setInput('item', mockFeedInactive);
      fixture.detectChanges();

      expect(component.cardClasses()).toContain('status-inactive');
    });

    it('should not include no-border class when showBorder is true', () => {
      spectator.setInput('item', mockFeedActive);
      spectator.setInput('showBorder', true);
      fixture.detectChanges();

      expect(component.cardClasses()).not.toContain('no-border');
    });

    it('should include no-border class when showBorder is false', () => {
      spectator.setInput('item', mockFeedActive);
      spectator.setInput('showBorder', false);
      fixture.detectChanges();

      expect(component.cardClasses()).toContain('no-border');
    });

    it('should combine status and border classes correctly', () => {
      spectator.setInput('item', mockFeedInactive);
      spectator.setInput('showBorder', false);
      fixture.detectChanges();

      const classes = component.cardClasses();
      expect(classes).toContain('status-inactive');
      expect(classes).toContain('no-border');
    });
  });

  describe('Template Rendering', () => {
    it('should show loading skeleton when isLoading is true', () => {
      component.isLoading.set(true);
      fixture.detectChanges();

      const skeleton = spectator.query('ion-skeleton-text');
      expect(skeleton).toBeTruthy();
    });

    it('should show empty state when item is undefined and not loading', () => {
      component.isLoading.set(false);
      fixture.detectChanges();

      const emptyState = spectator.query('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(spectator.query('.empty-text')?.textContent).toContain('No parking information available');
    });

    it('should render card with data when item is set', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const card = spectator.query('.parking-card');
      expect(card).toBeTruthy();
    });

    it('should display date in header', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const dateElement = spectator.query('.date');
      expect(dateElement?.textContent).toContain(dayjs().format('MMMM'));
    });

    it('should display parking status', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const statusText = spectator.queryAll('.info-value')[0]?.textContent?.trim();
      expect(statusText).toBe('In Effect');
    });

    it('should display meter status', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const meterText = spectator.queryAll('.info-value')[1]?.textContent?.trim();
      expect(meterText).toBe('In Effect');
    });

    it('should show reason when rule is inactive and reason exists', () => {
      spectator.setInput('item', mockFeedInactive);
      fixture.detectChanges();

      const reasonItem = spectator.query('.reason-item');
      expect(reasonItem).toBeTruthy();
      expect(reasonItem?.textContent).toContain('Holiday');
    });

    it('should not show reason when rule is active', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const reasonItem = spectator.query('.reason-item');
      expect(reasonItem).toBeFalsy();
    });

    it('should show updated info when lastUpdated is true', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const updatedInfo = spectator.query('.updated-info');
      expect(updatedInfo).toBeTruthy();
      expect(updatedInfo?.textContent).toContain('Updated');
    });

    it('should not show updated info when lastUpdated is false', () => {
      spectator.setInput('item', mockFeedInactive);
      fixture.detectChanges();

      const updatedInfo = spectator.query('.updated-info');
      expect(updatedInfo).toBeFalsy();
    });

    it('should have correct aria-busy attribute when loading', () => {
      component.isLoading.set(true);
      fixture.detectChanges();

      const container = spectator.query('.card-container');
      expect(container?.getAttribute('aria-busy')).toBe('true');
    });

    it('should have correct aria-label for date', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const dateSpan = spectator.query('.date');
      const ariaLabel = dateSpan?.getAttribute('aria-label');
      expect(ariaLabel).toContain('Date:');
    });
  });

  describe('Signal Reactivity', () => {
    it('should update view when item changes', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      expect(component.detail()?.active).toBe(true);

      spectator.setInput('item', mockFeedInactive);
      fixture.detectChanges();

      expect(component.detail()?.active).toBe(false);
    });

    it('should update computed signals when item changes', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      expect(component.statusColor()).toBe('primary');

      spectator.setInput('item', mockFeedInactive);
      fixture.detectChanges();

      expect(component.statusColor()).toBe('danger');
    });

    it('should update view when isLoading changes', () => {
      component.isLoading.set(false);
      fixture.detectChanges();
      expect(spectator.query('ion-skeleton-text')).toBeFalsy();

      component.isLoading.set(true);
      fixture.detectChanges();
      expect(spectator.query('ion-skeleton-text')).toBeTruthy();
    });

    it('should update view when showBorder changes', () => {
      spectator.setInput('item', mockFeedActive);
      spectator.setInput('showBorder', true);
      fixture.detectChanges();

      expect(component.cardClasses()).not.toContain('no-border');

      spectator.setInput('showBorder', false);
      fixture.detectChanges();

      expect(component.cardClasses()).toContain('no-border');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle Feed with empty strings', () => {
      const emptyFeed: Feed = {
        id: 'empty',
        active: true,
        created: mockTimestamp,
        date: mockTimestamp,
        metered: false,
        reason: '',
        text: '',
        type: 'NYC'
      };

      spectator.setInput('item', emptyFeed);
      fixture.detectChanges();

      expect(component.detail()).toBeDefined();
      expect(component.detail()?.reason).toBe('');
      expect(component.detail()?.text).toBe('');
    });

    it('should handle rapid item changes', () => {
      for (let i = 0; i < 50; i++) {
        const feed: Feed = { ...mockFeedActive, id: `feed-${i}` };
        spectator.setInput('item', feed);
        fixture.detectChanges();
      }

      expect(component.detail()).toBeDefined();
      expect(component.detail()?.active).toBe(true);
    });

    it('should handle switching between Feed and Dayjs', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();
      expect(component.detail()?.type).toBe('NYC');

      const mockDate = dayjs();
      spectator.setInput('item', mockDate);
      fixture.detectChanges();
      expect(component.detail()?.type).toBeUndefined();

      spectator.setInput('item', mockFeedInactive);
      fixture.detectChanges();
      expect(component.detail()?.type).toBe('NYC');
    });

    it('should handle various Dayjs formats', () => {
      const dates = [
        dayjs(),
        dayjs('2025-01-01'),
        dayjs(new Date()),
        dayjs('2025-12-31T23:59:59'),
        dayjs().startOf('day'),
        dayjs().endOf('day')
      ];

      dates.forEach(date => {
        spectator.setInput('item', date);
        fixture.detectChanges();
        expect(component.detail()).toBeDefined();
        expect(component.detail()?.date).toMatch(/^[A-Z][a-z]+ \d{1,2}(st|nd|rd|th) \d{4}$/);
      });
    });

    it('should handle Feed with OTHER type', () => {
      const otherFeed: Feed = {
        ...mockFeedActive,
        type: 'OTHER'
      };

      spectator.setInput('item', otherFeed);
      fixture.detectChanges();

      expect(component.detail()?.type).toBe('OTHER');
    });

    it('should handle isLoading toggle multiple times', () => {
      for (let i = 0; i < 10; i++) {
        component.isLoading.set(i % 2 === 0);
        fixture.detectChanges();

        const skeleton = spectator.query('ion-skeleton-text');
        if (i % 2 === 0) {
          expect(skeleton).toBeTruthy();
        } else {
          expect(skeleton).toBeFalsy();
        }
      }
    });
  });

  describe('Type Safety', () => {
    it('should accept Feed type in item input', () => {
      const feed: Feed = mockFeedActive;
      expect(() => {
        spectator.setInput('item', feed);
        fixture.detectChanges();
      }).not.toThrow();
    });

    it('should accept Dayjs type in item input', () => {
      const date: Dayjs = dayjs();
      expect(() => {
        spectator.setInput('item', date);
        fixture.detectChanges();
      }).not.toThrow();
    });

    it('should maintain correct types in detail signal', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const detail = component.detail();
      expect(detail).toHaveProperty('active');
      expect(detail).toHaveProperty('created');
      expect(detail).toHaveProperty('date');
      expect(detail).toHaveProperty('metered');
      expect(detail).toHaveProperty('lastUpdated');
    });

    it('should handle Feed type property', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const detail = component.detail();
      expect(detail?.type).toBe('NYC');
    });
  });

  describe('Constants and Configuration', () => {
    it('should use correct date format constant', () => {
      const mockDate = dayjs('2025-01-15');
      spectator.setInput('item', mockDate);
      fixture.detectChanges();

      expect(component.detail()?.date).toBe('January 15th 2025');
    });

    it('should use correct meter status text constants', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();
      expect(component.meterStatus().text).toBe('In Effect');

      spectator.setInput('item', mockFeedInactive);
      fixture.detectChanges();
      expect(component.meterStatus().text).toBe('Not in Effect');
    });

    it('should use correct default values for Dayjs items', () => {
      const mockDate = dayjs();
      spectator.setInput('item', mockDate);
      fixture.detectChanges();

      const detail = component.detail();
      expect(detail?.active).toBe(true);
      expect(detail?.metered).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA roles', () => {
      const host = spectator.element;
      expect(host.getAttribute('role')).toBe('region');
    });

    it('should have descriptive aria-label', () => {
      const host = spectator.element;
      expect(host.getAttribute('aria-label')).toBe('Parking details card');
    });

    it('should update aria-busy when loading state changes', () => {
      component.isLoading.set(false);
      fixture.detectChanges();
      expect(spectator.query('.card-container')?.getAttribute('aria-busy')).toBe('false');

      component.isLoading.set(true);
      fixture.detectChanges();
      expect(spectator.query('.card-container')?.getAttribute('aria-busy')).toBe('true');
    });

    it('should provide date aria-label', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const dateSpan = spectator.query('.date');
      expect(dateSpan?.getAttribute('aria-label')).toMatch(/^Date: /);
    });

    it('should provide updated info aria-label', () => {
      spectator.setInput('item', mockFeedActive);
      fixture.detectChanges();

      const updatedInfo = spectator.query('.updated-info');
      expect(updatedInfo?.getAttribute('aria-label')).toMatch(/^Last updated /);
    });
  });
});
