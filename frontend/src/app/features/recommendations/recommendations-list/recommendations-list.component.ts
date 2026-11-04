import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { catchError, combineLatest, finalize, of, startWith, Subject, switchMap, tap } from 'rxjs';
import { ProfileStore } from '../../../core/services/profile.store';
import { RecommendationService } from '../../../core/services/recommendation.service';
import { AppError, ContentType, Recommendation } from '../../../shared/models';
import { appError } from '../../../shared/utils/app-error';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ChipComponent } from '../../../shared/ui/chip/chip.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ToggleGroupComponent } from '../../../shared/ui/toggle-group/toggle-group.component';

export function filterRecommendations(
  items: readonly Recommendation[],
  priority: string,
): readonly Recommendation[] {
  return priority === '' ? items : items.filter((item) => item.priority === priority);
}

@Component({
  selector: 'app-recommendations-list',
  imports: [
    ReactiveFormsModule,
    BadgeComponent,
    ChipComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
    ToggleGroupComponent,
  ],
  templateUrl: './recommendations-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationsListComponent {
  readonly store = inject(ProfileStore);
  private readonly recommendations = inject(RecommendationService);
  private readonly reload = new Subject<void>();
  readonly items = signal<readonly Recommendation[]>([]);
  readonly loading = signal(true);
  readonly error = signal<AppError | null>(null);
  readonly priorityControl = new FormControl('', { nonNullable: true });
  readonly priority = signal('');
  readonly filtered = computed(() => filterRecommendations(this.items(), this.priority()));
  readonly options = computed(() => [
    { value: '', label: `All (${this.items().length})` },
    ...(['high', 'medium', 'low'] as const).map((value) => ({
      value,
      label: `${value.charAt(0).toUpperCase() + value.slice(1)} (${this.items().filter((item) => item.priority === value).length})`,
    })),
  ]);
  readonly contentLabels: Record<ContentType, string> = {
    blog_post: 'Blog post',
    landing_page: 'Landing page',
    faq: 'FAQ',
  };

  constructor() {
    this.priorityControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.priority.set(value));
    combineLatest([
      toObservable(this.store.profileUuid),
      toObservable(this.store.revision),
      this.reload.pipe(startWith(undefined)),
    ])
      .pipe(
        switchMap(([uuid]) => {
          if (!uuid) return of(null);
          this.loading.set(true);
          this.error.set(null);
          return this.recommendations.list(uuid).pipe(
            tap((result) => {
              const items = result.items ?? [];
              this.items.set(items);
              this.store.counts.update((counts) => ({ ...counts, recommendations: items.length }));
            }),
            catchError((error: unknown) => {
              this.error.set(appError(error));
              return of(null);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  retry(): void {
    this.reload.next();
  }
  reset(): void {
    this.priorityControl.setValue('');
  }
}
