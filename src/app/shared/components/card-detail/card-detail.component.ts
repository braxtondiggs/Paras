import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import {
  IonBadge,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonIcon,
  IonItem,
  IonList,
  IonSkeletonText,
  IonText
} from '@ionic/angular/standalone';

import dayjs, { type Dayjs } from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

import { addIcons } from 'ionicons';
import {
  calendarOutline,
  carOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  documentOutline,
  informationCircleOutline,
  refreshOutline,
  timeOutline
} from 'ionicons/icons';

import { type Feed } from '@core/types/firestore.types';

// Type definitions for better type safety
type CardDetailInput = Feed | Dayjs;

type StatusColor = 'success' | 'danger' | 'primary' | 'medium';

type StatusIconName = 'checkmark-circle-outline' | 'close-circle-outline' | 'time-outline';

// Enhanced view model with better type definitions
interface CardDetailViewModel {
  readonly active: boolean;
  readonly created: string;
  readonly date: string;
  readonly metered: boolean;
  readonly lastUpdated: boolean;
  readonly reason?: string;
  readonly text?: string;
  readonly type?: string;
}

// Constants for better maintainability
const CARD_CONFIG = {
  DATE_FORMAT: 'MMMM Do YYYY',
  METERS_IN_EFFECT: 'In Effect',
  METERS_NOT_IN_EFFECT: 'Not in Effect',
  DEFAULT_ACTIVE_STATE: true,
  DEFAULT_METERED_STATE: true
} as const;

@Component({
  standalone: true,
  imports: [IonCard, IonCardContent, IonCardHeader, IonIcon, IonItem, IonList, IonText, IonBadge, IonSkeletonText],
  selector: 'app-card-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card-detail.component.html',
  styleUrls: ['./card-detail.component.scss'],
  host: {
    role: 'region',
    'aria-label': 'Parking details card'
  }
})
export class CardDetailComponent {
  readonly item = input<CardDetailInput>();
  readonly showBorder = input<boolean>(true);
  readonly isLoading = signal<boolean>(false);

  constructor() {
    // Initialize dayjs plugins and icons once
    dayjs.extend(relativeTime);
    dayjs.extend(advancedFormat);

    // Register all icons at once for better performance
    addIcons({
      closeCircleOutline,
      checkmarkCircleOutline,
      timeOutline,
      calendarOutline,
      carOutline,
      informationCircleOutline,
      refreshOutline,
      documentOutline
    });
  }

  readonly detail = computed((): CardDetailViewModel | undefined => {
    const currentItem = this.item();
    if (!currentItem) return undefined;

    return this.createViewModel(currentItem);
  });

  /**
   * Create view model from input data
   */
  private createViewModel(item: CardDetailInput): CardDetailViewModel {
    if (dayjs.isDayjs(item)) {
      return this.createDayjsViewModel(item);
    }

    return this.createFeedViewModel(item);
  }

  /**
   * Create view model from Feed data
   */
  private createFeedViewModel(feedItem: Feed): CardDetailViewModel {
    const dateValue = dayjs(feedItem.date.toDate());
    const createdValue = dayjs(feedItem.created.toDate());

    return {
      active: feedItem.active,
      created: createdValue.fromNow(),
      date: dateValue.format(CARD_CONFIG.DATE_FORMAT),
      metered: feedItem.metered,
      lastUpdated: this.isRecentlyUpdated(dateValue),
      reason: feedItem.reason,
      text: feedItem.text,
      type: feedItem.type
    };
  }

  /**
   * Create view model from Dayjs data
   */
  private createDayjsViewModel(dayjsItem: Dayjs): CardDetailViewModel {
    return {
      active: CARD_CONFIG.DEFAULT_ACTIVE_STATE,
      created: dayjsItem.fromNow(),
      date: dayjsItem.format(CARD_CONFIG.DATE_FORMAT),
      metered: CARD_CONFIG.DEFAULT_METERED_STATE,
      lastUpdated: dayjsItem.isSame(dayjs(), 'day'),
      reason: undefined,
      text: undefined,
      type: undefined
    };
  }

  /**
   * Check if date is recently updated (today or tomorrow)
   */
  private isRecentlyUpdated(date: Dayjs): boolean {
    return date.isSame(dayjs(), 'day') || date.isSame(dayjs().add(1, 'day'), 'day');
  }

  readonly statusColor = computed((): StatusColor => {
    const currentDetail = this.detail();
    if (!currentDetail) return 'medium';
    return currentDetail.active ? 'primary' : 'danger';
  });

  readonly statusIcon = computed((): StatusIconName => {
    const currentDetail = this.detail();
    if (!currentDetail) return 'time-outline';
    return currentDetail.active ? 'checkmark-circle-outline' : 'close-circle-outline';
  });

  readonly parkingStatus = computed(() => {
    const currentDetail = this.detail();
    if (!currentDetail) return { text: 'Unknown', class: 'text-medium' };

    return {
      text: currentDetail.active ? 'In Effect' : 'Suspended',
      class: currentDetail.active ? 'text-success' : 'text-danger'
    };
  });

  readonly meterStatus = computed(() => {
    const currentDetail = this.detail();
    if (!currentDetail) return { text: 'Unknown', class: 'text-medium' };

    return {
      text: currentDetail.metered ? CARD_CONFIG.METERS_IN_EFFECT : CARD_CONFIG.METERS_NOT_IN_EFFECT,
      class: currentDetail.metered ? 'text-success' : 'text-danger'
    };
  });

  readonly cardClasses = computed(() => {
    const currentDetail = this.detail();
    if (!currentDetail) return '';

    const statusClass = `status-${currentDetail.active ? 'active' : 'inactive'}`;
    const borderClass = this.showBorder() ? '' : ' no-border';

    return `${statusClass}${borderClass}`;
  });
}
