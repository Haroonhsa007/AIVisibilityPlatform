import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SkeletonVariant = 'line' | 'stat' | 'row' | 'chart' | 'card';

@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="sr-only" role="status">{{ label() }}</span
    ><span
      aria-hidden="true"
      class="skeleton-shimmer block rounded-lg"
      [style.width]="width()"
      [style.height]="resolvedHeight()"
    ></span>`,
})
export class SkeletonComponent {
  readonly label = input('Loading');
  readonly width = input('100%');
  readonly height = input<string | null>(null);
  readonly variant = input<SkeletonVariant>('line');
  readonly resolvedHeight = computed(
    () =>
      this.height() ??
      { line: '1rem', stat: '3rem', row: '2.5rem', chart: '22rem', card: '12rem' }[this.variant()],
  );
}
