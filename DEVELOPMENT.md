# Development Guide - Paras (ASP NYC)

## Project Names
- **Paras**: Project codename
- **ASP NYC**: Short/public name  
- **Alternate side parking - New York City**: Full application name

## Development Environment Setup

### Prerequisites
- **Node.js 20** (specified in package.json engines)
- **npm** (comes with Node.js)
- **iOS Development**: Xcode and iOS Simulator
- **Android Development**: Android Studio and Android SDK

### Initial Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd Paras
   npm install  # Also installs @ionic/cli globally via preinstall script
   ```

2. **Environment Configuration**:
   - Check `src/environments/environment.ts` for development settings
   - Check `src/environments/environment.prod.ts` for production settings
   - Firebase configuration is handled by `FirebaseConfigService`

3. **IDE Setup**:
   - **Recommended**: VS Code with Angular Language Service extension
   - **ESLint**: Auto-formatting on save with ESLint + Prettier
   - **TypeScript**: Enable strict mode checking

## Development Workflow

### Running the Application

```bash
# Web development server
npm run start  # Serves on http://localhost:4200

# Mobile development
npm run ios      # iOS Simulator
npm run android  # Android device/emulator with livereload
```

### Code Quality & Testing

```bash
# Linting and formatting
npm run lint          # ESLint check and auto-fix
npm run lint:check    # ESLint check only (CI mode)
npm run format        # Prettier formatting
npm run format:check  # Prettier check only (CI mode)
npm run type-check    # TypeScript compilation check

# Testing
npm run test             # Run all tests
npm run test:watch       # Watch mode for development
npm run test:coverage    # Generate coverage report
npm run test:ci          # CI-optimized test run
npm run test:debug       # Debug mode with Node inspector
npm run test:update      # Update Jest snapshots
```

### Building and Deployment

```bash
# Web build
npm run build      # Production build to www/ directory

# Mobile builds
npm run copy           # Copy web assets to native platforms
npm run build:ios      # Build and sync iOS platform
npm run build:android  # Build and sync Android platform

# Bundle analysis
npm run stats     # Analyze bundle size with webpack-bundle-analyzer
```

## Architecture Patterns

### Component Architecture

**Standalone Components (Angular 20)**:
```typescript
@Component({
  standalone: true,
  imports: [CommonModule, IonicModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
export class ExampleComponent {
  // Use inject() for dependency injection
  private readonly service = inject(SomeService);
  
  // Use signals for reactive state
  readonly data = signal<Data[]>([]);
  readonly isLoading = signal(false);
  
  // Computed values
  readonly filteredData = computed(() => 
    this.data().filter(item => item.active)
  );
}
```

### State Management with Signals

**Reactive State**:
```typescript
// Service with signal-based state
@Injectable({ providedIn: 'root' })
export class StateService {
  private readonly _items = signal<Item[]>([]);
  
  readonly items = this._items.asReadonly();
  readonly itemCount = computed(() => this.items().length);
  
  updateItems(items: Item[]) {
    this._items.set(items);
  }
}

// Component consumption
export class Component {
  private readonly stateService = inject(StateService);
  
  readonly items = this.stateService.items;
  readonly count = this.stateService.itemCount;
}
```

### RxJS Integration

**Reactive Data Flows**:
```typescript
// Service with RxJS streams
@Injectable()
export class DataService {
  private readonly firestore = inject(Firestore);
  private readonly destroyRef = inject(DestroyRef);
  
  getData(): Observable<Data[]> {
    return collectionData(collection(this.firestore, 'data')).pipe(
      catchError(error => {
        console.error('Data fetch error:', error);
        return of([]);
      }),
      retry({ count: 2, delay: 1000 }),
      shareReplay(1)
    );
  }
}

// Component subscription
ngOnInit() {
  this.dataService.getData()
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(data => this.data.set(data));
}
```

## Firebase Integration

### Firestore Usage

**Data Service Pattern**:
```typescript
@Injectable()
export class FeedService {
  private readonly firestore = inject(Firestore);
  private readonly feedCollection = collection(this.firestore, 'feed');
  
  get(startDate: Date, endDate: Date): Observable<Feed[]> {
    const constraints = [
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<', Timestamp.fromDate(endDate)),
      orderBy('date', 'desc')
    ];
    
    return collectionData(
      query(this.feedCollection, ...constraints),
      { idField: 'id' }
    ).pipe(
      traceUntilFirst('getFeed'), // Performance monitoring
      map(items => this.filterItems(items)),
      shareReplay(1)
    );
  }
}
```

### Performance Optimization

**Caching and Offline Support**:
```typescript
getCachedFeeds(start: Dayjs, end: Dayjs): Observable<Feed[]> {
  return this.get(start, end).pipe(
    shareReplay({
      bufferSize: 1,
      refCount: true
    })
  );
}

private async handleOfflineState(offline: boolean): Promise<void> {
  try {
    if (offline) {
      await disableNetwork(this.firestore);
    } else {
      await enableNetwork(this.firestore);
    }
  } catch (error) {
    console.warn('Network state change failed:', error);
  }
}
```

## Mobile Development

### Capacitor Integration

**Native Features**:
```typescript
// Push notifications
import { PushNotifications } from '@capacitor/push-notifications';

async setupPushNotifications() {
  const { receive } = await PushNotifications.checkPermissions();
  if (receive === 'granted') {
    // Handle notifications
  }
}

// Device preferences
import { Preferences } from '@capacitor/preferences';

async saveUserPreference(key: string, value: string) {
  await Preferences.set({ key, value });
}
```

### Platform-Specific Code

**Platform Detection**:
```typescript
import { Platform } from '@ionic/angular/standalone';

constructor() {
  this.platform = inject(Platform);
  this.isiOS = this.platform.is('ios');
  this.isAndroid = this.platform.is('android');
}
```

## Testing Patterns

### Component Testing with Spectator

```typescript
import { createComponentFactory, Spectator } from '@ngneat/spectator';

describe('ExampleComponent', () => {
  let spectator: Spectator<ExampleComponent>;
  const createComponent = createComponentFactory({
    component: ExampleComponent,
    imports: [/* required imports */],
    providers: [/* mock providers */]
  });

  beforeEach(() => spectator = createComponent());

  it('should display data', () => {
    spectator.component.data.set([mockData]);
    spectator.detectChanges();
    
    expect(spectator.query('.data-item')).toBeTruthy();
  });
});
```

### Service Testing

```typescript
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

describe('DataService', () => {
  let service: DataService;
  
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: mockFirestore }
      ]
    });
    service = TestBed.inject(DataService);
  });

  it('should fetch data', () => {
    const mockData = [{ id: 1, name: 'Test' }];
    jest.spyOn(service, 'getData').mockReturnValue(of(mockData));
    
    service.getData().subscribe(data => {
      expect(data).toEqual(mockData);
    });
  });
});
```

## Code Style Guidelines

### TypeScript Conventions

- **Strict TypeScript**: All code must pass `tsc --noEmit`
- **Interface definitions**: Use interfaces for data shapes
- **Readonly properties**: Prefer readonly for immutable data
- **Signal naming**: Use descriptive names for signals

### Angular Patterns

- **OnPush Strategy**: All components use OnPush change detection
- **Standalone Components**: No NgModules, use standalone pattern
- **Dependency Injection**: Use `inject()` function over constructor injection
- **Lifecycle**: Use `DestroyRef` for cleanup instead of `OnDestroy`

### File Organization

```
feature/
├── components/          # UI components
├── services/           # Business logic
├── models/             # TypeScript interfaces
├── pages/              # Route components
└── index.ts            # Barrel exports
```

## Performance Guidelines

### Bundle Optimization

- **Lazy Loading**: Route-level code splitting
- **Tree Shaking**: Import only needed functions
- **Bundle Analysis**: Regular `npm run stats` checks

### Runtime Performance

- **OnPush Detection**: Minimize change detection cycles
- **Signal Updates**: Batch signal updates when possible
- **Memory Leaks**: Always use `takeUntilDestroyed`

## Common Development Tasks

### Adding a New Feature

1. Create feature directory structure
2. Implement standalone components
3. Add route configuration
4. Create/update services
5. Add tests
6. Update documentation

### Updating Dependencies

```bash
# Check for updates
npm outdated

# Update specific package
npm update @angular/core

# Major version updates
npm install @angular/core@latest
```

### Debugging

- **Chrome DevTools**: Standard web debugging
- **Ionic DevApp**: Test on real devices
- **Safari Web Inspector**: iOS debugging
- **Chrome Remote Debugging**: Android debugging

## Deployment Checklist

1. **Code Quality**:
   - [ ] `npm run lint:check` passes
   - [ ] `npm run format:check` passes
   - [ ] `npm run type-check` passes
   - [ ] `npm run test:ci` passes

2. **Build Verification**:
   - [ ] `npm run build` succeeds
   - [ ] Bundle size is acceptable (`npm run stats`)
   - [ ] All routes load correctly

3. **Mobile Testing**:
   - [ ] iOS build and test (`npm run build:ios`)
   - [ ] Android build and test (`npm run build:android`)
   - [ ] Push notifications work
   - [ ] Offline functionality works

4. **Environment Configuration**:
   - [ ] Production environment variables set
   - [ ] Firebase configuration updated
   - [ ] App store metadata prepared