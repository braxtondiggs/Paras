import { Injectable, inject } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { Firestore, connectFirestoreEmulator, enableMultiTabIndexedDbPersistence } from '@angular/fire/firestore';
import { Auth, connectAuthEmulator } from '@angular/fire/auth';
import { Analytics } from '@angular/fire/analytics';
import { Performance } from '@angular/fire/performance';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FirebaseConfigService {
  private readonly app = inject(FirebaseApp);
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly analytics = inject(Analytics);
  private readonly performance = inject(Performance);

  private _initialized = false;

  async initialize(): Promise<void> {
    if (this._initialized) return;

    try {
      // Enable offline persistence for Firestore
      await this.enableOfflineSupport();

      // Connect to emulators in development
      if (!environment.production) {
        await this.connectEmulators();
      }

      this._initialized = true;
      console.log('Firebase services initialized successfully');
    } catch (error) {
      console.error('Firebase initialization error:', error);
      throw error;
    }
  }

  private async enableOfflineSupport(): Promise<void> {
    try {
      await enableMultiTabIndexedDbPersistence(this.firestore);
      console.log('Firestore offline persistence enabled');
    } catch (error) {
      if ((error as any)?.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time');
      } else if ((error as any)?.code === 'unimplemented') {
        console.warn("Browser doesn't support persistence");
      } else {
        console.error('Persistence error:', error);
      }
    }
  }

  private async connectEmulators(): Promise<void> {
    // Only connect to emulators once
    if (this._initialized) return;

    const platform = (window as any).Capacitor?.getPlatform?.() ?? 'web';
    const host = platform === 'android' ? '10.0.2.2' : 'localhost';

    try {
      // Connect Firestore emulator
      connectFirestoreEmulator(this.firestore, host, 8080);
      console.log(`Connected to Firestore emulator at ${host}:8080`);

      // Connect Auth emulator
      connectAuthEmulator(this.auth, `http://${host}:9099`, {
        disableWarnings: true
      });
      console.log(`Connected to Auth emulator at ${host}:9099`);
    } catch (error) {
      console.warn('Emulator connection failed:', error);
    }
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Get Firebase app instance
   */
  getApp(): FirebaseApp {
    return this.app;
  }

  /**
   * Get current project configuration
   */
  getProjectConfig() {
    return {
      projectId: environment.firebase.projectId,
      appId: environment.firebase.appId,
      apiKey: environment.firebase.apiKey,
      authDomain: environment.firebase.authDomain,
      storageBucket: environment.firebase.storageBucket
    };
  }
}
