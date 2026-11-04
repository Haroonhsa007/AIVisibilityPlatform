import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-error-state',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="rounded-lg border border-danger bg-surface p-6">
    <p role="alert" class="mb-4 text-danger">{{ message() }}</p>
    <app-button variant="secondary" (click)="retry.emit()">Try again</app-button>
  </div>`,
})
export class ErrorStateComponent {
  readonly message = input.required<string>();
  readonly retry = output<void>();
}
