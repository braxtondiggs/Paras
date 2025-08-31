import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';

export const introGuard = async (): Promise<boolean> => {
  const router = inject(Router);
  const { value } = await Preferences.get({ key: 'intro' });
  if (value !== 'true') {
    router.navigate(['intro']);
    return false;
  }
  return true;
};
