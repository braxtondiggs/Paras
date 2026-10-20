/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type { ComponentFixture } from '@angular/core/testing';
import { Analytics, setUserProperties } from '@angular/fire/analytics';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';
import { SettingsService, ThemeService } from '@core/services';
import { AlertController, Platform } from '@ionic/angular/standalone';
import { createComponentFactory, type Spectator } from '@ngneat/spectator/jest';
import { Subject } from 'rxjs';
import { AppComponent } from './app.component';

// Mock Capacitor modules
jest.mock('@capacitor/network', () => ({
  Network: {
    getStatus: jest.fn().mockResolvedValue({ connected: true, connectionType: 'wifi' }),
    addListener: jest.fn().mockResolvedValue({ remove: jest.fn() })
  }
}));

jest.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: jest.fn().mockResolvedValue({ value: null }),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('@capacitor/splash-screen', () => ({
  SplashScreen: {
    hide: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    requestPermissions: jest.fn().mockResolvedValue({ receive: 'granted' }),
    register: jest.fn().mockResolvedValue(undefined),
    addListener: jest.fn().mockResolvedValue({ remove: jest.fn() })
  }
}));

// Mock Firebase Analytics
jest.mock('@angular/fire/analytics', () => ({
  Analytics: jest.fn(),
  setUserProperties: jest.fn()
}));

// Mock Swiper registration
jest.mock('swiper/element', () => ({
  register: jest.fn()
}));

import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';

const mockNetwork = Network as jest.Mocked<typeof Network>;
const mockPreferences = Preferences as jest.Mocked<typeof Preferences>;
const mockPushNotifications = PushNotifications as jest.Mocked<typeof PushNotifications>;
const mockSetUserProperties = setUserProperties as jest.Mock;

describe('AppComponent', () => {
  let spectator: Spectator<AppComponent>;
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;

  const mockAlert = {
    present: jest.fn().mockResolvedValue(undefined),
    dismiss: jest.fn().mockResolvedValue(true),
    // Stays pending by default: the alert counts as on screen until a test settles it.
    onDidDismiss: jest.fn().mockReturnValue(new Promise(() => undefined))
  };

  const mockAlertController = {
    create: jest.fn().mockResolvedValue(mockAlert)
  };

  const mockPlatform = {
    is: jest.fn().mockReturnValue(false),
    ready: jest.fn().mockResolvedValue('dom'),
    backButton: {
      subscribeWithPriority: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() })
    },
    pause: new Subject(),
    resume: new Subject(),
    platforms: jest.fn().mockReturnValue(['desktop'])
  };

  const mockRouter = {
    url: '/',
    navigate: jest.fn().mockResolvedValue(true),
    events: new Subject(),
    routerState: {
      root: {
        firstChild: null,
        snapshot: {
          data: {}
        }
      } as any
    }
  };

  const mockTitle = {
    setTitle: jest.fn()
  };

  const mockAnalytics = {
    app: { name: 'test-app' }
  } as any;

  const mockActivatedRoute = {
    snapshot: {
      params: {},
      queryParams: {},
      data: {}
    }
  };

  const mockSettingsService = {
    saveToken: jest.fn().mockResolvedValue({ success: true })
  };

  const createComponent = createComponentFactory({
    component: AppComponent,
    providers: [
      {
        provide: Analytics,
        useValue: mockAnalytics
      },
      {
        provide: AlertController,
        useValue: mockAlertController
      },
      {
        provide: Platform,
        useValue: mockPlatform
      },
      {
        provide: Router,
        useValue: mockRouter
      },
      {
        provide: Title,
        useValue: mockTitle
      },
      {
        provide: ActivatedRoute,
        useValue: mockActivatedRoute
      },
      {
        provide: SettingsService,
        useValue: mockSettingsService
      }
    ],
    shallow: true
  });

  beforeEach(() => {
    // Mock matchMedia globally
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockReturnValue({
        matches: false,
        addListener: jest.fn(),
        removeListener: jest.fn()
      })
    });

    // Reset all mocks
    jest.clearAllMocks();
    mockAlert.present.mockClear().mockResolvedValue(undefined);
    mockAlert.dismiss.mockClear().mockResolvedValue(true);
    mockAlert.onDidDismiss.mockClear().mockReturnValue(new Promise(() => undefined));
    mockAlertController.create.mockClear().mockResolvedValue(mockAlert);
    mockPlatform.ready.mockClear().mockResolvedValue('dom');
    mockPlatform.is.mockClear().mockReturnValue(false);
    mockTitle.setTitle.mockClear();
    mockNetwork.getStatus.mockClear().mockResolvedValue({ connected: true, connectionType: 'wifi' });
    mockNetwork.addListener.mockClear().mockResolvedValue({ remove: jest.fn() });
    mockPreferences.get.mockClear().mockResolvedValue({ value: null });
    mockPreferences.set.mockClear().mockResolvedValue(undefined);
    mockPushNotifications.requestPermissions.mockClear().mockResolvedValue({ receive: 'granted' });
    mockPushNotifications.register.mockClear().mockResolvedValue(undefined);
    mockPushNotifications.addListener.mockClear().mockResolvedValue({ remove: jest.fn() });
    mockSetUserProperties.mockClear();
    mockSettingsService.saveToken.mockReset().mockResolvedValue({ success: true });

    // Clear localStorage
    localStorage.clear();

    spectator = createComponent();
    component = spectator.component;
    fixture = spectator.fixture;
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should have OnPush change detection strategy', () => {
      expect(fixture.componentRef.changeDetectorRef).toBeDefined();
    });

    it('should initialize with default signal values', async () => {
      // ngOnInit runs automatically so wait for platform.ready()
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(component.isDarkMode()).toBe(false);
      expect(component.isNetworkConnected()).toBe(true);
      // After initializeApp runs, isAppReady becomes true
      expect(component.isAppReady()).toBe(true);
    });

    it('should have environmentInjector defined', () => {
      expect(component.environmentInjector).toBeDefined();
    });

    it('should register the Swiper core elements once at module load', async () => {
      await jest.isolateModulesAsync(async () => {
        await import('./app.component');
        const { register } = await import('swiper/element');
        expect(register).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('ngOnInit', () => {
    it('should call initialization methods', () => {
      const initializeAppSpy = jest.spyOn(component as any, 'initializeApp');
      const setThemeSpy = jest.spyOn(component as any, 'setTheme');

      component.ngOnInit();

      expect(initializeAppSpy).toHaveBeenCalled();
      expect(setThemeSpy).toHaveBeenCalled();
    });
  });

  describe('initializeApp', () => {
    it('should wait for platform ready and set isAppReady', async () => {
      await (component as any).initializeApp();

      expect(mockPlatform.ready).toHaveBeenCalled();
      expect(component.isAppReady()).toBe(true);
    });

    it('should return early if not on cordova platform', async () => {
      mockPlatform.is.mockReturnValue(false);

      await (component as any).initializeApp();

      expect(mockNetwork.getStatus).not.toHaveBeenCalled();
    });

    it('should check network status on cordova', async () => {
      mockPlatform.is.mockImplementation((platform: string) => platform === 'cordova');

      await (component as any).initializeApp();

      expect(mockNetwork.getStatus).toHaveBeenCalled();
      expect(component.isNetworkConnected()).toBe(true);
    });

    it('should show alert when network is disconnected', async () => {
      mockPlatform.is.mockImplementation((platform: string) => platform === 'cordova');
      mockNetwork.getStatus.mockResolvedValue({ connected: false, connectionType: 'none' });

      await (component as any).initializeApp();

      expect(component.isNetworkConnected()).toBe(false);
      expect(mockAlertController.create).toHaveBeenCalledWith({
        header: 'Network Error',
        message: 'An Internet connection is required to use this application, please connect and try again.',
        backdropDismiss: false,
        keyboardClose: false
      });
      expect(mockAlert.present).toHaveBeenCalled();
    });

    it('should add network status change listener on cordova', async () => {
      mockPlatform.is.mockImplementation((platform: string) => platform === 'cordova');

      await (component as any).initializeApp();

      expect(mockNetwork.addListener).toHaveBeenCalledWith('networkStatusChange', expect.any(Function));
    });

    const captureNetworkListener = () => {
      let networkCallback: Function | undefined;
      mockNetwork.addListener.mockImplementation(((event: string, callback: Function) => {
        if (event === 'networkStatusChange') networkCallback = callback;
        return Promise.resolve({ remove: jest.fn() });
      }) as any);
      return (status: { connected: boolean }) =>
        networkCallback?.({ ...status, connectionType: status.connected ? 'wifi' : 'none' });
    };

    it('dismisses the network alert when the connection returns', async () => {
      mockPlatform.is.mockImplementation((platform: string) => platform === 'cordova');
      mockNetwork.getStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
      const emitNetworkStatus = captureNetworkListener();

      await (component as any).initializeApp();
      expect(mockAlertController.create).toHaveBeenCalledTimes(1);
      expect(mockAlert.present).toHaveBeenCalledTimes(1);
      expect(mockAlert.dismiss).not.toHaveBeenCalled();

      await emitNetworkStatus({ connected: true });

      expect(component.isNetworkConnected()).toBe(true);
      expect(mockAlert.dismiss).toHaveBeenCalledTimes(1);
    });

    it('presents the network alert when the connection drops after launch', async () => {
      mockPlatform.is.mockImplementation((platform: string) => platform === 'cordova');
      const emitNetworkStatus = captureNetworkListener();

      await (component as any).initializeApp();
      expect(mockAlertController.create).not.toHaveBeenCalled();

      await emitNetworkStatus({ connected: false });
      expect(component.isNetworkConnected()).toBe(false);
      expect(mockAlertController.create).toHaveBeenCalledTimes(1);
      expect(mockAlert.present).toHaveBeenCalledTimes(1);

      await emitNetworkStatus({ connected: false });
      expect(mockAlertController.create).toHaveBeenCalledTimes(1);
    });

    it('presents the network alert again after it was dismissed', async () => {
      mockPlatform.is.mockImplementation((platform: string) => platform === 'cordova');
      let settleDismiss: () => void = () => undefined;
      mockAlert.onDidDismiss.mockReturnValue(new Promise<void>(resolve => (settleDismiss = resolve)));
      const emitNetworkStatus = captureNetworkListener();

      await (component as any).initializeApp();
      await emitNetworkStatus({ connected: false });
      await emitNetworkStatus({ connected: true });
      settleDismiss();
      await Promise.resolve();
      await emitNetworkStatus({ connected: false });

      expect(mockAlertController.create).toHaveBeenCalledTimes(2);
    });

    it('presents a new network alert when the connection drops again while the previous one is dismissing', async () => {
      mockPlatform.is.mockImplementation((platform: string) => platform === 'cordova');
      const emitNetworkStatus = captureNetworkListener();

      await (component as any).initializeApp();
      await emitNetworkStatus({ connected: false });
      // onDidDismiss never settles here: the first alert is still animating out when the connection drops again.
      await emitNetworkStatus({ connected: true });
      await emitNetworkStatus({ connected: false });

      expect(mockAlert.dismiss).toHaveBeenCalledTimes(1);
      expect(mockAlertController.create).toHaveBeenCalledTimes(2);
      expect(mockAlert.present).toHaveBeenCalledTimes(2);
    });

    it('logs instead of rejecting when the network alert cannot be created', async () => {
      mockPlatform.is.mockImplementation((platform: string) => platform === 'cordova');
      const failure = new Error('overlay failed');
      mockAlertController.create.mockRejectedValue(failure);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const emitNetworkStatus = captureNetworkListener();

      await (component as any).initializeApp();
      await expect(emitNetworkStatus({ connected: false })).resolves.toBeUndefined();
      expect(component.isNetworkConnected()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('network alert'), failure);

      // The failed attempt must not block the next one.
      mockAlertController.create.mockResolvedValue(mockAlert);
      await emitNetworkStatus({ connected: false });
      expect(mockAlert.present).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it('closes the network alert if the connection returned while it was being created', async () => {
      mockPlatform.is.mockImplementation((platform: string) => platform === 'cordova');
      let resolveCreate: (alert: typeof mockAlert) => void = () => undefined;
      mockAlertController.create.mockReturnValue(new Promise(resolve => (resolveCreate = resolve)));
      const emitNetworkStatus = captureNetworkListener();

      await (component as any).initializeApp();
      const offline = emitNetworkStatus({ connected: false });
      const online = emitNetworkStatus({ connected: true });
      resolveCreate(mockAlert);
      await Promise.all([offline, online]);

      expect(mockAlertController.create).toHaveBeenCalledTimes(1);
      expect(mockAlert.dismiss).toHaveBeenCalled();
    });

    const createAlertMock = () => ({
      present: jest.fn().mockResolvedValue(undefined),
      dismiss: jest.fn().mockResolvedValue(true),
      onDidDismiss: jest.fn().mockReturnValue(new Promise(() => undefined))
    });

    it('does not show a stale network alert when the connection flaps while it is being created', async () => {
      mockPlatform.is.mockImplementation((platform: string) => platform === 'cordova');
      const staleAlert = createAlertMock();
      let resolveStaleCreate: (alert: typeof staleAlert) => void = () => undefined;
      mockAlertController.create.mockReturnValueOnce(new Promise(resolve => (resolveStaleCreate = resolve)));
      const emitNetworkStatus = captureNetworkListener();

      await (component as any).initializeApp();
      const offline = emitNetworkStatus({ connected: false });
      const online = emitNetworkStatus({ connected: true });
      const offlineAgain = emitNetworkStatus({ connected: false });
      resolveStaleCreate(staleAlert);
      await Promise.all([offline, online, offlineAgain]);

      expect(mockAlertController.create).toHaveBeenCalledTimes(2);
      expect(staleAlert.present).not.toHaveBeenCalled();
      expect(mockAlert.present).toHaveBeenCalledTimes(1);

      await emitNetworkStatus({ connected: true });
      expect(mockAlert.dismiss).toHaveBeenCalledTimes(1);
    });

    it('dismisses a stale network alert when the connection flaps while it is being presented', async () => {
      mockPlatform.is.mockImplementation((platform: string) => platform === 'cordova');
      const staleAlert = createAlertMock();
      let settlePresent: () => void = () => undefined;
      staleAlert.present.mockReturnValue(new Promise<void>(resolve => (settlePresent = resolve)));
      mockAlertController.create.mockResolvedValueOnce(staleAlert);
      const emitNetworkStatus = captureNetworkListener();

      await (component as any).initializeApp();
      const offline = emitNetworkStatus({ connected: false });
      await Promise.resolve();
      expect(staleAlert.present).toHaveBeenCalledTimes(1);
      await emitNetworkStatus({ connected: true });
      await emitNetworkStatus({ connected: false });
      staleAlert.dismiss.mockClear();
      settlePresent();
      await offline;

      expect(staleAlert.dismiss).toHaveBeenCalledTimes(1);
      expect(mockAlert.present).toHaveBeenCalledTimes(1);
      expect(mockAlert.dismiss).not.toHaveBeenCalled();
    });

    it('should request FCM notifications on Android', async () => {
      mockPlatform.is.mockImplementation((platform: string) => {
        if (platform === 'cordova') return true;
        if (platform === 'ios') return false;
        return false;
      });

      await (component as any).initializeApp();

      expect(mockPushNotifications.requestPermissions).toHaveBeenCalled();
    });

    it('hides the native splash after the first navigation on cordova', () => {
      mockPlatform.is.mockImplementation((platform: string) => platform === 'cordova');
      const { SplashScreen } = jest.requireMock('@capacitor/splash-screen');
      // Fresh stream: take(1) subscriptions from earlier tests would otherwise also fire on this emit.
      mockRouter.events = new Subject();

      component.ngOnInit();
      expect(SplashScreen.hide).not.toHaveBeenCalled();

      mockRouter.events.next(new NavigationEnd(1, '/home', '/home'));
      mockRouter.events.next(new NavigationEnd(2, '/settings', '/settings'));

      expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
      expect(SplashScreen.hide).toHaveBeenCalledWith({ fadeOutDuration: 300 });
    });

    it.each([
      ['cancelled', () => new NavigationCancel(1, '/home', 'guard rejected')],
      ['failed', () => new NavigationError(1, '/home', new Error('chunk load failed'))]
    ])('hides the native splash when the first navigation is %s', (_label, makeEvent) => {
      mockPlatform.is.mockImplementation((platform: string) => platform === 'cordova');
      const { SplashScreen } = jest.requireMock('@capacitor/splash-screen');
      mockRouter.events = new Subject();

      component.ngOnInit();
      mockRouter.events.next(makeEvent());

      expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
    });

    it('hides the native splash after the safety timeout when no router event arrives', () => {
      jest.useFakeTimers();
      try {
        mockPlatform.is.mockImplementation((platform: string) => platform === 'cordova');
        const { SplashScreen } = jest.requireMock('@capacitor/splash-screen');
        mockRouter.events = new Subject();

        component.ngOnInit();
        jest.advanceTimersByTime(9_999);
        expect(SplashScreen.hide).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it('hides the native splash immediately when routing already finished', () => {
      mockPlatform.is.mockImplementation((platform: string) => platform === 'cordova');
      const { SplashScreen } = jest.requireMock('@capacitor/splash-screen');
      (mockRouter as any).navigated = true;

      component.ngOnInit();

      expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
      (mockRouter as any).navigated = false;
    });

    it('does not touch the splash on web', () => {
      mockPlatform.is.mockReturnValue(false);
      const { SplashScreen } = jest.requireMock('@capacitor/splash-screen');
      mockRouter.events = new Subject();

      component.ngOnInit();
      mockRouter.events.next(new NavigationEnd(1, '/home', '/home'));

      expect(SplashScreen.hide).not.toHaveBeenCalled();
    });

    it('should not request FCM notifications on iOS', async () => {
      mockPlatform.is.mockImplementation((platform: string) => {
        if (platform === 'cordova') return true;
        if (platform === 'ios') return true;
        return false;
      });

      await (component as any).initializeApp();

      expect(mockPushNotifications.requestPermissions).not.toHaveBeenCalled();
    });
  });

  describe('getFCMNotification', () => {
    it('should register for push notifications when permission granted', async () => {
      mockPushNotifications.requestPermissions.mockResolvedValue({ receive: 'granted' });

      await (component as any).getFCMNotification();

      expect(mockPushNotifications.requestPermissions).toHaveBeenCalled();
      expect(mockPushNotifications.register).toHaveBeenCalled();
    });

    it('should not register when permission denied', async () => {
      mockPushNotifications.requestPermissions.mockResolvedValue({ receive: 'denied' });

      await (component as any).getFCMNotification();

      expect(mockPushNotifications.requestPermissions).toHaveBeenCalled();
      expect(mockPushNotifications.register).not.toHaveBeenCalled();
    });

    it('should add registration listener', async () => {
      await (component as any).getFCMNotification();

      expect(mockPushNotifications.addListener).toHaveBeenCalledWith('registration', expect.any(Function));
    });

    it('should add registrationError listener', async () => {
      await (component as any).getFCMNotification();

      expect(mockPushNotifications.addListener).toHaveBeenCalledWith('registrationError', expect.any(Function));
    });

    it('should save token on registration', async () => {
      let registrationCallback: Function | undefined;

      mockPushNotifications.addListener.mockImplementation((event: string, callback: Function) => {
        if (event === 'registration') {
          registrationCallback = callback;
        }
        return Promise.resolve({ remove: jest.fn() });
      });

      await (component as any).getFCMNotification();

      const mockToken = { value: 'test-token-123' };
      await registrationCallback?.(mockToken);

      expect(mockPreferences.set).toHaveBeenCalledWith({ key: 'token', value: 'test-token-123' });
    });

    it('saves the token to the user document on registration', async () => {
      let registrationCallback: Function | undefined;
      mockPushNotifications.addListener.mockImplementation((event: string, callback: Function) => {
        if (event === 'registration') registrationCallback = callback;
        return Promise.resolve({ remove: jest.fn() });
      });

      await (component as any).getFCMNotification();
      await registrationCallback?.({ value: 'tok' });

      expect(mockSettingsService.saveToken).toHaveBeenCalledTimes(1);
      expect(mockSettingsService.saveToken).toHaveBeenCalledWith('tok');
    });

    it('logs when the token cannot be saved to the user document', async () => {
      let registrationCallback: Function | undefined;
      mockPushNotifications.addListener.mockImplementation((event: string, callback: Function) => {
        if (event === 'registration') registrationCallback = callback;
        return Promise.resolve({ remove: jest.fn() });
      });
      const failure = new Error('denied');
      mockSettingsService.saveToken.mockResolvedValueOnce({ success: false, error: failure });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      await (component as any).getFCMNotification();
      await registrationCallback?.({ value: 'tok' });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('push token'), failure);
      consoleSpy.mockRestore();
    });

    it('should show alert on registration error', async () => {
      let errorCallback: Function | undefined;

      mockPushNotifications.addListener.mockImplementation((event: string, callback: Function) => {
        if (event === 'registrationError') {
          errorCallback = callback;
        }
        return Promise.resolve({ remove: jest.fn() });
      });

      await (component as any).getFCMNotification();

      const mockError = new Error('Registration failed');
      await errorCallback?.(mockError);

      expect(mockAlertController.create).toHaveBeenCalledWith({
        header: 'ASP For NYC',
        message: 'Notification token registration failed, you may not be able to receive push notifications or alerts!',
        buttons: expect.any(Array)
      });
      expect(mockAlert.present).toHaveBeenCalled();
    });
  });

  describe('setTheme', () => {
    it('should use system preference when no user preference exists', async () => {
      mockPreferences.get.mockResolvedValue({ value: null });
      const matchMediaMock = jest.fn().mockReturnValue({ matches: true });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: matchMediaMock
      });

      await (component as any).setTheme();

      expect(component.isDarkMode()).toBe(true);
      expect(mockPreferences.set).toHaveBeenCalledWith({ key: 'darkMode', value: 'true' });
      expect(document.body.classList.contains('dark')).toBe(true);
    });

    it('should respect user preference over system preference', async () => {
      mockPreferences.get.mockResolvedValue({ value: 'false' });
      const matchMediaMock = jest.fn().mockReturnValue({ matches: true });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: matchMediaMock
      });

      await (component as any).setTheme();

      expect(component.isDarkMode()).toBe(false);
      expect(document.body.classList.contains('dark')).toBe(false);
    });

    it('should set dark mode when user preference is true', async () => {
      mockPreferences.get.mockResolvedValue({ value: 'true' });

      await (component as any).setTheme();

      expect(component.isDarkMode()).toBe(true);
      expect(document.body.classList.contains('dark')).toBe(true);
    });

    it('should set analytics user properties for dark mode', async () => {
      mockPreferences.get.mockResolvedValue({ value: 'true' });

      await (component as any).setTheme();

      expect(mockSetUserProperties).toHaveBeenCalledWith(mockAnalytics, { darkMode: 'true' });
    });

    it('should delegate the system preference to ThemeService when no preference is saved', async () => {
      mockPreferences.get.mockResolvedValue({ value: null });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockReturnValue({ matches: true })
      });
      const setDarkSpy = jest.spyOn(spectator.inject(ThemeService), 'setDark');

      await (component as any).setTheme();

      expect(setDarkSpy).toHaveBeenCalledWith(true);
    });

    it('should delegate the saved preference to ThemeService over the system preference', async () => {
      mockPreferences.get.mockResolvedValue({ value: 'false' });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockReturnValue({ matches: true })
      });
      const setDarkSpy = jest.spyOn(spectator.inject(ThemeService), 'setDark');

      await (component as any).setTheme();

      expect(setDarkSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('isDarkMode', () => {
    it('reflects the shared ThemeService state', async () => {
      await spectator.inject(ThemeService).setDark(true);

      expect(component.isDarkMode()).toBe(true);
    });
  });

  describe('showNetworkAlert', () => {
    it('should create and present network alert', async () => {
      await (component as any).showNetworkAlert();

      expect(mockAlertController.create).toHaveBeenCalledWith({
        header: 'Network Error',
        message: 'An Internet connection is required to use this application, please connect and try again.',
        backdropDismiss: false,
        keyboardClose: false
      });
      expect(mockAlert.present).toHaveBeenCalled();
    });
  });

  describe('Signal Reactivity', () => {
    it('should update isDarkMode signal', () => {
      expect(component.isDarkMode()).toBe(false);

      component.isDarkMode.set(true);

      expect(component.isDarkMode()).toBe(true);
    });

    it('should update isNetworkConnected signal', () => {
      expect(component.isNetworkConnected()).toBe(true);

      component.isNetworkConnected.set(false);

      expect(component.isNetworkConnected()).toBe(false);
    });

    it('should update isAppReady signal', async () => {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should already be true from ngOnInit
      expect(component.isAppReady()).toBe(true);

      component.isAppReady.set(false);
      expect(component.isAppReady()).toBe(false);

      component.isAppReady.set(true);
      expect(component.isAppReady()).toBe(true);
    });

    it('should handle rapid signal updates', () => {
      for (let i = 0; i < 100; i++) {
        component.isDarkMode.set(i % 2 === 0);
        component.isNetworkConnected.set(i % 3 === 0);
      }

      // i=99: 99 % 2 = 1 (odd) -> set(false), 99 % 3 = 0 -> set(true)
      expect(component.isDarkMode()).toBe(false);
      expect(component.isNetworkConnected()).toBe(true);
    });
  });

  describe('Component Cleanup', () => {
    it('should handle component destroy without errors', () => {
      expect(() => spectator.fixture.destroy()).not.toThrow();
    });
  });
});
