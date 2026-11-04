import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowPath } from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-spinner',
  imports: [NgIcon],
  providers: [provideIcons({ heroArrowPath })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span role="status" class="inline-flex items-center">
    <ng-icon name="heroArrowPath" size="16" class="animate-spin" aria-hidden="true" /><span
      class="sr-only"
      >{{ label() }}</span
    >
  </span>`,
})
export class SpinnerComponent {
  readonly label = input('Loading');
}
