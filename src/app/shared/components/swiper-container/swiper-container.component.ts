import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
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
      (swiperinit)="syncAllowTouchMove()"
      (swiperslidechange)="slideChange.emit()"
    >
      <ng-content />
    </swiper-container>
  `,
  // The host takes the place <swiper-container> used to have in its parent's layout (e.g. a flex
  // item in the calendar), so it must fill the available width for Swiper to size its slides
  styles: ':host { display: block; flex: 1 1 auto; min-width: 0; width: 100%; }'
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

  constructor() {
    effect(() => this.syncAllowTouchMove());
  }

  /** The underlying `<swiper-container>` element; its `.swiper` is the Swiper instance */
  get nativeElement(): SwiperContainer | undefined {
    return this.container()?.nativeElement;
  }

  /**
   * Swiper's touch handlers read the live `swiper.allowTouchMove`, but setting the element property after
   * Swiper has initialised only updates `swiper.params.allowTouchMove`, so mirror the input onto the instance.
   * Runs from an effect (input changes) and on `swiperinit` (Swiper created after the effect ran).
   */
  protected syncAllowTouchMove(): void {
    const allowTouchMove = this.allowTouchMove();
    const swiper = this.container()?.nativeElement.swiper;
    if (swiper) swiper.allowTouchMove = allowTouchMove;
  }
}
