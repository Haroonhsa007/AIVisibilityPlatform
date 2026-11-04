import { Directive, signal, WritableSignal } from '@angular/core';
import { ControlValueAccessor } from '@angular/forms';

let controlSequence = 0;
export function controlId(prefix: string): string {
  return `${prefix}-${++controlSequence}`;
}

@Directive()
export abstract class FormValueAccessor<T> implements ControlValueAccessor {
  abstract readonly value: WritableSignal<T>;
  readonly disabled = signal(false);
  private onChange: (value: T) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  abstract writeValue(value: unknown): void;

  registerOnChange(fn: (value: T) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected update(value: T): void {
    this.value.set(value);
    this.onChange(value);
  }

  touch(): void {
    this.onTouched();
  }
}
