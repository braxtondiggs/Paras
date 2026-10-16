import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  input,
  output,
  viewChild
} from '@angular/core';
import type { SwiperContainer } from 'swiper/element';

/**
 * Thin wrapper around Swiper's `<swiper-container>` web component.
 *
 * This is the only component that declares `CUSTOM_ELEMENTS_SCHEMA`, so every other template keeps
 * Angular's unknown-element/property checking. Slides are projected as direct children of
 * `<swiper-container>`; use `SwiperSlideComponent` (`<swiper-slide>`) for them.
 *
 * Input defaults match Swiper's own defaults, so leaving one unset is a no-op.
 */
@Component({
  standalone: true,
  selector: 'app-swiper-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <swiper-container
      #container
      [initialSlide]="initialSlide()"
      [slidesPerView]="slidesPerView()"
      [spaceBetween]="spaceBetween()"
      [centeredSlides]="centeredSlides()"
      [allowTouchMove]="allowTouchMove()"
      (swiperslidechange)="slideChange.emit()"
    >
      <ng-content />
    </swiper-container>
  `,
  styles: ':host { display: block; }'
})
export class SwiperContainerComponent {
  readonly initialSlide = input(0);
  readonly slidesPerView = input(1);
  readonly spaceBetween = input(0);
  readonly centeredSlides = input(false);
  readonly allowTouchMove = input(true);

  /** Re-emits Swiper's `swiperslidechange` event */
  readonly slideChange = output<void>();

  private readonly container = viewChild<ElementRef<SwiperContainer>>('container');

  /** The underlying `<swiper-container>` element; its `.swiper` is the Swiper instance */
  get nativeElement(): SwiperContainer | undefined {
    return this.container()?.nativeElement;
  }
}
