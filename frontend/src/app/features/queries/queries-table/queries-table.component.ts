import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  finalize,
  map,
  of,
  startWith,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowDown,
  heroArrowUp,
  heroArrowPath,
  heroArrowDownTray,
} from '@ng-icons/heroicons/outline';
import { DownloadService } from '../../../core/services/download.service';
import { queriesCsv, queryCsvFilename } from '../../../shared/utils/csv';
import { ProfileStore } from '../../../core/services/profile.store';
import { QueryService } from '../../../core/services/query.service';
import { ToastService } from '../../../core/services/toast.service';
import { AppError, Page, QueryItem, QuerySort } from '../../../shared/models';
import { appError } from '../../../shared/utils/app-error';
import { queryApiParams, queryViewParams } from '../../../shared/utils/query-params';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { PaginatorComponent } from '../../../shared/ui/paginator/paginator.component';
import { ScoreChipComponent } from '../../../shared/ui/score-chip/score-chip.component';
import { SelectComponent } from '../../../shared/ui/select/select.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { SliderComponent } from '../../../shared/ui/slider/slider.component';

@Component({
  selector: 'app-queries-table',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    NgIcon,
    BadgeComponent,
    ButtonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    PaginatorComponent,
    ScoreChipComponent,
    SelectComponent,
    SkeletonComponent,
    SliderComponent,
  ],
  providers: [provideIcons({ heroArrowDown, heroArrowUp, heroArrowPath, heroArrowDownTray })],
  templateUrl: './queries-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueriesTableComponent {
  readonly store = inject(ProfileStore);
  private readonly queries = inject(QueryService);
  private readonly download = inject(DownloadService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  readonly params = signal(queryViewParams(this.route.snapshot.queryParamMap));
  readonly page = signal<Page<QueryItem> | null>(null);
  readonly rows = computed(() => this.page()?.items ?? []);
  readonly loading = signal(true);
  readonly error = signal<AppError | null>(null);
  readonly exporting = signal(false);
  readonly exportCount = signal(0);
  readonly exportTotal = signal<number | undefined>(undefined);
  readonly exportError = signal<AppError | null>(null);
  readonly rechecking = signal<ReadonlySet<string>>(new Set());
  readonly filtered = computed(() => this.params().min_score > 0 || !!this.params().status);
  readonly filters = new FormGroup({
    min_score: new FormControl(0, { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
  });
  readonly visibilityOptions = [
    { value: '', label: 'All visibility' },
    { value: 'visible', label: 'Visible' },
    { value: 'not_visible', label: 'Not visible' },
    { value: 'unknown', label: 'Unknown' },
  ];

  constructor() {
    effect(() => {
      const params = this.params();
      this.filters.patchValue(
        { min_score: params.min_score, status: params.status ?? '' },
        { emitEvent: false },
      );
    });
    this.filters.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged((a, b) => a.min_score === b.min_score && a.status === b.status),
        takeUntilDestroyed(),
      )
      .subscribe((value) => {
        this.navigate({
          min_score: value.min_score || null,
          status: value.status || null,
          page: 1,
        });
      });
    combineLatest([
      toObservable(this.store.profileUuid),
      toObservable(this.store.revision),
      this.route.queryParamMap.pipe(
        map(queryViewParams),
        distinctUntilChanged(
          (a, b) =>
            a.page === b.page &&
            a.per_page === b.per_page &&
            a.min_score === b.min_score &&
            a.status === b.status &&
            a.sort === b.sort &&
            a.order === b.order,
        ),
      ),
      this.reload.pipe(startWith(undefined)),
    ])
      .pipe(
        switchMap(([uuid, , params]) => {
          this.params.set(params);
          if (!uuid) return of(null);
          this.loading.set(true);
          this.error.set(null);
          return this.queries.list(uuid, queryApiParams(params)).pipe(
            tap((page) => {
              this.page.set(page);
              if (!params.status && params.min_score === 0 && page.total !== undefined)
                this.store.counts.update((counts) => ({ ...counts, queries: page.total }));
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
    this.filters.reset({ min_score: 0, status: '' }, { emitEvent: false });
    this.navigate({ min_score: null, status: null, page: 1 });
  }
  setPage(page: number): void {
    this.navigate({ page });
  }
  setSize(per_page: number): void {
    this.navigate({ per_page, page: 1 });
  }
  sortBy(sort: QuerySort): void {
    this.navigate({
      sort,
      order: this.params().sort === sort && this.params().order === 'desc' ? 'asc' : 'desc',
      page: 1,
    });
  }
  sortDirection(sort: QuerySort): 'ascending' | 'descending' | 'none' {
    return this.params().sort === sort
      ? this.params().order === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none';
  }

  recheck(row: QueryItem): void {
    if (this.rechecking().has(row.query_uuid)) return;
    this.rechecking.update((ids) => new Set([...ids, row.query_uuid]));
    this.queries
      .recheck(row.query_uuid)
      .pipe(
        tap((updated) => {
          this.page.update((page) =>
            page
              ? {
                  ...page,
                  items: (page.items ?? []).map((item) =>
                    item.query_uuid === updated.query_uuid ? updated : item,
                  ),
                }
              : page,
          );
          this.toast.success('Recheck complete.');
        }),
        catchError(() => EMPTY), // Interceptor announces the error; keep the original row.
        finalize(() =>
          this.rechecking.update((ids) => new Set([...ids].filter((id) => id !== row.query_uuid))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  exportCsv(): void {
    const profile = this.store.profile();
    if (!profile || this.exporting() || this.store.busy()) return;
    this.exporting.set(true);
    this.exportCount.set(0);
    this.exportTotal.set(undefined);
    this.exportError.set(null);
    const state = this.params();
    const params = {
      ...(state.min_score > 0 ? { min_score: state.min_score } : {}),
      ...(state.status ? { status: state.status } : {}),
      sort: state.sort,
      order: state.order,
    };
    this.queries
      .listAll(profile.profile_uuid, params, (loaded, total) => {
        this.exportCount.set(loaded);
        this.exportTotal.set(total);
      })
      .pipe(
        tap((rows) => {
          this.download.saveCsv(queryCsvFilename(profile.domain), queriesCsv(rows));
          this.toast.success(`Export complete. ${rows.length} queries downloaded.`);
        }),
        catchError((error: unknown) => {
          this.exportError.set(appError(error));
          if (error instanceof Error) this.toast.error(appError(error).message);
          return EMPTY;
        }),
        finalize(() => this.exporting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private navigate(queryParams: Record<string, string | number | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
