import { Component, computed, inject, signal } from '@angular/core';
import { LucideCheck, LucideChevronRight } from '@lucide/angular';
import type { TrackedGame } from '../../../../api/_lib/models.js';
import { BackdropService, BLUR_MAX, BRIGHTNESS_MAX, BRIGHTNESS_MIN } from '../../core/backdrop';
import { coverUrl, IgdbService } from '../../core/igdb';
import { LibraryService } from '../../core/library.service';
import { Cover } from '../../shared/cover';
import { SearchField } from '../../shared/search-field';

/** One game's pictures on IGDB: screenshots first (artworks are often logos or key art text). */
type Pictures = { state: 'loading' } | { state: 'ready'; ids: string[] } | { state: 'failed' };

/**
 * Settings → Game art: pick a picture from one of your games to glow behind the app. Your games
 * are listed (Playing first, then A–Z, with a search); tapping one opens its pictures under it,
 * and tapping a picture uses it at once. Once one is chosen, Blur and Brightness sliders set
 * how soft and how bright it is. This screen shows the result live behind itself.
 */
@Component({
  selector: 'app-art',
  imports: [Cover, SearchField, LucideCheck, LucideChevronRight],
  template: `
    <h1 class="large-title">Game art</h1>

    @if (backdrop.current(); as art) {
      <img
        [src]="coverUrl(art.imageId, 'screenshot_med')"
        alt=""
        class="mt-3 aspect-video w-full rounded-[10px] bg-group object-cover"
      />
      @let look = backdrop.look();
      <!-- Moving a slider changes the glow behind this screen as you drag. -->
      <div class="grouped mt-3">
        <div class="row flex-col items-stretch gap-0 pt-2.5! pb-0!">
          <div class="flex justify-between">
            <span id="blur-label">Blur</span>
            <span class="num text-muted">{{ look.blur === 0 ? 'Off' : look.blur }}</span>
          </div>
          <input
            type="range"
            class="look-slider"
            min="0"
            [max]="blurMax"
            step="1"
            aria-labelledby="blur-label"
            [attr.aria-valuetext]="look.blur === 0 ? 'Off' : look.blur + ' of ' + blurMax"
            [value]="look.blur"
            [style.--fill]="look.blur / blurMax"
            (input)="setBlur($event)"
          />
        </div>
        <div class="row flex-col items-stretch gap-0 pt-2.5! pb-0!">
          <div class="flex justify-between">
            <span id="brightness-label">Brightness</span>
            <span class="num" [class]="look.brightness > 1 ? 'text-label' : 'text-muted'">
              {{ percent(look.brightness) }}
            </span>
          </div>
          <div class="relative">
            <input
              type="range"
              class="look-slider"
              [min]="brightnessMin"
              [max]="brightnessMax"
              step="0.05"
              aria-labelledby="brightness-label"
              [attr.aria-valuetext]="percent(look.brightness)"
              [value]="look.brightness"
              [style.--fill]="brightnessFill(look.brightness)"
              (input)="setBrightness($event)"
            />
            <!-- 100%: the brightest that keeps grey text easy to read. -->
            <span
              class="pointer-events-none absolute bottom-1 h-1.5 w-0.5 -translate-x-1/2 rounded-full bg-muted"
              [style.left]="'calc(14px + (100% - 28px) * ' + brightnessFill(1) + ')'"
              aria-hidden="true"
            ></span>
          </div>
        </div>
        <button type="button" class="row text-danger" (click)="backdrop.clear()">
          Remove game art
        </button>
      </div>
      <p class="group-footer">
        @if (look.brightness > 1) {
          Above 100%, grey text can be hard to read where the picture is bright.
        } @else {
          Up to 100%, grey text stays easy to read over the picture.
        }
        From {{ art.game }}; pick another picture below to change it.
      </p>
    } @else {
      <p class="group-footer mt-3">
        Pick a picture from one of your games to show behind your lists. Once picked, you can set
        how soft and how bright it is here.
      </p>
    }

    <app-search-field class="mt-5" label="Search your games" [(query)]="query" />

    @if (games().length) {
      <div class="grouped mt-3" style="--sep-inset: 68px">
        @for (game of games(); track game.igdbId) {
          @let open = openId() === game.igdbId;
          <button
            type="button"
            class="row py-2!"
            [attr.aria-expanded]="open"
            (click)="toggle(game)"
          >
            <app-cover class="w-10 shrink-0 rounded-[5px]!" [coverId]="game.coverId" [name]="''" />
            <span class="min-w-0 flex-1 truncate">{{ game.name }}</span>
            @if (backdrop.current()?.gameId === game.igdbId) {
              <svg lucideCheck [size]="20" [strokeWidth]="2.5" class="shrink-0 text-accent"></svg>
            }
            <svg
              lucideChevronRight
              [size]="18"
              [strokeWidth]="2.25"
              class="-mr-1 shrink-0 text-faint transition-transform duration-200"
              [class.rotate-90]="open"
            ></svg>
          </button>
          @if (open) {
            @let pics = pictures()[game.igdbId];
            <div class="px-4 pb-4">
              @switch (pics?.state) {
                @case ('ready') {
                  @if (pics?.state === 'ready' && pics.ids.length) {
                    <ul
                      class="grid grid-cols-2 gap-2"
                      [attr.aria-label]="'Pictures of ' + game.name"
                    >
                      @for (id of pics.ids; track id; let i = $index) {
                        @let chosen = backdrop.current()?.imageId === id;
                        <li>
                          <button
                            type="button"
                            class="relative block w-full overflow-hidden rounded-lg active:opacity-70"
                            [class.ring-2]="chosen"
                            [class.ring-accent]="chosen"
                            [attr.aria-pressed]="chosen"
                            [attr.aria-label]="'Picture ' + (i + 1) + ' of ' + game.name"
                            (click)="choose(game, id)"
                          >
                            <img
                              [src]="coverUrl(id, 'screenshot_med')"
                              alt=""
                              loading="lazy"
                              class="aspect-video w-full bg-raised object-cover"
                            />
                            @if (chosen) {
                              <span
                                class="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-accent-fill text-white"
                              >
                                <svg lucideCheck [size]="15" [strokeWidth]="3"></svg>
                              </span>
                            }
                          </button>
                        </li>
                      }
                    </ul>
                  } @else {
                    <p class="text-[15px] leading-5 text-muted">
                      IGDB has no pictures of this game.
                    </p>
                  }
                }
                @case ('failed') {
                  <p class="text-[15px] leading-5 text-muted">
                    Couldn't load its pictures.
                    <button type="button" class="text-accent" (click)="load(game.igdbId)">
                      Try again
                    </button>
                  </p>
                }
                @default {
                  <ul class="grid grid-cols-2 gap-2" aria-label="Loading pictures">
                    @for (n of [1, 2, 3, 4]; track n) {
                      <li class="aspect-video animate-pulse rounded-lg bg-raised"></li>
                    }
                  </ul>
                }
              }
            </div>
          }
        }
      </div>
    } @else if (library.loaded()) {
      <p class="mt-12 text-center text-[15px] leading-5 text-muted">
        @if (query()) {
          No games in your library match “{{ query() }}”.
        } @else {
          Add games to your library to use their art.
        }
      </p>
    }
  `,
})
export class ArtPage {
  protected readonly backdrop = inject(BackdropService);
  protected readonly library = inject(LibraryService);
  private readonly igdb = inject(IgdbService);
  protected readonly coverUrl = coverUrl;
  protected readonly blurMax = BLUR_MAX;
  protected readonly brightnessMin = BRIGHTNESS_MIN;
  protected readonly brightnessMax = BRIGHTNESS_MAX;

  protected readonly query = signal('');
  protected readonly openId = signal<number | null>(null);
  protected readonly pictures = signal<Record<number, Pictures>>({});

  /** Playing first, then A–Z; filtered by the search. */
  protected readonly games = computed((): TrackedGame[] => {
    const term = this.query().trim().toLowerCase();
    return this.library
      .games()
      .filter((g) => !term || g.name.toLowerCase().includes(term))
      .sort((a, b) => Number(!!b.playing) - Number(!!a.playing) || a.name.localeCompare(b.name));
  });

  constructor() {
    // Open the game the current art is from, so its pictures are there to change.
    const art = this.backdrop.current();
    if (art) this.toggle({ igdbId: art.gameId } as TrackedGame);
  }

  protected toggle(game: TrackedGame): void {
    if (this.openId() === game.igdbId) {
      this.openId.set(null);
      return;
    }
    this.openId.set(game.igdbId);
    const pics = this.pictures()[game.igdbId];
    if (!pics || pics.state === 'failed') void this.load(game.igdbId);
  }

  protected async load(id: number): Promise<void> {
    this.pictures.update((p) => ({ ...p, [id]: { state: 'loading' } }));
    try {
      const details = await this.igdb.game(id);
      const ids = [
        ...(details?.screenshots ?? []).map((s) => s.image_id),
        ...(details?.artworks ?? []).map((a) => a.image_id),
      ];
      this.pictures.update((p) => ({ ...p, [id]: { state: 'ready', ids } }));
    } catch {
      this.pictures.update((p) => ({ ...p, [id]: { state: 'failed' } }));
    }
  }

  protected setBlur(event: Event): void {
    this.backdrop.setLook({ blur: Number((event.target as HTMLInputElement).value) });
  }

  protected setBrightness(event: Event): void {
    this.backdrop.setLook({ brightness: Number((event.target as HTMLInputElement).value) });
  }

  protected percent(brightness: number): string {
    return Math.round(brightness * 100) + '%';
  }

  /** How far along the Brightness slider a value sits (0 to 1). */
  protected brightnessFill(brightness: number): number {
    return (brightness - BRIGHTNESS_MIN) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN);
  }

  protected choose(game: TrackedGame, imageId: string): void {
    this.backdrop.set({ imageId, gameId: game.igdbId, game: game.name });
  }
}
