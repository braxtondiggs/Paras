import { createServiceFactory, type SpectatorService } from '@ngneat/spectator/jest';
import dayjs from 'dayjs';
import { lastValueFrom, of, throwError } from 'rxjs';
import { skip } from 'rxjs/operators';

import { disableNetwork, enableNetwork, Firestore, limit, orderBy, Timestamp, where } from '@angular/fire/firestore';
import { traceUntilFirst } from '@angular/fire/performance';
import type { Feed } from '../types/firestore.types';
import { FeedService } from './feed.service';

jest.mock('@angular/fire/firestore', () => {
  const Timestamp = { fromDate: jest.fn() };
  return {
    disableNetwork: jest.fn(),
    enableNetwork: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
    orderBy: jest.fn(),
    Timestamp,
    Firestore: class MockFirestore {}
  };
});

jest.mock('@angular/fire/performance', () => ({
  traceUntilFirst: jest.fn()
}));

describe('FeedService', () => {
  let spectator: SpectatorService<FeedService>;
  let firestoreStub: Record<string, unknown>;
  let consoleWarnSpy: jest.SpyInstance;

  const createService = createServiceFactory({
    service: FeedService
  });

  const whereMock = jest.mocked(where);
  const limitMock = jest.mocked(limit);
  const orderByMock = jest.mocked(orderBy);
  const disableNetworkMock = jest.mocked(disableNetwork);
  const enableNetworkMock = jest.mocked(enableNetwork);
  const traceUntilFirstMock = jest.mocked(traceUntilFirst);
  const timestampFromDateMock = Timestamp.fromDate as jest.Mock;

  const createFirestoreTimestamp = () =>
    ({
      toDate: () => new Date(),
      seconds: 0
    }) as any;

  const createFeed = (overrides: Partial<Feed> = {}): Feed => ({
    id: `feed-${Math.random().toString(36).slice(2, 8)}`,
    active: false,
    metered: false,
    created: createFirestoreTimestamp(),
    date: createFirestoreTimestamp(),
    reason: 'Test reason',
    text: 'Test text',
    type: 'NYC',
    ...overrides
  });

  beforeEach(() => {
    whereMock.mockImplementation((field, op, value) => ({ type: 'where', field, op, value }));
    limitMock.mockImplementation(count => ({ type: 'limit', count }));
    orderByMock.mockImplementation((field, direction) => ({ type: 'orderBy', field, direction }));
    disableNetworkMock.mockResolvedValue(undefined);
    enableNetworkMock.mockResolvedValue(undefined);
    traceUntilFirstMock.mockImplementation(() => source$ => source$);
    timestampFromDateMock.mockImplementation(date => ({ timestamp: date }));

    firestoreStub = {};
    spectator = createService({ providers: [{ provide: Firestore, useValue: firestoreStub }] });
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleWarnSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('filters out active and metered feeds and builds constraints correctly', async () => {
    const params = {
      startDate: dayjs('2024-01-01'),
      endDate: dayjs('2024-01-02'),
      type: 'NYC' as const,
      limit: 3
    };

    const feeds: Feed[] = [
      createFeed({ id: 'drop', active: true, metered: true }),
      createFeed({ id: 'keep-1', active: true, metered: false }),
      createFeed({ id: 'keep-2', active: false, metered: true })
    ];

    const getAllSpy = jest.spyOn(spectator.service, 'getAll').mockReturnValue(of(feeds));

    const result = await lastValueFrom(spectator.service.getFeeds(params).pipe(skip(1)));

    expect(result.map(feed => feed.id)).toEqual(['keep-1', 'keep-2']);
    expect(getAllSpy).toHaveBeenCalledTimes(1);

    expect(whereMock).toHaveBeenNthCalledWith(
      1,
      'date',
      '>=',
      expect.objectContaining({ timestamp: expect.any(Date) })
    );
    expect(whereMock).toHaveBeenNthCalledWith(2, 'date', '<', expect.objectContaining({ timestamp: expect.any(Date) }));
    expect(whereMock).toHaveBeenNthCalledWith(3, 'type', '==', 'NYC');
    expect(orderByMock).toHaveBeenCalledWith('date', 'desc');
    expect(limitMock).toHaveBeenCalledWith(3);
    expect(traceUntilFirstMock).toHaveBeenCalledWith('get_feeds');

    const firstTimestampArg = timestampFromDateMock.mock.calls[0][0] as Date;
    const secondTimestampArg = timestampFromDateMock.mock.calls[1][0] as Date;

    expect(dayjs(firstTimestampArg).isSame(params.startDate, 'millisecond')).toBe(true);
    expect(dayjs(secondTimestampArg).isSame(params.endDate, 'millisecond')).toBe(true);
  });

  it('returns cached feeds when Firestore read fails', async () => {
    const params = {
      startDate: dayjs('2024-03-10'),
      endDate: dayjs('2024-03-11'),
      type: 'NYC' as const
    };

    const cachedFeed = createFeed({ id: 'cached' });
    const getAllSpy = jest.spyOn(spectator.service, 'getAll');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    getAllSpy.mockReturnValueOnce(of([cachedFeed]));
    await lastValueFrom(spectator.service.getFeeds(params).pipe(skip(1)));

    const failure = new Error('Firestore unavailable');
    getAllSpy.mockReturnValueOnce(throwError(() => failure));

    const result = await lastValueFrom(spectator.service.getFeeds(params).pipe(skip(1)));

    expect(result).toEqual([cachedFeed]);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Feed fetch error:', failure);
    expect(getAllSpy).toHaveBeenCalledTimes(2);

    consoleErrorSpy.mockRestore();
  });

  it('toggles offline mode and updates last sync when re-enabling network', async () => {
    const referenceTime = new Date('2024-04-01T10:00:00Z');
    jest.useFakeTimers().setSystemTime(referenceTime);

    await spectator.service.setOfflineMode(true);

    expect(disableNetworkMock).toHaveBeenCalledWith(firestoreStub);
    expect(spectator.service.isOffline()).toBe(true);
    expect(spectator.service.lastSync()).toBeNull();

    await spectator.service.setOfflineMode(false);

    expect(enableNetworkMock).toHaveBeenCalledWith(firestoreStub);
    expect(spectator.service.isOffline()).toBe(false);
    expect(spectator.service.lastSync()).not.toBeNull();
    expect(spectator.service.lastSync()?.toISOString()).toBe(referenceTime.toISOString());
  });

  it('retries connection by forcing online mode', async () => {
    const setOfflineSpy = jest.spyOn(spectator.service, 'setOfflineMode').mockResolvedValue();

    await spectator.service.retryConnection();

    expect(setOfflineSpy).toHaveBeenCalledWith(false);
  });

  it('should get last feed date for specific type', async () => {
    const mockFeed = createFeed({ id: 'latest-feed' });
    const getAllSpy = jest.spyOn(spectator.service, 'getAll').mockReturnValue(of([mockFeed]));

    const result = await lastValueFrom(spectator.service.getLastDate('NYC'));

    expect(result).toEqual(mockFeed);
    expect(getAllSpy).toHaveBeenCalledWith([
      { type: 'where', field: 'type', op: '==', value: 'NYC' },
      { type: 'orderBy', field: 'date', direction: 'desc' },
      { type: 'limit', count: 1 }
    ]);
    expect(traceUntilFirstMock).toHaveBeenCalledWith('get_last_feed_item');
  });

  it('should return null when no feeds found for getLastDate', async () => {
    const getAllSpy = jest.spyOn(spectator.service, 'getAll').mockReturnValue(of([]));

    const result = await lastValueFrom(spectator.service.getLastDate('OTHER'));

    expect(result).toBeNull();
    expect(getAllSpy).toHaveBeenCalledWith([
      { type: 'where', field: 'type', op: '==', value: 'OTHER' },
      { type: 'orderBy', field: 'date', direction: 'desc' },
      { type: 'limit', count: 1 }
    ]);
  });

  it('should handle errors in getLastDate gracefully', async () => {
    const getAllSpy = jest.spyOn(spectator.service, 'getAll');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('Firestore error');
    getAllSpy.mockReturnValue(throwError(() => error));

    const result = await lastValueFrom(spectator.service.getLastDate());

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Latest feed fetch error:', error);

    consoleErrorSpy.mockRestore();
  });

  it('should handle network state change errors', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('Network state change failed');
    disableNetworkMock.mockRejectedValue(error);

    await spectator.service.setOfflineMode(true);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Network state change failed:', error);
    expect(spectator.service.isOffline()).toBe(true); // State should still update

    consoleErrorSpy.mockRestore();
  });

  it('should build query constraints without type filter', async () => {
    const params = {
      startDate: dayjs('2024-01-01'),
      endDate: dayjs('2024-01-02')
      // No type specified
    };

    const feeds: Feed[] = [createFeed({ id: 'test-feed' })];
    jest.spyOn(spectator.service, 'getAll').mockReturnValue(of(feeds));

    await lastValueFrom(spectator.service.getFeeds(params).pipe(skip(1)));

    expect(whereMock).toHaveBeenCalledTimes(2); // Only date constraints, no type constraint
    expect(orderByMock).toHaveBeenCalledWith('date', 'desc');
    expect(limitMock).not.toHaveBeenCalled(); // No limit specified
  });

  it('should clear cache and log warning', () => {
    // Set up some cached data first by calling a method that caches
    const params = {
      startDate: dayjs('2024-01-01'),
      endDate: dayjs('2024-01-02'),
      type: 'NYC' as const
    };

    const feeds: Feed[] = [createFeed()];
    jest.spyOn(spectator.service, 'getAll').mockReturnValue(of(feeds));

    // This should cache the data
    spectator.service.getFeeds(params).subscribe();

    // Verify cache has data (assuming it gets cached)
    spectator.service.clearCache();

    expect(consoleWarnSpy).toHaveBeenCalledWith('🔥 Feed cache cleared');
  });

  it('should return empty array when no cached data and error occurs', async () => {
    const params = {
      startDate: dayjs('2024-01-01'),
      endDate: dayjs('2024-01-02'),
      type: 'NYC' as const
    };

    const getAllSpy = jest.spyOn(spectator.service, 'getAll');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('Network error');
    getAllSpy.mockReturnValue(throwError(() => error));

    const result = await lastValueFrom(spectator.service.getFeeds(params).pipe(skip(1)));

    expect(result).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Feed fetch error:', error);

    consoleErrorSpy.mockRestore();
  });

  it('should provide computed properties for state monitoring', () => {
    expect(spectator.service.isOffline()).toBe(false);
    expect(spectator.service.lastSync()).toBeNull();

    spectator.service['_offlineMode'].set(true);
    spectator.service['_lastSync'].set(new Date('2024-01-01'));

    expect(spectator.service.isOffline()).toBe(true);
    expect(spectator.service.lastSync()).toEqual(new Date('2024-01-01'));
  });
});
