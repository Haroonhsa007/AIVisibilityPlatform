import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SpinnerComponent } from '../spinner/spinner.component';

@Component({
  selector: 'app-button',
  imports: [SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button
    class="ui-button"
    [attr.data-variant]="variant()"
    [type]="type()"
    [disabled]="disabled() || loading()"
    [attr.aria-busy]="loading()"
  >
    @if (loading()) {
      <app-spinner label="Please wait" />
    }
    <ng-content />
  </button>`,
})
export class ButtonComponent {
  readonly variant = input<'primary' | 'secondary' | 'ghost'>('primary');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false);
  readonly loading = input(false);
}
