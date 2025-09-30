import { EnvironmentInjector } from '@angular/core';
import { createComponentFactory, type Spectator } from '@ngneat/spectator/jest';
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { NavController } from '@ionic/angular';
import { AlertController, LoadingController, Platform, ToastController } from '@ionic/angular/standalone';

import { Analytics, logEvent, setUserProperties } from '@angular/fire/analytics';
import { LaunchReview } from '@awesome-cordova-plugins/launch-review/ngx';
import { Preferences } from '@capacitor/preferences';
import { SettingsService } from '@core/services';
import type { Setting } from '@core/types/firestore.types';
import { EmailComposer } from 'capacitor-email-composer';

import { SettingsPage } from './settings.page';

jest.mock('ionicons', () => ({
  addIcons: jest.fn()
}));

jest.mock('@capacitor/preferences', () => ({
  Preferences: {
    set: jest.fn(async () => undefined)
  }
}));

jest.mock('@angular/fire/analytics', () => ({
  Analytics: class MockAnalytics {},
  logEvent: jest.fn(),
  setUserProperties: jest.fn()
}));

jest.mock('@awesome-cordova-plugins/launch-review/ngx', () => ({
  LaunchReview: class LaunchReviewMock {
    isRatingSupported = jest.fn().mockReturnValue(true);
    launch = jest.fn(async () => undefined);
    rating = jest.fn().mockReturnValue({ subscribe: jest.fn() });
  }
}));

jest.mock('capacitor-email-composer', () => ({
  EmailComposer: {
    hasAccount: jest.fn(async () => ({ hasAccount: false })),
    open: jest.fn()
  }
}));

describe('SettingsPage', () => {
  let spectator: Spectator<SettingsPage>;
  let settingsService: jest.Mocked<SettingsService>;
  let alertController: { create: jest.Mock };
  let toastController: { create: jest.Mock };
  let loadingController: { create: jest.Mock };
  let platformMock: Platform;

  const overlayFactory = () => ({
    present: jest.fn(async () => undefined),
    dismiss: jest.fn(async () => undefined)
  });

  const launchReviewMock = {
    isRatingSupported: jest.fn().mockReturnValue(true),
    launch: jest.fn(async () => undefined),
    rating: jest.fn().mockReturnValue({ subscribe: jest.fn() })
  } as jest.Mocked<LaunchReview>;

  const initialSettings: Setting = {
    id: 'settings-id',
    today: 'custom',
    todayCustom: '09:30',
    nextDay: 'none',
    nextDayCustom: '18:15',
    exceptionOnly: true,
    weekend: true,
    darkMode: true,
    token: 'abc',
    type: 'NYC'
  };

  const createComponent = createComponentFactory({
    component: SettingsPage,
    detectChanges: false,
    shallow: true,
    providers: [
      { provide: LaunchReview, useValue: launchReviewMock },
      {
        provide: EnvironmentInjector,
        useValue: {
          runInContext: <T>(fn: () => T) => fn()
        } as EnvironmentInjector
      },
      {
        provide: Analytics,
        useValue: {} as Analytics
      }
    ]
  });

  beforeAll(() => {
    const storeMock = {
      register: jest.fn().mockReturnThis(),
      when: jest.fn().mockReturnValue({
        approved: jest.fn().mockReturnValue({
          verified: jest.fn().mockReturnValue(undefined)
        })
      }),
      initialize: jest.fn(),
      get: jest.fn().mockReturnValue({
        getOffer: jest.fn().mockReturnValue({ order: jest.fn() })
      })
    };

    (globalThis as any).CdvPurchase = {
      Platform: { GOOGLE_PLAY: 'google_play' },
      ProductType: { CONSUMABLE: 'consumable' },
      store: storeMock
    };
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    platformMock = {
      is: jest.fn().mockReturnValue(false),
      ready: jest.fn(async () => undefined)
    } as unknown as Platform;

    alertController = {
      create: jest.fn().mockImplementation(async () => overlayFactory())
    };
    toastController = {
      create: jest.fn().mockImplementation(async () => overlayFactory())
    };
    loadingController = {
      create: jest.fn().mockImplementation(async () => overlayFactory())
    };

    settingsService = {
      settingsSignal: jest.fn().mockReturnValue(initialSettings),
      updateSettings: jest.fn(async () => ({ success: true }))
    } as unknown as jest.Mocked<SettingsService>;

    spectator = createComponent({
      providers: [
        { provide: SettingsService, useValue: settingsService },
        { provide: Platform, useValue: platformMock },
        { provide: AlertController, useValue: alertController },
        { provide: NavController, useValue: {} },
        { provide: ToastController, useValue: toastController },
        { provide: LoadingController, useValue: loadingController }
      ]
    });

    await spectator.component.ngOnInit();
  });

  it('loads persisted settings on init and updates signals', () => {
    expect(loadingController.create).toHaveBeenCalled();
    expect(settingsService.settingsSignal).toHaveBeenCalled();
    expect(spectator.component.isLoading()).toBe(false);
    expect(spectator.component.settings().today).toBe('custom');
    expect(spectator.component.settingsForm().value.today).toBe('custom');
  });

  it('saves checkbox changes and logs analytics', async () => {
    settingsService.updateSettings.mockClear();

    await spectator.component.onCheckBoxChange({ detail: { checked: true } } as any, 'weekend');

    expect(settingsService.updateSettings).toHaveBeenCalledWith({ weekend: true });
    expect(toastController.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Your settings have been saved.' })
    );
    expect(jest.mocked(logEvent)).toHaveBeenCalledWith(expect.any(Object), 'custom_event', {
      action: 'weekend',
      active: 'true'
    });
    expect(jest.mocked(setUserProperties)).toHaveBeenCalledWith(expect.any(Object), {
      weekend: 'true'
    });
  });

  it('prevents saving when today notification time is too early', async () => {
    settingsService.updateSettings.mockClear();

    await spectator.component.onTodayChange('6:15AM');

    expect(alertController.create).toHaveBeenCalledWith(expect.objectContaining({ header: 'Invalid Time' }));
    expect(settingsService.updateSettings).not.toHaveBeenCalled();
  });
  it('updates today notification time when valid', async () => {
    settingsService.updateSettings.mockClear();

    spectator.component.settingsForm().patchValue({ today: 'custom' });

    await spectator.component.onTodayChange('8:45AM');

    expect(spectator.component.settings().todayCustom).toBe('8:45');
    expect(settingsService.updateSettings).toHaveBeenCalledWith({
      today: 'custom',
      todayCustom: '8:45'
    });
    expect(toastController.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Your settings have been saved.' })
    );
  });

  it('saves next day custom time when valid', async () => {
    settingsService.updateSettings.mockClear();

    spectator.component.settingsForm().patchValue({ nextDay: 'custom' });

    await spectator.component.onNextDateChange('5:30PM');

    expect(spectator.component.settings().nextDayCustom).toBe('17:30');
    expect(settingsService.updateSettings).toHaveBeenCalledWith({
      nextDay: 'custom',
      nextDayCustom: '17:30'
    });
  });

  it('prevents saving when next day notification time is too early', async () => {
    settingsService.updateSettings.mockClear();
    alertController.create.mockClear();

    await spectator.component.onNextDateChange('3:30PM');

    const lastCall = alertController.create.mock.calls[alertController.create.mock.calls.length - 1]?.[0];
    expect(lastCall).toEqual(expect.objectContaining({ header: 'Invalid Time' }));
    expect(settingsService.updateSettings).not.toHaveBeenCalled();
  });

  it('reverts today selection when cancelled', () => {
    spectator.component.settingsForm().controls['today'].setValue('immediately');

    spectator.component.onTodayCancel();

    expect(spectator.component.settingsForm().value.today).toBe(spectator.component.settings().today);
  });

  it('reverts next day selection when cancelled', () => {
    spectator.component.settingsForm().controls['nextDay'].setValue('custom');

    spectator.component.onNextDateCancel();

    expect(spectator.component.settingsForm().value.nextDay).toBe(spectator.component.settings().nextDay);
  });

  it('handles dark mode toggles and logs analytics', async () => {
    settingsService.updateSettings.mockClear();
    const toggleSpy = jest.spyOn(document.body.classList, 'toggle');

    await (
      spectator.component as unknown as { handleDarkModeChange: (value: boolean) => Promise<void> }
    ).handleDarkModeChange(true);

    expect(Preferences.set).toHaveBeenCalledWith({ key: 'darkMode', value: 'true' });
    expect(toggleSpy).toHaveBeenCalledWith('dark', true);
    expect(settingsService.updateSettings).toHaveBeenCalledWith({ darkMode: true });
    expect(jest.mocked(logEvent)).toHaveBeenCalledWith(expect.any(Object), 'custom_event', {
      action: 'dark mode',
      active: 'true'
    });
    expect(jest.mocked(setUserProperties)).toHaveBeenCalledWith(expect.any(Object), { darkMode: 'true' });

    toggleSpy.mockRestore();
  });

  it('falls back to in-app rating flow when native rating is unsupported', async () => {
    const ratingResult = { subscribe: jest.fn() };
    const originalLaunchReview = (spectator.component as any).launchReview;
    const customLaunchReview = {
      isRatingSupported: jest.fn().mockReturnValue(false),
      launch: jest.fn(),
      rating: jest.fn().mockReturnValue(ratingResult)
    };
    (spectator.component as any).launchReview = customLaunchReview;

    try {
      await spectator.component.rate();

      expect(customLaunchReview.isRatingSupported).toHaveBeenCalledTimes(1);
      expect(customLaunchReview.launch).not.toHaveBeenCalled();
      expect(customLaunchReview.rating).toHaveBeenCalledTimes(1);
      expect(ratingResult.subscribe).toHaveBeenCalled();
      expect(jest.mocked(logEvent)).toHaveBeenCalledWith(
        expect.any(Object),
        'custom_event',
        expect.objectContaining({
          action: 'rate'
        })
      );
      expect(jest.mocked(setUserProperties)).not.toHaveBeenCalled();
    } finally {
      (spectator.component as any).launchReview = originalLaunchReview;
    }
  });

  it('launches contact email composer when account exists', async () => {
    const emailComposer = EmailComposer as jest.Mocked<typeof EmailComposer>;
    emailComposer.hasAccount.mockResolvedValueOnce({ hasAccount: true });
    emailComposer.open.mockClear();
    const windowOpenSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    await spectator.component.about();

    const config = alertController.create.mock.calls[alertController.create.mock.calls.length - 1]?.[0] as any;
    const contactHandler = config.buttons.find((button: any) => button.text === 'Contact Us').handler;
    await contactHandler();

    expect(emailComposer.open).toHaveBeenCalledWith({
      to: ['hello@braxtondiggs.com'],
      subject: 'ASP for NYC',
      isHtml: false,
      body: ''
    });
    expect(windowOpenSpy).not.toHaveBeenCalled();

    windowOpenSpy.mockRestore();
  });

  it('opens mail client when no email account is present', async () => {
    const emailComposer = EmailComposer as jest.Mocked<typeof EmailComposer>;
    emailComposer.hasAccount.mockResolvedValueOnce({ hasAccount: false });
    emailComposer.open.mockClear();
    const windowOpenSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    await spectator.component.about();

    const config = alertController.create.mock.calls[alertController.create.mock.calls.length - 1]?.[0] as any;
    const contactHandler = config.buttons.find((button: any) => button.text === 'Contact Us').handler;
    await contactHandler();

    expect(windowOpenSpy).toHaveBeenCalledWith('mailto:hello@braxtondiggs.com?subject=ASP%20for%20NYC', '_system');
    expect(emailComposer.open).not.toHaveBeenCalled();

    windowOpenSpy.mockRestore();
  });

  it('invokes donation purchase flow', () => {
    const store = (globalThis as any).CdvPurchase.store;
    const orderSpy = jest.fn();
    const getOfferSpy = jest.fn().mockReturnValue({ order: orderSpy });
    store.get.mockReturnValueOnce({ getOffer: getOfferSpy } as any);
    spectator.component.store.set(store);

    (spectator.component as unknown as { handleDonation: () => void }).handleDonation();

    expect(store.get).toHaveBeenCalledWith('donation_99', 'google_play');
    expect(getOfferSpy).toHaveBeenCalled();
    expect(orderSpy).toHaveBeenCalled();
  });

  it('opens time picker and forwards selection to today change handler', async () => {
    const callCount = alertController.create.mock.calls.length;
    const onTodayChangeSpy = jest.spyOn(spectator.component, 'onTodayChange').mockResolvedValue();

    await spectator.component.openTimePicker('today');

    const config = alertController.create.mock.calls[callCount]?.[0] as any;
    expect(config.inputs[0].value).toBe(spectator.component.settings().todayCustom);

    const doneButton = config.buttons.find((button: any) => button.text === 'Done');
    await doneButton.handler({ time: '09:05' });

    expect(onTodayChangeSpy).toHaveBeenCalledWith('9:05 AM');

    onTodayChangeSpy.mockRestore();
  });

  it('opens time picker and forwards selection to next day change handler', async () => {
    const callCount = alertController.create.mock.calls.length;
    const onNextDateChangeSpy = jest.spyOn(spectator.component, 'onNextDateChange').mockResolvedValue();

    await spectator.component.openTimePicker('nextDay');

    const config = alertController.create.mock.calls[callCount]?.[0] as any;
    const doneButton = config.buttons.find((button: any) => button.text === 'Done');
    await doneButton.handler({ time: '21:15' });

    expect(onNextDateChangeSpy).toHaveBeenCalledWith('9:15 PM');

    onNextDateChangeSpy.mockRestore();
  });

  it('shows error toast when saving settings fails', async () => {
    settingsService.updateSettings.mockRejectedValueOnce(new Error('failure'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await spectator.component.onCheckBoxChange({ detail: { checked: false } } as any, 'weekend');

    expect(toastController.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'An error occurred while saving settings.',
        color: 'danger'
      })
    );

    consoleSpy.mockRestore();
  });
});
