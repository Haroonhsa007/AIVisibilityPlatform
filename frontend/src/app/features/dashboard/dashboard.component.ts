import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowRight, heroPlus } from '@ng-icons/heroicons/outline';
import { DashboardStore } from '../../core/services/dashboard.store';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { RunStatusComponent } from '../../shared/ui/run-status/run-status.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    RelativeTimePipe,
    NgIcon,
    EmptyStateComponent,
    ErrorStateComponent,
    RunStatusComponent,
    SkeletonComponent,
  ],
  providers: [provideIcons({ heroPlus, heroArrowRight })],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly store = inject(DashboardStore);
  readonly data = this.store.data;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  constructor() {
    this.store.load();
  }

  retry(): void {
    this.store.load(true);
  }
}
