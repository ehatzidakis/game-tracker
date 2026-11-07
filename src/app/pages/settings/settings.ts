import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideBell, LucideCalendarPlus, LucideCopy, LucideLogOut, LucideRotateCcw } from '@lucide/angular';
import { PLATFORMS, type PlatformKey } from '../../../../api/_lib/platforms.js';
import { AuthService } from '../../core/auth.service';
import { LibraryService } from '../../core/library.service';
import { PushService } from '../../core/push.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-settings',
  imports: [LucideLogOut, LucideBell, LucideCopy, LucideCalendarPlus, LucideRotateCcw],
  templateUrl: './settings.html',
})
export class SettingsPage {
  protected readonly auth = inject(AuthService);
  protected readonly library = inject(LibraryService);
  protected readonly push = inject(PushService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly platforms = PLATFORMS;
  protected readonly dayOptions = [0, 1, 2, 3, 5, 7];

  protected readonly calendarUrl = computed(() => {
    const key = this.library.settings().calendarKey;
    return key ? `${location.origin}/api/calendar.ics?key=${key}` : null;
  });
  protected readonly webcalUrl = computed(
    () => this.calendarUrl()?.replace(/^https?:/, 'webcal:') ?? null,
  );

  protected async togglePush(): Promise<void> {
    try {
      if (this.push.enabledHere()) {
        await this.push.disable();
        this.toast.show('Alerts turned off on this device');
      } else {
        await this.push.enable();
        // Alerts are scheduled in your time zone.
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timezone && timezone !== this.library.settings().timezone) {
          this.library.saveSettings({ timezone });
        }
        if (this.push.enabledHere()) this.toast.show('Alerts on for this device');
      }
    } catch (error) {
      this.toast.error("Couldn't change notifications on this device.", error);
    }
  }

  protected async sendTest(): Promise<void> {
    try {
      await this.push.sendTest();
      this.toast.show('Test sent. It should arrive in a few seconds.');
    } catch (error) {
      this.toast.error("Couldn't send the test notification.", error);
    }
  }

  protected setTime(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (/^\d{2}:\d{2}$/.test(value)) this.library.saveSettings({ notifyTime: value });
  }

  protected setDays(event: Event): void {
    this.library.saveSettings({ notifyDaysBefore: Number((event.target as HTMLSelectElement).value) });
  }

  protected setPlatform(key: PlatformKey): void {
    this.library.saveSettings({ defaultPlatform: key });
  }

  protected dayLabel(days: number): string {
    if (days === 0) return 'On the day';
    return days === 1 ? '1 day before' : `${days} days before`;
  }

  protected createCalendarLink(): void {
    this.library.calendarKey();
  }

  protected async copyCalendarLink(): Promise<void> {
    const url = this.calendarUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.toast.show('Link copied');
    } catch {
      this.toast.error("Couldn't copy. Press and hold the link to copy it.");
    }
  }

  protected resetCalendarLink(): void {
    if (!confirm('Make a new link? The old one stops working, so calendars using it stop updating.')) return;
    this.library.calendarKey(true);
    this.toast.show('New link made');
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
