import { DatePipe, NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { IonButton, IonIcon, IonItem, IonLabel, IonRippleEffect, LoadingController } from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { arrowBack, arrowForward } from 'ionicons/icons';

import { register } from 'swiper/element/bundle';

import dayjs, { Dayjs } from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

import { FeedService, type Feed } from '@core/services';
import { Calendar } from '@shared/interfaces';
import { CardDetailComponent } from '../card-detail/card-detail.component';

@Component({
  standalone: true,
  imports: [CardDetailComponent, IonRippleEffect, IonButton, IonIcon, IonItem, IonLabel, NgClass, DatePipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  selector: 'app-horizontal-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './horizontal-calendar.component.html',
  styleUrls: ['./horizontal-calendar.component.scss']
})
export class HorizontalCalendarComponent implements OnInit {
  @ViewChild('swiper') public swiper?: ElementRef | undefined;

  private readonly feed = inject(FeedService);
  private readonly loadingCtl = inject(LoadingController);
  private readonly destroyRef = inject(DestroyRef);

  // Reactive state with signals
  readonly isLoading = signal(true);
  readonly selected = signal<Feed | Dayjs | undefined>(undefined);
  readonly feeds = signal<Feed[] | undefined>(undefined);
  readonly active = signal<Calendar | undefined>(undefined);
  readonly items = signal<Calendar[]>([]);
  readonly error = signal<string | null>(null);
  readonly isSliding = signal(false);

  // Computed properties for derived state
  readonly dateRange = computed(() => {
    const items = this.items();
    if (items.length === 0) return null;

    const start = items[0];
    const end = items[items.length - 1];
    return start && end ? { start: dayjs(start.date), end: dayjs(end.date) } : null;
  });

  readonly hasError = computed(() => !!this.error());
  readonly canNavigatePrev = computed(() => !this.isLoading() && !this.isSliding());
  readonly canNavigateNext = computed(() => !this.isLoading() && !this.isSliding());

  private loading?: HTMLIonLoadingElement;

  constructor() {
    // Register icons for better performance
    addIcons({ arrowBack, arrowForward });

    // Set up reactive effect for data loading
    effect(() => {
      const active = this.active();
      const dateRange = this.dateRange();

      if (active && dateRange && !this.isLoading()) {
        this.loadData();
      }
    });
  }

  async ngOnInit() {
    try {
      // Extend dayjs with plugins
      dayjs.extend(isSameOrBefore);
      dayjs.extend(advancedFormat);

      // Initialize loading state
      this.loading = await this.loadingCtl.create({
        message: 'Loading calendar...',
        spinner: 'crescent',
        translucent: true
      });
      await this.loading.present();

      // Initialize calendar dates
      const dates = this.getDatesBetween();
      this.items.set(dates);
      this.active.set(dates[6]);

      // Load initial data
      await this.loadData();

      // Register Swiper elements
      register();
    } catch (error) {
      console.error('Failed to initialize horizontal calendar:', error);
      this.error.set('Failed to load calendar');
      this.isLoading.set(false);
      await this.loading?.dismiss();
    }
  }

  async onSlideChange() {
    const index = this.swiper?.nativeElement?.swiper?.activeIndex;
    if (typeof index !== 'number') return;

    try {
      // Check if we're already processing a slide change to prevent infinite loops
      if (this.isSliding()) return;

      this.isSliding.set(true);
      const items = this.items();

      // Update active date first
      const newActive = items[index];
      if (newActive) {
        this.active.set(newActive);
      }

      // Load more dates if needed
      if (items.length - 3 <= index) {
        await this.slideEnd();
      } else if (index <= 2) {
        await this.slideStart();
      }
    } catch (error) {
      console.error('Failed to handle slide change:', error);
      this.error.set('Failed to update calendar');
    } finally {
      this.isSliding.set(false);
    }
  }

  public slideTo(index: number, speed = 250): void {
    if (!this.canNavigateNext() || !this.swiper?.nativeElement?.swiper) return;

    try {
      this.swiper.nativeElement.swiper.slideTo(index, speed);
      // Update active state immediately when manually sliding to an index
      const items = this.items();
      const newActive = items[index];
      if (newActive) {
        this.active.set(newActive);
      }
    } catch (error) {
      console.error('Failed to slide to index:', index, error);
    }
  }

  public slideNext(): void {
    if (!this.canNavigateNext() || !this.swiper?.nativeElement?.swiper) return;

    try {
      this.swiper.nativeElement.swiper.slideNext();
    } catch (error) {
      console.error('Failed to slide next:', error);
    }
  }

  public slidePrev(): void {
    if (!this.canNavigatePrev() || !this.swiper?.nativeElement?.swiper) return;

    try {
      this.swiper.nativeElement.swiper.slidePrev();
    } catch (error) {
      console.error('Failed to slide previous:', error);
    }
  }

  public hasNotice(calendar: Calendar, feed: Feed[] | undefined): boolean {
    if (feed) {
      const item = this.getSelectedItem(calendar, feed);
      return item ? !item.active : false;
    }
    return false;
  }

  public isToday(calendar: Calendar): boolean {
    if (!calendar?.date) return false;

    try {
      return dayjs(calendar.date).isSame(dayjs(), 'day');
    } catch (error) {
      console.error('Failed to check if date is today:', error);
      return false;
    }
  }

  private getSelectedItem(calendar: Calendar, feed: Feed[]): Feed | undefined {
    if (!calendar?.date || !Array.isArray(feed)) return undefined;

    try {
      const filteredFeed = feed.filter(item => {
        if (!item?.date) return false;
        return dayjs(item.date.toDate()).isSame(calendar.date, 'day');
      });

      return filteredFeed.length > 0 ? filteredFeed[0] : undefined;
    } catch (error) {
      console.error('Failed to get selected item:', error);
      return undefined;
    }
  }

  private async slideEnd() {
    const items = this.items();
    const date = items[items.length - 1];
    if (!date) return;
    const end = dayjs(date.text).add(10, 'day');
    this.items.set(items.concat(this.getDatesBetween(dayjs(date.text).add(1, 'day'), end)));
    this.swiper?.nativeElement.swiper.update();
  }

  private async slideStart() {
    const items = this.items();
    const date = items[0];
    if (!date) return;
    const start = dayjs(date.text).subtract(5, 'days');
    const newItems = this.getDatesBetween(start, dayjs(date.text).subtract(1, 'day'));
    this.items.set(newItems.concat(items));

    this.swiper?.nativeElement.swiper.update();
  }

  private getDatesBetween(startDate?: Dayjs, endDate?: Dayjs): Calendar[] {
    try {
      let start = startDate ?? dayjs().subtract(6, 'days');
      const end = endDate ?? dayjs().add(6, 'day');
      const dates: Calendar[] = [];

      // Safety check to prevent infinite loops
      let iterations = 0;
      const maxIterations = 365; // Maximum 1 year worth of dates

      while (start.isSameOrBefore(end) && iterations < maxIterations) {
        dates.push(this.getCalendarFormat(start));
        start = start.add(1, 'day');
        iterations++;
      }

      return dates;
    } catch (error) {
      console.error('Failed to generate date range:', error);
      return [];
    }
  }

  private async loadData(): Promise<void> {
    const active = this.active();
    const dateRange = this.dateRange();

    if (!dateRange || !active) {
      this.isLoading.set(false);
      await this.loading?.dismiss();
      return;
    }

    try {
      // Clear any previous errors
      this.error.set(null);

      // Use runInInjectionContext for Firebase operations
      // await runInInjectionContext(this.injector, () => {
      return new Promise<void>((resolve, reject) => {
        this.feed
          .getFeeds({
            startDate: dateRange.start,
            endDate: dateRange.end,
            type: 'NYC'
          })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (feed: Feed[]) => {
              try {
                this.selected.set(this.getSelectedItem(active, feed) ?? dayjs(active.date));
                this.feeds.set(feed);

                // Smooth loading state transition
                setTimeout(async () => {
                  this.isLoading.set(false);
                  await this.loading?.dismiss();
                  resolve();
                }, 250);
              } catch (error) {
                reject(error);
              }
            },
            error: error => {
              console.error('Failed to load calendar data:', error);
              this.error.set('Failed to load parking data');
              this.isLoading.set(false);
              this.loading?.dismiss();
              reject(error);
            }
          });
      });
      //  });
    } catch (error) {
      console.error('Failed to load calendar data:', error);
      this.error.set('Failed to load parking data');
      this.isLoading.set(false);
      await this.loading?.dismiss();
    }
  }

  private getCalendarFormat(date: Dayjs): Calendar {
    if (!date?.isValid?.()) {
      throw new Error('Invalid date provided to getCalendarFormat');
    }

    return {
      text: date.format(),
      date: date.toDate(),
      month: {
        short: date.format('MMM'),
        long: date.format('MMMM')
      },
      day: {
        short: date.format('ddd'),
        long: date.format('dddd'),
        num: date.format('DD')
      }
    };
  }
}
