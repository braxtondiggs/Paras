import { Preferences } from '@capacitor/preferences';
import { createServiceFactory, type SpectatorService } from '@ngneat/spectator/jest';

import { ThemeService } from './theme.service';

jest.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: jest.fn().mockResolvedValue({ value: null }),
    set: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('ThemeService', () => {
  let spectator: SpectatorService<ThemeService>;
  let service: ThemeService;

  const createService = createServiceFactory(ThemeService);

  const mockSystemPrefersDark = (matches: boolean): void => {
    (window.matchMedia as jest.Mock).mockReturnValue({ matches });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.classList.remove('dark');
    spectator = createService();
    service = spectator.service;
  });

  it('defaults to light mode', () => {
    expect(service.isDarkMode()).toBe(false);
  });

  describe('setDark', () => {
    it('enables dark mode: updates signal, body class and persists the preference', async () => {
      await service.setDark(true);

      expect(service.isDarkMode()).toBe(true);
      expect(document.body.classList.contains('dark')).toBe(true);
      expect(Preferences.set).toHaveBeenCalledWith({ key: 'darkMode', value: 'true' });
    });

    it('disables dark mode: clears signal, body class and persists the preference', async () => {
      await service.setDark(true);
      await service.setDark(false);

      expect(service.isDarkMode()).toBe(false);
      expect(document.body.classList.contains('dark')).toBe(false);
      expect(Preferences.set).toHaveBeenLastCalledWith({ key: 'darkMode', value: 'false' });
    });
  });

  describe('toggle', () => {
    it('flips the current theme on each call', async () => {
      await service.toggle();
      expect(service.isDarkMode()).toBe(true);

      await service.toggle();
      expect(service.isDarkMode()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('respects a stored dark preference', async () => {
      (Preferences.get as jest.Mock).mockResolvedValueOnce({ value: 'true' });

      const result = await service.initialize();

      expect(result).toBe(true);
      expect(service.isDarkMode()).toBe(true);
      expect(document.body.classList.contains('dark')).toBe(true);
    });

    it('respects a stored light preference', async () => {
      (Preferences.get as jest.Mock).mockResolvedValueOnce({ value: 'false' });

      const result = await service.initialize();

      expect(result).toBe(false);
      expect(service.isDarkMode()).toBe(false);
    });

    it('falls back to the system preference when none is stored and persists it', async () => {
      (Preferences.get as jest.Mock).mockResolvedValueOnce({ value: null });
      mockSystemPrefersDark(true);

      const result = await service.initialize();

      expect(result).toBe(true);
      expect(service.isDarkMode()).toBe(true);
      expect(Preferences.set).toHaveBeenCalledWith({ key: 'darkMode', value: 'true' });
    });

    it('defaults to light when no preference is stored and the system is light', async () => {
      (Preferences.get as jest.Mock).mockResolvedValueOnce({ value: null });
      mockSystemPrefersDark(false);

      const result = await service.initialize();

      expect(result).toBe(false);
      expect(service.isDarkMode()).toBe(false);
    });
  });
});
