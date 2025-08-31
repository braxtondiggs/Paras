import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  ChangeDetectionStrategy,
  signal,
  computed
} from '@angular/core';
import { ModalDetailComponent } from '@shared/components/modal-detail/modal-detail.component';
import { Feed } from '@shared/interfaces';
import { FeedService } from '@data/services';
import dayjs, { Dayjs } from 'dayjs';
import { lastValueFrom } from 'rxjs';
import { addIcons } from 'ionicons';
import { calendarOutline, settingsOutline } from 'ionicons/icons';
import {
  IonRouterLink,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonButtons,
  IonContent,
  IonIcon,
  ModalController,
  IonDatetime,
  PickerColumnOption
} from '@ionic/angular/standalone';
import { Router, RouterLink } from '@angular/router';
import { HorizontalCalendarComponent } from '@shared/components/horizontal-calendar/horizontal-calendar.component';

@Component({
  imports: [
    HorizontalCalendarComponent,
    IonButton,
    IonButtons,
    IonContent,
    IonDatetime,
    IonHeader,
    IonIcon,
    IonRouterLink,
    IonTitle,
    IonToolbar,
    RouterLink
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['home.page.scss'],
  templateUrl: './home.page.html'
})
export class HomePage implements AfterViewInit {
  private readonly feed = inject(FeedService);
  private readonly modal = inject(ModalController);
  private readonly router = inject(Router);

  readonly selectedDate = signal(dayjs().startOf('day').toISOString());
  readonly items = signal<Feed[]>([]);
  readonly highlightedDates = signal<unknown[]>([]);
  readonly activeSlide = signal(0);
  readonly maxDate = signal(dayjs().endOf('year').toISOString());

  readonly minDate = computed(() => dayjs().startOf('year').toISOString());

  @ViewChild('swiper', { static: false }) swiper?: ElementRef | undefined;
  @ViewChild('calendar', { read: ElementRef, static: false }) calendar?: ElementRef;

  constructor() {
    this.activeSlide.set(this.router.url.includes('calendar') ? 1 : 0);
    addIcons({ calendarOutline, settingsOutline });
  }

  async onChange({ detail }: CustomEvent<PickerColumnOption>) {
    this.selectedDate.set(dayjs().toISOString());
    const { value } = detail;
    const date = dayjs(value);
    const item = this.items().find(o => dayjs(o.date.toDate()).isSame(date, 'day')) ?? dayjs(date.toString());
    const modal = await this.modal.create({
      component: ModalDetailComponent,
      cssClass: 'fullscreen',
      componentProps: {
        item
      }
    });
    return await modal.present();
  }

  async ngAfterViewInit(): Promise<void> {
    await this.getLastDate();
    this.getData(dayjs(this.minDate()), dayjs(this.maxDate()));
  }

  switchCalenderView() {
    const newSlide = this.activeSlide() ? 0 : 1;
    this.activeSlide.set(newSlide);
    this.swiper?.nativeElement.swiper?.slideTo(newSlide);
    this.router.navigate([`/home${newSlide ? '/calendar' : ''}`], { replaceUrl: true });
  }

  private getData(start: Dayjs, end: Dayjs) {
    this.feed.get(start, end).subscribe(items => {
      this.items.set(items);
      this.highlightedDates.set(
        items.map(o => ({
          date: dayjs(o.date.toDate()).format('YYYY-MM-DD'),
          backgroundColor: '#f38181',
          textColor: '#fff'
        }))
      );
    });
  }

  private async getLastDate() {
    const { date } = await lastValueFrom(this.feed.getLast());
    this.maxDate.set(dayjs(date.toDate()).endOf('month').subtract(1, 'day').toISOString());
  }
}
