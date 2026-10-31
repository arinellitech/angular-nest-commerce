import { TestBed } from '@angular/core/testing';
import { QuantityStepper } from './quantity-stepper';

describe('QuantityStepper', () => {
  function create(inputs: { quantity: number; max?: number; busy?: boolean }) {
    const fixture = TestBed.createComponent(QuantityStepper);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    const emitted: number[] = [];
    fixture.componentInstance.quantityChange.subscribe((v) => emitted.push(v));
    const root: HTMLElement = fixture.nativeElement;
    return {
      fixture,
      emitted,
      input: root.querySelector<HTMLInputElement>('input')!,
      minus: root.querySelector<HTMLButtonElement>('[aria-label="Diminuir quantidade"]')!,
      plus: root.querySelector<HTMLButtonElement>('[aria-label="Aumentar quantidade"]')!,
    };
  }

  it('steps up and down, never below 1', () => {
    const { emitted, minus, plus, fixture } = create({ quantity: 2 });
    plus.click();
    // The parent confirms each change by passing the new quantity back.
    fixture.componentRef.setInput('quantity', 3);
    fixture.detectChanges();
    minus.click();
    expect(emitted).toEqual([3, 2]);

    fixture.componentRef.setInput('quantity', 1);
    fixture.detectChanges();
    expect(minus.disabled).toBe(true);
  });

  it('stops the + button at max', () => {
    const { plus } = create({ quantity: 5, max: 5 });
    expect(plus.disabled).toBe(true);
  });

  it('commits a typed value on change, even above max, so the API can explain', () => {
    const { input, emitted } = create({ quantity: 1, max: 5 });
    input.value = '20';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    expect(emitted).toEqual([20]);
  });

  it('falls back to the confirmed quantity once a rejected change ends', async () => {
    const { fixture, input } = create({ quantity: 2 });
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    input.value = '9';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(input.value).toBe('9');

    fixture.componentRef.setInput('busy', false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(input.value).toBe('2');
  });
});
