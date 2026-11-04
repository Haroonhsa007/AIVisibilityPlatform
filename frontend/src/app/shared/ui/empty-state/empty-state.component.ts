import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroDocumentText } from '@ng-icons/heroicons/outline';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-empty-state',
  imports: [ButtonComponent, NgIcon],
  providers: [provideIcons({ heroDocumentText })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="flex flex-col items-center gap-4 py-12 text-center">
    <ng-icon name="heroDocumentText" size="48" class="text-muted" aria-hidden="true" />
    <h2 class="text-lg font-semibold">{{ title() }}</h2>
    <p class="max-w-md text-sm text-muted">{{ message() }}</p>
    @if (actionLabel()) {
      <app-button (click)="action.emit()">{{ actionLabel() }}</app-button>
    }
  </div>`,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly actionLabel = input('');
  readonly action = output<void>();
}
