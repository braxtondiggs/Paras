import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { IonButton, IonButtons, IonContent, IonHeader, IonToolbar, ModalController } from '@ionic/angular/standalone';

import dayjs, { type Dayjs } from 'dayjs';

import { type Feed } from '@core/types/firestore.types';
import { CardDetailComponent } from './../card-detail/card-detail.component';

@Component({
  standalone: true,
  imports: [CardDetailComponent, IonButton, IonButtons, IonContent, IonHeader, IonToolbar],
  selector: 'app-modal-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal-detail.component.html',
  styleUrls: ['./modal-detail.component.scss']
})
export class ModalDetailComponent implements OnInit {
  private readonly analytics = inject(Analytics);
  private readonly modal = inject(ModalController);

  readonly item = signal<Feed | Dayjs | undefined>(undefined);

  // Property to receive data from componentProps
  modalData?: Feed | Dayjs;

  constructor() {
    logEvent(this.analytics, 'screen_view', {
      firebase_screen: 'Calendar Detailed',
      firebase_screen_class: 'app-modal-detail'
    });
  }

  ngOnInit(): void {
    // Set the item from modalData if provided
    if (this.modalData) {
      this.item.set(this.modalData);
    }
  }

  /**
   * Sets the item data for the modal
   */
  setItem(itemData: Feed | Dayjs): void {
    this.item.set(itemData);
  }

  async dismiss() {
    await this.modal.dismiss();
    const currentItem = this.item();
    const isActive = currentItem && !dayjs.isDayjs(currentItem) ? currentItem.active : true;

    logEvent(this.analytics, 'custom_event', {
      modal: 'dismiss',
      active: isActive ? 'true' : 'false'
    });
  }
}
