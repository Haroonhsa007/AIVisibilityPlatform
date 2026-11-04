import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-chip',
  imports: [NgIcon],
  providers: [provideIcons({ heroXMark })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span
    class="inline-flex items-center gap-1 rounded-lg border border-border bg-bg pl-3"
    [class.pr-3]="!removable()"
  >
    <span class="py-1 text-sm">{{ label() }}</span>
    @if (removable()) {
      <button
        type="button"
        class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-muted hover:text-text"
        [attr.aria-label]="'Remove ' + label()"
        (click)="removed.emit()"
      >
        <ng-icon name="heroXMark" size="16" aria-hidden="true" />
      </button>
    }
  </span>`,
})
export class ChipComponent {
  readonly label = input.required<string>();
  readonly removable = input(false);
  readonly removed = output<void>();
}
