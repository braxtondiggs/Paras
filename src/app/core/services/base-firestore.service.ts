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
  query,
  QueryConstraint,
  serverTimestamp,
  setDoc,
  updateDoc
} from '@angular/fire/firestore';
import { traceUntilFirst } from '@angular/fire/performance';
import { Observable, throwError } from 'rxjs';
import { catchError, retry, shareReplay } from 'rxjs/operators';
import type { FirestoreCollection, FirestoreDocument, OperationResult } from '../types/firestore.types';

@Injectable({
  providedIn: 'root'
})
export abstract class BaseFirestoreService<T extends FirestoreDocument> {
  protected readonly firestore = inject(Firestore);
  protected abstract readonly collectionName: FirestoreCollection;
  protected readonly environmentInjector = inject(EnvironmentInjector);
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

  protected handleError(error: unknown): Observable<never> {
    console.error(`Firestore error in ${this.collectionName}:`, error);

    // Check for specific Firestore error codes
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const firestoreError = error as { code: string };
      if (firestoreError.code === 'unavailable') {
        console.warn('Firestore is offline, using cached data');
      }
    }

    return throwError(() => error);
  }
}
