import { TestBed } from '@angular/core/testing';
import { ScoreRing, scoreColor } from './score-ring';

function render(score: number) {
  const fixture = TestBed.createComponent(ScoreRing);
  fixture.componentRef.setInput('score', score);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const arc = el.querySelectorAll('circle')[1];
  const [filled, whole] = (arc?.getAttribute('stroke-dasharray') ?? '0 1').split(' ').map(Number);
  return { el, share: filled / whole, arc };
}

describe('ScoreRing', () => {
  it('fills the ring as far as the score: half at 50, nearly all at 94', () => {
    expect(render(50).share).toBeCloseTo(0.5, 2);
    expect(render(94).share).toBeCloseTo(0.94, 2);
    expect(render(100).share).toBeCloseTo(1, 2);
  });

  it('shows the rounded score and says what it is', () => {
    const { el } = render(87.6);
    expect(el.textContent?.trim()).toBe('88');
    expect(el.getAttribute('aria-label')).toBe('OpenCritic 88');
  });

  it('colours the ring by OpenCritic tier: green, yellow, orange, red', () => {
    expect([95, 84, 83, 75, 74, 67, 66, 30].map(scoreColor)).toEqual([
      '#30d158',
      '#30d158',
      '#ffd60a',
      '#ffd60a',
      '#ff9f0a',
      '#ff9f0a',
      '#ff453a',
      '#ff453a',
    ]);
    // Rounded first: 83.6 shows as 84, so it's green like the number says.
    expect(render(83.6).arc?.getAttribute('stroke')).toBe('#30d158');
  });

  it('draws no arc for a score of 0', () => {
    expect(render(0).arc).toBeUndefined();
  });
});
