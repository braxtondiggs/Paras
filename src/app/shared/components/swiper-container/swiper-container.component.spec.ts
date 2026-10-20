import { createHostFactory, type SpectatorHost } from '@ngneat/spectator/jest';
import { SwiperContainerComponent } from './swiper-container.component';
import { SwiperSlideComponent } from './swiper-slide.component';

type SwiperProps = HTMLElement &
  Record<'initialSlide' | 'slidesPerView' | 'spaceBetween', number> & {
    centeredSlides: boolean;
    allowTouchMove: boolean;
  };

describe('SwiperContainerComponent', () => {
  let spectator: SpectatorHost<SwiperContainerComponent>;

  const createHost = createHostFactory({
    component: SwiperContainerComponent,
    imports: [SwiperSlideComponent]
  });

  const swiperContainer = () => spectator.query('swiper-container') as SwiperProps;

  it('renders <swiper-container> with projected <swiper-slide> children and forwards inputs', () => {
    spectator = createHost(
      `<app-swiper-container
        [initialSlide]="6"
        [slidesPerView]="7"
        [spaceBetween]="4"
        [centeredSlides]="true"
        [allowTouchMove]="false"
        role="tabpanel"
        aria-label="Calendar view"
      >
        <swiper-slide class="swiper-slide"><span class="day">1</span></swiper-slide>
        <swiper-slide class="swiper-slide"><span class="day">2</span></swiper-slide>
      </app-swiper-container>`
    );

    const container = swiperContainer();
    const slides = Array.from(container.children);
    expect(slides.map(slide => slide.tagName)).toEqual(['SWIPER-SLIDE', 'SWIPER-SLIDE']);
    expect(slides.map(slide => slide.querySelector(':scope > .day')?.textContent)).toEqual(['1', '2']);

    expect(container.initialSlide).toBe(6);
    expect(container.slidesPerView).toBe(7);
    expect(container.spaceBetween).toBe(4);
    expect(container.centeredSlides).toBe(true);
    expect(container.allowTouchMove).toBe(false);
    // role/aria-label stay on the wrapper host only, so the tabpanel isn't announced twice
    expect(spectator.element.getAttribute('role')).toBe('tabpanel');
    expect(spectator.element.getAttribute('aria-label')).toBe('Calendar view');
    expect(container.hasAttribute('role')).toBe(false);
    expect(container.hasAttribute('aria-label')).toBe(false);
  });

  it('uses Swiper defaults when inputs are omitted', () => {
    spectator = createHost('<app-swiper-container><swiper-slide>A</swiper-slide></app-swiper-container>');

    const container = swiperContainer();
    expect(container.initialSlide).toBe(0);
    expect(container.slidesPerView).toBe(1);
    expect(container.spaceBetween).toBe(0);
    expect(container.centeredSlides).toBe(false);
    expect(container.allowTouchMove).toBe(true);
  });

  it('exposes the <swiper-container> element and re-emits swiperslidechange', () => {
    spectator = createHost('<app-swiper-container><swiper-slide>A</swiper-slide></app-swiper-container>');
    const slideChange = jest.fn();
    spectator.output('slideChange').subscribe(slideChange);

    expect(spectator.component.nativeElement).toBe(swiperContainer());

    swiperContainer().dispatchEvent(new CustomEvent('swiperslidechange'));
    expect(slideChange).toHaveBeenCalledTimes(1);
  });

  it('keeps swiper.allowTouchMove in sync with the allowTouchMove input', () => {
    spectator = createHost(
      '<app-swiper-container [allowTouchMove]="allow"><swiper-slide>A</swiper-slide></app-swiper-container>',
      { hostProps: { allow: false } }
    );
    // Swiper Element isn't registered under jsdom, so stand in for the instance it creates on init. Its live
    // flag starts at the constructor default, which setting the element property afterwards doesn't touch
    const swiper = { allowTouchMove: true };
    Object.assign(swiperContainer(), { swiper });
    swiperContainer().dispatchEvent(new CustomEvent('swiperinit'));
    expect(spectator.component.nativeElement?.swiper.allowTouchMove).toBe(false);

    spectator.setHostInput({ allow: true });
    expect(swiper.allowTouchMove).toBe(true);

    spectator.setHostInput({ allow: false });
    expect(swiper.allowTouchMove).toBe(false);
  });
});
