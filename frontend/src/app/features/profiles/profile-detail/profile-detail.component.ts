import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowLeft, heroArrowTopRightOnSquare, heroPlay } from '@ng-icons/heroicons/outline';
import { ProfileStore } from '../../../core/services/profile.store';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { ChipComponent } from '../../../shared/ui/chip/chip.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { RunStatusComponent } from '../../../shared/ui/run-status/run-status.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { RouteTab, TabsComponent } from '../../../shared/ui/tabs/tabs.component';

@Component({
  selector: 'app-profile-detail',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterOutlet,
    RouterLink,
    NgIcon,
    ButtonComponent,
    ChipComponent,
    ErrorStateComponent,
    RunStatusComponent,
    SkeletonComponent,
    TabsComponent,
  ],
  providers: [ProfileStore, provideIcons({ heroArrowLeft, heroArrowTopRightOnSquare, heroPlay })],
  templateUrl: './profile-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileDetailComponent {
  readonly store = inject(ProfileStore);
  private readonly route = inject(ActivatedRoute);
  private profileUuid = '';
  readonly tabs = computed<RouteTab[]>(() => {
    const counts = this.store.counts();
    return [
      {
        label: `Queries${counts.queries === undefined ? '' : ' (' + counts.queries + ')'}`,
        link: 'queries',
      },
      { label: 'Chart', link: 'chart' },
      {
        label: `Recommendations${counts.recommendations === undefined ? '' : ' (' + counts.recommendations + ')'}`,
        link: 'recommendations',
      },
    ];
  });
  readonly duration = computed(() => {
    const run = this.store.run();
    if (!run?.started_at || !run.completed_at) return null;
    return Math.max(0, (Date.parse(run.completed_at) - Date.parse(run.started_at)) / 1000);
  });
  readonly stage = computed(() => {
    const run = this.store.run();
    if (run?.status === 'queued') return 'Waiting to start';
    return {
      discovery: 'Discovering queries',
      scoring: 'Scoring visibility',
      recommendations: 'Creating recommendations',
    }[run?.stage ?? 'discovery'];
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('profileUuid') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((uuid) => {
        this.profileUuid = uuid;
        this.store.load(uuid);
      });
  }

  retry(): void {
    this.store.load(this.profileUuid);
  }
}
