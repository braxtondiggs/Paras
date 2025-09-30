import { EnvironmentInjector } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Preferences } from '@capacitor/preferences';
import { createServiceFactory, type SpectatorService } from '@ngneat/spectator/jest';
import { BehaviorSubject, firstValueFrom, of, throwError } from 'rxjs';
import { filter } from 'rxjs/operators';

import type { Setting } from '../types/firestore.types';
import { AuthService } from './auth.service';
import { DEFAULT_SETTINGS, SettingsService, type SettingsUpdate } from './settings.service';

jest.mock('@capacitor/preferences', () => ({
  Preferences: {
    set: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('SettingsService', () => {
  let spectator: SpectatorService<SettingsService>;
  let authServiceMock: {
    user$: BehaviorSubject<any>;
    userSignal: jest.Mock;
  };
  let getByIdSpy: jest.SpyInstance;
  let createSpy: jest.SpyInstance;
  let updateSpy: jest.SpyInstance;

  const mockUser = { uid: 'user-1', email: 'test@example.com' };
  const baseSetting: Setting = {
    id: mockUser.uid,
    today: 'none',
    todayCustom: '09:00',
    nextDay: 'none',
    nextDayCustom: '19:00',
    exceptionOnly: false,
    weekend: false,
    darkMode: false,
    token: 'token-1',
    type: 'NYC'
  };

  const createService = createServiceFactory({
    service: SettingsService,
    providers: [
      { provide: Firestore, useValue: {} },
      {
        provide: EnvironmentInjector,
        useValue: {
          runInContext: <T>(fn: () => T) => fn()
        } as EnvironmentInjector
      }
    ]
  });

  beforeEach(() => {
    jest.clearAllMocks();

    authServiceMock = {
      user$: new BehaviorSubject<any>(null),
      userSignal: jest.fn().mockReturnValue(null)
    };

    spectator = createService({
      providers: [{ provide: AuthService, useValue: authServiceMock }]
    });

    getByIdSpy = jest.spyOn(spectator.service, 'getById');
    createSpy = jest.spyOn(spectator.service, 'create');
    updateSpy = jest.spyOn(spectator.service, 'update');
  });

  const driveSettingsStream = async (setting: Setting | null) => {
    authServiceMock.userSignal.mockReturnValue(setting ? mockUser : null);
    getByIdSpy.mockReturnValue(of(setting));

    authServiceMock.user$.next(setting ? mockUser : null);

    await firstValueFrom(
      spectator.service.settings$.pipe(filter(value => (setting ? value?.id === setting.id : value === null)))
    );
  };

  it('creates service with default state', () => {
    expect(spectator.service).toBeTruthy();
    expect(spectator.service.isLoading()).toBe(false);
    expect(spectator.service.error()).toBeNull();
    expect(spectator.service.syncStatus()).toBe('synced');
    expect(spectator.service.settingsState()).toEqual({
      settings: null,
      isLoading: false,
      error: null,
      syncStatus: 'synced',
      hasSettings: false
    });
  });

  it('updates computed state when settings are loaded', async () => {
    await driveSettingsStream({ ...baseSetting, darkMode: true, weekend: true, exceptionOnly: false });

    expect(spectator.service.darkMode()).toBe(true);
    expect(spectator.service.notificationsEnabled()).toBe(true);
    expect(spectator.service.weekendNotifications()).toBe(true);
    expect(spectator.service.notificationType()).toBe('NYC');
    expect(spectator.service.settingsState()).toEqual({
      settings: expect.objectContaining({ id: mockUser.uid }),
      isLoading: false,
      error: null,
      syncStatus: 'synced',
      hasSettings: true
    });
  });

  it('short-circuits initializeSettings when user missing', async () => {
    const result = await spectator.service.initializeSettings();
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('No authenticated user');
    expect(getByIdSpy).not.toHaveBeenCalled();
  });

  it('returns success when settings already exist', async () => {
    authServiceMock.userSignal.mockReturnValue(mockUser);
    getByIdSpy.mockReturnValue(of(baseSetting));

    const result = await spectator.service.initializeSettings();

    expect(result).toEqual({ success: true });
    expect(getByIdSpy).toHaveBeenCalledWith(mockUser.uid);
    expect(createSpy).not.toHaveBeenCalled();
    expect(spectator.service.isLoading()).toBe(false);
  });

  it('creates default settings when none exist', async () => {
    authServiceMock.userSignal.mockReturnValue(mockUser);
    getByIdSpy.mockReturnValue(of(null));
    createSpy.mockResolvedValue({ success: true, data: mockUser.uid });

    const result = await spectator.service.initializeSettings();

    expect(result).toEqual({ success: true, data: mockUser.uid });
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining(DEFAULT_SETTINGS));
    expect(spectator.service.syncStatus()).toBe('synced');
    expect(spectator.service.isLoading()).toBe(false);
  });

  it('captures initialization errors', async () => {
    const failure = new Error('boom');
    authServiceMock.userSignal.mockReturnValue(mockUser);
    getByIdSpy.mockReturnValue(throwError(() => failure));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await spectator.service.initializeSettings();

    expect(result.success).toBe(false);
    expect(result.error).toBe(failure);
    expect(spectator.service.error()).toBe('boom');
    expect(spectator.service.syncStatus()).toBe('error');
    consoleSpy.mockRestore();
  });

  it('short-circuits updateSettings with missing user', async () => {
    const result = await spectator.service.updateSettings({ darkMode: true });
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('No authenticated user');
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('updates Firestore and local preferences', async () => {
    authServiceMock.userSignal.mockReturnValue(mockUser);
    updateSpy.mockResolvedValue({ success: true });

    const updates: SettingsUpdate = { darkMode: true, token: 'fresh-token' };
    const result = await spectator.service.updateSettings(updates);

    expect(result).toEqual({ success: true });
    expect(updateSpy).toHaveBeenCalledWith(mockUser.uid, updates);
    expect(Preferences.set).toHaveBeenNthCalledWith(1, { key: 'darkMode', value: 'true' });
    expect(Preferences.set).toHaveBeenNthCalledWith(2, { key: 'token', value: 'fresh-token' });
    expect(spectator.service.syncStatus()).toBe('synced');
    expect(spectator.service.isLoading()).toBe(false);
  });

  it('marks sync status as error when Firestore update fails', async () => {
    authServiceMock.userSignal.mockReturnValue(mockUser);
    updateSpy.mockResolvedValue({ success: false, error: new Error('denied') });

    const result = await spectator.service.updateSettings({ weekend: true });

    expect(result.success).toBe(false);
    expect(spectator.service.syncStatus()).toBe('error');
    expect(Preferences.set).not.toHaveBeenCalled();
  });

  it('records thrown update errors', async () => {
    authServiceMock.userSignal.mockReturnValue(mockUser);
    const failure = new Error('offline');
    updateSpy.mockRejectedValue(failure);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await spectator.service.updateSettings({ exceptionOnly: true });

    expect(result.success).toBe(false);
    expect(result.error).toBe(failure);
    expect(spectator.service.error()).toBe('offline');
    expect(spectator.service.syncStatus()).toBe('error');
    consoleSpy.mockRestore();
  });

  it('clears errors with clearError', () => {
    (spectator.service as any)._error.set('bad');
    spectator.service.clearError();
    expect(spectator.service.error()).toBeNull();
  });
});
