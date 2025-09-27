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
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
  PickerColumnOption
} from '@ionic/angular/standalone';
import { HorizontalCalendarComponent } from '@shared/components/horizontal-calendar/horizontal-calendar.component';
import { ModalDetailComponent } from '@shared/components/modal-detail/modal-detail.component';
import dayjs, { type Dayjs } from 'dayjs';
import { addIcons } from 'ionicons';
import { calendarOutline, settingsOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

// Types and interfaces
interface FeedQueryParams {
  startDate: Dayjs;
  endDate: Dayjs;
  type: 'NYC';
}

interface HighlightedDate {
  date: string;
  backgroundColor: string;
  textColor: string;
}

// Constants
const HOME_CONFIG = {
  SLIDE_TRANSITION_DURATION: 300,
  DATE_FORMAT: 'YYYY-MM-DD',
  HIGHLIGHTED_DATE_STYLES: {
    backgroundColor: '#f38181',
    textColor: '#fff'
  },
  SLIDES: {
    CALENDAR: 0,
    DATETIME: 1
  }
} as const;

const ROUTE_PATHS = {
  HOME: '/home',
  HOME_CALENDAR: '/home/calendar',
  SETTINGS: '/settings'
} as const;

/**
 * Home page component for ASP NYC application.
 * Provides two views: horizontal calendar and datetime picker.
 * Manages parking feed data and navigation between views.
 */
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
    IonSpinner,
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
  // Dependencies
  private readonly feedService = inject(FeedService);
  private readonly modalController = inject(ModalController);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Signals
  readonly selectedDate = signal(dayjs().startOf('day').toISOString());
  readonly items = signal<Feed[]>([]);
  readonly activeSlide = signal<0 | 1>(HOME_CONFIG.SLIDES.CALENDAR);
  readonly maxDate = signal(dayjs().endOf('year').toISOString());
  readonly isLoading = signal(false);

  // Computed properties
  readonly minDate = computed(() => dayjs().startOf('year').toISOString());

  readonly highlightedDates = computed((): HighlightedDate[] =>
    this.items().map(item => ({
      date: dayjs(item.date.toDate()).format(HOME_CONFIG.DATE_FORMAT),
      backgroundColor: HOME_CONFIG.HIGHLIGHTED_DATE_STYLES.backgroundColor,
      textColor: HOME_CONFIG.HIGHLIGHTED_DATE_STYLES.textColor
    }))
  );

  readonly isCalendarView = computed(() => this.activeSlide() === HOME_CONFIG.SLIDES.CALENDAR);
  readonly isDateTimeView = computed(() => this.activeSlide() === HOME_CONFIG.SLIDES.DATETIME);

  @ViewChild('swiper', { static: false }) swiper?: ElementRef | undefined;
  @ViewChild('calendar', { read: ElementRef, static: false }) calendar?: ElementRef;

  constructor() {
    this.registerIcons();
  }

  /**
   * Handles date selection from the datetime picker.
   * Opens modal with parking information for selected date.
   */
  async onChange({ detail }: CustomEvent<PickerColumnOption>): Promise<void> {
    try {
      const { value } = detail;
      const selectedDate = dayjs(value);

      // Update selected date
      this.selectedDate.set(selectedDate.toISOString());

      // Find matching feed item or use selected date
      const feedItem = this.items().find(item => dayjs(item.date.toDate()).isSame(selectedDate, 'day'));

      const modalData = feedItem || selectedDate;

      const modal = await this.modalController.create({
        component: ModalDetailComponent,
        cssClass: 'fullscreen',
        componentProps: { item: modalData }
      });

      await modal.present();
    } catch (error) {
      console.error('Error handling date change:', error);
    }
  }

  async ngAfterViewInit(): Promise<void> {
    await this.initializeData();
    this.initializeComponent();
  }

  /**
   * Toggles between calendar and datetime picker views.
   * Updates swiper position and route accordingly.
   */
  switchCalenderView(): void {
    const newSlide =
      this.activeSlide() === HOME_CONFIG.SLIDES.CALENDAR ? HOME_CONFIG.SLIDES.DATETIME : HOME_CONFIG.SLIDES.CALENDAR;

    this.activeSlide.set(newSlide as 0 | 1);

    // Smooth transition to new slide
    const swiperInstance = this.getSwiperInstance();
    if (swiperInstance) {
      swiperInstance.slideTo(newSlide, HOME_CONFIG.SLIDE_TRANSITION_DURATION);
    }

    // Update route to reflect current view
    this.navigateToRoute(newSlide === HOME_CONFIG.SLIDES.DATETIME);
  }

  private initializeComponent(): void {
    const isCalendarRoute = this.router.url.includes('calendar');
    const initialSlide = isCalendarRoute ? HOME_CONFIG.SLIDES.DATETIME : HOME_CONFIG.SLIDES.CALENDAR;
    this.activeSlide.set(initialSlide as 0 | 1);

    const swiperInstance = this.getSwiperInstance();
    if (swiperInstance) {
      swiperInstance.slideTo(initialSlide as 0 | 1);
    }
  }

  private registerIcons(): void {
    addIcons({ calendarOutline, settingsOutline });
  }

  private async initializeData(): Promise<void> {
    await this.getLastDate();
    this.loadFeedData(dayjs(this.minDate()), dayjs(this.maxDate()));
  }

  private loadFeedData(start: Dayjs, end: Dayjs): void {
    this.isLoading.set(true);

    const queryParams: FeedQueryParams = {
      startDate: start,
      endDate: end,
      type: 'NYC'
    };

    this.feedService
      .getFeeds(queryParams)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error fetching feed data:', error);
          return [];
        })
      )
      .subscribe({
        next: (items: Feed[]) => {
          console.warn('🔥 Fetched feed items:', items.length);
          this.items.set(items);
          this.isLoading.set(false);
        },
        error: error => {
          console.error('Error in feed subscription:', error);
          this.isLoading.set(false);
        }
      });
  }

  private getSwiperInstance() {
    return this.swiper?.nativeElement?.swiper;
  }

  private navigateToRoute(isCalendarView: boolean): void {
    const route = isCalendarView ? ROUTE_PATHS.HOME_CALENDAR : ROUTE_PATHS.HOME;
    this.router.navigate([route], { replaceUrl: true });
  }

  private async getLastDate(): Promise<void> {
    try {
      const lastFeed = await firstValueFrom(
        this.feedService.getLastDate().pipe(
          take(1),
          catchError(() => [null])
        )
      );

      const fallbackDate = dayjs().endOf('month').subtract(1, 'day').toISOString();

      if (lastFeed?.date) {
        this.maxDate.set(dayjs(lastFeed.date.toDate()).endOf('month').subtract(1, 'day').toISOString());
      } else {
        this.maxDate.set(fallbackDate);
      }
    } catch (error) {
      console.error('Error fetching last date:', error);
      this.maxDate.set(dayjs().endOf('month').subtract(1, 'day').toISOString());
    }
  }
}
