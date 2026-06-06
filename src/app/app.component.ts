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
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { AlertController, IonApp, IonRouterOutlet, Platform } from '@ionic/angular/standalone';
import { register } from 'swiper/element/bundle';

import { ThemeService } from '@core/services';

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
  private readonly theme = inject(ThemeService);
  public readonly environmentInjector = inject(EnvironmentInjector);

  // Signals for reactive state
  readonly isDarkMode = this.theme.isDarkMode;
  readonly isNetworkConnected = signal(true);
  readonly isAppReady = signal(false);

  ngOnInit() {
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
    const darkMode = await this.theme.initialize();

    runInInjectionContext(this.environmentInjector, () => {
      setUserProperties(this.analytics, { darkMode: darkMode.toString() });
    });
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
}
