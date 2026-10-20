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
import { NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { SplashScreen } from '@capacitor/splash-screen';
import { AlertController, IonApp, IonRouterOutlet, Platform } from '@ionic/angular/standalone';
import { SettingsService, ThemeService } from '@core/services';
import { filter, race, take, timer } from 'rxjs';
import { register } from 'swiper/element';

register();

/** Upper bound on how long the native splash may cover the app if the first navigation never settles. */
const SPLASH_HIDE_TIMEOUT_MS = 10_000;

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
  private readonly settingsService = inject(SettingsService);
  private readonly themeService = inject(ThemeService);
  public readonly environmentInjector = inject(EnvironmentInjector);

  // Signals for reactive state
  readonly isDarkMode = this.themeService.isDark;
  readonly isNetworkConnected = signal(true);
  readonly isAppReady = signal(false);

  /** The "Network Error" alert while it is up; held as the create() promise so overlapping offline events share one alert. */
  private networkAlert?: Promise<HTMLIonAlertElement>;

  ngOnInit() {
    // Before anything async: a slow or failed platform.ready() must not leave the splash up.
    if (this.platform.is('cordova')) this.hideSplashAfterFirstRender();
    this.initializeApp();
    this.setTheme();
  }

  private async initializeApp() {
    await this.platform.ready();
    this.isAppReady.set(true);

    if (!this.platform.is('cordova')) return;

    const networkStatus = await Network.getStatus();
    this.isNetworkConnected.set(networkStatus.connected);
    if (!networkStatus.connected) await this.showNetworkAlert();

    // Listen for network changes to update offline state and keep the alert in step with the connection
    Network.addListener('networkStatusChange', async status => {
      this.isNetworkConnected.set(status.connected);
      try {
        if (status.connected) await this.dismissNetworkAlert();
        else await this.showNetworkAlert();
      } catch (error) {
        // The plugin does not await this callback, so a failing alert would otherwise be an unhandled rejection.
        console.error('Failed to update the network alert:', error);
      }
    });

    if (!this.platform.is('ios')) this.getFCMNotification();
  }

  private getFCMNotification() {
    PushNotifications.requestPermissions().then(result => {
      if (result.receive === 'granted') PushNotifications.register();
    });

    PushNotifications.addListener('registration', async (token: Token) => {
      await Preferences.set({ key: 'token', value: token.value });
      // The Cloud Function sends to the token on users/<uid>, so it must land there and not only in Preferences.
      const result = await this.settingsService.saveToken(token.value);
      if (!result.success) console.error('Failed to save the push token to the user document:', result.error);
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
      await this.themeService.setDark(systemDarkMode);

      runInInjectionContext(this.environmentInjector, () => {
        setUserProperties(this.analytics, { darkMode: systemDarkMode.toString() });
      });
    } else {
      // User has set a preference - respect it and don't listen to system changes
      const darkMode = value === 'true';
      await this.themeService.setDark(darkMode);

      runInInjectionContext(this.environmentInjector, () => {
        setUserProperties(this.analytics, { darkMode: darkMode.toString() });
      });
    }
  }

  /**
   * The native splash (launchAutoHide: false in capacitor.config.ts) stays up until the first navigation has
   * settled, so Angular's boot never shows as a blank frame. "Settled" includes cancelled and failed
   * navigations (a rejecting guard, a lazy chunk that won't load offline): the user must still reach whatever
   * the app can show. A timer bounds the wait in case no router event ever arrives, and if routing already
   * finished before we got here we hide immediately.
   */
  private hideSplashAfterFirstRender(): void {
    const hide = () => void SplashScreen.hide({ fadeOutDuration: 300 });

    if (this.router.navigated) {
      hide();
      return;
    }

    const firstNavigationSettled$ = this.router.events.pipe(
      filter(
        event => event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError
      )
    );

    race(firstNavigationSettled$, timer(SPLASH_HIDE_TIMEOUT_MS)).pipe(take(1)).subscribe(hide);
  }

  private async showNetworkAlert() {
    if (this.networkAlert) return;

    const pending = this.alert.create({
      header: 'Network Error',
      message: 'An Internet connection is required to use this application, please connect and try again.',
      backdropDismiss: false,
      keyboardClose: false
    });
    this.networkAlert = pending;

    let alert: HTMLIonAlertElement;
    try {
      alert = await pending;
    } catch (error) {
      if (this.networkAlert === pending) this.networkAlert = undefined;
      throw error;
    }

    // The alert has no buttons, so one that is no longer current must never stay on screen. It stops being
    // current when the connection comes back (and maybe drops again, which starts a newer alert) mid-create.
    if (this.networkAlert !== pending) return;

    void alert.onDidDismiss().then(() => {
      if (this.networkAlert === pending) this.networkAlert = undefined;
    });
    await alert.present();

    // Same check for a reconnect while the alert was being presented.
    if (this.networkAlert !== pending) await alert.dismiss();
  }

  private async dismissNetworkAlert() {
    // Forget the alert now rather than on onDidDismiss: if the connection drops again during the dismiss
    // animation, showNetworkAlert() must present a fresh alert instead of returning early.
    const pending = this.networkAlert;
    this.networkAlert = undefined;
    const alert = await pending;
    await alert?.dismiss();
  }
}
