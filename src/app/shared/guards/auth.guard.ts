import { inject } from '@angular/core';
import { AuthService } from '@data/services';

export const authGuard = async (): Promise<boolean> => {
  const auth = inject(AuthService);
  const uid = await auth.uid();
  const isLoggedIn = !!uid;
  if (!isLoggedIn) {
    await auth.anonymousLogin();
  }
  return true;
};
