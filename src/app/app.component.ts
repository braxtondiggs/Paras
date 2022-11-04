import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { Analytics, setUserProperties } from '@angular/fire/analytics';
import { Platform, AlertController } from '@ionic/angular';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { Network } from '@capacitor/network';
import { Storage } from '@capacitor/storage';
import { filter, map } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent {
  constructor(
    private alert: AlertController,
    private analytics: Analytics,
    private platform: Platform,
    private router: Router,
    private title: Title
  ) {
    this.migrateData();
    this.initializeApp();
    this.setTheme();
    this.watchTitle();
  }

  private async initializeApp() {
    await this.platform.ready();
    if (!this.platform.is('cordova')) return;
    if (!await Network.getStatus()) await this.showNetworkAlert();
    if (!this.platform.is('ios')) this.getFCMNotification();
  }

  private getFCMNotification() {
    PushNotifications.requestPermissions().then(result => {
      if (result.receive === 'granted') PushNotifications.register();
    });

    PushNotifications.addListener('registration', async (token: Token) => {
      await Storage.set({ key: 'token', value: token.value });
    });

    PushNotifications.addListener('registrationError', async (error: any) => {
      const alert = await this.alert.create({
        header: 'ASP For NYC',
        message: 'Notification token registration failed, you may not be able to receive push notifications or alerts!',
        buttons: [
          {
            text: 'Dismiss',
            role: 'cancel',
            handler: async () => {
              await Storage.set({ key: 'tokenFailure', value: 'true' });
              await Storage.set({ key: 'tokenFailureError', value: error.toString() });
            }
          }
        ]
      });

      await alert.present();
    });
  }

  private async setTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    const { value } = await Storage.get({ key: 'darkMode' });
    const darkMode = (value === 'true');
    if (darkMode) await Storage.set({ key: 'darkMode', value: prefersDark.matches.toString() });
    this.toggleDarkTheme(darkMode);
    setUserProperties(this.analytics, { darkMode: darkMode.toString() });
    prefersDark.addEventListener('change', (mediaQuery) => this.toggleDarkTheme(mediaQuery.matches));
  }

  private async toggleDarkTheme(shouldAdd: boolean) {
    document.body.classList.toggle('dark', shouldAdd);
    await Storage.set({ key: 'darkMode', value: shouldAdd.toString() });
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
    if (localStorage.getItem('intro')) { await Storage.set({ key: 'intro', value: 'true' }); localStorage.removeItem('intro'); }
    if (darkMode) { await Storage.set({ key: 'darkMode', value: darkMode }); localStorage.removeItem('darkMode'); }
  }

  private watchTitle() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd),
      map(() => {
        let route: ActivatedRoute = this.router.routerState.root;
        let routeTitle = '';
        while (route!.firstChild) {
          route = route.firstChild;
        }
        if (route.snapshot.data['title']) {
          routeTitle = route!.snapshot.data['title'];
        }
        return routeTitle;
      })).subscribe((title: string) => {
        if (title) this.title.setTitle(title);
      });
  }
}
