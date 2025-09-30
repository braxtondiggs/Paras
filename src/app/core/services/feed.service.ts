import { computed, EnvironmentInjector, inject, Injectable, runInInjectionContext, signal } from '@angular/core';
import {
  disableNetwork,
  enableNetwork,
  limit,
  orderBy,
  QueryConstraint,
  Timestamp,
  where
} from '@angular/fire/firestore';
import { traceUntilFirst } from '@angular/fire/performance';
import { Dayjs } from 'dayjs';
import { Observable, of } from 'rxjs';
import { catchError, map, retry, shareReplay, startWith, tap } from 'rxjs/operators';
import type { Feed } from '../types/firestore.types';
import { BaseFirestoreService } from './base-firestore.service';

// Feed query parameters interface
export interface FeedQueryParams {
  startDate: Dayjs;
  endDate: Dayjs;
  type?: 'NYC' | 'OTHER';
  limit?: number;
}

// Feed statistics interface
export interface FeedStatistics {
  total: number;
  active: number;
  inactive: number;
  metered: number;
  lastUpdated: Date | null;
}

@Injectable({
  providedIn: 'root'
})
export class FeedService extends BaseFirestoreService<Feed> {
  protected readonly collectionName = 'feed' as const;
  protected readonly environmentInjector = inject(EnvironmentInjector);

  // Reactive state
  private readonly _offlineMode = signal(false);
  private readonly _lastSync = signal<Date | null>(null);
  private readonly _cache = new Map<string, Feed[]>();

  // Public computed properties
  readonly isOffline = computed(() => this._offlineMode());
  readonly lastSync = computed(() => this._lastSync());
  readonly cacheSize = computed(() => this._cache.size);

  getFeeds(params: FeedQueryParams): Observable<Feed[]> {
    const constraints = this.buildQueryConstraints(params);
    const cacheKey = this.getCacheKey(params);

    return this.getAll(constraints).pipe(
      traceUntilFirst('get_feeds'),
      map(feeds => feeds.filter(o => !o.active || !o.metered)),
      tap(feeds => this._cache.set(cacheKey, feeds)),
      catchError(error => {
        console.error('Feed fetch error:', error);
        return this.getFallbackData(cacheKey);
      }),
      retry({ count: 2, delay: 1000 }),
      shareReplay({ bufferSize: 1, refCount: true }),
      startWith([]) // Immediate UI feedback
    );
  }

  getLastDate(type: 'NYC' | 'OTHER' = 'NYC'): Observable<Feed | null> {
    const constraints = [where('type', '==', type), orderBy('date', 'desc'), limit(1)];

    return runInInjectionContext(this.environmentInjector, () => {
      return this.getAll(constraints).pipe(
        traceUntilFirst('get_last_feed_item'),
        map(feeds => feeds[0] || null),
        catchError(error => {
          console.error('Latest feed fetch error:', error);
          return of(null);
        })
      );
    });
  }

  async setOfflineMode(offline: boolean): Promise<void> {
    this._offlineMode.set(offline);

    try {
      if (offline) {
        await disableNetwork(this.firestore);
        console.warn('🔥 Firestore network disabled - offline mode active');
      } else {
        await enableNetwork(this.firestore);
        this._lastSync.set(new Date());
        console.warn('🔥 Firestore network enabled - online mode active');
      }
    } catch (error) {
      console.error('Network state change failed:', error);
    }
  }

  async retryConnection(): Promise<void> {
    await this.setOfflineMode(false);
  }

  clearCache(): void {
    this._cache.clear();
    console.warn('🔥 Feed cache cleared');
  }

  // Private helper methods

  private buildQueryConstraints(params: FeedQueryParams): QueryConstraint[] {
    const constraints: QueryConstraint[] = [
      where('date', '>=', Timestamp.fromDate(params.startDate.toDate())),
      where('date', '<', Timestamp.fromDate(params.endDate.toDate())),
      orderBy('date', 'desc')
    ];

    if (params.type) {
      constraints.push(where('type', '==', params.type));
    }

    if (params.limit) {
      constraints.push(limit(params.limit));
    }

    return constraints;
  }

  private getCacheKey(params: FeedQueryParams): string {
    return `${params.startDate.format('YYYY-MM-DD')}_${params.endDate.format('YYYY-MM-DD')}_${params.type ?? 'ALL'}`;
  }

  private getFallbackData(cacheKey: string): Observable<Feed[]> {
    const cachedData = this._cache.get(cacheKey);
    if (cachedData) {
      console.warn('🔥 Using cached data due to network error');
      return of(cachedData);
    }
    return of([]);
  }
}
