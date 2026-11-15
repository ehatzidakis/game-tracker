import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CardGrid, eventDateLine, type GridCard, type GridFilter } from './card-grid';

const cards: GridCard[] = Array.from({ length: 23 }, (_, i) => ({
  id: i,
  link: ['/game', i],
  name: `Game ${i}`,
  line: i < 3 ? '2027' : '2020',
  tags: i < 3 ? ['upcoming'] : ['out'],
  ...(i === 4 ? { status: 'Completed', platinum: true } : {}),
  ...(i === 5 ? { dim: true } : {}),
}));
const filters: GridFilter[] = [
  { key: 'upcoming', title: 'Upcoming' },
  { key: 'out', title: 'Out' },
  { key: 'mine', title: 'In my library' },
  { key: 'year-2020', title: '2020', group: 'Year' },
];

async function render(title: string | null = null) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(CardGrid);
  fixture.componentRef.setInput('cards', cards);
  fixture.componentRef.setInput('filters', filters);
  fixture.componentRef.setInput('title', title);
  fixture.componentRef.setInput('initial', 10);
  await fixture.whenStable();
  return { el: fixture.nativeElement as HTMLElement, fixture };
}

const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('CardGrid', () => {
  it('shows the first rows as cards, then "Show N more" adds as many again', async () => {
    const { el, fixture } = await render();
    expect(text(el.querySelector('h2'))).toBe('23 games');
    expect(el.querySelectorAll('li').length).toBe(10);
    const more = () => [...el.querySelectorAll('button')].find((b) => text(b).startsWith('Show'));
    expect(text(more()!)).toBe('Show 10 more');
    more()!.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('li').length).toBe(20);
    expect(text(more()!)).toBe('Show 3 more');
    more()!.click();
    await fixture.whenStable();
    expect(more()).toBeUndefined();
  });

  it('marks your status and Platinum, and greys out dimmed cards', async () => {
    const { el } = await render();
    const labels = [...el.querySelectorAll('li a')].map((a) => a.getAttribute('aria-label'));
    expect(labels[4]).toBe('Game 4, 2020, Completed, Platinum');
    expect(el.querySelectorAll('li')[4].querySelector('svg')).not.toBeNull();
    expect(el.querySelectorAll('.dimmed').length).toBe(1);
  });

  it('filters by the menu, leaving out empty filters and grouping the rest', async () => {
    const { el, fixture } = await render('Shown at');
    const select = el.querySelector('select') as HTMLSelectElement;
    expect([...select.options].map((o) => text(o))).toEqual([
      'All · 23',
      'Upcoming · 3',
      'Out · 20',
    ]);
    // Year 2020 has no cards tagged with it, so no Year group.
    expect(select.querySelector('optgroup')).toBeNull();
    select.value = 'upcoming';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(text(el.querySelector('h2'))).toBe('Shown at · 3');
    expect(el.querySelectorAll('li').length).toBe(3);
  });
});

describe('CardGrid filters', () => {
  it('has no filter pill when no filter would leave anything out', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(CardGrid);
    fixture.componentRef.setInput('cards', cards.slice(3, 6));
    fixture.componentRef.setInput('filters', filters);
    await fixture.whenStable();
    // All three are "out": filtering by it would show the same three.
    expect((fixture.nativeElement as HTMLElement).querySelector('select')).toBeNull();
  });
});

describe('eventDateLine', () => {
  it('leaves out this year, and the day in other years', () => {
    const now = new Date(2026, 10, 16);
    expect(eventDateLine(new Date(2026, 11, 13).getTime(), now)).toBe('13 Dec');
    expect(eventDateLine(new Date(2024, 11, 13).getTime(), now)).toBe('Dec 2024');
  });
});
