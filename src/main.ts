import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { PreloadAllModules, provideRouter, RouteReuseStrategy, withPreloading } from '@angular/router';
import { provideIonicAngular, IonicRouteStrategy } from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';

import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import {
  getFirestore,
  provideFirestore,
  connectFirestoreEmulator,
  enableMultiTabIndexedDbPersistence
} from '@angular/fire/firestore';
import { provideAuth, getAuth, connectAuthEmulator } from '@angular/fire/auth';
import { provideAnalytics, getAnalytics } from '@angular/fire/analytics';
import { providePerformance, getPerformance } from '@angular/fire/performance';
// import { initializeAppCheck, provideAppCheck, ReCaptchaV3Provider } from '@angular/fire/app-check';

import { AppComponent } from '@app/app.component';
import { routes } from '@app/app.routes';
import { environment } from '@environments/environment';

const platform = Capacitor.getPlatform();
const devHost = platform === 'android' ? '10.0.2.2' : 'localhost';
if (environment.production) {
  enableProdMode();
}

const providers = [
  provideRouter(routes, withPreloading(PreloadAllModules)),
  { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
  provideIonicAngular({ mode: 'md', innerHTMLTemplatesEnabled: true }),

  // Firebase providers with enhanced configuration
  provideFirebaseApp(() => initializeApp(environment.firebase)),

  provideFirestore(() => {
    const firestore = getFirestore();

    // Connect to emulator in development
    if (!environment.production) {
      try {
        connectFirestoreEmulator(firestore, devHost, 8080);
      } catch (error) {
        console.warn('Firestore emulator connection failed:', error);
      }
    }

    // Enable offline persistence (will be handled gracefully if already enabled)
    enableMultiTabIndexedDbPersistence(firestore).catch(error => {
      if (error.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time');
      } else if (error.code === 'unimplemented') {
        console.warn("Browser doesn't support persistence");
      }
    });

    return firestore;
  }),

  provideAuth(() => {
    const auth = getAuth();
    if (!environment.production) {
      try {
        connectAuthEmulator(auth, `http://${devHost}:9099`, {
          disableWarnings: true
        });
      } catch (error) {
        console.warn('Auth emulator connection failed:', error);
      }
    }
    return auth;
  }),

  // Analytics with support check
  provideAnalytics(() => getAnalytics()),

  providePerformance(() => getPerformance())

  // App Check for production security (optional - commented out until recaptcha key is configured)
  // ...(environment.production && environment.firebase.appId
  //   ? [
  //       provideAppCheck(() =>
  //         initializeAppCheck(undefined, {
  //           provider: new ReCaptchaV3Provider('your-recaptcha-site-key'),
  //           isTokenAutoRefreshEnabled: true
  //         })
  //       )
  //     ]
  //   : [])
];

bootstrapApplication(AppComponent, {
  providers
}).catch(err => console.error(err));
