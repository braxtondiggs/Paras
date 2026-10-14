import { Preferences } from '@capacitor/preferences';
import { createServiceFactory, type SpectatorService } from '@ngneat/spectator/jest';

import { ThemeService } from './theme.service';

jest.mock('@capacitor/preferences', () => ({
  Preferences: {
    set: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('ThemeService', () => {
  let spectator: SpectatorService<ThemeService>;
  const createService = createServiceFactory(ThemeService);

  beforeEach(() => {
    jest.mocked(Preferences.set).mockClear();
    document.body.classList.remove('dark');
    spectator = createService();
  });

  it('starts in light mode', () => {
    expect(spectator.service.isDark()).toBe(false);
    expect(document.body.classList.contains('dark')).toBe(false);
  });

  describe('setDark', () => {
    it('applies the dark class, updates state and persists the preference', async () => {
      await spectator.service.setDark(true);

      expect(spectator.service.isDark()).toBe(true);
      expect(document.body.classList.contains('dark')).toBe(true);
      expect(Preferences.set).toHaveBeenCalledWith({ key: 'darkMode', value: 'true' });
    });

    it('removes the dark class and persists false', async () => {
      document.body.classList.add('dark');

      await spectator.service.setDark(false);

      expect(spectator.service.isDark()).toBe(false);
      expect(document.body.classList.contains('dark')).toBe(false);
      expect(Preferences.set).toHaveBeenCalledWith({ key: 'darkMode', value: 'false' });
    });
  });

  describe('toggle', () => {
    it('flips state, class and persisted value on repeated calls', async () => {
      await spectator.service.toggle();

      expect(spectator.service.isDark()).toBe(true);
      expect(document.body.classList.contains('dark')).toBe(true);
      expect(Preferences.set).toHaveBeenLastCalledWith({ key: 'darkMode', value: 'true' });

      await spectator.service.toggle();

      expect(spectator.service.isDark()).toBe(false);
      expect(document.body.classList.contains('dark')).toBe(false);
      expect(Preferences.set).toHaveBeenLastCalledWith({ key: 'darkMode', value: 'false' });
    });
  });
});
