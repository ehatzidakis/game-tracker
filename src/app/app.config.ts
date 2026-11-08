import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // No page cross-fade (view transitions): it animated a frozen snapshot of the whole screen,
    // tab bar included, which flickered on iPhone. Pages switch instantly, as iOS tabs do.
    provideRouter(routes, withComponentInputBinding()),
    provideTanStackQuery(new QueryClient()),
  ],
};
