import { TestBed } from '@angular/core/testing';
import { ratingAt, RatingSlider } from './rating-slider';

describe('ratingAt', () => {
  it('snaps a position on the bar to 1–10 in half points', () => {
    expect(ratingAt(0)).toBe(1);
    expect(ratingAt(1)).toBe(10);
    expect(ratingAt(0.5)).toBe(5.5);
    expect(ratingAt(0.83)).toBe(8.5);
    expect(ratingAt(-0.3)).toBe(1);
    expect(ratingAt(1.4)).toBe(10);
  });
});

describe('RatingSlider', () => {
  it('previews while you slide and saves when you let go', async () => {
    const fixture = TestBed.createComponent(RatingSlider);
    fixture.componentRef.setInput('value', 7);
    await fixture.whenStable();
    const track = fixture.nativeElement.querySelector('[role=slider]') as HTMLElement;
    track.getBoundingClientRect = () => ({ left: 0, width: 180, top: 0, height: 44 }) as DOMRect;

    const previews: (number | null)[] = [];
    const saved: number[] = [];
    fixture.componentInstance.preview.subscribe((v) => previews.push(v));
    fixture.componentInstance.changed.subscribe((v) => saved.push(v));

    const at = (type: string, x: number) =>
      track.dispatchEvent(new PointerEvent(type, { clientX: x, pointerId: 1, bubbles: true }));
    at('pointerdown', 100); // 0.56 → 6
    at('pointermove', 150); // 0.83 → 8.5
    at('pointerup', 150);

    expect(previews).toEqual([6, 8.5, null]);
    expect(saved).toEqual([8.5]);
  });

  it('steps half a point with the arrow keys', async () => {
    const fixture = TestBed.createComponent(RatingSlider);
    fixture.componentRef.setInput('value', 8);
    await fixture.whenStable();
    const saved: number[] = [];
    fixture.componentInstance.changed.subscribe((v) => saved.push(v));
    const track = fixture.nativeElement.querySelector('[role=slider]') as HTMLElement;
    track.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(saved).toEqual([8.5]);
  });
});
