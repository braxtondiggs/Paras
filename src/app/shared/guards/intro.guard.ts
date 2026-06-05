import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';

export const introGuard = async (): Promise<boolean> => {
  const router = inject(Router);

  try {
    const { value } = await Preferences.get({ key: 'intro' });
    if (value !== 'true') {
      void router.navigate(['intro']);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Failed to check intro preference:', error);
    void router.navigate(['intro']);
    return false;
  }
};
