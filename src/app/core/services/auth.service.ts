import { computed, EnvironmentInjector, inject, Injectable, runInInjectionContext, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Analytics, setUserId, setUserProperties } from '@angular/fire/analytics';
import { Auth, authState, signInAnonymously, signOut, updateProfile, User } from '@angular/fire/auth';
import { doc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { traceUntilFirst } from '@angular/fire/performance';
import { Preferences } from '@capacitor/preferences';
import { EMPTY, Observable } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import type { OperationResult, User as UserDocument } from '../types/firestore.types';
import { BaseFirestoreService } from './base-firestore.service';

// Auth state interface
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  uid: string | null;
}

// Login result interface
export interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService extends BaseFirestoreService<UserDocument> {
  protected readonly collectionName = 'users' as const;

  // Firebase services
  private readonly auth = inject(Auth);
  private readonly analytics = inject(Analytics);
  protected readonly environmentInjector = inject(EnvironmentInjector);

  // Reactive state management
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Auth state stream with performance tracing
  public readonly user$ = authState(this.auth).pipe(
    traceUntilFirst('auth_state'),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // Convert auth state to signals for easier component consumption
  public readonly userSignal = toSignal(this.user$, { initialValue: null });

  // Computed properties for derived state
  public readonly isAuthenticated = computed(() => !!this.userSignal());
  public readonly uid = computed(() => this.userSignal()?.uid ?? null);
  public readonly isLoading = computed(() => this._isLoading());
  public readonly error = computed(() => this._error());
  public readonly isAnonymous = computed(() => this.userSignal()?.isAnonymous ?? false);

  // Combined auth state
  public readonly authState = computed(
    (): AuthState => ({
      user: this.userSignal(),
      isAuthenticated: this.isAuthenticated(),
      isLoading: this.isLoading(),
      uid: this.uid()
    })
  );

  async anonymousLogin(): Promise<LoginResult> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const { user } = await signInAnonymously(this.auth);

      if (!user) {
        throw new Error('Failed to create anonymous user');
      }

      // Store UID in preferences for offline access
      await Preferences.set({ key: 'uid', value: user.uid });

      // Set analytics user ID
      await runInInjectionContext(this.environmentInjector, async () => {
        setUserId(this.analytics, user.uid);
        setUserProperties(this.analytics, {
          user_type: 'anonymous',
          login_method: 'anonymous'
        });
      });

      // Create or update user document
      await this.createOrUpdateUserDocument(user);

      this._isLoading.set(false);
      return {
        success: true,
        user
      };
    } catch (error) {
      console.error('Anonymous login failed:', error);
      this._error.set((error as Error).message);
      this._isLoading.set(false);

      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  async signOutUser(): Promise<OperationResult> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      await signOut(this.auth);

      // Clear stored preferences
      await Promise.all([
        Preferences.remove({ key: 'uid' }),
        Preferences.remove({ key: 'token' }),
        Preferences.remove({ key: 'darkMode' })
      ]);

      // Clear analytics
      await runInInjectionContext(this.environmentInjector, async () => {
        setUserId(this.analytics, null);
      });

      this._isLoading.set(false);
      return { success: true };
    } catch (error) {
      console.error('Sign out failed:', error);
      this._error.set((error as Error).message);
      this._isLoading.set(false);

      return {
        success: false,
        error: error as Error
      };
    }
  }

  async updateUserProfile(profile: { displayName?: string; photoURL?: string }): Promise<OperationResult> {
    const user = this.userSignal();
    if (!user) {
      return {
        success: false,
        error: new Error('No authenticated user')
      };
    }

    try {
      await updateProfile(user, profile);

      // Update user document in Firestore
      await this.updateUserDocument(user.uid, profile);

      return { success: true };
    } catch (error) {
      console.error('Profile update failed:', error);
      return {
        success: false,
        error: error as Error
      };
    }
  }

  getUserDocument(uid: string): Observable<UserDocument | null> {
    return this.getById(uid).pipe(
      map(doc => doc ?? null),
      traceUntilFirst('get_user_document')
    );
  }

  getCurrentUserDocument(): Observable<UserDocument | null> {
    return this.user$.pipe(
      switchMap(user => {
        if (!user) return EMPTY;
        return this.getUserDocument(user.uid);
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  async userExists(uid: string): Promise<boolean> {
    return this.exists(uid);
  }

  async getStoredUID(): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key: 'uid' });
      return value;
    } catch (error) {
      console.error('Failed to get stored UID:', error);
      return null;
    }
  }

  async initializeAuth(): Promise<void> {
    const storedUID = await this.getStoredUID();
    const currentUser = this.userSignal();

    // If we have a stored UID but no current user, attempt anonymous login
    if (storedUID && !currentUser) {
      console.warn('🔐 Found stored UID but no current user, attempting anonymous login');
      await this.anonymousLogin();
    }
  }

  clearError(): void {
    this._error.set(null);
  }

  async refreshAuth(): Promise<void> {
    try {
      await this.auth.currentUser?.reload();
    } catch (error) {
      console.error('Failed to refresh auth:', error);
    }
  }

  // Private helper methods

  private async createOrUpdateUserDocument(user: User): Promise<void> {
    const timestamp = serverTimestamp();
    const userDoc = {
      uid: user.uid,
      created: timestamp,
      lastLogin: timestamp,
      version: '2.0.3', // App version
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await runInInjectionContext(this.environmentInjector, async () => {
      await setDoc(doc(this.firestore, `users/${user.uid}`), userDoc, { merge: true });
    });
  }

  private async updateUserDocument(uid: string, data: Partial<UserDocument>): Promise<void> {
    const updateData = {
      ...data,
      lastLogin: serverTimestamp()
    };

    await runInInjectionContext(this.environmentInjector, async () => {
      await setDoc(doc(this.firestore, `users/${uid}`), updateData, { merge: true });
    });
  }
}
