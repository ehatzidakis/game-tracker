import { Component, inject } from '@angular/core';
import { LucideCheck } from '@lucide/angular';
import { BackdropService, BRIGHTNESS_MAX, BRIGHTNESS_MIN } from '../../core/backdrop';
import { WALLPAPERS, WallpaperService, type WallpaperKey } from '../../core/wallpaper';

/**
 * Settings → Wallpaper: a picture behind the whole app, from the very top of the screen. Three
 * tall tiles (None and the two pictures, as the phone shows them); tapping one uses it at once,
 * behind this screen too. Picking one turns game art off (only one picture at a time). Once one
 * is chosen, a Brightness slider as on Game art.
 */
@Component({
  selector: 'app-wallpaper',
  imports: [LucideCheck],
  template: `
    <h1 class="large-title">Wallpaper</h1>

    <ul class="mt-4 grid grid-cols-3 gap-3" role="radiogroup" aria-label="Wallpaper">
      <li>
        <button
          type="button"
          role="radio"
          class="block w-full text-left active:opacity-70"
          [attr.aria-checked]="!wallpaper.current()"
          (click)="wallpaper.clear()"
        >
          <span
            class="relative block aspect-9/16 rounded-[10px] bg-group ring-[0.5px] ring-white/15"
            [class]="!wallpaper.current() ? 'ring-2! ring-accent!' : ''"
          >
            @if (!wallpaper.current()) {
              <span
                class="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-accent-fill text-white"
                aria-hidden="true"
              >
                <svg lucideCheck [size]="15" [strokeWidth]="3"></svg>
              </span>
            }
          </span>
          <span class="mt-1.5 block text-[13px] leading-4">None</span>
        </button>
      </li>
      @for (w of wallpapers; track w.key) {
        @let chosen = wallpaper.current()?.key === w.key;
        <li>
          <button
            type="button"
            role="radio"
            class="block w-full text-left active:opacity-70"
            [attr.aria-checked]="chosen"
            (click)="choose(w.key)"
          >
            <span
              class="relative block aspect-9/16 overflow-hidden rounded-[10px] bg-group ring-[0.5px] ring-white/15"
              [class]="chosen ? 'ring-2! ring-accent!' : ''"
            >
              <img
                [src]="w.src"
                alt=""
                class="size-full object-cover"
                [style.image-rendering]="w.pixelated ? 'pixelated' : 'auto'"
              />
              @if (chosen) {
                <span
                  class="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-accent-fill text-white"
                  aria-hidden="true"
                >
                  <svg lucideCheck [size]="15" [strokeWidth]="3"></svg>
                </span>
              }
            </span>
            <span class="mt-1.5 block text-[13px] leading-4">{{ w.label }}</span>
          </button>
        </li>
      }
    </ul>

    @if (wallpaper.current(); as w) {
      <div class="grouped mt-5">
        <div class="row flex-col items-stretch gap-0 pt-2.5! pb-0!">
          <div class="flex justify-between">
            <span id="wall-brightness-label">Brightness</span>
            <span class="num" [class]="w.brightness > 1 ? 'text-label' : 'text-muted'">
              {{ percent(w.brightness) }}
            </span>
          </div>
          <div class="relative">
            <input
              type="range"
              class="look-slider"
              [min]="brightnessMin"
              [max]="brightnessMax"
              step="0.05"
              aria-labelledby="wall-brightness-label"
              [attr.aria-valuetext]="percent(w.brightness)"
              [value]="w.brightness"
              [style.--fill]="fill(w.brightness)"
              (input)="setBrightness($event)"
            />
            <!-- 100%: the brightest that keeps grey text easy to read. -->
            <span
              class="pointer-events-none absolute bottom-1 h-1.5 w-0.5 -translate-x-1/2 rounded-full bg-muted"
              [style.left]="'calc(14px + (100% - 28px) * ' + fill(1) + ')'"
              aria-hidden="true"
            ></span>
          </div>
        </div>
      </div>
      <p class="group-footer">
        @if (w.brightness > 1) {
          Above 100%, grey text can be hard to read where the picture is bright.
        } @else {
          Up to 100%, grey text stays easy to read: the bright parts are toned down, the dark sky
          shows as it is.
        }
      </p>
    } @else {
      <p class="group-footer mt-3">
        A picture behind the whole app, from the top of the screen. It replaces game art.
      </p>
    }

  `,
})
export class WallpaperPage {
  protected readonly wallpaper = inject(WallpaperService);
  private readonly backdrop = inject(BackdropService);
  protected readonly wallpapers = WALLPAPERS;
  protected readonly brightnessMin = BRIGHTNESS_MIN;
  protected readonly brightnessMax = BRIGHTNESS_MAX;

  protected choose(key: WallpaperKey): void {
    this.wallpaper.set(key);
    // One picture at a time.
    this.backdrop.clear();
  }

  protected setBrightness(event: Event): void {
    this.wallpaper.setBrightness(Number((event.target as HTMLInputElement).value));
  }

  protected percent(brightness: number): string {
    return Math.round(brightness * 100) + '%';
  }

  /** How far along the slider a value sits (0 to 1). */
  protected fill(brightness: number): number {
    return (brightness - BRIGHTNESS_MIN) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN);
  }
}
