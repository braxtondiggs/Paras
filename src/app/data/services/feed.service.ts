import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { traceUntilFirst } from '@angular/fire/performance';
import {
  collection,
  collectionData,
  CollectionReference,
  Firestore,
  limit,
  orderBy,
  query,
  where
} from '@angular/fire/firestore';
import { Dayjs } from 'dayjs';
import { Feed } from '@shared/interfaces';
import { DocumentData } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class FeedService {
  private readonly afs = inject(Firestore);

  get(start: Dayjs, end: Dayjs): Observable<Feed[]> {
    return collectionData<Feed>(
      query<Feed, DocumentData>(
        collection(this.afs, 'feed') as CollectionReference<Feed>,
        where('date', '>=', start.toDate()),
        where('date', '<', end.toDate()),
        where('type', '==', 'NYC')
      ),
      { idField: 'id' }
    ).pipe(
      traceUntilFirst('getFeed'),
      map((item: Feed[]) => item.filter(o => !o.active || !o.metered))
    );
  }

  getLast(): Observable<Feed> {
    return collectionData<Feed>(
      query<Feed, DocumentData>(
        collection(this.afs, 'feed') as CollectionReference<Feed>,
        limit(1),
        orderBy('date', 'desc')
      ),
      { idField: 'id' }
    ).pipe(
      take(1),
      map((items: Feed[]) => items[0]),
      traceUntilFirst('getLastFeedItem')
    );
  }
}
