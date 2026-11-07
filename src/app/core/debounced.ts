import { effect, Signal, signal, untracked } from '@angular/core';

/** A copy of `source` that only updates after it has stopped changing for `ms`. Call in an injection context. */
export function debounced<T>(source: Signal<T>, ms: number): Signal<T> {
  const result = signal(untracked(source));
  effect((onCleanup) => {
    const value = source();
    const timer = setTimeout(() => result.set(value), ms);
    onCleanup(() => clearTimeout(timer));
  });
  return result.asReadonly();
}
