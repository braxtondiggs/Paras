import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Centralizes dark/light mode handling so the `dark` body class, the persisted
 * preference and the reactive state stay in sync from a single place.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private static readonly STORAGE_KEY = 'darkMode';

  private readonly darkMode = signal(false);

  /** Reactive dark-mode state for templates and components. */
  readonly isDarkMode = this.darkMode.asReadonly();

  /**
   * Resolves and applies the initial theme. Uses the stored preference when
   * present, otherwise falls back to the OS color scheme and persists it.
   * Returns the resolved dark-mode value.
   */
  async initialize(): Promise<boolean> {
    const { value } = await Preferences.get({ key: ThemeService.STORAGE_KEY });
    const dark =
      value === null || value === undefined ? window.matchMedia('(prefers-color-scheme: dark)').matches : value === 'true';
    await this.setDark(dark);
    return dark;
  }

  /** Flips the current theme. */
  async toggle(): Promise<void> {
    await this.setDark(!this.darkMode());
  }

  /** Applies, persists and records the given dark-mode state. */
  async setDark(dark: boolean): Promise<void> {
    this.darkMode.set(dark);
    document.body.classList.toggle('dark', dark);
    await Preferences.set({ key: ThemeService.STORAGE_KEY, value: dark.toString() });
  }
}
