import {
  ChangeDetectionStrategy,
  Component,
  EnvironmentInjector,
  inject,
  OnInit,
  runInInjectionContext,
  signal
} from '@angular/core';
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
import { AuthService, SettingsService, type Setting } from '@core/services';

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
  private readonly analytics = inject(Analytics);
  private readonly auth = inject(AuthService);
  private readonly settingsService = inject(SettingsService);
  private readonly alert = inject(AlertController);
  private readonly fb = inject(FormBuilder);
  private readonly launchReview = inject(LaunchReview);
  private readonly loading = inject(LoadingController);
  private readonly platform = inject(Platform);
  private readonly toast = inject(ToastController);
  private readonly injector = inject(EnvironmentInjector);

  readonly uid = signal<string | null>(null);
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
  readonly isFirst = signal(false);
  readonly token = signal<string | null>(null);
  readonly isiOS = signal(false);
  readonly store = signal<CdvPurchase.Store | undefined>(undefined);
  readonly product = signal<CdvPurchase.Product | undefined>(undefined);
  readonly purchasePlatform = CdvPurchase.Platform.GOOGLE_PLAY;
  readonly format = 'H:mm';

  constructor() {
    dayjs.extend(objectSupport);
    dayjs.extend(customParseFormat);
    this.isiOS.set(this.platform.is('ios'));
    addIcons({ heart, thumbsUp, informationCircle, moon });
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
          const toast = await this.toast.create({ message: 'Your support is always appreciated!', duration: 10000 });
          toast.present();
        });
      this.store()?.initialize([this.purchasePlatform]);
    });
  }

  async ngOnInit() {
    const loading = await this.loading.create();
    loading.present();

    // Use the modern SettingsService
    const currentSettings = this.settingsService.settingsSignal();
    if (currentSettings) {
      // Update form with current settings
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

    this.isLoading.set(false);
    loading.dismiss();

    // Set up form change listeners
    this.setupFormListeners();
  }

  private setupFormListeners() {
    this.settingsForm().controls['today'].valueChanges.subscribe(async today => {
      if (!today) return;
      if (today === 'custom') return this.openTimePicker('today');
      await this.saveSettings({ today });
    });

    this.settingsForm().controls['nextDay'].valueChanges.subscribe(async nextDay => {
      if (!nextDay) return;
      if (nextDay === 'custom') return this.openTimePicker('nextDay');
      await this.saveSettings({ nextDay });
    });

    this.settingsForm().controls['darkMode'].valueChanges.subscribe(async value => {
      await Preferences.set({ key: 'darkMode', value: value.toString() });
      document.body.classList.toggle('dark', value);
      await this.saveSettings({ darkMode: value });

      runInInjectionContext(this.injector, () => {
        logEvent(this.analytics, 'custom_event', { action: 'dark mode', active: value.toString() });
        setUserProperties(this.analytics, { darkMode: value.toString() });
      });
    });
  }

  /**
   * Modern save method using SettingsService
   */
  private async saveSettings(updates: Partial<Setting>): Promise<void> {
    try {
      const result = await this.settingsService.updateSettings(updates);

      if (result.success) {
        const toast = await this.toast.create({
          color: 'dark',
          duration: 1500,
          message: 'Your settings have been saved.'
        });
        toast.present();
      } else {
        const toast = await this.toast.create({
          color: 'danger',
          duration: 1500,
          message: 'An error occurred while saving settings.'
        });
        toast.present();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      const toast = await this.toast.create({
        color: 'danger',
        duration: 1500,
        message: 'An error occurred while saving settings.'
      });
      toast.present();
    }
  }

  async onCheckBoxChange(ev: Event, action: string) {
    const checked = (ev as CustomEvent).detail.checked;
    await this.saveSettings({ [action]: checked });

    // Use runInInjectionContext for Firebase analytics
    runInInjectionContext(this.injector, () => {
      logEvent(this.analytics, 'custom_event', { action, active: checked.toString() });
      setUserProperties(this.analytics, { [action]: checked.toString() });
    });
  }

  private getTime(time: string): { hour: number; minute: number } {
    if (!time) return { hour: dayjs().get('hour'), minute: dayjs().get('minute') };
    const [hour, minute] = time.split(':');
    return { hour: +hour, minute: +minute };
  }

  getNotificationMessage(type: string, action: string): string {
    const time = type === 'today' ? this.settings().todayCustom : this.settings().nextDayCustom;
    switch (action) {
      case 'none':
        return 'Get notified about alternate side parking';
      case 'immediately':
        return `Next notification around ${type === 'today' ? '7:30AM' : '4:00PM'}`;
      case 'custom':
        return `Next notification at ${dayjs(time, 'H:mm').format('h:mm A')}`;
      default:
        return '';
    }
  }

  async onTodayChange(date: string) {
    const maxTime = dayjs().set({ hour: 7, minute: 29 });
    if (dayjs(date, 'h:mmA').isBefore(maxTime)) return this.showAlert(maxTime);
    const todayCustom = dayjs(date, 'h:mmA').format(this.format);
    this.settings.update(s => ({ ...s, todayCustom }));
    await this.saveSettings({ today: this.settingsForm().value.today, todayCustom });
  }

  onTodayCancel() {
    this.settingsForm().controls['today'].patchValue(this.settings().today);
  }

  async onNextDateChange(date: string) {
    const maxTime = dayjs().set({ hour: 15, minute: 59 });
    if (dayjs(date, 'h:mmA').isBefore(maxTime)) return this.showAlert(maxTime);
    const nextDayCustom = dayjs(date, 'h:mmA').format(this.format);
    this.settings.update(s => ({ ...s, nextDayCustom }));
    await this.saveSettings({ nextDay: this.settingsForm().value.nextDay, nextDayCustom });
  }

  onNextDateCancel() {
    this.settingsForm().controls['nextDay'].patchValue(this.settings().nextDay);
  }

  async rate() {
    if (this.launchReview.isRatingSupported()) {
      await this.launchReview.launch();
    } else {
      this.launchReview.rating().subscribe();
    }

    runInInjectionContext(this.injector, () => {
      logEvent(this.analytics, 'custom_event', { action: 'rate' });
    });
  }

  async about() {
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
          handler: async () => {
            const { hasAccount } = await EmailComposer.hasAccount();
            if (hasAccount) {
              EmailComposer.open({ to: ['hello@braxtondiggs.com'], subject: 'ASP for NYC', isHtml: false, body: '' });
            } else {
              window.open('mailto:hello@braxtondiggs.com?subject=ASP%20for%20NYC', '_system');
            }
          }
        }
      ]
    });

    await alert.present();

    runInInjectionContext(this.injector, () => {
      logEvent(this.analytics, 'custom_event', { action: 'about' });
    });
  }

  async donate() {
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
          handler: () => {
            this.product.set(this.store()?.get('donation_99', this.purchasePlatform));
            this.product()?.getOffer()?.order();
          }
        }
      ]
    });

    await alert.present();

    runInInjectionContext(this.injector, () => {
      logEvent(this.analytics, 'custom_event', { action: 'donate' });
    });
  }

  private async showAlert(maxTime: Dayjs) {
    const time: string = maxTime.add(1, 'minute').format('h:mm A').toString();
    const alert = await this.alert.create({
      header: 'Invalid Time',
      message: `The time you have selected is too early, please select a time before ${time}.`,
      buttons: [
        {
          text: 'Okay',
          handler: () => this.settingsForm().controls['nextDay'].patchValue(this.settings().nextDay)
        }
      ]
    });
    await alert.present();
  }

  async openTimePicker(action: string = 'today') {
    const data = action === 'today' ? this.settings().todayCustom : this.settings().nextDayCustom;
    const currentTime = dayjs(data, this.format);

    // Create alert with datetime input for time selection
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
          handler: () => {
            if (action === 'today') {
              this.onTodayCancel();
            } else {
              this.onNextDateCancel();
            }
          }
        },
        {
          text: 'Done',
          handler: data => {
            if (data.time) {
              // Convert 24-hour format to 12-hour format with AM/PM
              const [hours, minutes] = data.time.split(':');
              const time24 = dayjs().set('hour', parseInt(hours)).set('minute', parseInt(minutes));
              const formattedTime = time24.format('h:mm A');

              if (action === 'today') {
                this.onTodayChange(formattedTime);
              } else if (action === 'nextDay') {
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
