import type { Routes } from '@angular/router';
import { authGuard } from '@shared/guards/auth.guard';
import { introGuard } from '@shared/guards/intro.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'intro',
    data: { title: 'Welcome' },
    loadComponent: () => import('@features/onboarding/intro/intro.page').then(m => m.IntroPage)
  },
  {
    path: 'home',
    data: { title: 'ASP For NYC' },
    loadComponent: () => import('@features/parking/home/home.page').then(m => m.HomePage),
    canActivate: [authGuard, introGuard]
  },
  {
    path: 'settings',
    data: { title: 'Settings' },
    loadComponent: () => import('@features/settings/settings/settings.page').then(m => m.SettingsPage),
    canActivate: [authGuard]
  }
];
