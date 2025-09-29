import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Preferences } from '@capacitor/preferences';
import { BehaviorSubject, of } from 'rxjs';
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

  // Local settings cache for offline support
  private readonly localSettings$ = new BehaviorSubject<Setting | null>(null);

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
          // Return cached settings on error
          return of(this.localSettings$.value ?? null);
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
        // Cache existing settings locally
        this.localSettings$.next(existingSettings);
        this._isLoading.set(false);
        return { success: true };
      }

      // Create default settings for new user
      const defaultSettings = this.getDefaultSettingsForUser(user.uid);
      const result = await this.create(defaultSettings);

      if (result.success && result.data) {
        // Get the created settings document
        const createdSettings$ = this.getById(result.data);
        createdSettings$.subscribe(settings => {
          if (settings) {
            this.localSettings$.next(settings);
          }
        });
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
        // Update local cache
        const currentSettings = this.localSettings$.value;
        if (currentSettings) {
          this.localSettings$.next({
            ...currentSettings,
            ...updates
          });
        }

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

  async toggleDarkMode(): Promise<OperationResult> {
    const newDarkMode = !this.darkMode();

    // Update local preference immediately for instant UI response
    await Preferences.set({ key: 'darkMode', value: String(newDarkMode) });

    return this.updateSettings({ darkMode: newDarkMode });
  }

  async updateNotificationToken(token: string): Promise<OperationResult> {
    return this.updateSettings({ token });
  }

  async toggleNotifications(): Promise<OperationResult> {
    return this.updateSettings({
      exceptionOnly: this.notificationsEnabled()
    });
  }

  async updateNotificationTimes(today: NotificationTime, nextDay: NotificationTime): Promise<OperationResult> {
    return this.updateSettings({ today, nextDay });
  }

  async resetToDefaults(): Promise<OperationResult> {
    const user = this.authService.userSignal();
    if (!user) {
      return {
        success: false,
        error: new Error('No authenticated user')
      };
    }

    const defaultSettings = this.getDefaultSettingsForUser(user.uid);
    return this.updateSettings(defaultSettings);
  }

  exportSettings(): Setting | null {
    const settings = this.settingsSignal();
    if (!settings) return null;

    // Ensure we have a complete Setting object with id
    return settings as Setting;
  }

  async importSettings(settings: Partial<Setting>): Promise<OperationResult> {
    // Remove readonly fields
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, ...importableSettings } = settings;
    return this.updateSettings(importableSettings);
  }

  async getOfflineSettings(): Promise<Setting | null> {
    try {
      const storedSettings = await Preferences.get({ key: 'settings' });
      return storedSettings.value ? JSON.parse(storedSettings.value) : null;
    } catch (error) {
      console.error('Failed to get offline settings:', error);
      return null;
    }
  }

  clearError(): void {
    this._error.set(null);
  }

  async syncSettings(): Promise<OperationResult> {
    const user = this.authService.userSignal();
    if (!user) {
      return {
        success: false,
        error: new Error('No authenticated user')
      };
    }

    this._isLoading.set(true);
    this._syncStatus.set('pending');

    try {
      const settings = await this.getById(user.uid).toPromise();

      if (settings) {
        this.localSettings$.next(settings);
        await Preferences.set({ key: 'settings', value: JSON.stringify(settings) });
        this._syncStatus.set('synced');
      }

      this._isLoading.set(false);
      return { success: true };
    } catch (error) {
      console.error('Failed to sync settings:', error);
      this._error.set((error as Error).message);
      this._syncStatus.set('error');
      this._isLoading.set(false);

      return {
        success: false,
        error: error as Error
      };
    }
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
