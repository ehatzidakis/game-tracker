import { attachSwipe, decide, resist, type SwipeDir } from './swipe';

describe('decide', () => {
  const W = 390;
  it('goes once you drag past a third of the width', () => {
    expect(decide(-140, 0, W, true, true)).toBe('next');
    expect(decide(140, 0, W, true, true)).toBe('prev');
    expect(decide(-120, 0, W, true, true)).toBeNull();
  });
  it('goes on a flick, even a short one', () => {
    expect(decide(-60, -0.6, W, true, true)).toBe('next');
    expect(decide(60, 0.6, W, true, true)).toBe('prev');
    // Too short, or flicked back the other way.
    expect(decide(-30, -0.8, W, true, true)).toBeNull();
    expect(decide(-60, 0.6, W, true, true)).toBeNull();
  });
  it('stays on a slow short drag', () => {
    expect(decide(-60, -0.1, W, true, true)).toBeNull();
  });
  it('has no next at the end, and no previous at the start', () => {
    expect(decide(-300, -1, W, true, false)).toBeNull();
    expect(decide(300, 1, W, false, true)).toBeNull();
  });
});

describe('resist', () => {
  it('follows the finger, and stretches past an end', () => {
    expect(resist(-100, true, true)).toBe(-100);
    expect(resist(-100, true, false)).toBeCloseTo(-30);
    expect(resist(100, false, true)).toBeCloseTo(30);
  });
});

describe('attachSwipe', () => {
  function setup(neighbours = { prev: 1 as number | null, next: 3 as number | null }) {
    document.body.innerHTML = `<div id="page"><p id="text">Text</p><ul class="shots"><li id="shot">x</li></ul></div>`;
    const el = document.getElementById('page')!;
    const went: SwipeDir[] = [];
    let finish: () => void = () => undefined;
    const detach = attachSwipe(el, {
      neighbours: () => neighbours,
      canStart: (target) => !target.closest('.shots'),
      go: (dir) => {
        went.push(dir);
        return new Promise<void>((resolve) => (finish = resolve));
      },
    });
    const at = (id: string, type: string, x: number, y = 300) =>
      document.getElementById(id)!.dispatchEvent(
        new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, isPrimary: true, bubbles: true }),
      );
    const drag = (id: string, from: number, to: number, dy = 0) => {
      at(id, 'pointerdown', from);
      for (let i = 1; i <= 10; i++) at(id, 'pointermove', from + ((to - from) * i) / 10, 300 + (dy * i) / 10);
      at(id, 'pointerup', to, 300 + dy);
    };
    return { el, went, drag, detach, finish: () => finish() };
  }

  it('a sideways drag moves the page with the finger and goes to the next game', () => {
    const { el, went, drag } = setup();
    document.getElementById('text')!.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 300, clientY: 300, pointerId: 1, isPrimary: true, bubbles: true }),
    );
    document.getElementById('text')!.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 250, clientY: 300, pointerId: 1, isPrimary: true, bubbles: true }),
    );
    expect(el.style.transform).toContain('-50px');
    document.getElementById('text')!.dispatchEvent(
      new PointerEvent('pointercancel', { pointerId: 1, isPrimary: true, bubbles: true }),
    );
    drag('text', 300, 50);
    expect(went).toEqual(['next']);
  });

  it('a short drag held still before letting go springs back', () => {
    const { el, went } = setup();
    const text = document.getElementById('text')!;
    const at = (type: string, x: number, timeStamp: number) => {
      const e = new PointerEvent(type, { clientX: x, clientY: 300, pointerId: 1, isPrimary: true, bubbles: true });
      Object.defineProperty(e, 'timeStamp', { value: timeStamp });
      text.dispatchEvent(e);
    };
    at('pointerdown', 300, 0);
    for (let i = 1; i <= 8; i++) at('pointermove', 300 - i * 16, i * 16);
    at('pointerup', 172, 400);
    expect(went).toEqual([]);
    expect(el.style.transform).toBe('');
  });

  it('a mostly vertical drag never moves the page', () => {
    const { el, went, drag } = setup();
    drag('text', 200, 160, -200);
    expect(went).toEqual([]);
    expect(el.style.transform).toBe('');
  });

  it('ignores drags that start on a strip', () => {
    const { went, drag } = setup();
    drag('shot', 300, 50);
    expect(went).toEqual([]);
  });

  it('ignores a drag from the left edge (the iPhone’s Back)', () => {
    const { went, drag } = setup();
    drag('text', 10, 300);
    expect(went).toEqual([]);
  });

  it('ignores a drag while busy, then pages again', async () => {
    const { went, drag, finish } = setup();
    drag('text', 300, 50);
    drag('text', 300, 50);
    expect(went).toEqual(['next']);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    drag('text', 50, 300);
    expect(went).toEqual(['next', 'prev']);
  });

  it('does nothing in a list of one', () => {
    const { el, went, drag } = setup({ prev: null, next: null });
    drag('text', 300, 50);
    expect(went).toEqual([]);
    expect(el.style.transform).toBe('');
  });

  it('stops listening once detached', () => {
    const { went, drag, detach } = setup();
    detach();
    drag('text', 300, 50);
    expect(went).toEqual([]);
  });
});
