import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { controlId, FormValueAccessor } from '../form-value-accessor';

@Component({
  selector: 'app-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SliderComponent), multi: true },
  ],
  template: `<div>
    <div class="mb-2 flex items-center justify-between gap-4">
      <label [for]="id" class="text-sm font-medium">{{ label() }}</label>
      <output [for]="id" class="text-sm tabular-nums">{{ value() }}</output>
    </div>
    <input
      #control
      class="min-h-10 w-full accent-primary"
      type="range"
      [id]="id"
      [min]="min()"
      [max]="max()"
      [step]="step()"
      [value]="value()"
      [disabled]="disabled()"
      (input)="change($event)"
      (blur)="touch()"
    />
  </div>`,
})
export class SliderComponent extends FormValueAccessor<number> {
  readonly id = controlId('slider');
  readonly label = input.required<string>();
  readonly min = input(0);
  readonly max = input(1);
  readonly step = input(0.1);

  readonly value = signal<number>(0);
  private readonly control = viewChild<ElementRef<HTMLInputElement>>('control');

  writeValue(value: unknown): void {
    const next = typeof value === 'number' && Number.isFinite(value) ? value : this.min();
    this.value.set(next);
    const element = this.control()?.nativeElement;
    if (element) element.value = String(next);
  }

  change(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.update(event.target.valueAsNumber);
  }
}
