import { Routes } from '@angular/router';
import { signedInGuard, signedOutGuard } from './core/auth.guard';
import { Shell } from './shell/shell';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · Questloggd',
    canActivate: [signedOutGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage),
  },
  {
    // Opened from an invite link: /signup?invite=<code>.
    path: 'signup',
    title: 'Sign up · Questloggd',
    canActivate: [signedOutGuard],
    loadComponent: () => import('./pages/signup/signup').then((m) => m.SignupPage),
  },
  {
    path: '',
    component: Shell,
    canActivate: [signedInGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'calendar' },
      {
        path: 'calendar',
        title: 'Calendar · Questloggd',
        data: { title: 'Calendar' },
        loadComponent: () => import('./pages/calendar/calendar').then((m) => m.CalendarPage),
      },
      {
        path: 'library',
        title: 'Library · Questloggd',
        data: { title: 'Library' },
        loadComponent: () => import('./pages/library/library').then((m) => m.LibraryPage),
      },
      {
        path: 'search',
        title: 'Search · Questloggd',
        data: { title: 'Search' },
        loadComponent: () => import('./pages/search/search').then((m) => m.SearchPage),
      },
      {
        path: 'game/:id',
        title: 'Game · Questloggd',
        data: { back: true, hero: true },
        loadComponent: () => import('./pages/game/game').then((m) => m.GamePage),
      },
      {
        path: 'company/:id',
        title: 'Company · Questloggd',
        data: { back: true },
        loadComponent: () => import('./pages/company/company').then((m) => m.CompanyPage),
      },
      {
        path: 'event/:id',
        title: 'Event · Questloggd',
        data: { back: true },
        loadComponent: () => import('./pages/event/event').then((m) => m.EventPage),
      },
      {
        path: 'playstation',
        title: 'PlayStation games · Questloggd',
        data: { title: 'PlayStation games', back: true },
        loadComponent: () =>
          import('./pages/playstation/playstation').then((m) => m.PlaystationPage),
      },
      {
        path: 'events',
        title: 'Gaming events · Questloggd',
        data: { title: 'Gaming events', back: true },
        loadComponent: () => import('./pages/events/events').then((m) => m.EventsPage),
      },
      {
        path: 'settings',
        title: 'Settings · Questloggd',
        data: { title: 'Settings' },
        loadComponent: () => import('./pages/settings/settings').then((m) => m.SettingsPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
