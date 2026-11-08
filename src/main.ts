import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// No pinch zoom, like a native app. iOS Safari ignores user-scalable=no, but its own
// gesture events can still be cancelled.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
}

// Long press on a link or cover: no context menu (backs up -webkit-touch-callout in styles.css).
// Fields you type in keep theirs, for paste.
document.addEventListener('contextmenu', (event) => {
  if (!(event.target as Element | null)?.closest?.('input, textarea, [contenteditable]')) {
    event.preventDefault();
  }
});

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
