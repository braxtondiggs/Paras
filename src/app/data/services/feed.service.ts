import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, take, shareReplay, catchError, retry, startWith } from 'rxjs/operators';
import { traceUntilFirst } from '@angular/fire/performance';
import {
  collection,
  collectionData,
  CollectionReference,
  Firestore,
  limit,
  orderBy,
  query,
  where,
  QueryConstraint,
  Timestamp,
  enableNetwork,
  disableNetwork
} from '@angular/fire/firestore';
import { Dayjs } from 'dayjs';
import { Feed } from '@shared/interfaces';
import { DocumentData } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class FeedService {
  private readonly firestore = inject(Firestore);

  // Cache for feed collection reference
  private readonly feedCollection = collection(this.firestore, 'feed') as CollectionReference<Feed>;

  // Reactive state for connection status
  private readonly isOffline = signal(false);

  get(start: Dayjs, end: Dayjs): Observable<Feed[]> {
    const constraints: QueryConstraint[] = [
      where('date', '>=', Timestamp.fromDate(start.toDate())),
      where('date', '<', Timestamp.fromDate(end.toDate())),
      where('type', '==', 'NYC'),
      orderBy('date', 'desc')
    ];

    return collectionData<Feed>(query<Feed, DocumentData>(this.feedCollection, ...constraints), { idField: 'id' }).pipe(
      traceUntilFirst('getFeed'),
      map((items: Feed[]) => this.filterActiveAndMetered(items)),
      catchError(error => {
        console.error('Feed fetch error:', error);
        this.handleOfflineState(true);
        return of([]); // Return empty array on error
      }),
      retry({ count: 2, delay: 1000 }),
      shareReplay(1),
      startWith([]) // Start with empty array for immediate UI feedback
    );
  }

  getLast(): Observable<Feed> {
    return collectionData<Feed>(query<Feed, DocumentData>(this.feedCollection, orderBy('date', 'desc'), limit(1)), {
      idField: 'id'
    }).pipe(
      take(1),
      map((items: Feed[]) => items[0]),
      traceUntilFirst('getLastFeedItem'),
      catchError(error => {
        console.error('Last feed item error:', error);
        throw error;
      })
    );
  }

  /**
   * Get feeds with caching and offline support
   */
  getCachedFeeds(start: Dayjs, end: Dayjs): Observable<Feed[]> {
    return this.get(start, end).pipe(
      shareReplay({
        bufferSize: 1,
        refCount: true
      })
    );
  }

  /**
   * Filter active and metered items
   */
  private filterActiveAndMetered(items: Feed[]): Feed[] {
    return items.filter(item => !item.active || !item.metered);
  }

  /**
   * Handle offline state
   */
  private async handleOfflineState(offline: boolean): Promise<void> {
    this.isOffline.set(offline);
    try {
      if (offline) {
        await disableNetwork(this.firestore);
      } else {
        await enableNetwork(this.firestore);
      }
    } catch (error) {
      console.warn('Network state change failed:', error);
    }
  }

  /**
   * Computed property for offline status
   */
  readonly offlineStatus = computed(() => this.isOffline());

  /**
   * Manually retry connection
   */
  async retryConnection(): Promise<void> {
    await this.handleOfflineState(false);
  }
}
