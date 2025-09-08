import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  ViewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FeedService, type Feed } from '@core/services';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonHeader,
  IonIcon,
  IonRouterLink,
  IonTitle,
  IonToolbar,
  ModalController,
  PickerColumnOption
} from '@ionic/angular/standalone';
import { HorizontalCalendarComponent } from '@shared/components/horizontal-calendar/horizontal-calendar.component';
import { ModalDetailComponent } from '@shared/components/modal-detail/modal-detail.component';
import dayjs, { Dayjs } from 'dayjs';
import { addIcons } from 'ionicons';
import { calendarOutline, settingsOutline } from 'ionicons/icons';
import { lastValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

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
  private readonly destroyRef = inject(DestroyRef);

  readonly selectedDate = signal(dayjs().startOf('day').toISOString());
  readonly items = signal<Feed[]>([]);
  readonly activeSlide = signal(0);
  readonly maxDate = signal(dayjs().endOf('year').toISOString());

  readonly minDate = computed(() => dayjs().startOf('year').toISOString());
  readonly highlightedDates = computed(() =>
    this.items().map(o => ({
      date: dayjs(o.date.toDate()).format('YYYY-MM-DD'),
      backgroundColor: '#f38181',
      textColor: '#fff'
    }))
  );

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

    // Smooth transition to new slide
    const swiperInstance = this.swiper?.nativeElement?.swiper;
    if (swiperInstance) {
      swiperInstance.slideTo(newSlide, 300); // 300ms transition
    }

    // Update route to reflect current view
    this.router.navigate([`/home${newSlide ? '/calendar' : ''}`], {
      replaceUrl: true
    });
  }

  private getData(start: Dayjs, end: Dayjs) {
    this.feed
      .getFeeds({
        startDate: start,
        endDate: end,
        type: 'NYC'
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items: Feed[]) => {
        console.warn('🔥 Fetched feed items:', items.length);
        this.items.set(items);
      });
  }

  private async getLastDate() {
    try {
      const lastFeed = await lastValueFrom(this.feed.getLastDate().pipe(take(1)));
      if (lastFeed?.date) {
        this.maxDate.set(dayjs(lastFeed.date.toDate()).endOf('month').subtract(1, 'day').toISOString());
      } else {
        this.maxDate.set(dayjs().endOf('month').subtract(1, 'day').toISOString());
      }
    } catch (error) {
      console.error('Error fetching last date:', error);
      // Fallback to current month on error
      this.maxDate.set(dayjs().endOf('month').subtract(1, 'day').toISOString());
    }
  }
}
