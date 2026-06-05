import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { IonButton, IonContent, IonIcon, IonText } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowForward, calendarOutline, moonOutline, notificationsOutline, timeOutline } from 'ionicons/icons';

@Component({
  imports: [IonContent, IonText, IonButton, IonIcon],
  selector: 'app-intro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./intro.page.scss'],
  templateUrl: './intro.page.html'
})
export class IntroPage {
  private readonly router = inject(Router);

  constructor() {
    addIcons({ calendarOutline, timeOutline, notificationsOutline, arrowForward, moonOutline });
  }

  async continue() {
    try {
      await Preferences.set({ key: 'intro', value: 'true' });
    } catch (error) {
      console.warn('Failed to save intro preference:', error);
    } finally {
      void this.router.navigate(['/']);
    }
  }
}
