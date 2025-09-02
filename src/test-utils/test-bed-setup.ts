import { TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { MockAuthService, MockFeedService } from './firebase-mocks';
import { MockAlertController, MockLoadingController, MockModalController, MockPlatform } from './ionic-mocks';

/**
 * Configure TestBed with common Ionic and Firebase mocks
 * Use this for traditional Angular TestBed testing (not Spectator)
 */
export function configureTestBed(config: any = {}) {
  return TestBed.configureTestingModule({
    imports: [IonicModule.forRoot(), ...(config.imports || [])],
    providers: [
      // Firebase mocks
      { provide: 'AuthService', useClass: MockAuthService },
      { provide: 'FeedService', useClass: MockFeedService },

      // Ionic mocks
      { provide: 'AlertController', useClass: MockAlertController },
      { provide: 'LoadingController', useClass: MockLoadingController },
      { provide: 'ModalController', useClass: MockModalController },
      { provide: 'Platform', useClass: MockPlatform },

      // Add any additional providers
      ...(config.providers || [])
    ],
    declarations: config.declarations || [],
    schemas: config.schemas || []
  });
}

/**
 * Common setup for component testing
 */
export async function setupComponentTest<T>(component: new (...args: any[]) => T, config: any = {}) {
  await configureTestBed({
    declarations: [component],
    ...config
  }).compileComponents();

  const fixture = TestBed.createComponent(component);
  const instance = fixture.componentInstance;

  return {
    fixture,
    component: instance,
    element: fixture.nativeElement as HTMLElement,
    detectChanges: () => fixture.detectChanges()
  };
}

/**
 * Common setup for service testing
 */
export function setupServiceTest<T>(service: new (...args: any[]) => T, config: any = {}) {
  configureTestBed(config);
  return TestBed.inject(service);
}
