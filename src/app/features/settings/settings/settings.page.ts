import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  EnvironmentInjector,
  inject,
  OnInit,
  runInInjectionContext,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

import {
  AlertController,
  IonBackButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
  IonTitle,
  IonToggle,
  IonToolbar,
  LoadingController,
  Platform,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { heart, informationCircle, moon, thumbsUp } from 'ionicons/icons';

import { Analytics, logEvent, setUserProperties } from '@angular/fire/analytics';

import { LaunchReview } from '@awesome-cordova-plugins/launch-review/ngx';
import { Preferences } from '@capacitor/preferences';
import { SettingsService, type Setting } from '@core/services';

import { EmailComposer } from 'capacitor-email-composer';

import 'cordova-plugin-purchase';
import dayjs, { Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import objectSupport from 'dayjs/plugin/objectSupport';

@Component({
  standalone: true,
  providers: [LaunchReview],
  imports: [
    ReactiveFormsModule,
    IonBackButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonSelect,
    IonSelectOption,
    IonSkeletonText,
    IonTitle,
    IonToggle,
    IonToolbar
  ],
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss']
})
export class SettingsPage implements OnInit {
  // Services injected with modern inject() pattern
  private readonly analytics = inject(Analytics);
  private readonly settingsService = inject(SettingsService);
  private readonly alert = inject(AlertController);
  private readonly fb = inject(FormBuilder);
  private readonly launchReview = inject(LaunchReview);
  private readonly loading = inject(LoadingController);
  private readonly platform = inject(Platform);
  private readonly toast = inject(ToastController);
  private readonly injector = inject(EnvironmentInjector);
  private readonly destroyRef = inject(DestroyRef);

  // Signal-based reactive state
  readonly settings = signal<Omit<Setting, 'id'>>({
    today: 'none',
    todayCustom: dayjs().format('H:mm'),
    nextDay: 'none',
    nextDayCustom: dayjs().format('H:mm'),
    exceptionOnly: false,
    weekend: false,
    darkMode: false
  });

  readonly settingsForm = signal<FormGroup>(this.fb.group(this.settings()));
  readonly isLoading = signal(true);
  readonly isiOS = signal(this.platform.is('ios'));
  readonly store = signal<CdvPurchase.Store | undefined>(undefined);
  readonly product = signal<CdvPurchase.Product | undefined>(undefined);

  // Constants
  private readonly purchasePlatform = CdvPurchase.Platform.GOOGLE_PLAY;
  private readonly format = 'H:mm';

  // Computed signals for derived state
  readonly todayNotificationMessage = computed(() =>
    this.getNotificationMessage('today', this.settingsForm().value.today)
  );

  readonly nextDayNotificationMessage = computed(() =>
    this.getNotificationMessage('nextday', this.settingsForm().value.nextDay)
  );

  constructor() {
    this.initializeDayjs();
    this.initializeIcons();
    this.initializePurchaseStore();
  }

  async ngOnInit() {
    await this.loadSettings();
    this.setupFormListeners();
  }

  private setupFormListeners(): void {
    this.settingsForm()
      .controls['today'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async today => {
        if (!today) return;
        if (today === 'custom') return this.openTimePicker('today');
        await this.saveSettings({ today });
      });

    this.settingsForm()
      .controls['nextDay'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async nextDay => {
        if (!nextDay) return;
        if (nextDay === 'custom') return this.openTimePicker('nextDay');
        await this.saveSettings({ nextDay });
      });

    this.settingsForm()
      .controls['darkMode'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async value => {
        await this.handleDarkModeChange(value);
      });
  }

  // Initialization methods
  private initializeDayjs(): void {
    dayjs.extend(objectSupport);
    dayjs.extend(customParseFormat);
  }

  private initializeIcons(): void {
    addIcons({ heart, thumbsUp, informationCircle, moon });
  }

  private initializePurchaseStore(): void {
    this.platform.ready().then(() => {
      this.store.set(CdvPurchase.store);

      this.store()?.register({
        id: 'donation_99',
        type: CdvPurchase.ProductType.CONSUMABLE,
        platform: this.purchasePlatform
      });

      this.store()
        ?.when()
        .approved(receipt => receipt.verify())
        .verified(async receipt => {
          receipt.finish();
          await this.showToast('Your support is always appreciated!', 10000);
        });

      this.store()?.initialize([this.purchasePlatform]);
    });
  }

  private async loadSettings(): Promise<void> {
    const loading = await this.loading.create();
    await loading.present();

    try {
      const currentSettings = this.settingsService.settingsSignal();
      if (currentSettings) {
        const formData = {
          today: currentSettings.today ?? 'none',
          nextDay: currentSettings.nextDay ?? 'none',
          todayCustom: currentSettings.todayCustom ?? dayjs().format(this.format),
          nextDayCustom: currentSettings.nextDayCustom ?? dayjs().format(this.format),
          exceptionOnly: currentSettings.exceptionOnly ?? false,
          weekend: currentSettings.weekend ?? false,
          darkMode: currentSettings.darkMode ?? false
        };

        this.settings.set(formData);
        this.settingsForm().patchValue(formData, { emitEvent: false, onlySelf: true });
      }
    } finally {
      this.isLoading.set(false);
      await loading.dismiss();
    }
  }

  private async saveSettings(updates: Partial<Setting>): Promise<void> {
    try {
      const result = await this.settingsService.updateSettings(updates);

      await this.showToast(
        result.success ? 'Your settings have been saved.' : 'An error occurred while saving settings.',
        1500,
        result.success ? 'dark' : 'danger'
      );
    } catch (error) {
      console.error('Error saving settings:', error);
      await this.showToast('An error occurred while saving settings.', 1500, 'danger');
    }
  }

  private async handleDarkModeChange(value: boolean): Promise<void> {
    await Preferences.set({ key: 'darkMode', value: value.toString() });
    document.body.classList.toggle('dark', value);
    await this.saveSettings({ darkMode: value });

    this.logAnalyticsEvent('dark mode', { active: value.toString() }, { darkMode: value.toString() });
  }

  private async showToast(message: string, duration: number = 1500, color: string = 'dark'): Promise<void> {
    const toast = await this.toast.create({ message, duration, color });
    await toast.present();
  }

  private logAnalyticsEvent(
    action: string,
    eventParams?: Record<string, string>,
    userProperties?: Record<string, string>
  ): void {
    runInInjectionContext(this.injector, () => {
      logEvent(this.analytics, 'custom_event', { action, ...eventParams });
      if (userProperties) {
        setUserProperties(this.analytics, userProperties);
      }
    });
  }

  // Public event handlers
  async onCheckBoxChange(ev: Event, action: string): Promise<void> {
    const checked = (ev as CustomEvent).detail.checked;
    await this.saveSettings({ [action]: checked });
    this.logAnalyticsEvent(action, { active: checked.toString() }, { [action]: checked.toString() });
  }

  private getNotificationMessage(type: string, action: string): string {
    const time = type === 'today' ? this.settings().todayCustom : this.settings().nextDayCustom;
    const timeMap: Record<string, string> = {
      none: 'Get notified about alternate side parking',
      immediately: `Next notification around ${type === 'today' ? '7:30AM' : '4:00PM'}`,
      custom: `Next notification at ${dayjs(time, 'H:mm').format('h:mm A')}`
    };
    return timeMap[action] ?? '';
  }

  async onTodayChange(date: string): Promise<void> {
    const maxTime = dayjs().set({ hour: 7, minute: 29 });
    if (dayjs(date, 'h:mmA').isBefore(maxTime)) {
      await this.showTimeValidationAlert(maxTime);
      return;
    }

    const todayCustom = dayjs(date, 'h:mmA').format(this.format);
    this.settings.update(s => ({ ...s, todayCustom }));
    await this.saveSettings({ today: this.settingsForm().value.today, todayCustom });
  }

  onTodayCancel(): void {
    this.settingsForm().controls['today'].patchValue(this.settings().today);
  }

  async onNextDateChange(date: string): Promise<void> {
    const maxTime = dayjs().set({ hour: 15, minute: 59 });
    if (dayjs(date, 'h:mmA').isBefore(maxTime)) {
      await this.showTimeValidationAlert(maxTime);
      return;
    }

    const nextDayCustom = dayjs(date, 'h:mmA').format(this.format);
    this.settings.update(s => ({ ...s, nextDayCustom }));
    await this.saveSettings({ nextDay: this.settingsForm().value.nextDay, nextDayCustom });
  }

  onNextDateCancel(): void {
    this.settingsForm().controls['nextDay'].patchValue(this.settings().nextDay);
  }

  async rate(): Promise<void> {
    if (this.launchReview.isRatingSupported()) {
      await this.launchReview.launch();
    } else {
      this.launchReview.rating().subscribe();
    }
    this.logAnalyticsEvent('rate');
  }

  async about(): Promise<void> {
    const alert = await this.alert.create({
      header: 'ASP For NYC',
      message:
        'This app was built and designed by Braxton Diggs of Cymbit Creative Studios.<br /><br />For more info and inquiries, email us at <strong>hello@braxtondiggs.com</strong>',
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel'
        },
        {
          text: 'Contact Us',
          handler: async () => await this.handleContactUs()
        }
      ]
    });

    await alert.present();
    this.logAnalyticsEvent('about');
  }

  async donate(): Promise<void> {
    const alert = await this.alert.create({
      header: 'Support Development',
      message:
        'Hello, there! Hundreds of hours have been put into developing and perfecting ASP NYC, so if you use this app quite often, why not considering supporting development.<br /><br />Your support ensures that we can keep up development, keeping the app alive.',
      buttons: [
        {
          text: 'No, Thanks',
          role: 'cancel'
        },
        {
          text: 'Yes, Please',
          handler: () => this.handleDonation()
        }
      ]
    });

    await alert.present();
    this.logAnalyticsEvent('donate');
  }

  private async handleContactUs(): Promise<void> {
    const { hasAccount } = await EmailComposer.hasAccount();
    if (hasAccount) {
      await EmailComposer.open({
        to: ['hello@braxtondiggs.com'],
        subject: 'ASP for NYC',
        isHtml: false,
        body: ''
      });
    } else {
      window.open('mailto:hello@braxtondiggs.com?subject=ASP%20for%20NYC', '_system');
    }
  }

  private handleDonation(): void {
    this.product.set(this.store()?.get('donation_99', this.purchasePlatform));
    this.product()?.getOffer()?.order();
  }

  private async showTimeValidationAlert(maxTime: Dayjs): Promise<void> {
    const time = maxTime.add(1, 'minute').format('h:mm A');
    const alert = await this.alert.create({
      header: 'Invalid Time',
      message: `The time you have selected is too early, please select a time after ${time}.`,
      buttons: [
        {
          text: 'Okay',
          handler: () => this.settingsForm().controls['nextDay'].patchValue(this.settings().nextDay)
        }
      ]
    });
    await alert.present();
  }

  async openTimePicker(action: 'today' | 'nextDay' = 'today'): Promise<void> {
    const data = action === 'today' ? this.settings().todayCustom : this.settings().nextDayCustom;
    const currentTime = dayjs(data, this.format);

    const alert = await this.alert.create({
      header: `Select ${action === 'today' ? 'Today' : 'Next Day'} Notification Time`,
      inputs: [
        {
          name: 'time',
          type: 'time',
          value: currentTime.format('HH:mm'),
          placeholder: 'Select time'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => (action === 'today' ? this.onTodayCancel() : this.onNextDateCancel())
        },
        {
          text: 'Done',
          handler: (data): void => {
            if (data.time) {
              const [hours, minutes] = data.time.split(':');
              const time24 = dayjs().set('hour', parseInt(hours, 10)).set('minute', parseInt(minutes, 10));
              const formattedTime = time24.format('h:mm A');

              if (action === 'today') {
                this.onTodayChange(formattedTime);
              } else {
                this.onNextDateChange(formattedTime);
              }
            }
          }
        }
      ]
    });

    await alert.present();
  }
}
