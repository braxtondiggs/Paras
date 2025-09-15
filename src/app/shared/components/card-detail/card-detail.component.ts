import { ChangeDetectionStrategy, Component, computed, input, OnInit, signal } from '@angular/core';
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
  checkmarkCircleOutline,
  closeCircleOutline,
  timeOutline,
  carOutline,
  informationCircleOutline,
  documentTextOutline,
  refreshOutline,
  documentOutline
} from 'ionicons/icons';

import { type Feed } from '@core/types/firestore.types';

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

type CardDetailInput = Feed | Dayjs;

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
export class CardDetailComponent implements OnInit {
  readonly item = input<CardDetailInput>();
  readonly isLoading = signal(false);

  readonly detail = computed((): CardDetailViewModel | undefined => {
    const currentItem = this.item();
    if (!currentItem) return undefined;

    if (!dayjs.isDayjs(currentItem)) {
      const feedItem = currentItem as Feed;
      const dateValue = dayjs(feedItem.date.toDate());
      const createdValue = dayjs(feedItem.created.toDate());

      return {
        active: feedItem.active,
        created: createdValue.fromNow(),
        date: dateValue.format('MMMM Do YYYY'),
        metered: feedItem.metered,
        lastUpdated: dateValue.isSame(dayjs(), 'day') || dateValue.isSame(dayjs().add(1, 'day'), 'day'),
        reason: feedItem.reason,
        text: feedItem.text,
        type: feedItem.type
      } satisfies CardDetailViewModel;
    } else {
      const dayjsItem = currentItem as Dayjs;
      return {
        active: true,
        created: dayjsItem.fromNow(),
        date: dayjsItem.format('MMMM Do YYYY'),
        metered: true,
        lastUpdated: dayjsItem.isSame(dayjs(), 'day'),
        reason: undefined,
        text: undefined,
        type: undefined
      } satisfies CardDetailViewModel;
    }
  });

  readonly statusColor = computed(() => {
    const currentDetail = this.detail();
    if (!currentDetail) return 'medium';
    return currentDetail.active ? 'success' : 'danger';
  });

  readonly statusIcon = computed(() => {
    const currentDetail = this.detail();
    if (!currentDetail) return 'time-outline';
    return currentDetail.active ? 'checkmark-circle-outline' : 'close-circle-outline';
  });

  readonly statusText = computed(() => {
    const currentDetail = this.detail();
    if (!currentDetail) return 'Unknown';
    return currentDetail.active ? 'In Effect' : 'Suspended';
  });

  ngOnInit(): void {
    dayjs.extend(relativeTime);
    dayjs.extend(advancedFormat);
    addIcons({
      closeCircleOutline,
      checkmarkCircleOutline,
      timeOutline,
      calendarOutline,
      carOutline,
      informationCircleOutline,
      documentTextOutline,
      refreshOutline,
      documentOutline
    });
  }
}
