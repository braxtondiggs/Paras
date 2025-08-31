import type { Spectator } from '@ngneat/spectator/jest';
import { createComponentFactory } from '@ngneat/spectator/jest';
import { RouterTestingModule } from '@angular/router/testing';
import { IonContent, IonText, IonButton } from '@ionic/angular/standalone';

import { IntroPage } from './intro.page';

describe('IntroPage', () => {
  const createComponent = createComponentFactory({
    component: IntroPage,
    imports: [IonContent, IonText, IonButton, RouterTestingModule]
  });

  let spectator: Spectator<IntroPage>;
  beforeEach(() => (spectator = createComponent()));

  it('should create', async () => {
    const app = spectator.component;
    expect(app).toBeTruthy();
  });
});
