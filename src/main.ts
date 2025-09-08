import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { PreloadAllModules, provideRouter, RouteReuseStrategy, withPreloading } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { getAnalytics, provideAnalytics } from '@angular/fire/analytics';
import { getApp, initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { initializeAppCheck, provideAppCheck, ReCaptchaEnterpriseProvider } from '@angular/fire/app-check';
import { connectAuthEmulator, getAuth, provideAuth } from '@angular/fire/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  provideFirestore
} from '@angular/fire/firestore';
import { getFunctions, provideFunctions } from '@angular/fire/functions';
import { getMessaging, provideMessaging } from '@angular/fire/messaging';
import { getPerformance, providePerformance } from '@angular/fire/performance';

import { AppComponent } from '@app/app.component';
import { routes } from '@app/app.routes';
import { environment } from '@environments/environment';

// Initialize production mode
if (environment.production) {
  enableProdMode();
}

// Platform-specific configuration
const platform = Capacitor.getPlatform();
const emulatorHost = platform === 'android' ? '10.0.2.2' : 'localhost';

const providers = [
  provideRouter(routes, withPreloading(PreloadAllModules)),
  { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
  provideIonicAngular({ mode: 'md', innerHTMLTemplatesEnabled: true }),

  // Firebase App - Initialize first
  provideFirebaseApp(() => initializeApp(environment.firebase)),

  // Firestore with offline persistence and emulator support
  provideFirestore(() => {
    const firestore = initializeFirestore(getApp(), {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });

    // Connect to emulator in development (when available)
    if (!environment.production && environment.useEmulators) {
      try {
        connectFirestoreEmulator(firestore, emulatorHost, 8080);
        console.warn(`🔥 Connected to Firestore emulator at ${emulatorHost}:8080`);
      } catch (error) {
        console.warn('Firestore emulator connection failed:', error);
      }
    }

    return firestore;
  }),

  // Authentication with emulator support
  provideAuth(() => {
    const auth = getAuth();

    if (!environment.production && environment.useEmulators) {
      try {
        connectAuthEmulator(auth, `http://${emulatorHost}:9099`, {
          disableWarnings: true
        });
        console.warn(`🔐 Connected to Auth emulator at ${emulatorHost}:9099`);
      } catch (error) {
        console.warn('Auth emulator connection failed:', error);
      }
    }

    return auth;
  }),

  // Cloud Functions
  provideFunctions(() => getFunctions()),

  // Cloud Messaging for push notifications
  provideMessaging(() => getMessaging()),

  // Analytics - only in production or when explicitly enabled
  ...(environment.production || environment.enableAnalytics ? [provideAnalytics(() => getAnalytics())] : []),

  // Performance monitoring
  ...(environment.production || environment.enablePerformance ? [providePerformance(() => getPerformance())] : []),

  // App Check for production security
  ...(environment.production
    ? [
        provideAppCheck(() => {
          // TODO: Replace with your reCAPTCHA Enterprise site key from https://console.cloud.google.com/security/recaptcha
          const provider = new ReCaptchaEnterpriseProvider('your-recaptcha-site-key');
          return initializeAppCheck(undefined, {
            provider,
            isTokenAutoRefreshEnabled: true
          });
        })
      ]
    : [])
];

bootstrapApplication(AppComponent, {
  providers
}).catch(err => console.error('❌ Bootstrap failed:', err));
