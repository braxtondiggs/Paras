import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Lets templates use Swiper's `<swiper-slide>` web component without `CUSTOM_ELEMENTS_SCHEMA`.
 * The host element is the `<swiper-slide>` itself, so slides stay direct children of
 * `<swiper-container>` and existing `.swiper-slide` styles keep matching.
 */
@Component({
  standalone: true,
  // eslint-disable-next-line @angular-eslint/component-selector -- must be Swiper's own element, not a wrapper
  selector: 'swiper-slide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content />'
})
export class SwiperSlideComponent {}
