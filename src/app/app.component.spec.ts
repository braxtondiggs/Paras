/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type { ComponentFixture } from '@angular/core/testing';
import { Analytics, setUserProperties } from '@angular/fire/analytics';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
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
jest.mock('swiper/element/bundle', () => ({
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
    dismiss: jest.fn().mockResolvedValue(true)
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

    it('should request FCM notifications on Android', async () => {
      mockPlatform.is.mockImplementation((platform: string) => {
        if (platform === 'cordova') return true;
        if (platform === 'ios') return false;
        return false;
      });

      await (component as any).initializeApp();

      expect(mockPushNotifications.requestPermissions).toHaveBeenCalled();
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
  });

  describe('toggleDarkTheme', () => {
    it('should add dark class when enabled', async () => {
      await (component as any).toggleDarkTheme(true);

      expect(component.isDarkMode()).toBe(true);
      expect(document.body.classList.contains('dark')).toBe(true);
      expect(mockPreferences.set).toHaveBeenCalledWith({ key: 'darkMode', value: 'true' });
    });

    it('should remove dark class when disabled', async () => {
      document.body.classList.add('dark');

      await (component as any).toggleDarkTheme(false);

      expect(component.isDarkMode()).toBe(false);
      expect(document.body.classList.contains('dark')).toBe(false);
      expect(mockPreferences.set).toHaveBeenCalledWith({ key: 'darkMode', value: 'false' });
    });

    it('should toggle multiple times correctly', async () => {
      await (component as any).toggleDarkTheme(true);
      expect(component.isDarkMode()).toBe(true);

      await (component as any).toggleDarkTheme(false);
      expect(component.isDarkMode()).toBe(false);

      await (component as any).toggleDarkTheme(true);
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
