import { TestBed } from '@angular/core/testing';
import type { TrackedGame } from '../../../api/_lib/models.js';
import { DetailsSheet, DetailsSheetOutlet, type SheetResult } from './details-sheet';

const game = {
  igdbId: 7,
  name: 'Test Game',
  status: 'backlog',
  completion: null,
  hoursPlayed: null,
  completedAt: null,
  physical: false,
  sold: false,
} as unknown as TrackedGame;

/** The "Edit my data" sheet, open on a game, with Completed picked. */
async function open(initial: Partial<TrackedGame> = {}) {
  // jsdom has no modal dialogs or scrolling.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  Element.prototype.scrollIntoView ??= () => undefined;

  const fixture = TestBed.createComponent(DetailsSheetOutlet);
  const sheet = TestBed.inject(DetailsSheet);
  let result: SheetResult | null | undefined;
  void sheet
    .edit(
      { ...game, ...initial },
      { purchase: true, hours: false, completed: true },
      '2026-11-28',
      [],
      { status: 'completed', rating: null, released: true, hoursFromPsn: true, preordered: false },
    )
    .then((r) => (result = r));
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const save = () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  };
  const click = (target: Element) => {
    (target as HTMLElement).click();
    fixture.detectChanges();
  };
  const button = (text: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
  return { el, save, click, button, result: () => result };
}

describe('DetailsSheetOutlet', () => {
  it('says why Save did nothing, by the Save button, and marks the field to fix', async () => {
    const { el, save, click, button, result } = await open();
    save();
    await Promise.resolve();
    expect(result()).toBeUndefined();
    expect(el.querySelector('app-sheet-error')?.textContent).toContain(
      'Pick how far you got before saving.',
    );
    // Right above Save, in the footer that stays on screen.
    const footer = el.querySelector('form > .sticky')!;
    expect(footer.querySelector('app-sheet-error')).not.toBeNull();
    expect(el.querySelector('[data-field="completion"]')!.classList).toContain('field-invalid');

    // Picking how far you got clears it, and then it saves.
    click(button('Main story'));
    expect(el.querySelector('app-sheet-error')).toBeNull();
    expect(el.querySelector('.field-invalid')).toBeNull();
    save();
    await Promise.resolve();
    expect(result()).toMatchObject({ status: 'completed', completion: 'main' });
  });

  it('offers Sold only for a physical copy, and another copy turns Sold off', async () => {
    const { el, click, button } = await open();
    const soldRow = () => el.querySelector('#sheet-sold-label');
    expect(soldRow()).toBeNull();

    click(button('Physical'));
    expect(soldRow()).not.toBeNull();
    const sold = el.querySelector('[aria-labelledby="sheet-sold-label"]')!;
    click(sold);
    expect(sold.getAttribute('aria-checked')).toBe('true');

    click(button('Digital'));
    expect(soldRow()).toBeNull();
    click(button('Physical'));
    expect(el.querySelector('[aria-labelledby="sheet-sold-label"]')!.getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('still shows Sold for a game marked sold before it had to be physical', async () => {
    const { el } = await open({ sold: true, physical: false });
    expect(el.querySelector('#sheet-sold-label')).not.toBeNull();
  });

  it('picks the copy, Copy sitting first in the purchase details', async () => {
    const { el, click, button, save, result } = await open({ completion: 'main' });
    const labels = [...el.querySelectorAll('form .row')].map((r) => r.textContent!.trim());
    const copyAt = labels.findIndex((t) => t.startsWith('Copy'));
    expect(labels.findIndex((t) => t.startsWith('Rating'))).toBeLessThan(copyAt);
    expect(labels.findIndex((t) => t.startsWith('Price'))).toBe(copyAt + 1);
    // Nothing picked yet (you haven't said).
    expect(el.querySelector('[aria-labelledby="sheet-copy-label"] [aria-checked="true"]')).toBeNull();

    click(button('Digital'));
    save();
    await Promise.resolve();
    expect(result()).toMatchObject({ copy: 'digital', physical: false });
  });

  it('hides the price, store and date for a subscription, and saves them empty', async () => {
    const { el, click, button, save, result } = await open({
      completion: 'main',
      pricePaid: 70,
      boughtFrom: 'Amazon',
      orderedOn: '2026-01-02',
    });
    click(button('Subscription'));
    expect(el.querySelector('input[name="price"]')).toBeNull();
    expect(el.querySelector('input[name="store"]')).toBeNull();
    expect(el.querySelector('input[name="ordered"]')).toBeNull();
    save();
    await Promise.resolve();
    expect(result()).toMatchObject({
      copy: 'subscription',
      physical: false,
      pricePaid: null,
      boughtFrom: null,
      orderedOn: null,
    });
  });

  it('hides them for a rented game too, which can’t be sold', async () => {
    const { el, click, button, save, result } = await open({
      completion: 'main',
      pricePaid: 70,
      boughtFrom: 'Amazon',
      orderedOn: '2026-01-02',
    });
    click(button('Rent'));
    expect(el.querySelector('input[name="price"]')).toBeNull();
    expect(el.querySelector('input[name="store"]')).toBeNull();
    expect(el.querySelector('input[name="ordered"]')).toBeNull();
    expect(el.querySelector('#sheet-sold-label')).toBeNull();
    save();
    await Promise.resolve();
    expect(result()).toMatchObject({
      copy: 'rent',
      physical: false,
      sold: false,
      pricePaid: null,
      boughtFrom: null,
      orderedOn: null,
    });
  });

  it('reads an older physical copy as Physical, and offers no Subscription or Rent for a pre-order', async () => {
    const { button } = await open({ physical: true });
    expect(button('Physical').getAttribute('aria-checked')).toBe('true');

    const preorder = await open({ preordered: true });
    expect(preorder.button('Subscription')).toBeUndefined();
    expect(preorder.button('Rent')).toBeUndefined();
    expect(preorder.button('Digital')).toBeDefined();
  });
});
