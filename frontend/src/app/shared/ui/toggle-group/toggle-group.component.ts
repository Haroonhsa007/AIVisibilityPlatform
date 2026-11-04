import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  input,
  signal,
  viewChildren,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { controlId, FormValueAccessor } from '../form-value-accessor';

export interface ToggleOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-toggle-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ToggleGroupComponent),
      multi: true,
    },
  ],
  template: `<fieldset [disabled]="disabled()">
    <legend class="text-sm font-medium" [class.mb-2]="!hideLabel()" [class.sr-only]="hideLabel()">
      {{ label() }}
    </legend>
    <div class="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
      @for (option of options(); track option.value; let i = $index) {
        <label class="ui-toggle" [class.selected]="value() === option.value" [for]="id + '-' + i">
          <input
            #control
            class="sr-only"
            type="radio"
            [id]="id + '-' + i"
            [name]="id"
            [value]="option.value"
            [checked]="value() === option.value"
            (change)="choose(option.value)"
            (blur)="touch()"
          />
          {{ option.label }}
        </label>
      }
    </div>
  </fieldset>`,
})
export class ToggleGroupComponent extends FormValueAccessor<string> {
  readonly id = controlId('toggle');
  readonly label = input.required<string>();
  /** Keep the label for assistive tech but hide it visually (e.g. beside a heading). */
  readonly hideLabel = input(false);
  readonly options = input.required<readonly ToggleOption[]>();

  readonly value = signal<string>('');
  private readonly controls = viewChildren<ElementRef<HTMLInputElement>>('control');

  writeValue(value: unknown): void {
    const next = typeof value === 'string' ? value : '';
    this.value.set(next);
    this.controls().forEach(
      ({ nativeElement }) => (nativeElement.checked = nativeElement.value === next),
    );
  }
  choose(value: string): void {
    this.update(value);
  }
}
