import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { addIcons } from 'ionicons';
import { calendarOutline, timeOutline, notificationsOutline, arrowForward } from 'ionicons/icons';
import { IonContent, IonText, IonButton, IonIcon } from '@ionic/angular/standalone';

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
    addIcons({ calendarOutline, timeOutline, notificationsOutline, arrowForward });
  }

  async continue() {
    await Preferences.set({ key: 'intro', value: 'true' });
    this.router.navigate(['/']);
  }
}
