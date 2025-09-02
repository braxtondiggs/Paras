import { Injectable, inject, computed } from '@angular/core';
import { Auth, signInAnonymously, User, authState } from '@angular/fire/auth';
import { Analytics, setUserId } from '@angular/fire/analytics';
import { doc, Firestore, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { lastValueFrom } from 'rxjs';
import { take, shareReplay } from 'rxjs/operators';
import { traceUntilFirst } from '@angular/fire/performance';
import { Preferences } from '@capacitor/preferences';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly analytics = inject(Analytics);
  private readonly firestore = inject(Firestore);

  // Modern reactive state with signals
  public readonly user$ = authState(this.auth).pipe(traceUntilFirst('auth'), shareReplay(1));

  // Convert to signal for easier consumption
  public readonly userSignal = toSignal(this.user$, { initialValue: null });

  // Computed properties for derived state
  public readonly isAuthenticated = computed(() => !!this.userSignal());
  public readonly userId = computed(() => this.userSignal()?.uid ?? null);

  async anonymousLogin() {
    try {
      const { user } = await signInAnonymously(this.auth);
      if (user) {
        await Preferences.set({ key: 'uid', value: user.uid });
        setUserId(this.analytics, user.uid);

        // Use serverTimestamp for better consistency
        return await setDoc(
          doc(this.firestore, `users/${user.uid}`),
          {
            uid: user.uid,
            created: serverTimestamp(),
            lastLogin: serverTimestamp(),
            version: 'v2.0.3'
          },
          { merge: true }
        );
      } else {
        await Preferences.set({ key: 'uid', value: 'null' });
        throw new Error('Anonymous login failed - no user returned');
      }
    } catch (error) {
      console.error('Anonymous login error:', error);
      await Preferences.set({ key: 'uid', value: 'null' });
      throw error;
    }
  }

  async getUser(): Promise<User | null> {
    return await lastValueFrom(this.user$.pipe(traceUntilFirst('getUser'), take(1)));
  }

  async uid(): Promise<string | null> {
    // Use computed signal value for better performance
    return this.userId();
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    try {
      await this.auth.signOut();
      await Preferences.remove({ key: 'uid' });
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  /**
   * Check if user session is valid
   */
  async isValidSession(): Promise<boolean> {
    try {
      const user = await this.getUser();
      return user !== null && !user.isAnonymous;
    } catch {
      return false;
    }
  }
}
