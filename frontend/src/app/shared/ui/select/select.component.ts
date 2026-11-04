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
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronDown } from '@ng-icons/heroicons/outline';
import { controlId, FormValueAccessor } from '../form-value-accessor';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-select',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provideIcons({ heroChevronDown }),
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true },
  ],
  template: `<label [for]="id" class="mb-2 block text-sm font-medium">{{ label() }}</label>
    <div class="relative">
      <select
        #control
        [id]="id"
        class="ui-input ui-select w-full"
        [value]="value()"
        [disabled]="disabled()"
        (change)="change($event)"
        (blur)="touch()"
      >
        @if (placeholder()) {
          <option value="" disabled [selected]="value() === ''">{{ placeholder() }}</option>
        }
        @for (option of options(); track option.value) {
          <option
            [value]="option.value"
            [disabled]="option.disabled ?? false"
            [selected]="option.value === value()"
          >
            {{ option.label }}
          </option>
        }
      </select>
      <ng-icon
        name="heroChevronDown"
        size="16"
        aria-hidden="true"
        class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>`,
})
export class SelectComponent extends FormValueAccessor<string> {
  readonly id = controlId('select');
  readonly label = input.required<string>();
  readonly options = input.required<readonly SelectOption[]>();
  readonly placeholder = input('');

  readonly value = signal<string>('');
  private readonly control = viewChild<ElementRef<HTMLSelectElement>>('control');

  writeValue(value: unknown): void {
    const next = typeof value === 'string' ? value : '';
    this.value.set(next);
    const element = this.control()?.nativeElement;
    if (element) element.value = next;
  }

  change(event: Event): void {
    if (event.target instanceof HTMLSelectElement) this.update(event.target.value);
  }
}
