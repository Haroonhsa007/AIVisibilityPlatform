import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BadgeComponent, BadgeTone } from '../badge/badge.component';

export function scoreTone(score: number | null | undefined): BadgeTone {
  if (score === null || score === undefined) return 'neutral';
  return score >= 0.7 ? 'success' : score >= 0.4 ? 'warning' : 'danger';
}

@Component({
  selector: 'app-score-chip',
  imports: [DecimalPipe, BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-badge [tone]="tone()">{{
    score() === null ? '—' : (score() | number: '1.2-3')
  }}</app-badge>`,
})
export class ScoreChipComponent {
  readonly score = input.required<number | null>();
  readonly tone = computed(() => scoreTone(this.score()));
}
