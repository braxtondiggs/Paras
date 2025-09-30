import { ActivatedRoute, Router } from '@angular/router';
import { createComponentFactory, type Spectator } from '@ngneat/spectator/jest';

import { FeedService, type Feed } from '@core/services';
import { NavController, Platform } from '@ionic/angular';
import { ModalController } from '@ionic/angular/standalone';
import dayjs from 'dayjs';
import { of, throwError } from 'rxjs';

import { HomePage } from './home.page';

jest.mock('ionicons', () => ({
  addIcons: jest.fn()
}));

describe('HomePage', () => {
  let spectator: Spectator<HomePage>;
  let feedService: jest.Mocked<FeedService>;
  let modalController: jest.Mocked<ModalController>;
  let router: jest.Mocked<Router>;
  let platform: Platform;

  const createTimestamp = (value: string | Date) => ({
    toDate: () => (value instanceof Date ? value : new Date(value))
  });

  const createFeed = (overrides: Partial<Feed> = {}): Feed => ({
    id: overrides.id ?? 'feed-1',
    active: overrides.active ?? false,
    metered: overrides.metered ?? false,
    created: overrides.created ?? (createTimestamp('2024-03-01') as any),
    date: overrides.date ?? (createTimestamp('2024-03-10') as any),
    reason: overrides.reason ?? 'Reason',
    text: overrides.text ?? 'Text',
    type: overrides.type ?? 'NYC'
  });

  const createComponent = createComponentFactory({
    component: HomePage,
    detectChanges: false,
    shallow: true
  });

  beforeEach(() => {
    feedService = {
      getFeeds: jest.fn(),
      getLastDate: jest.fn()
    } as unknown as jest.Mocked<FeedService>;

    modalController = {
      create: jest.fn()
    } as unknown as jest.Mocked<ModalController>;

    router = {
      navigate: jest.fn(),
      url: '/home'
    } as unknown as jest.Mocked<Router>;

    platform = {
      backButton: {
        subscribeWithPriority: jest.fn()
      },
      ready: jest.fn().mockResolvedValue(undefined),
      is: jest.fn().mockReturnValue(false)
    } as unknown as Platform;

    spectator = createComponent({
      providers: [
        { provide: FeedService, useValue: feedService },
        { provide: ModalController, useValue: modalController },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: {}, url: of([]) } },
        { provide: Platform, useValue: platform },
        { provide: NavController, useValue: { setTopOutlet: jest.fn() } }
      ]
    });
  });

  it('initialises feed data and highlighted dates after view init', async () => {
    const feeds = [
      createFeed({ id: 'alpha' }),
      createFeed({ id: 'bravo', date: createTimestamp('2024-03-14') as any })
    ];

    feedService.getLastDate.mockReturnValue(of(createFeed({ date: createTimestamp('2024-05-20') as any })));
    feedService.getFeeds.mockReturnValue(of(feeds));

    await spectator.component.ngAfterViewInit();

    expect(feedService.getLastDate).toHaveBeenCalled();
    expect(feedService.getFeeds).toHaveBeenCalledWith(expect.objectContaining({ type: 'NYC' }));
    expect(spectator.component.items()).toHaveLength(2);
    expect(spectator.component.isLoading()).toBe(false);

    const highlighted = spectator.component.highlightedDates();
    expect(highlighted).toEqual([
      expect.objectContaining({ date: '2024-03-10' }),
      expect.objectContaining({ date: '2024-03-14' })
    ]);

    const expectedMaxDate = dayjs('2024-05-20').endOf('month').subtract(1, 'day').toISOString();
    expect(spectator.component.maxDate()).toBe(expectedMaxDate);
  });

  it('falls back to default max date when last date retrieval fails', async () => {
    feedService.getLastDate.mockReturnValue(throwError(() => new Error('firestore down')));
    feedService.getFeeds.mockReturnValue(of([createFeed()]));

    await spectator.component.ngAfterViewInit();

    expect(feedService.getLastDate).toHaveBeenCalled();
    expect(dayjs(spectator.component.maxDate()).isSame(dayjs().endOf('month').subtract(1, 'day'), 'day')).toBe(true);
  });

  it('opens modal with feed item when selecting an existing date', async () => {
    const present = jest.fn().mockResolvedValue(undefined);
    modalController.create.mockResolvedValue({ present } as any);

    spectator.component.items.set([createFeed({ id: 'match' })]);

    await spectator.component.onChange({
      detail: { value: dayjs('2024-03-10').toISOString() }
    } as any);

    expect(modalController.create).toHaveBeenCalledWith(
      expect.objectContaining({
        componentProps: expect.objectContaining({ modalData: expect.objectContaining({ id: 'match' }) })
      })
    );
    expect(present).toHaveBeenCalled();
  });

  it('toggles calendar view and updates router', () => {
    const slideTo = jest.fn();
    spectator.component['swiper'] = {
      nativeElement: { swiper: { slideTo } }
    } as any;

    spectator.component.switchCalenderView();
    expect(slideTo).toHaveBeenCalledWith(1, expect.any(Number));
    expect(router.navigate).toHaveBeenCalledWith(['/home/calendar'], { replaceUrl: true });

    spectator.component.switchCalenderView();
    expect(router.navigate).toHaveBeenLastCalledWith(['/home'], { replaceUrl: true });
  });
});
