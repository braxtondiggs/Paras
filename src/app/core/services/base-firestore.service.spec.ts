import { EnvironmentInjector, Injectable } from '@angular/core';
import { createServiceFactory, SpectatorService } from '@ngneat/spectator/jest';
import { lastValueFrom, of } from 'rxjs';

import {
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  Firestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type CollectionReference,
  type DocumentReference,
  type FieldValue,
  type QueryConstraint
} from '@angular/fire/firestore';
import { traceUntilFirst } from '@angular/fire/performance';
import type { FirestoreDocument } from '../types/firestore.types';
import { BaseFirestoreService } from './base-firestore.service';

jest.mock('@angular/fire/firestore', () => ({
  collection: jest.fn(),
  collectionData: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  docData: jest.fn(),
  Firestore: class MockFirestore {},
  query: jest.fn(),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn()
}));

jest.mock('@angular/fire/performance', () => ({
  traceUntilFirst: jest.fn()
}));

interface TestDoc extends FirestoreDocument {
  name: string;
}

@Injectable()
class TestFirestoreService extends BaseFirestoreService<TestDoc> {
  protected readonly collectionName = 'feed';

  public exposeHandleError(error: unknown) {
    return this.handleError(error);
  }
}

describe('BaseFirestoreService', () => {
  let spectator: SpectatorService<TestFirestoreService>;
  let firestoreStub: Record<string, unknown>;

  const createService = createServiceFactory({
    service: TestFirestoreService,
    providers: [
      { provide: Firestore, useFactory: () => firestoreStub },
      {
        provide: EnvironmentInjector,
        useValue: {
          runInContext: <T>(fn: () => T) => fn()
        } as EnvironmentInjector
      }
    ]
  });

  const collectionMock = jest.mocked(collection);
  const docMock = jest.mocked(doc);
  const collectionDataMock = jest.mocked(collectionData);
  const docDataMock = jest.mocked(docData);
  const setDocMock = jest.mocked(setDoc);
  const updateDocMock = jest.mocked(updateDoc);
  const deleteDocMock = jest.mocked(deleteDoc);
  const queryMock = jest.mocked(query);
  const traceUntilFirstMock = jest.mocked(traceUntilFirst);
  const serverTimestampMock = jest.mocked(serverTimestamp);

  const createCollectionRef = () => ({ path: 'collection-ref' }) as unknown as CollectionReference<TestDoc>;
  const docRefCache = new Map<string, DocumentReference<TestDoc>>();
  const getOrCreateDocRef = (id: string) => {
    if (!docRefCache.has(id)) {
      docRefCache.set(id, { id, path: `doc-${id}` } as unknown as DocumentReference<TestDoc>);
    }
    return docRefCache.get(id)!;
  };

  beforeEach(() => {
    firestoreStub = {};
    jest.clearAllMocks();

    docRefCache.clear();
    traceUntilFirstMock.mockImplementation(() => source$ => source$);
    (serverTimestampMock as jest.Mock).mockReturnValue('timestamp' as unknown as FieldValue);

    (collectionMock as jest.Mock).mockReturnValue(createCollectionRef());
    (docMock as jest.Mock).mockImplementation((...args: unknown[]) => {
      if (args.length === 1) {
        return getOrCreateDocRef(`generated-${docRefCache.size + 1}`);
      }
      const id = String(args[2]);
      return getOrCreateDocRef(id);
    });
    (collectionDataMock as jest.Mock).mockReturnValue(of([]));
    (docDataMock as jest.Mock).mockReturnValue(of(undefined));
    (queryMock as jest.Mock).mockImplementation((ref: unknown, ...constraints: QueryConstraint[]) => ({
      ref,
      constraints
    }));

    spectator = createService();
  });

  it('retrieves all documents with optional constraints', async () => {
    const documents: TestDoc[] = [
      { id: '1', name: 'Document 1' },
      { id: '2', name: 'Document 2' }
    ];
    const constraints = [{ field: 'name', operator: '==' } as unknown as QueryConstraint];
    const collectionRef = createCollectionRef();
    const queryRef = { fromQuery: true } as unknown;

    (collectionMock as jest.Mock).mockReturnValueOnce(collectionRef);
    (queryMock as jest.Mock).mockReturnValueOnce(queryRef);
    (collectionDataMock as jest.Mock).mockReturnValueOnce(of(documents));

    const result = await lastValueFrom(spectator.service.getAll(constraints));

    expect(result).toEqual(documents);
    expect(collectionMock).toHaveBeenCalledWith(firestoreStub, 'feed');
    expect(queryMock).toHaveBeenCalledWith(collectionRef, ...constraints);
    expect(collectionDataMock).toHaveBeenCalledWith(queryRef, { idField: 'id' });
    expect(traceUntilFirstMock).toHaveBeenCalledWith('get_all_feed');
  });

  it('retrieves a single document by id', async () => {
    const document: TestDoc = { id: 'doc-123', name: 'Primary' };
    (docDataMock as jest.Mock).mockReturnValueOnce(of(document));

    const result = await lastValueFrom(spectator.service.getById('doc-123'));

    expect(result).toEqual(document);
    expect(docMock).toHaveBeenCalledWith(firestoreStub, 'feed', 'doc-123');
    expect(docDataMock.mock.calls[0]).toEqual([getOrCreateDocRef('doc-123'), { idField: 'id' }]);
    expect(traceUntilFirstMock).toHaveBeenCalledWith('get_by_id_feed');
  });

  it('creates a document and returns generated id', async () => {
    const payload = { name: 'Fresh' } satisfies Omit<TestDoc, 'id' | 'createdAt' | 'updatedAt'>;
    const docRef = { id: 'new-doc', path: 'doc-new-doc' } as unknown as DocumentReference<TestDoc>;

    (docMock as jest.Mock).mockImplementationOnce(() => docRef);

    const result = await spectator.service.create(payload);

    expect(result).toEqual({ success: true, data: 'new-doc' });
    expect(setDocMock.mock.calls[0]).toEqual([
      docRef,
      {
        ...payload,
        id: 'new-doc',
        createdAt: 'timestamp',
        updatedAt: 'timestamp'
      }
    ]);
  });

  it('updates an existing document and refreshes updatedAt', async () => {
    const changes = { name: 'Updated' } satisfies Partial<Omit<TestDoc, 'id' | 'createdAt'>>;

    const result = await spectator.service.update('doc-7', changes);

    expect(result).toEqual({ success: true });
    expect(updateDocMock.mock.calls[0]).toEqual([
      getOrCreateDocRef('doc-7'),
      {
        ...changes,
        updatedAt: 'timestamp'
      }
    ]);
  });

  it('sets a document with merge defaults and optional create timestamp', async () => {
    const existing = { name: 'Existing' } satisfies Omit<TestDoc, 'id'>;

    await spectator.service.set('doc-9', existing);
    expect(setDocMock.mock.calls[0]).toEqual([
      getOrCreateDocRef('doc-9'),
      {
        ...existing,
        id: 'doc-9',
        updatedAt: 'timestamp'
      },
      { merge: true }
    ]);

    (setDocMock as jest.Mock).mockClear();

    await spectator.service.set('doc-10', existing, false);
    expect(setDocMock.mock.calls[0]).toEqual([
      getOrCreateDocRef('doc-10'),
      {
        ...existing,
        id: 'doc-10',
        updatedAt: 'timestamp',
        createdAt: 'timestamp'
      },
      { merge: false }
    ]);
  });

  it('deletes a document successfully', async () => {
    const result = await spectator.service.delete('doc-13');

    expect(result).toEqual({ success: true });
    expect((deleteDocMock as jest.Mock).mock.calls[0]).toEqual([getOrCreateDocRef('doc-13')]);
  });

  it('logs and rethrows errors via handleError', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failure = { code: 'unavailable', message: 'offline' };

    await expect(lastValueFrom(spectator.service.exposeHandleError(failure))).rejects.toBe(failure);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Firestore error in feed:', failure);
    expect(consoleWarnSpy).toHaveBeenCalledWith('Firestore is offline, using cached data');

    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
});
