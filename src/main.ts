import { enableProdMode, importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { PreloadAllModules, provideRouter, RouteReuseStrategy, withPreloading } from '@angular/router';
import { provideIonicAngular, IonicRouteStrategy } from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';

import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { getFirestore, provideFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { provideAuth, getAuth, connectAuthEmulator } from '@angular/fire/auth';
import { provideAnalytics, getAnalytics, ScreenTrackingService, UserTrackingService } from '@angular/fire/analytics';
import { providePerformance, getPerformance } from '@angular/fire/performance';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { environment } from './environments/environment';

const platform = Capacitor.getPlatform();
const devHost =  platform === 'android' ? '10.0.2.2' : 'localhost';
if (environment.production) {
  enableProdMode();
}

const providers = [
  provideRouter(routes, withPreloading(PreloadAllModules)),
  { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
  provideIonicAngular({ mode: 'md', innerHTMLTemplatesEnabled: true }),
  importProvidersFrom(
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore( () => {
      const firestore = getFirestore()
      if (!environment.production) connectFirestoreEmulator(firestore, devHost, 8080);
      return (firestore);
    }),
    provideAuth(() => {
      const auth = getAuth();
      if (!environment.production) connectAuthEmulator(auth, `http://${devHost}:9099`, { disableWarnings: !environment.production });
      return (auth);
    }),
    provideAnalytics(() => getAnalytics()),
    providePerformance(() => getPerformance())
  )
];

bootstrapApplication(AppComponent, { 
  providers }).catch(err => console.error(err));