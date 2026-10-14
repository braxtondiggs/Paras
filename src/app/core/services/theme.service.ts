import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

// Single owner of the dark/light theme: the body class, the reactive flag and the persisted preference
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  readonly isDark = signal(false);

  async setDark(dark: boolean): Promise<void> {
    this.isDark.set(dark);
    document.body.classList.toggle('dark', dark);
    await Preferences.set({ key: 'darkMode', value: dark.toString() });
  }

  async toggle(): Promise<void> {
    await this.setDark(!this.isDark());
  }
}
