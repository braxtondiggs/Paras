import { EnvironmentInjector, inject, Injectable, runInInjectionContext } from '@angular/core';
import {
  collection,
  collectionData,
  CollectionReference,
  deleteDoc,
  doc,
  docData,
  DocumentReference,
  Firestore,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  QueryConstraint,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  writeBatch
} from '@angular/fire/firestore';
import { traceUntilFirst } from '@angular/fire/performance';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, retry, shareReplay } from 'rxjs/operators';
import type { FirestoreCollection, FirestoreDocument, OperationResult } from '../types/firestore.types';

@Injectable({
  providedIn: 'root'
})
export abstract class BaseFirestoreService<T extends FirestoreDocument> {
  protected readonly firestore = inject(Firestore);
  protected abstract readonly collectionName: FirestoreCollection;
  protected readonly environmentInjector = inject(EnvironmentInjector);

  // Connection status tracking
  private readonly connectionStatus$ = new BehaviorSubject<boolean>(true);
  public readonly isOnline$ = this.connectionStatus$.asObservable();

  // Get collection reference
  protected getCollection(): CollectionReference<T> {
    return collection(this.firestore, this.collectionName) as CollectionReference<T>;
  }

  // Get document reference
  protected getDocRef(id: string): DocumentReference<T> {
    return doc(this.firestore, this.collectionName, id) as DocumentReference<T>;
  }

  getAll(constraints: QueryConstraint[] = []): Observable<T[]> {
    const collectionRef = this.getCollection();
    const queryRef = constraints.length ? query(collectionRef, ...constraints) : collectionRef;
    return runInInjectionContext(this.environmentInjector, () => {
      return collectionData(queryRef, { idField: 'id' }).pipe(
        traceUntilFirst(`get_all_${this.collectionName}`),
        catchError(this.handleError.bind(this)),
        retry({ count: 2, delay: 1000 }),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    });
  }

  getById(id: string): Observable<T | undefined> {
    const docRef = this.getDocRef(id);

    return docData(docRef, { idField: 'id' }).pipe(
      traceUntilFirst(`get_by_id_${this.collectionName}`),
      catchError(this.handleError.bind(this)),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<OperationResult<string>> {
    try {
      const docRef = doc(this.getCollection());
      const timestamp = serverTimestamp();

      const documentData = {
        ...data,
        id: docRef.id,
        createdAt: timestamp,
        updatedAt: timestamp
      } as T;

      await setDoc(docRef, documentData);

      return {
        success: true,
        data: docRef.id
      };
    } catch (error) {
      console.error(`Error creating ${this.collectionName} document:`, error);
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async update(id: string, data: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<OperationResult> {
    try {
      const docRef = this.getDocRef(id);
      const updateData = {
        ...data,
        updatedAt: serverTimestamp()
      };

      await updateDoc(docRef, updateData);

      return { success: true };
    } catch (error) {
      console.error(`Error updating ${this.collectionName} document:`, error);
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async set(id: string, data: Omit<T, 'id'>, merge = true): Promise<OperationResult> {
    try {
      const docRef = this.getDocRef(id);
      const timestamp = serverTimestamp();

      const documentData = {
        ...data,
        id,
        updatedAt: timestamp,
        ...(merge ? {} : { createdAt: timestamp })
      } as T;

      await setDoc(docRef, documentData, { merge });

      return { success: true };
    } catch (error) {
      console.error(`Error setting ${this.collectionName} document:`, error);
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async delete(id: string): Promise<OperationResult> {
    try {
      const docRef = this.getDocRef(id);
      await deleteDoc(docRef);

      return { success: true };
    } catch (error) {
      console.error(`Error deleting ${this.collectionName} document:`, error);
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async batchWrite(
    operations: Array<{
      type: 'create' | 'update' | 'delete';
      id?: string;
      data?: Partial<T>;
    }>
  ): Promise<OperationResult> {
    try {
      const batch = writeBatch(this.firestore);
      const timestamp = serverTimestamp();

      operations.forEach(operation => {
        switch (operation.type) {
          case 'create': {
            const docRef = doc(this.getCollection());
            const data = {
              ...operation.data,
              id: docRef.id,
              createdAt: timestamp,
              updatedAt: timestamp
            } as T;
            batch.set(docRef, data);
            break;
          }
          case 'update': {
            if (!operation.id) throw new Error('ID required for update operation');
            const docRef = this.getDocRef(operation.id);
            const data = {
              ...operation.data,
              updatedAt: timestamp
            };
            batch.update(docRef, data);
            break;
          }
          case 'delete': {
            if (!operation.id) throw new Error('ID required for delete operation');
            const docRef = this.getDocRef(operation.id);
            batch.delete(docRef);
            break;
          }
        }
      });

      await batch.commit();
      return { success: true };
    } catch (error) {
      console.error(`Error in batch operation for ${this.collectionName}:`, error);
      return {
        success: false,
        error: error as Error
      };
    }
  }

  subscribe(
    constraints: QueryConstraint[] = [],
    callback: (data: T[]) => void,
    errorCallback?: (error: Error) => void
  ): Unsubscribe {
    const collectionRef = this.getCollection();
    const queryRef = constraints.length ? query(collectionRef, ...constraints) : collectionRef;

    return onSnapshot(queryRef, {
      next: snapshot => {
        const data = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as T[];
        callback(data);
      },
      error: error => {
        console.error(`Subscription error for ${this.collectionName}:`, error);
        this.connectionStatus$.next(false);
        errorCallback?.(error);
      }
    });
  }

  async exists(id: string): Promise<boolean> {
    try {
      const docRef = this.getDocRef(id);
      const snapshot = await getDoc(docRef);
      return snapshot.exists();
    } catch (error) {
      console.error(`Error checking document existence:`, error);
      return false;
    }
  }

  async count(constraints: QueryConstraint[] = []): Promise<number> {
    try {
      const collectionRef = this.getCollection();
      const queryRef = constraints.length ? query(collectionRef, ...constraints) : collectionRef;
      const snapshot = await getDocs(queryRef);
      return snapshot.size;
    } catch (error) {
      console.error(`Error counting documents:`, error);
      return 0;
    }
  }

  protected handleError(error: unknown): Observable<never> {
    console.error(`Firestore error in ${this.collectionName}:`, error);
    this.connectionStatus$.next(false);

    // Check for specific Firestore error codes
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const firestoreError = error as { code: string };
      if (firestoreError.code === 'unavailable') {
        console.warn('Firestore is offline, using cached data');
      }
    }

    return throwError(() => error);
  }

  protected updateConnectionStatus(isOnline: boolean): void {
    this.connectionStatus$.next(isOnline);
  }
}
