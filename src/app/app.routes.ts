import type { Routes } from '@angular/router';
import { authGuard } from '@shared/guards/auth.guard';
import { introGuard } from '@shared/guards/intro.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'intro',
    title: 'Welcome',
    data: {
      title: 'Welcome',
      animation: 'fade-in'
    },
    loadComponent: () => import('@features/onboarding/intro/intro.page').then(m => m.IntroPage)
  },
  {
    path: 'home',
    title: 'ASP For NYC',
    data: {
      title: 'ASP For NYC',
      animation: 'slide-in'
    },
    loadComponent: () => import('@features/parking/home/home.page').then(m => m.HomePage),
    canActivate: [authGuard, introGuard],
    children: [
      {
        path: 'calendar',
        title: 'Calendar View',
        data: {
          title: 'Calendar View',
          animation: 'slide-in'
        },
        loadComponent: () => import('@features/parking/home/home.page').then(m => m.HomePage)
      }
    ]
  },
  {
    path: 'settings',
    title: 'Settings',
    data: {
      title: 'Settings',
      animation: 'slide-in'
    },
    loadComponent: () => import('@features/settings/settings/settings.page').then(m => m.SettingsPage),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: 'home'
  }
];
