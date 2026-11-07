import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error';
}

/** Short messages shown above the tab bar ("Added to Backlog", "Couldn't save"). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private timer: ReturnType<typeof setTimeout> | undefined;
  readonly current = signal<Toast | null>(null);

  show(message: string, kind: Toast['kind'] = 'info'): void {
    clearTimeout(this.timer);
    this.current.set({ id: this.nextId++, message, kind });
    this.timer = setTimeout(() => this.current.set(null), kind === 'error' ? 5000 : 2500);
  }

  error(message: string, error?: unknown): void {
    if (error) console.error(error);
    this.show(message, 'error');
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.current.set(null);
  }
}
