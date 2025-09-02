import { Injectable } from '@angular/core';

// Mock Ionic Controllers
@Injectable({ providedIn: 'root' })
export class MockAlertController {
  create = jest.fn().mockResolvedValue({
    present: jest.fn().mockResolvedValue(undefined),
    dismiss: jest.fn().mockResolvedValue(undefined),
    onDidDismiss: jest.fn().mockResolvedValue({ role: null }),
  });
}

@Injectable({ providedIn: 'root' })
export class MockLoadingController {
  create = jest.fn().mockResolvedValue({
    present: jest.fn().mockResolvedValue(undefined),
    dismiss: jest.fn().mockResolvedValue(undefined),
  });
}

@Injectable({ providedIn: 'root' })
export class MockModalController {
  create = jest.fn().mockResolvedValue({
    present: jest.fn().mockResolvedValue(undefined),
    dismiss: jest.fn().mockResolvedValue(undefined),
    onDidDismiss: jest.fn().mockResolvedValue({ data: null, role: null }),
  });
}

@Injectable({ providedIn: 'root' })
export class MockToastController {
  create = jest.fn().mockResolvedValue({
    present: jest.fn().mockResolvedValue(undefined),
    dismiss: jest.fn().mockResolvedValue(undefined),
  });
}

// Mock Platform service
@Injectable({ providedIn: 'root' })
export class MockPlatform {
  is = jest.fn().mockReturnValue(false);
  ready = jest.fn().mockResolvedValue('dom');
  width = jest.fn().mockReturnValue(1024);
  height = jest.fn().mockReturnValue(768);
  platforms = jest.fn().mockReturnValue(['desktop']);
}

// Capacitor mocks
export const capacitorMocks = {
  '@capacitor/preferences': {
    Preferences: {
      get: jest.fn().mockResolvedValue({ value: null }),
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
      keys: jest.fn().mockResolvedValue({ keys: [] }),
    },
  },
  '@capacitor/network': {
    Network: {
      getStatus: jest.fn().mockResolvedValue({
        connected: true,
        connectionType: 'wifi',
      }),
      addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    },
  },
  '@capacitor/push-notifications': {
    PushNotifications: {
      requestPermissions: jest.fn().mockResolvedValue({ receive: 'granted' }),
      register: jest.fn().mockResolvedValue(undefined),
      addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    },
  },
  '@capacitor/haptics': {
    Haptics: {
      impact: jest.fn().mockResolvedValue(undefined),
      notification: jest.fn().mockResolvedValue(undefined),
      vibrate: jest.fn().mockResolvedValue(undefined),
    },
  },
};

// Ionic module mocks
export const ionicMocks = {
  '@ionic/angular/standalone': {
    AlertController: MockAlertController,
    LoadingController: MockLoadingController,
    ModalController: MockModalController,
    ToastController: MockToastController,
    Platform: MockPlatform,
    IonApp: jest.fn(),
    IonContent: jest.fn(),
    IonHeader: jest.fn(),
    IonTitle: jest.fn(),
    IonToolbar: jest.fn(),
    IonButton: jest.fn(),
    IonIcon: jest.fn(),
    IonRouterOutlet: jest.fn(),
  },
};