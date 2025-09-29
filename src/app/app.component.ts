import {
  ChangeDetectionStrategy,
  Component,
  EnvironmentInjector,
  inject,
  OnInit,
  runInInjectionContext,
  signal
} from '@angular/core';
import { Analytics, setUserProperties } from '@angular/fire/analytics';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { AlertController, IonApp, IonRouterOutlet, Platform } from '@ionic/angular/standalone';
import { filter, map } from 'rxjs/operators';
import { register } from 'swiper/element/bundle';

register();

@Component({
  imports: [IonApp, IonRouterOutlet],
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['app.component.scss'],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  private readonly analytics = inject(Analytics);
  private readonly alert = inject(AlertController);
  private readonly platform = inject(Platform);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  public readonly environmentInjector = inject(EnvironmentInjector);

  // Signals for reactive state
  readonly isDarkMode = signal(false);
  readonly isNetworkConnected = signal(true);
  readonly isAppReady = signal(false);

  ngOnInit() {
    this.migrateData();
    this.initializeApp();
    this.setTheme();
    this.watchTitle();
  }

  private async initializeApp() {
    await this.platform.ready();
    this.isAppReady.set(true);

    if (!this.platform.is('cordova')) return;

    const networkStatus = await Network.getStatus();
    this.isNetworkConnected.set(networkStatus.connected);
    if (!networkStatus.connected) await this.showNetworkAlert();

    // Listen for network changes to update offline state
    Network.addListener('networkStatusChange', status => {
      this.isNetworkConnected.set(status.connected);
    });

    if (!this.platform.is('ios')) this.getFCMNotification();
  }

  private getFCMNotification() {
    PushNotifications.requestPermissions().then(result => {
      if (result.receive === 'granted') PushNotifications.register();
    });

    PushNotifications.addListener('registration', async (token: Token) => {
      await Preferences.set({ key: 'token', value: token.value });
    });

    PushNotifications.addListener('registrationError', async (error: unknown) => {
      const alert = await this.alert.create({
        header: 'ASP For NYC',
        message: 'Notification token registration failed, you may not be able to receive push notifications or alerts!',
        buttons: [
          {
            text: 'Dismiss',
            role: 'cancel',
            handler: async () => {
              await Preferences.set({ key: 'tokenFailure', value: 'true' });
              await Preferences.set({ key: 'tokenFailureError', value: String(error) });
            }
          }
        ]
      });

      await alert.present();
    });
  }

  private async setTheme() {
    const { value } = await Preferences.get({ key: 'darkMode' });

    // If user hasn't set a preference, use system preference as default
    if (value === null || value === undefined) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
      const systemDarkMode = prefersDark.matches;
      await Preferences.set({ key: 'darkMode', value: systemDarkMode.toString() });
      this.isDarkMode.set(systemDarkMode);
      this.toggleDarkTheme(systemDarkMode);

      runInInjectionContext(this.environmentInjector, () => {
        setUserProperties(this.analytics, { darkMode: systemDarkMode.toString() });
      });
    } else {
      // User has set a preference - respect it and don't listen to system changes
      const darkMode = value === 'true';
      this.isDarkMode.set(darkMode);
      this.toggleDarkTheme(darkMode);

      runInInjectionContext(this.environmentInjector, () => {
        setUserProperties(this.analytics, { darkMode: darkMode.toString() });
      });
    }
  }

  private async toggleDarkTheme(shouldAdd: boolean) {
    this.isDarkMode.set(shouldAdd);
    document.body.classList.toggle('dark', shouldAdd);
    await Preferences.set({ key: 'darkMode', value: shouldAdd.toString() });
  }

  private async showNetworkAlert() {
    const alert = await this.alert.create({
      header: 'Network Error',
      message: 'An Internet connection is required to use this application, please connect and try again.',
      backdropDismiss: false,
      keyboardClose: false
    });
    await alert.present();
  }

  private async migrateData() {
    const darkMode = localStorage.getItem('darkMode');
    if (localStorage.getItem('intro')) {
      await Preferences.set({ key: 'intro', value: 'true' });
      localStorage.removeItem('intro');
    }
    if (darkMode) {
      await Preferences.set({ key: 'darkMode', value: darkMode });
      localStorage.removeItem('darkMode');
    }
  }

  private watchTitle() {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(() => {
          let route: ActivatedRoute = this.router.routerState.root;
          let routeTitle = '';
          while (route?.firstChild) {
            route = route.firstChild;
          }
          if (route?.snapshot.data?.['title']) {
            routeTitle = route.snapshot.data['title'];
          }
          return routeTitle;
        })
      )
      .subscribe((title: string) => {
        if (title) this.title.setTitle(title);
      });
  }
}
