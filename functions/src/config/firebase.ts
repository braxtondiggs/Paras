import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
let app: ReturnType<typeof initializeApp>;
let db: FirebaseFirestore.Firestore;

export function initializeFirebase() {
  if (!app) {
    app = initializeApp();
    db = getFirestore();
    db.settings({ ignoreUndefinedProperties: true });
  }
  return { app, db };
}

export function getDb(): FirebaseFirestore.Firestore {
  if (!db) {
    initializeFirebase();
  }
  return db;
}