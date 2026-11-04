import { DOCUMENT, DecimalPipe } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, finalize, of, startWith, Subject, switchMap, tap } from 'rxjs';
import {
  BarController,
  BarElement,
  CategoryScale,
  ChartOptions,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { BaseChartDirective, provideCharts } from 'ng2-charts';
import { ProfileStore } from '../../../core/services/profile.store';
import { QueryService } from '../../../core/services/query.service';
import { ThemeService } from '../../../core/services/theme.service';
import { AppError, Page, QueryItem } from '../../../shared/models';
import { appError } from '../../../shared/utils/app-error';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { buildChartData, readChartPalette } from './chart-data';

@Component({
  selector: 'app-opportunity-chart',
  imports: [
    DecimalPipe,
    BaseChartDirective,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
  ],
  providers: [
    provideCharts({
      registerables: [BarController, BarElement, CategoryScale, LinearScale, Tooltip],
    }),
  ],
  templateUrl: './opportunity-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpportunityChartComponent {
  readonly store = inject(ProfileStore);
  private readonly queries = inject(QueryService);
  private readonly theme = inject(ThemeService);
  private readonly document = inject(DOCUMENT);
  private readonly reload = new Subject<void>();
  private readonly smallScreen = toSignal(inject(BreakpointObserver).observe('(max-width: 900px)'));
  private readonly reducedMotion = toSignal(
    inject(BreakpointObserver).observe('(prefers-reduced-motion: reduce)'),
  );
  readonly horizontal = computed(() => this.smallScreen()?.matches ?? false);
  readonly page = signal<Page<QueryItem> | null>(null);
  readonly rows = computed(() => this.page()?.items ?? []);
  readonly palette = signal(readChartPalette(this.document));
  readonly loading = signal(true);
  readonly error = signal<AppError | null>(null);
  readonly data = computed(() => buildChartData(this.rows(), this.palette()));
  /** Past this many bars the chart scrolls sideways instead of squeezing labels. */
  static readonly FIT_LIMIT = 40;
  readonly chartHeight = computed(() =>
    this.horizontal() ? Math.max(280, this.rows().length * 32) : 460,
  );
  readonly chartWidth = computed(() =>
    this.horizontal() || this.rows().length <= OpportunityChartComponent.FIT_LIMIT
      ? 0
      : this.rows().length * 28,
  );
  readonly scrolls = computed(() => !this.horizontal() && this.chartWidth() > 0);
  readonly options = computed<ChartOptions<'bar'>>(() => {
    const colors = this.palette();
    const horizontal = this.horizontal();
    const scoreScale = {
      type: 'linear' as const,
      min: 0,
      max: 1,
      ticks: { stepSize: 0.2, color: colors.text, font: { family: 'Inter', size: 11 } },
      grid: { color: colors.border },
      border: { display: false },
    };
    const labelScale = {
      type: 'category' as const,
      ticks: {
        color: colors.text,
        // Vertical bars: show every label, angled so none are dropped.
        minRotation: horizontal ? 0 : 55,
        maxRotation: horizontal ? 0 : 55,
        autoSkip: false,
        font: { family: 'Inter', size: 11 },
      },
      grid: { display: false },
      border: { display: false },
    };
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      animation: this.reducedMotion()?.matches ? false : { duration: 160 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => this.rows()[items[0]?.dataIndex ?? 0]?.query_text ?? '',
            label: (item) => `Opportunity: ${item.raw === null ? 'not scored' : String(item.raw)}`,
          },
        },
      },
      scales: { x: horizontal ? scoreScale : labelScale, y: horizontal ? labelScale : scoreScale },
    };
  });

  constructor() {
    effect(() => {
      this.theme.resolvedTheme();
      this.palette.set(readChartPalette(this.document));
    });
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
          return this.queries
            .list(uuid, { page: 1, per_page: 100, sort: 'opportunity_score', order: 'desc' })
            .pipe(
              tap((page) => {
                this.page.set(page);
                if (page.total !== undefined)
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
}
