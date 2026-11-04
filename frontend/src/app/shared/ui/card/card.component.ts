import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="rounded-lg border border-border bg-surface p-6">
    <ng-content />
  </div>`,
})
export class CardComponent {}
