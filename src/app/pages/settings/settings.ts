import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideCalendarPlus,
  LucideCheck,
  LucideChevronRight,
  LucideChevronsUpDown,
  LucideCopy,
  LucideRotateCcw,
  LucideShare,
  LucideUserPlus,
} from '@lucide/angular';
import { PLATFORMS, type PlatformKey } from '../../../../api/_lib/platforms.js';
import { AuthService } from '../../core/auth.service';
import { EventsService } from '../../core/events.service';
import { LibraryService } from '../../core/library.service';
import { PsnAddAll } from '../../core/psn-add-all.service';
import { PsnService } from '../../core/psn.service';
import { PushService } from '../../core/push.service';
import { ToastService } from '../../core/toast.service';
import { GROUNDS, GroundService } from '../../core/ground';
import { subscribeUrl } from '../../core/calendar-link';
import { isAndroid } from '../../core/platform';
import { PinnedTop } from '../../shared/pinned-top';
import { SheetPicker } from '../../shared/sheet-picker';
import { TabTitle } from '../../shared/tab-title';

@Component({
  selector: 'app-settings',
  imports: [
    SheetPicker,
    TabTitle,
    PinnedTop,
    RouterLink,
    LucideCalendarPlus,
    LucideCheck,
    LucideChevronRight,
    LucideChevronsUpDown,
    LucideCopy,
    LucideRotateCcw,
    LucideShare,
    LucideUserPlus,
  ],
  templateUrl: './settings.html',
})
export class SettingsPage {
  protected readonly auth = inject(AuthService);
  protected readonly library = inject(LibraryService);
  protected readonly push = inject(PushService);
  private readonly events = inject(EventsService);
  /** The background, chosen here and kept on this device. */
  protected readonly ground = inject(GroundService);
  protected readonly grounds = GROUNDS;
  protected readonly eventCount = computed(() => this.events.events().length);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly psn = inject(PsnService);
  protected readonly addAll = inject(PsnAddAll);
  /** No games yet: the first-time setup from PlayStation is offered instead of "Add all". */
  protected readonly libraryEmpty = computed(
    () => this.library.loaded() && this.library.games().length === 0,
  );
  protected readonly psnGames = this.psn;
  /** Checking or removing the PlayStation link. */
  protected readonly psnBusy = signal(false);

  protected async linkPsn(event: Event, field: HTMLInputElement): Promise<void> {
    event.preventDefault();
    const onlineId = field.value.trim();
    if (!onlineId || this.psnBusy()) return;
    this.psnBusy.set(true);
    try {
      const link = await this.psn.link(onlineId);
      this.toast.show(`Connected ${link.onlineId}`);
      // An empty library: set it up from PlayStation (it can be skipped, and stays offered here).
      if (this.libraryEmpty()) await this.router.navigateByUrl('/setup');
    } catch (error) {
      this.toast.error((error as Error).message, error);
    } finally {
      this.psnBusy.set(false);
    }
  }

  protected readonly psnSyncing = signal(false);

  /** "Today 10:05 · 4 games updated", "Not yet", or why the last one failed. */
  protected readonly syncedLine = computed(() => {
    const sync = this.library.settings().psnSync;
    if (!sync) return 'Not yet';
    const when = (ms: number) => {
      const d = new Date(ms);
      const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const day =
        d.toDateString() === new Date().toDateString()
          ? 'Today'
          : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      return `${day} ${time}`;
    };
    if (!sync.ok) {
      const last = sync.lastOkAt ? ` Last worked ${when(sync.lastOkAt)}.` : '';
      return `${sync.error ?? 'It failed.'} Nothing was changed.${last}`;
    }
    const n = sync.changed ?? 0;
    return `${when(sync.at)} · ${n ? `${n} ${n === 1 ? 'game' : 'games'} updated` : 'up to date'}`;
  });

  protected async syncPsn(): Promise<void> {
    if (this.psnSyncing()) return;
    this.psnSyncing.set(true);
    try {
      const state = await this.psn.syncNow();
      const n = state.changed ?? 0;
      const p = state.platinums ?? 0;
      const platinums = p ? ` · ${p} ${p === 1 ? 'Platinum' : 'Platinums'} completed` : '';
      this.toast.show(
        n ? `Synced: ${n} ${n === 1 ? 'game' : 'games'} updated${platinums}` : 'Synced: up to date',
      );
    } catch (error) {
      this.toast.error((error as Error).message, error);
    } finally {
      this.psnSyncing.set(false);
    }
  }

  protected async unlinkPsn(): Promise<void> {
    if (this.psnBusy() || !confirm('Disconnect your PlayStation account?')) return;
    this.psnBusy.set(true);
    try {
      await this.psn.unlink();
      this.toast.show('PlayStation disconnected');
    } catch (error) {
      this.toast.error((error as Error).message, error);
    } finally {
      this.psnBusy.set(false);
    }
  }

  protected readonly platforms = PLATFORMS;
  protected readonly dayOptions = [0, 1, 2, 3, 5, 7];

  protected readonly calendarUrl = computed(() => {
    const key = this.library.settings().calendarKey;
    return key ? `${location.origin}/api/calendar.ics?key=${key}` : null;
  });
  /**
   * Where "Add to Calendar" goes. iPhone opens webcal: links in its Calendar app, which asks to
   * subscribe. Android has nothing that opens them (the button did nothing), so there it opens
   * Google Calendar's "add this calendar" page, which then syncs to the phone's Calendar app.
   */
  protected readonly onAndroid = isAndroid();
  protected readonly addCalendarUrl = computed(() => {
    const url = this.calendarUrl();
    return url ? subscribeUrl(url, this.onAndroid) : null;
  });

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
    this.library.saveSettings({
      notifyDaysBefore: Number((event.target as HTMLSelectElement).value),
    });
  }

  protected setPlatform(key: PlatformKey): void {
    this.library.saveSettings({ defaultPlatform: key });
  }

  protected dayLabel(days: number): string {
    if (days === 0) return 'On the day';
    return days === 1 ? '1 day before' : `${days} days before`;
  }

  /** Makes your calendar link if needed and opens the calendar's "Subscribe" prompt. */
  protected subscribe(): void {
    const key = this.library.calendarKey();
    const url = subscribeUrl(`${location.origin}/api/calendar.ics?key=${key}`, this.onAndroid);
    if (this.onAndroid) window.open(url, '_blank');
    else location.href = url;
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
    if (
      !confirm('Make a new link? The old one stops working, so calendars using it stop updating.')
    )
      return;
    this.library.calendarKey(true);
    this.toast.show('New link made');
  }

  /** The invite link made last on this visit, and until when it works. */
  protected readonly invite = signal<{ url: string; until: string } | null>(null);
  protected readonly inviteBusy = signal(false);
  protected readonly canShare = typeof navigator.share === 'function';

  protected async createInvite(): Promise<void> {
    if (this.inviteBusy()) return;
    this.inviteBusy.set(true);
    try {
      const { url, expiresAt } = await this.auth.createInvite();
      const until = new Date(expiresAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      });
      this.invite.set({ url, until });
    } catch (error) {
      this.toast.error("Couldn't make an invite link. Try again in a moment.", error);
    } finally {
      this.inviteBusy.set(false);
    }
  }

  /** The share sheet needs a tap of its own (not one after a server call), so it's its own row. */
  protected async shareInvite(): Promise<void> {
    const url = this.invite()?.url;
    if (!url) return;
    try {
      await navigator.share({ title: 'Questloggd', text: 'Join me on Questloggd', url });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') await this.copyInvite();
    }
  }

  protected async copyInvite(): Promise<void> {
    const url = this.invite()?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.toast.show('Invite link copied');
    } catch {
      this.toast.error("Couldn't copy. Press and hold the link to copy it.");
    }
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
