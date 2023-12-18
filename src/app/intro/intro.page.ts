import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { IonContent, IonText, IonButton } from '@ionic/angular/standalone';

@Component({
  imports: [IonContent, IonText, IonButton],
  selector: 'app-intro',
  standalone: true,
  styleUrls: ['./intro.page.scss'],
  templateUrl: './intro.page.html',
})
export class IntroPage {
  private router: Router = inject(Router);

  async continue() {
    await Preferences.set({ key: 'intro', value: 'true' });
    this.router.navigate(['/']);
  }
}
