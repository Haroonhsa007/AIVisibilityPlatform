import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ProfileStatus, RunStatus } from '../../models';
import { BadgeComponent, BadgeTone } from '../badge/badge.component';

@Component({
  selector: 'app-run-status',
  imports: [BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-badge [tone]="tone()">{{ label() }}</app-badge>`,
})
export class RunStatusComponent {
  readonly status = input.required<RunStatus | ProfileStatus>();
  readonly tone = computed<BadgeTone>(
    () =>
      (
        ({
          completed: 'success',
          partial: 'warning',
          failed: 'danger',
          running: 'accent',
          queued: 'neutral',
          new: 'neutral',
        }) as const
      )[this.status()],
  );
  readonly label = computed(
    () =>
      ({
        completed: 'Completed',
        partial: 'Partial',
        failed: 'Failed',
        running: 'Running',
        queued: 'Queued',
        new: 'New',
      })[this.status()],
  );
}
