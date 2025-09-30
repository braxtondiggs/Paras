import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Preferences } from '@capacitor/preferences';
import { of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import type { NotificationTime, OperationResult, Setting } from '../types/firestore.types';
import { AuthService } from './auth.service';
import { BaseFirestoreService } from './base-firestore.service';

// Default settings configuration
export const DEFAULT_SETTINGS: Omit<Setting, 'id' | 'createdAt' | 'updatedAt'> = {
  exceptionOnly: false,
  nextDay: 'none',
  nextDayCustom: '19:00',
  today: 'none',
  todayCustom: '09:00',
  token: '',
  type: 'NYC',
  weekend: false,
  darkMode: false
};

// Settings update interface
export interface SettingsUpdate {
  exceptionOnly?: boolean;
  nextDay?: NotificationTime;
  nextDayCustom?: string;
  today?: NotificationTime;
  todayCustom?: string;
  type?: 'NYC' | 'OTHER';
  weekend?: boolean;
  darkMode?: boolean;
  token?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService extends BaseFirestoreService<Setting> {
  protected readonly collectionName = 'users' as const;

  // Dependencies
  private readonly authService = inject(AuthService);

  // Reactive state
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _syncStatus = signal<'synced' | 'pending' | 'error'>('synced');

  // Settings stream - combines auth state with settings data
  public readonly settings$ = this.authService.user$.pipe(
    switchMap(user => {
      if (!user) {
        return of(null);
      }

      return this.getById(user.uid).pipe(
        map(settings => settings ?? null),
        catchError(error => {
          console.error('Failed to load settings:', error);
          this._error.set(error.message);
          // Return null on error
          return of(null);
        })
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // Convert settings to signals
  public readonly settingsSignal = toSignal(this.settings$, { initialValue: null });

  // Computed properties for easy access to specific settings
  public readonly darkMode = computed(() => this.settingsSignal()?.darkMode ?? false);
  public readonly notificationsEnabled = computed(() => !this.settingsSignal()?.exceptionOnly);
  public readonly weekendNotifications = computed(() => this.settingsSignal()?.weekend ?? false);
  public readonly notificationType = computed(() => this.settingsSignal()?.type ?? 'NYC');
  public readonly todayNotificationTime = computed(() => this.settingsSignal()?.today ?? 'am9');
  public readonly nextDayNotificationTime = computed(() => this.settingsSignal()?.nextDay ?? 'pm7');

  // Status signals
  public readonly isLoading = computed(() => this._isLoading());
  public readonly error = computed(() => this._error());
  public readonly syncStatus = computed(() => this._syncStatus());

  // Combined state for easier component consumption
  public readonly settingsState = computed(() => ({
    settings: this.settingsSignal(),
    isLoading: this.isLoading(),
    error: this.error(),
    syncStatus: this.syncStatus(),
    hasSettings: !!this.settingsSignal()
  }));

  async initializeSettings(): Promise<OperationResult> {
    const user = this.authService.userSignal();
    if (!user) {
      return {
        success: false,
        error: new Error('No authenticated user')
      };
    }

    this._isLoading.set(true);
    this._error.set(null);

    try {
      // Check if settings already exist
      const existingSettings = await this.getById(user.uid).toPromise();

      if (existingSettings) {
        this._isLoading.set(false);
        return { success: true };
      }

      // Create default settings for new user
      const defaultSettings = this.getDefaultSettingsForUser(user.uid);
      const result = await this.create(defaultSettings);

      if (result.success && result.data) {
        this._syncStatus.set('synced');
      }

      this._isLoading.set(false);
      return result;
    } catch (error) {
      console.error('Failed to initialize settings:', error);
      this._error.set((error as Error).message);
      this._syncStatus.set('error');
      this._isLoading.set(false);

      return {
        success: false,
        error: error as Error
      };
    }
  }

  async updateSettings(updates: SettingsUpdate): Promise<OperationResult> {
    const user = this.authService.userSignal();
    if (!user) {
      return {
        success: false,
        error: new Error('No authenticated user')
      };
    }

    this._isLoading.set(true);
    this._error.set(null);
    this._syncStatus.set('pending');

    try {
      // Update Firestore
      const result = await this.update(user.uid, updates);

      if (result.success) {
        // Update local preferences for critical settings
        await this.updateLocalPreferences(updates);
        this._syncStatus.set('synced');
      } else {
        this._syncStatus.set('error');
      }

      this._isLoading.set(false);
      return result;
    } catch (error) {
      console.error('Failed to update settings:', error);
      this._error.set((error as Error).message);
      this._syncStatus.set('error');
      this._isLoading.set(false);

      return {
        success: false,
        error: error as Error
      };
    }
  }

  clearError(): void {
    this._error.set(null);
  }

  // Private helper methods

  private getDefaultSettingsForUser(_uid: string): Omit<Setting, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      ...DEFAULT_SETTINGS
    };
  }

  private async updateLocalPreferences(updates: SettingsUpdate): Promise<void> {
    const promises: Promise<void>[] = [];

    if (updates.darkMode !== undefined) {
      promises.push(Preferences.set({ key: 'darkMode', value: String(updates.darkMode) }));
    }

    if (updates.token !== undefined) {
      promises.push(Preferences.set({ key: 'token', value: updates.token }));
    }

    // Store complete settings for offline access
    const currentSettings = this.settingsSignal();
    if (currentSettings) {
      const updatedSettings = { ...currentSettings, ...updates };
      promises.push(Preferences.set({ key: 'settings', value: JSON.stringify(updatedSettings) }));
    }

    await Promise.all(promises);
  }
}
