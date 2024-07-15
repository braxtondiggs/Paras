const IonComponents = [
  IonBackButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemGroup,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar
];

@Component({
  standalone: true,
  providers: [LaunchReview],
  imports: [
    NgIf,
    ReactiveFormsModule,
    ...IonComponents,
  ],
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss']
})
export class SettingsPage implements OnInit {
  private analytics: Analytics = inject(Analytics);
  private afs: Firestore = inject(Firestore);
  private fb: FormBuilder = inject(FormBuilder);
  uid?: string | null;
  settings: Setting;
  settingsForm: FormGroup;
  isLoading = true;
  format = 'H:mm';
  isFirst = false;
  token?: string | null;
  isiOS?: boolean;
  store?: CdvPurchase.Store;
  product?: CdvPurchase.Product;
  purchasePlatform = CdvPurchase.Platform.GOOGLE_PLAY;

  constructor(
    private auth: AuthService,
    private alert: AlertController,
    private launchReview: LaunchReview,
    private loading: LoadingController,
    private picker: PickerController,
    private platform: Platform,
    private toast: ToastController) {
    dayjs.extend(objectSupport);
    dayjs.extend(customParseFormat);
    this.settings = {
      today: 'none',
      todayCustom: dayjs().format(this.format),
      nextDay: 'none',
      nextDayCustom: dayjs().format(this.format),
      exceptionOnly: false,
      weekend: false,
      darkMode: false
    };
    this.settingsForm = this.fb.group(this.settings);
    this.isiOS = this.platform.is('ios');
    addIcons({ heart, thumbsUp, informationCircle, moon });
    this.platform.ready().then(() => {
      this.store = CdvPurchase.store;
      
      this.store?.register({
        id: 'donation_99',
        type: CdvPurchase.ProductType.CONSUMABLE,
        platform: this.purchasePlatform
      });

      console.log(this.store)
  
      this.store?.when()
        .approved((receipt) => receipt.verify())
        .verified(async (receipt) => {
          receipt.finish();
          const toast = await this.toast.create({ message: 'Your support is always appreciated!', duration: 10000 });
          toast.present();
        });
      this.store?.initialize([this.purchasePlatform]);
    });
  }

  async ngOnInit() {
    const loading = await this.loading.create();
    loading.present();
    this.uid = await this.auth.uid();
    if (this.uid) {
      const { value } = await Preferences.get({ key: 'token' });
      this.token = value;
      docData<Setting>(
        doc(this.afs, `notifications/${this.uid}`) as DocumentReference<Setting>
      ).pipe(traceUntilFirst('getUserNotifications')).subscribe(async (settings: Setting = {}) => {
        this.isFirst = settings.updateAt === undefined;
        if (settings.todayCustom) settings.todayCustom = dayjs().set(this.getTime(settings.todayCustom)).format(this.format);
        if (settings.nextDayCustom) settings.nextDayCustom = dayjs().set(this.getTime(settings.nextDayCustom)).format(this.format);
        this.settings = { ...this.settings, ...settings };
        const { value } = await Preferences.get({ key: 'darkMode' });
        if (value === 'true') this.settings.darkMode = true;
        this.settingsForm.patchValue(this.settings, { emitEvent: false, onlySelf: true });
        setTimeout(() => {
          this.isLoading = false;
          loading.dismiss();
        });
      });
    }

    this.settingsForm.controls['today'].valueChanges.subscribe(async today => {
      if (!today) return;
      if (today === 'custom') return this.openTimePicker('today');
      await this.save({ today });
    });

    this.settingsForm.controls['nextDay'].valueChanges.subscribe(async nextDay => {
      if (!nextDay) return;
      if (nextDay === 'custom') return this.openTimePicker('nextDay');
      await this.save({ nextDay });
    });

    this.settingsForm.controls['darkMode'].valueChanges.subscribe(async (value) => {
      await Preferences.set({ key: 'darkMode', value: value.toString() });
      document.body.classList.toggle('dark', value);
      logEvent(this.analytics, 'custom_event', { action: 'dark mode', active: value.toString() });
      setUserProperties(this.analytics, { darkMode: value.toString() });
    });
  }

  async onCheckBoxChange(ev: Event, action: string) {
    const checked = (ev as any).detail.checked;
    await this.save({ [action]: checked });
    logEvent(this.analytics, 'custom_event', { action, active: checked.toString() });
    setUserProperties(this.analytics, { [action]: checked.toString() });
  }

  async save(data: Setting): Promise<void> {
    let t: HTMLIonToastElement;
    const { receive } = await PushNotifications.checkPermissions();
    const createdAt = this.isFirst ? new Date() : null;
    data = this.omitByNil({ ...data, token: this.token, type: 'NYC', updateAt: new Date(), createdAt });
    if (data.token !== undefined && receive === 'granted') {
      setDoc(doc(this.afs, `notifications/${this.uid}`) as DocumentReference<Setting>, data, { merge: true }).then(async () => {
        t = await this.toast.create({
          color: 'dark',
          duration: 1500,
          message: 'Your settings have been saved.'
        });
      }).catch(async () => {
        t = await this.toast.create({
          color: 'dark',
          duration: 1500,
          message: 'An error has occurred.'
        });
      }).finally(() => {
        t.present();
        this.isFirst = false;
      });
    } else if (receive === 'denied') {
      t = await this.toast.create({
        color: 'danger',
        duration: 1500,
        message: 'Please enable push notifications.'
      });
      t.present();
    }
  }

  private getTime(time: string): { hour: number, minute: number } {
    if (!time) return { hour: dayjs().get('hour'), minute: dayjs().get('minute') };
    const [hour, minute] = time.split(':');
    return { hour: +hour, minute: +minute };
  }

  private omitByNil = (data: any) => Object.fromEntries(Object.entries(data).filter(([key, value]) => value !== null && value !== undefined));

  getNotificationMessage(type: string, action: string): string {
    const time = type === 'today' ? this.settings.todayCustom : this.settings.nextDayCustom;
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
    this.settings.todayCustom = dayjs(date, 'h:mmA').format(this.format);
    await this.save({ today: this.settingsForm.value.today, todayCustom: this.settings.todayCustom });
  }

  onTodayCancel() {
    this.settingsForm.controls['today'].patchValue(this.settings.today);
  }

  async onNextDateChange(date: string) {
    const maxTime = dayjs().set({ hour: 15, minute: 59 });
    if (dayjs(date, 'h:mmA').isBefore(maxTime)) return this.showAlert(maxTime);
    this.settings.nextDayCustom = dayjs(date, 'h:mmA').format(this.format);
    await this.save({ nextDay: this.settingsForm.value.nextDay, nextDayCustom: this.settings.nextDayCustom });
  }

  onNextDateCancel() {
    this.settingsForm.controls['nextDay'].patchValue(this.settings.nextDay);
  }

  async rate() {
    if (this.launchReview.isRatingSupported()) {
      await this.launchReview.launch();
    } else {
      this.launchReview.rating().subscribe();
    }
    logEvent(this.analytics, 'custom_event', { action: 'rate' });
  }

  async about() {
    const alert = await this.alert.create({
      header: 'ASP For NYC',
      message: 'This app was built and designed by Braxton Diggs of Cymbit Creative Studios.<br /><br />For more info and inquiries, email us at <strong>hello@braxtondiggs.com</strong>',
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel'
        }, {
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
    logEvent(this.analytics, 'custom_event', { action: 'about' });
  }

  async donate() {
    const alert = await this.alert.create({
      header: 'Support Development',
      message: 'Hello, there! Hundreds of hours have been put into developing and perfecting ASP NYC, so if you use this app quite often, why not considering supporting development.<br /><br />Your support ensures that we can keep up development, keeping the app alive.',
      buttons: [
        {
          text: 'No, Thanks',
          role: 'cancel'
        }, {
          text: 'Yes, Please',
          handler: () => {
            this.product = this.store?.get('donation_99', this.purchasePlatform);
            this.product?.getOffer()?.order();
          }
        }
      ]
    });

    await alert.present();
    logEvent(this.analytics, 'custom_event', { action: 'donate' });
  }

  private async showAlert(maxTime: Dayjs) {
    const time: string = maxTime.add(1, 'minute').format('h:mm A').toString();
    const alert = await this.alert.create({
      header: 'Invalid Time',
      message: `The time you have selected is too early, please select a time before ${time}.`,
      buttons: [{
        text: 'Okay',
        handler: () => this.settingsForm.controls['nextDay'].patchValue(this.settings.nextDay)
      }]
    });
    await alert.present();
  }

  async openTimePicker(action: string = 'today') {
    const data = action === 'today' ? this.settings.todayCustom : this.settings.nextDayCustom;
    const time = dayjs(data, this.format);
    const hour = time.get('hour');
    const minute = time.get('minute');
    const period = hour >= 12 ? 'PM' : 'AM';
    let m = ((Math.round(minute / 15) * 15) % 60).toString();
    if (m === '0') m = '00';
    const picker = await this.picker.create({
      buttons: [{
        text: 'Cancel',
        role: 'cancel'
      }, {
        text: 'Done',
        role: 'save',
        handler: (o) => {
          const date = `${o.hours.text}:${o.minutes.text}${o.periods.text}`;
          if (action === 'today') this.onTodayChange(date);
          if (action === 'nextDay') this.onNextDateChange(date);
        },
      }],
      columns: [
        {
          name: 'hours',
          selectedIndex: [...Array(12).keys()].map(k => k + 1).findIndex(o => o == hour),
          options: [...Array(12).keys()].map(k => k + 1).map(o => ({ text: o.toString() }))
        },
        {
          name: 'minutes',
          selectedIndex: ['00', '15', '30', '45'].findIndex(o => o == m),
          options: ['00', '15', '30', '45'].map(text => ({ text }))
        },
        {
          name: 'periods',
          selectedIndex: ['AM', 'PM'].findIndex(o => o == period.toString()),
          options: ['AM', 'PM'].map(text => ({ text }))
        },
      ]
    });
    await picker.present();
  }
}

import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';

import { addIcons } from 'ionicons';
import { heart, thumbsUp, informationCircle, moon } from 'ionicons/icons';
import {
  AlertController,
  IonBackButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemGroup,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
  LoadingController,
  PickerController,
  Platform,
  ToastController
} from '@ionic/angular/standalone';

import { Analytics, logEvent, setUserProperties } from '@angular/fire/analytics';
import { doc, docData, DocumentReference, Firestore, setDoc, } from '@angular/fire/firestore';
import { traceUntilFirst } from '@angular/fire/performance';

import { AuthService } from '../core/services';
import { Setting } from '../core/interface';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';
import { EmailComposer } from 'capacitor-email-composer';
import { LaunchReview } from '@awesome-cordova-plugins/launch-review/ngx';

import dayjs, { Dayjs } from 'dayjs';
import objectSupport from 'dayjs/plugin/objectSupport';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'cordova-plugin-purchase';
