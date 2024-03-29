import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';


@Injectable({
  providedIn: 'root'
})
export class IntroGuard {
  private router: Router = inject(Router);
  async canActivate(): Promise<boolean> {
    const { value } = await Preferences.get({ key: 'intro' });
    if (value !== 'true') {
      this.router.navigate(['intro']);
      return false;
    }

    return true;
  }
}
