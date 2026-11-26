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
    // First-time setup from PlayStation: full screen, without the tab bar.
    path: 'setup',
    title: 'Set up your Library · Questloggd',
    canActivate: [signedInGuard],
    loadComponent: () => import('./pages/setup/setup').then((m) => m.SetupPage),
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
        // One of Search's lists in full, from "See all" by its strip.
        path: 'search/:kind',
        title: 'Search · Questloggd',
        data: { back: true },
        loadComponent: () => import('./pages/discover/discover').then((m) => m.DiscoverPage),
      },
      {
        path: 'game/:id',
        title: 'Game · Questloggd',
        data: { back: true, hero: true },
        loadComponent: () => import('./pages/game/game').then((m) => m.GamePage),
      },
      {
        // A game's trophies, from the Trophies card on its page.
        path: 'game/:id/trophies',
        title: 'Trophies · Questloggd',
        data: { title: 'Trophies', back: true },
        loadComponent: () => import('./pages/trophies/trophies').then((m) => m.TrophiesPage),
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
        // Also where a What's new notification opens.
        path: 'whats-new',
        title: 'What’s new · Questloggd',
        data: { title: 'What’s new', back: true },
        loadComponent: () => import('./pages/whats-new/whats-new').then((m) => m.WhatsNewPage),
      },
      {
        path: 'settings/wallpaper',
        title: 'Wallpaper · Questloggd',
        data: { title: 'Wallpaper', back: true },
        loadComponent: () => import('./pages/wallpaper/wallpaper').then((m) => m.WallpaperPage),
      },
      {
        path: 'settings/art',
        title: 'Game art · Questloggd',
        data: { title: 'Game art', back: true },
        loadComponent: () => import('./pages/art/art').then((m) => m.ArtPage),
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
