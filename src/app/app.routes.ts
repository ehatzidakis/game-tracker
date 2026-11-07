import { Routes } from '@angular/router';
import { signedInGuard, signedOutGuard } from './core/auth.guard';
import { Shell } from './shell/shell';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · Game Tracker',
    canActivate: [signedOutGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: Shell,
    canActivate: [signedInGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'calendar' },
      {
        path: 'calendar',
        title: 'Calendar · Game Tracker',
        data: { title: 'Calendar' },
        loadComponent: () => import('./pages/calendar/calendar').then((m) => m.CalendarPage),
      },
      {
        path: 'library',
        title: 'Library · Game Tracker',
        data: { title: 'Library' },
        loadComponent: () => import('./pages/library/library').then((m) => m.LibraryPage),
      },
      {
        path: 'search',
        title: 'Search · Game Tracker',
        data: { title: 'Search' },
        loadComponent: () => import('./pages/search/search').then((m) => m.SearchPage),
      },
      {
        path: 'game/:id',
        title: 'Game · Game Tracker',
        data: { back: true, hero: true },
        loadComponent: () => import('./pages/game/game').then((m) => m.GamePage),
      },
      {
        path: 'settings',
        title: 'Settings · Game Tracker',
        data: { title: 'Settings' },
        loadComponent: () => import('./pages/settings/settings').then((m) => m.SettingsPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
