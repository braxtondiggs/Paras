import { inject } from '@angular/core';
import { AuthService } from '@data/services';

export const authGuard = async (): Promise<boolean> => {
  const auth = inject(AuthService);

  try {
    // Use computed signal for better performance
    const isAuthenticated = auth.isAuthenticated();

    if (!isAuthenticated) {
      // Try anonymous login
      await auth.anonymousLogin();

      // Double-check authentication after login attempt
      const stillNotAuthenticated = !auth.isAuthenticated();
      if (stillNotAuthenticated) {
        console.error('Authentication failed');
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Auth guard error:', error);
    // Could redirect to an error page or retry mechanism
    return false;
  }
};
