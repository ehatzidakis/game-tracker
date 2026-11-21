import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChoiceSheet } from './choice-sheet';
import { SheetPicker } from './sheet-picker';

@Component({
  imports: [SheetPicker],
  template: `
    <label>
      <span class="sr-only">Sort by</span>
      <select sheetPicker (change)="picked.set($any($event.target).value)">
        <option value="name">Name</option>
        <option value="release" selected>Release date</option>
        <optgroup label="PS5">
          <option value="ps5">PS5 games</option>
        </optgroup>
      </select>
    </label>
  `,
})
class Host {
  readonly picked = signal<string | null>(null);
}

describe('SheetPicker (off iPhone)', () => {
  it('opens the sheet from the label, with the options, groups and the current one ticked', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const sheet = TestBed.inject(ChoiceSheet);

    (fixture.nativeElement.querySelector('label') as HTMLLabelElement).click();
    const req = sheet.request()!;
    expect(req.heading[0]).toBe('Sort by');
    expect(req.current).toBe('release');
    expect(req.choices.map((c) => [c.key, c.label, c.group])).toEqual([
      ['name', 'Name', undefined],
      ['release', 'Release date', undefined],
      ['ps5', 'PS5 games', 'PS5'],
    ]);

    sheet.finish('name');
    await Promise.resolve();
    expect((fixture.nativeElement.querySelector('select') as HTMLSelectElement).value).toBe('name');
    expect(fixture.componentInstance.picked()).toBe('name');
  });

  it('changes nothing when dismissed', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const sheet = TestBed.inject(ChoiceSheet);

    (fixture.nativeElement.querySelector('label') as HTMLLabelElement).click();
    sheet.finish(null);
    await Promise.resolve();
    expect(fixture.componentInstance.picked()).toBeNull();
  });
});
