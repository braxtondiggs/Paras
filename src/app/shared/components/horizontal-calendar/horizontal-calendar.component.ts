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

import dayjs, { Dayjs } from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

import { FeedService, type Feed } from '@core/services';
import { Calendar } from '@shared/interfaces';
import { CardDetailComponent } from '../card-detail/card-detail.component';

// Swiper instance interface
interface SwiperInstance {
  activeIndex: number;
  slideTo(index: number, speed?: number): void;
  slideNext(): void;
  slidePrev(): void;
  update(): void;
}
// Constants for better maintainability
const CALENDAR_CONFIG = {
  INITIAL_SLIDE: 6,
  SLIDES_PER_VIEW: 7,
  SPACE_BETWEEN: 4,
  PRELOAD_DAYS_BEFORE: 6,
  PRELOAD_DAYS_AFTER: 6,
  LOAD_MORE_THRESHOLD: 3,
  ADD_DAYS_ON_SCROLL: 10,
  MAX_DATE_ITERATIONS: 365,
  SLIDE_ANIMATION_DURATION: 250,
  DEBOUNCE_DELAY: 16, // ~1 frame at 60fps
  DATA_LOAD_DELAY: 250
} as const;

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
  @ViewChild('swiper', { static: false })
  public readonly swiper?: ElementRef<{ swiper: SwiperInstance }>;

  // Injected dependencies
  private readonly feedService = inject(FeedService);
  private readonly loadingController = inject(LoadingController);
  private readonly destroyRef = inject(DestroyRef);

  // Reactive state signals
  readonly isLoading = signal<boolean>(true);
  readonly selected = signal<Feed | Dayjs | undefined>(undefined);
  readonly feeds = signal<Feed[]>([]);
  readonly active = signal<Calendar | undefined>(undefined);

  // Stable selected - simple signal that updates only when needed
  readonly stableSelected = signal<Feed | Dayjs | undefined>(undefined);
  readonly items = signal<Calendar[]>([]);
  readonly error = signal<string | null>(null);
  readonly isSliding = signal<boolean>(false);

  // Internal state for preventing concurrent updates
  private isUpdatingSwiper = false;

  // Computed properties for derived state
  readonly dateRange = computed(() => {
    const items = this.items();
    if (items.length === 0) return null;

    const start = items[0];
    const end = items[items.length - 1];
    return start && end
      ? {
          start: dayjs(start.date),
          end: dayjs(end.date)
        }
      : null;
  });

  readonly hasError = computed(() => !!this.error());
  readonly hasFeeds = computed(() => this.feeds().length > 0);
  readonly canNavigate = computed(() => !this.isLoading() && !this.isSliding());

  // Loading state management
  private loadingElement?: HTMLIonLoadingElement;

  constructor() {
    // Register icons for better performance
    addIcons({ arrowBack, arrowForward });

    // Extend dayjs with plugins once
    dayjs.extend(isSameOrBefore);
    dayjs.extend(advancedFormat);

    // Set up reactive effect for data loading
    effect(() => {
      const active = this.active();
      const dateRange = this.dateRange();

      if (active && dateRange && !this.isLoading()) {
        this.loadData().catch(error => {
          console.error('Effect data loading failed:', error);
          this.handleError('Failed to load calendar data');
        });
      }
    });

    // Set up reactive effect for stable selected updates
    effect(() => {
      const selected = this.selected();
      const isActivelySliding = this.isSliding() || this.isUpdatingSwiper;

      // Only update stable selected when not actively sliding
      if (!isActivelySliding) {
        this.stableSelected.set(selected);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.initializeComponent();
    } catch (error) {
      console.error('Failed to initialize horizontal calendar:', error);
      this.handleError('Failed to initialize calendar');
    }
  }

  /**
   * Initialize the component with loading state and default data
   */
  private async initializeComponent(): Promise<void> {
    // Show loading indicator
    this.loadingElement = await this.loadingController.create({
      message: 'Loading calendar...',
      spinner: 'crescent',
      translucent: true
    });
    await this.loadingElement.present();

    // Initialize calendar dates
    const initialDates = this.generateInitialDates();
    this.items.set(initialDates);
    this.active.set(initialDates[CALENDAR_CONFIG.INITIAL_SLIDE]);

    // Load initial data
    await this.loadData();
  }

  /**
   * Generate initial date range for the calendar
   */
  private generateInitialDates(): Calendar[] {
    return this.getDatesBetween(
      dayjs().subtract(CALENDAR_CONFIG.PRELOAD_DAYS_BEFORE, 'days'),
      dayjs().add(CALENDAR_CONFIG.PRELOAD_DAYS_AFTER, 'days')
    );
  }

  /**
   * Centralized error handling
   */
  private handleError(message: string): void {
    this.error.set(message);
    this.isLoading.set(false);
    this.loadingElement?.dismiss().catch(console.error);
  }

  /**
   * Handle slide change events from swiper
   */
  async onSlideChange(): Promise<void> {
    const swiperInstance = this.getSwiperInstance();
    if (!swiperInstance) return;

    const index = swiperInstance.activeIndex;
    if (typeof index !== 'number') return;

    try {
      // Prevent concurrent slide processing or swiper updates
      if (this.isSliding() || this.isUpdatingSwiper) return;

      this.isSliding.set(true);
      const items = this.items();

      // Update active date
      const newActive = items[index];
      if (newActive) {
        this.active.set(newActive);
      }

      // Load more dates if approaching boundaries
      await this.handleBoundarySliding(index, items.length);
    } catch (error) {
      console.error('Failed to handle slide change:', error);
      this.handleError('Failed to update calendar');
    } finally {
      this.isSliding.set(false);
    }
  }

  /**
   * Navigate to a specific slide index
   */
  public slideTo(index: number, speed = CALENDAR_CONFIG.SLIDE_ANIMATION_DURATION): void {
    if (!this.canNavigate() || !this.isValidIndex(index)) return;

    const swiperInstance = this.getSwiperInstance();
    if (!swiperInstance) return;

    try {
      swiperInstance.slideTo(index, speed);
      this.updateActiveDate(index);
    } catch (error) {
      console.error('Failed to slide to index:', index, error);
    }
  }

  /**
   * Navigate to next slide
   */
  public slideNext(): void {
    if (!this.canNavigate()) return;

    const swiperInstance = this.getSwiperInstance();
    if (!swiperInstance) return;

    try {
      swiperInstance.slideNext();
    } catch (error) {
      console.error('Failed to slide next:', error);
    }
  }

  /**
   * Navigate to previous slide
   */
  public slidePrev(): void {
    if (!this.canNavigate()) return;

    const swiperInstance = this.getSwiperInstance();
    if (!swiperInstance) return;

    try {
      swiperInstance.slidePrev();
    } catch (error) {
      console.error('Failed to slide previous:', error);
    }
  }

  /**
   * Get swiper instance safely
   */
  private getSwiperInstance(): SwiperInstance | null {
    return this.swiper?.nativeElement?.swiper || null;
  }

  /**
   * Check if index is valid for current items array
   */
  private isValidIndex(index: number): boolean {
    const items = this.items();
    return index >= 0 && index < items.length;
  }

  /**
   * Update active date when sliding to specific index
   */
  private updateActiveDate(index: number): void {
    const items = this.items();
    const newActive = items[index];
    if (newActive) {
      this.active.set(newActive);
    }
  }

  /**
   * Handle sliding near boundaries to load more dates
   */
  private async handleBoundarySliding(index: number, itemsLength: number): Promise<void> {
    const threshold = CALENDAR_CONFIG.LOAD_MORE_THRESHOLD;

    if (itemsLength - threshold <= index) {
      await this.slideEnd();
    } else if (index <= threshold) {
      await this.slideStart();
    }
  }

  /**
   * Check if a calendar date has a notice/alert
   */
  public hasNotice(calendar: Calendar, feeds: Feed[] | undefined): boolean {
    if (!feeds || !calendar?.date) return false;

    try {
      const item = this.getSelectedItem(calendar, feeds);
      return item ? !item.active : false;
    } catch (error) {
      console.error('Failed to check notice status:', error);
      return false;
    }
  }

  /**
   * Check if a calendar date is today
   */
  public isToday(calendar: Calendar): boolean {
    if (!calendar?.date) return false;

    try {
      return dayjs(calendar.date).isSame(dayjs(), 'day');
    } catch (error) {
      console.error('Failed to check if date is today:', error);
      return false;
    }
  }

  /**
   * Get the feed item for a specific calendar date
   */
  private getSelectedItem(calendar: Calendar, feeds: Feed[]): Feed | undefined {
    if (!calendar?.date || !Array.isArray(feeds)) return undefined;

    try {
      return feeds.find(item => {
        if (!item?.date) return false;
        return dayjs(item.date.toDate()).isSame(calendar.date, 'day');
      });
    } catch (error) {
      console.error('Failed to get selected item:', error);
      return undefined;
    }
  }

  /**
   * Add more dates to the end when scrolling right
   */
  private async slideEnd(): Promise<void> {
    const items = this.items();
    const lastItem = items[items.length - 1];
    if (!lastItem || this.isUpdatingSwiper) return;

    try {
      this.isUpdatingSwiper = true;
      const startDate = dayjs(lastItem.text).add(1, 'day');
      const endDate = startDate.add(CALENDAR_CONFIG.ADD_DAYS_ON_SCROLL, 'day');
      const newItems = this.getDatesBetween(startDate, endDate);

      this.items.set([...items, ...newItems]);
      this.updateSwiperAfterDelay();
    } catch (error) {
      console.error('Failed to load more dates at end:', error);
    } finally {
      this.isUpdatingSwiper = false;
    }
  }

  /**
   * Add more dates to the beginning when scrolling left
   */
  private async slideStart(): Promise<void> {
    const items = this.items();
    const firstItem = items[0];
    if (!firstItem || this.isUpdatingSwiper) return;

    try {
      this.isUpdatingSwiper = true;
      const swiperInstance = this.getSwiperInstance();
      const currentIndex = swiperInstance?.activeIndex ?? 0;

      const endDate = dayjs(firstItem.text).subtract(1, 'day');
      const startDate = endDate.subtract(CALENDAR_CONFIG.ADD_DAYS_ON_SCROLL - 1, 'day');
      const newItems = this.getDatesBetween(startDate, endDate);

      // Update items array
      this.items.set([...newItems, ...items]);

      // Update swiper and maintain position
      this.updateSwiperWithPositionCorrection(currentIndex, newItems.length);
    } catch (error) {
      console.error('Failed to load more dates at start:', error);
    } finally {
      this.isUpdatingSwiper = false;
    }
  }

  /**
   * Update swiper after a delay to ensure DOM updates
   */
  private updateSwiperAfterDelay(): void {
    setTimeout(() => {
      const swiperInstance = this.getSwiperInstance();
      swiperInstance?.update();
    }, CALENDAR_CONFIG.DEBOUNCE_DELAY);
  }

  /**
   * Update swiper and correct position after adding items to the beginning
   */
  private updateSwiperWithPositionCorrection(currentIndex: number, addedCount: number): void {
    const swiperInstance = this.getSwiperInstance();
    if (!swiperInstance) return;

    swiperInstance.update();

    setTimeout(() => {
      const newIndex = currentIndex + addedCount;
      swiperInstance.slideTo(newIndex, 0); // No animation to prevent jumping
    }, CALENDAR_CONFIG.DEBOUNCE_DELAY);
  }

  /**
   * Generate calendar dates between start and end dates
   */
  private getDatesBetween(startDate?: Dayjs, endDate?: Dayjs): Calendar[] {
    try {
      let start = startDate ?? dayjs().subtract(CALENDAR_CONFIG.PRELOAD_DAYS_BEFORE, 'days');
      const end = endDate ?? dayjs().add(CALENDAR_CONFIG.PRELOAD_DAYS_AFTER, 'days');
      const dates: Calendar[] = [];

      // Safety check to prevent infinite loops
      let iterations = 0;

      while (start.isSameOrBefore(end) && iterations < CALENDAR_CONFIG.MAX_DATE_ITERATIONS) {
        dates.push(this.createCalendarItem(start));
        start = start.add(1, 'day');
        iterations++;
      }

      return dates;
    } catch (error) {
      console.error('Failed to generate date range:', error);
      return [];
    }
  }

  /**
   * Load feed data for the current date range
   */
  private async loadData(): Promise<void> {
    const active = this.active();
    const dateRange = this.dateRange();

    if (!dateRange || !active) {
      this.finalizeLoading();
      return;
    }

    try {
      this.error.set(null);

      await new Promise<void>((resolve, reject) => {
        this.feedService
          .getFeeds({
            startDate: dateRange.start,
            endDate: dateRange.end,
            type: 'NYC'
          })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (feeds: Feed[]) => {
              try {
                this.processLoadedData(active, feeds);
                this.scheduleLoadingCompletion(resolve);
              } catch (error) {
                reject(error);
              }
            },
            error: (error: unknown) => {
              console.error('Failed to load calendar data:', error);
              this.handleError('Failed to load parking data');
              reject(error);
            }
          });
      });
    } catch (error) {
      console.error('Failed to load calendar data:', error);
      this.handleError('Failed to load parking data');
    }
  }

  /**
   * Process the loaded feed data
   */
  private processLoadedData(active: Calendar, feeds: Feed[]): void {
    const selectedItem = this.getSelectedItem(active, feeds);
    const newSelected = selectedItem ?? dayjs(active.date);

    this.selected.set(newSelected);
    this.feeds.set(feeds);

    // Set stable selected immediately on initial load since we're not sliding
    this.stableSelected.set(newSelected);
  }

  /**
   * Schedule loading completion with smooth transition
   */
  private scheduleLoadingCompletion(resolve: () => void): void {
    setTimeout(async () => {
      this.finalizeLoading();
      this.centerOnActiveDate();
      resolve();
    }, CALENDAR_CONFIG.DATA_LOAD_DELAY);
  }

  /**
   * Finalize loading state and dismiss loader
   */
  private finalizeLoading(): void {
    this.isLoading.set(false);
    this.loadingElement?.dismiss().catch(console.error);
  }

  /**
   * Center swiper on active date (initial load only)
   */
  private centerOnActiveDate(): void {
    setTimeout(() => {
      // Prevent jumping during navigation or updates
      if (this.isSliding() || this.isUpdatingSwiper) return;

      const items = this.items();
      const active = this.active();
      const swiperInstance = this.getSwiperInstance();

      if (items.length > 0 && active && swiperInstance) {
        const activeIndex = items.findIndex(item => dayjs(item.date).isSame(dayjs(active.date), 'day'));

        if (activeIndex >= 0) {
          // Temporarily set updating flag to prevent conflicts
          this.isUpdatingSwiper = true;
          swiperInstance.slideTo(activeIndex, 0); // No animation on initial load

          // Reset flag after a short delay
          setTimeout(() => {
            this.isUpdatingSwiper = false;
          }, CALENDAR_CONFIG.DEBOUNCE_DELAY);
        }
      }
    }, 100);
  }

  /**
   * Create a calendar item from a dayjs date
   */
  private createCalendarItem(date: Dayjs): Calendar {
    if (!date?.isValid?.()) {
      throw new Error('Invalid date provided to createCalendarItem');
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
