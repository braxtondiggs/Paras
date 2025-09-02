import {
  Component,
  OnInit,
  ViewChild,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  inject,
  ChangeDetectionStrategy,
  signal,
  computed,
  DestroyRef
} from '@angular/core';
import { Calendar, Feed } from '@shared/interfaces';
import { FeedService } from '@data/services';
import { LoadingController, IonRippleEffect, IonButton, IonIcon } from '@ionic/angular/standalone';
import dayjs, { Dayjs } from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import { NgClass } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { addIcons } from 'ionicons';
import { arrowBack, arrowForward } from 'ionicons/icons';
import { register } from 'swiper/element/bundle';
import { CardDetailComponent } from '../card-detail/card-detail.component';

@Component({
  standalone: true,
  imports: [CardDetailComponent, IonRippleEffect, IonButton, IonIcon, NgClass],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  selector: 'app-horizontal-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './horizontal-calendar.component.html',
  styleUrls: ['./horizontal-calendar.component.scss']
})
export class HorizontalCalendarComponent implements OnInit {
  @ViewChild('swiper', { static: false }) public swiper?: ElementRef | undefined;

  private readonly feed = inject(FeedService);
  private readonly loadingCtl = inject(LoadingController);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(true);
  readonly selected = signal<Feed | Dayjs | undefined>(undefined);
  readonly feeds = signal<Feed[] | undefined>(undefined);
  readonly active = signal<Calendar | undefined>(undefined);
  readonly items = signal<Calendar[]>([]);

  readonly dateRange = computed(() => {
    const items = this.items();
    const start = items[0];
    const end = items[items.length - 1];
    return start && end ? { start: dayjs(start.date), end: dayjs(end.date) } : null;
  });

  loading?: any;

  constructor() {
    addIcons({ arrowBack, arrowForward });
  }

  async ngOnInit() {
    dayjs.extend(isSameOrBefore);
    dayjs.extend(advancedFormat);
    this.loading = await this.loadingCtl.create();
    this.loading.present();
    const dates = this.getDatesBetween();
    this.items.set(dates);
    this.active.set(dates[6]);
    this.getData();
    register();
  }

  async onSlideChange() {
    const index = this.swiper?.nativeElement?.swiper?.activeIndex;
    if (!index) return;
    if (this.items().length - 3 <= index) {
      await this.slideEnd();
    } else if (index <= 2) {
      await this.slideStart();
    }
    this.active.set(this.items()[index]);
    this.getData();
  }

  public slideTo(index: number, speed = 250) {
    this.swiper?.nativeElement.swiper.slideTo(index, speed);
  }

  public slideNext() {
    this.swiper?.nativeElement.swiper.slideNext();
  }

  public slidePrev() {
    this.swiper?.nativeElement.swiper.slidePrev();
  }

  public hasNotice(calendar: Calendar, feed: Feed[] | undefined): boolean {
    if (feed) {
      const item = this.getSelectedItem(calendar, feed);
      return item ? !item.active : false;
    }
    return false;
  }

  private getSelectedItem(calendar: Calendar, feed: Feed[]): Feed | undefined {
    const filteredFeed = feed.filter(o => dayjs(o.date.toDate()).isSame(calendar.date, 'day'));
    if (filteredFeed.length === 0) return;
    return filteredFeed[0];
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
    this.items.set(this.getDatesBetween(start, dayjs(date.text).subtract(1, 'day')).concat(items));
    this.slideTo(7, 0);
    this.swiper?.nativeElement.swiper.update();
  }

  private getDatesBetween(startDate?: Dayjs, endDate?: Dayjs): Calendar[] {
    let start = startDate ?? dayjs().subtract(6, 'days');
    const end = endDate ?? dayjs().add(6, 'day');
    const dates: Calendar[] = [];
    while (start.isSameOrBefore(end)) {
      dates.push(this.getCalenderFormat(start));
      start = start.add(1, 'day');
    }
    return dates;
  }

  private getData() {
    const active = this.active();
    const dateRange = this.dateRange();
    if (!dateRange || !active) return;

    this.feed
      .getCachedFeeds(dateRange.start, dateRange.end) // Use cached version
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: feed => {
          this.selected.set(this.getSelectedItem(active, feed) ?? dayjs(active.date));
          this.feeds.set(feed);
          setTimeout(() => {
            this.isLoading.set(false);
            this.loading?.dismiss();
          }, 250);
        },
        error: error => {
          console.error('Failed to load calendar data:', error);
          this.isLoading.set(false);
          this.loading?.dismiss();
        }
      });
  }

  private getCalenderFormat(date: Dayjs): Calendar {
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
