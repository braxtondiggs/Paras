import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

import { IonCard, IonCardContent, IonCardHeader, IonIcon, IonItem, IonList, IonText } from '@ionic/angular/standalone';

import dayjs, { Dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import advancedFormat from 'dayjs/plugin/advancedFormat';

import { addIcons } from 'ionicons';
import { closeCircleOutline, checkmarkCircleOutline } from 'ionicons/icons';

import { Feed } from '@shared/interfaces';

@Component({
  standalone: true,
  imports: [IonCard, IonCardContent, IonCardHeader, IonIcon, IonItem, IonList, IonText],
  selector: 'app-card-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card-detail.component.html',
  styleUrls: ['./card-detail.component.scss']
})
export class CardDetailComponent {
  readonly item = input<Feed | Dayjs>();
  readonly detail = computed(() => {
    const currentItem = this.item();
    if (!currentItem) return undefined;

    if (!dayjs.isDayjs(currentItem)) {
      return {
        ...currentItem,
        created: dayjs(currentItem.created.toDate()).fromNow(),
        date: dayjs(currentItem.date.toDate()).format('MMMM Do YYYY'),
        lastUpdated:
          dayjs(currentItem.date.toDate()).isSame(dayjs(), 'day') ||
          dayjs(currentItem.date.toDate()).isSame(dayjs().add(1, 'day'), 'day'),
        reason: currentItem.reason
      };
    } else {
      return {
        active: true,
        created: currentItem.fromNow(),
        date: currentItem.format('MMMM Do YYYY'),
        metered: true,
        lastUpdated: currentItem.isSame(dayjs(), 'day'),
        reason: undefined
      };
    }
  });

  constructor() {
    dayjs.extend(relativeTime);
    dayjs.extend(advancedFormat);
    addIcons({ closeCircleOutline, checkmarkCircleOutline });
  }
}
