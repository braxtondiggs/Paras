import { computed, EnvironmentInjector, inject, Injectable, runInInjectionContext, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Analytics, setUserId, setUserProperties } from '@angular/fire/analytics';
import { Auth, authState, signInAnonymously, User } from '@angular/fire/auth';
import { doc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { traceUntilFirst } from '@angular/fire/performance';
import { Preferences } from '@capacitor/preferences';
import { shareReplay } from 'rxjs/operators';
import type { User as UserDocument } from '../types/firestore.types';
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
