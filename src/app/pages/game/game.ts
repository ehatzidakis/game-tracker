import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  LucideBell,
  LucideCalendar,
  LucideChevronLeft,
  LucidePlay,
  LucidePlus,
  LucideTrash2,
} from '@lucide/angular';
import { releaseDatesOf } from '../../../../api/_lib/igdb-sync.js';
import {
  COMPLETIONS,
  STATUSES,
  type Completion,
  type Release,
  type Status,
} from '../../../../api/_lib/models.js';
import { PLATFORMS, platformIgdbId, platformLabel, type PlatformKey } from '../../../../api/_lib/platforms.js';
import { pickRelease } from '../../../../api/_lib/release.js';
import { countdown, isReleased } from '../../core/dates';
import { coverUrl, IgdbService } from '../../core/igdb';
import { LibraryService } from '../../core/library.service';
import { PushService } from '../../core/push.service';
import { ToastService } from '../../core/toast.service';
import { Cover } from '../../shared/cover';
import { StatusPicker } from '../../shared/status-picker';

@Component({
  selector: 'app-game',
  imports: [
    Cover,
    LucideBell,
    LucideCalendar,
    LucideChevronLeft,
    LucidePlay,
    LucidePlus,
    LucideTrash2,
  ],
  templateUrl: './game.html',
})
export class GamePage {
  /** Route parameter: the IGDB game ID. */
  readonly id = input.required<string>();

  private readonly igdb = inject(IgdbService);
  private readonly picker = inject(StatusPicker);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly library = inject(LibraryService);
  protected readonly push = inject(PushService);

  protected readonly gameId = computed(() => Number(this.id()));

  protected readonly details = injectQuery(() => ({
    queryKey: ['igdb-game', this.gameId()],
    queryFn: () => this.igdb.game(this.gameId()),
    enabled: Number.isInteger(this.gameId()),
    staleTime: 60 * 60_000,
  }));

  /** Your copy, if the game is in your library. Works offline. */
  protected readonly tracked = computed(() => this.library.byId().get(this.gameId()));

  protected readonly name = computed(
    () => this.details.data()?.name ?? this.tracked()?.name ?? '',
  );
  protected readonly coverId = computed(
    () => this.tracked()?.coverId ?? this.details.data()?.cover?.image_id ?? null,
  );
  protected readonly developer = computed(
    () =>
      this.tracked()?.developer ??
      this.details.data()?.involved_companies?.find((c) => c.developer)?.company?.name ??
      null,
  );
  protected readonly heroUrl = computed(() => {
    const d = this.details.data();
    // Screenshots first: IGDB "artworks" are often logos or text.
    const id = d?.screenshots?.[0]?.image_id ?? d?.artworks?.[0]?.image_id;
    return id ? coverUrl(id, 'screenshot_big') : null;
  });

  /** The release for your platform (or your default platform if the game isn't added yet). */
  protected readonly release = computed<Release>(() => {
    const t = this.tracked();
    if (t) return { date: t.releaseDate, precision: t.releasePrecision, label: t.releaseLabel };
    const d = this.details.data();
    const platform = platformIgdbId(this.library.settings().defaultPlatform);
    return d ? pickRelease(releaseDatesOf(d), platform) : { date: null, precision: 'tbd', label: '' };
  });
  protected readonly countdown = computed(() =>
    countdown({ releaseDate: this.release().date, releasePrecision: this.release().precision }),
  );
  protected readonly released = computed(() =>
    isReleased({ releaseDate: this.release().date, releasePrecision: this.release().precision }),
  );

  /** Our four platforms this game is on; all four if IGDB doesn't say. */
  protected readonly ourPlatforms = computed(() => {
    const on = new Set(
      this.details.data()?.platforms?.map((p) => p.id) ?? this.tracked()?.platforms ?? [],
    );
    const ours = PLATFORMS.filter((p) => on.has(p.igdbId));
    return ours.length ? ours : PLATFORMS;
  });
  protected readonly otherPlatforms = computed(() =>
    (this.details.data()?.platforms ?? [])
      .filter((p) => !PLATFORMS.some((ours) => ours.igdbId === p.id))
      .map((p) => p.abbreviation ?? p.name),
  );

  protected readonly video = computed(() => {
    const v = this.details.data()?.videos?.[0];
    // YouTube IDs only, so the embed URL below can't point anywhere else.
    return v && /^[\w-]{6,20}$/.test(v.video_id) ? v : null;
  });
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly videoEmbedUrl = computed(() => {
    const v = this.video();
    return v
      ? this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.youtube-nocookie.com/embed/${v.video_id}?autoplay=1&playsinline=1`,
        )
      : null;
  });
  protected readonly screenshots = computed(() => this.details.data()?.screenshots ?? []);
  protected readonly genres = computed(
    () => this.details.data()?.genres?.map((g) => g.name) ?? this.tracked()?.genres ?? [],
  );

  protected readonly playingVideo = signal(false);
  protected readonly summaryOpen = signal(false);

  protected readonly statuses = STATUSES;
  protected readonly completions = COMPLETIONS;
  protected readonly ratings = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  protected readonly platformLabel = platformLabel;
  protected readonly coverUrl = coverUrl;

  constructor() {
    // Keep your copy of the IGDB data current (e.g. a release date that moved).
    effect(() => {
      const t = this.tracked();
      const d = this.details.data();
      if (t && d) this.library.refresh(t, d);
    });
  }

  protected back(): void {
    if (history.length > 1) history.back();
    else void this.router.navigateByUrl('/library');
  }

  protected async add(): Promise<void> {
    const d = this.details.data();
    if (!d) return;
    const status = await this.picker.pick(d.name, this.released() ? 'backlog' : 'wishlist');
    if (status) this.library.add(d, status);
  }

  protected setStatus(status: Status): void {
    const t = this.tracked();
    if (t) this.library.setStatus(t, status);
  }

  protected setCompletion(completion: Completion): void {
    const t = this.tracked();
    if (t) this.library.edit(t, { completion: t.completion === completion ? null : completion });
  }

  protected setRating(rating: number): void {
    const t = this.tracked();
    if (t) this.library.edit(t, { rating: t.rating === rating ? null : rating });
  }

  protected setHours(event: Event): void {
    const t = this.tracked();
    const input = event.target as HTMLInputElement;
    if (!t) return;
    const text = input.value.trim().replace(',', '.');
    const hours = text === '' ? null : Math.round(Number(text) * 10) / 10;
    if (hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 100_000)) {
      input.value = t.hoursPlayed?.toString() ?? '';
      this.toast.error('Hours should be a number, like 12 or 12.5.');
      return;
    }
    if (hours !== t.hoursPlayed) this.library.edit(t, { hoursPlayed: hours });
  }

  protected setNotes(event: Event): void {
    const t = this.tracked();
    const notes = (event.target as HTMLTextAreaElement).value;
    if (t && notes !== t.notes) this.library.edit(t, { notes });
  }

  protected toggleNotify(): void {
    const t = this.tracked();
    if (!t) return;
    const notify = !t.notify;
    this.library.edit(t, { notify });
    if (notify && !this.push.enabledHere()) {
      this.toast.show('Alert saved. Turn on notifications in Settings to get it on this phone.');
    }
  }

  protected setPlatform(key: PlatformKey): void {
    const t = this.tracked();
    const d = this.details.data();
    if (!t || t.myPlatform === key) return;
    if (!d) {
      this.toast.error('Game details are still loading. Try again in a moment.');
      return;
    }
    this.library.setPlatform(t, d, key);
  }

  protected remove(): void {
    const t = this.tracked();
    if (!t || !confirm(`Remove ${t.name} from your library?`)) return;
    this.library.remove(t);
  }
}
