import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize, forkJoin, tap } from 'rxjs';
import { AppError, Dashboard, Page, Profile } from '../../shared/models';
import { appError } from '../../shared/utils/app-error';
import { DashboardService } from './dashboard.service';
import { DataRevisionService } from './data-revision.service';
import { ProfileService } from './profile.service';

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly dashboard = inject(DashboardService);
  private readonly profiles = inject(ProfileService);
  private readonly revision = inject(DataRevisionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly data = signal<{ dashboard: Dashboard; profiles: Page<Profile> } | null>(null);
  readonly loading = signal(false);
  readonly error = signal<AppError | null>(null);
  private loadedAt = 0;
  private loadedVersion = -1;

  load(force = false): void {
    if (this.loading()) return;
    const version = this.revision.version();
    if (
      !force &&
      this.data() &&
      this.loadedVersion === version &&
      Date.now() - this.loadedAt < 30_000
    )
      return;
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      dashboard: this.dashboard.get(),
      profiles: this.profiles.list({ page: 1, per_page: 5 }),
    })
      .pipe(
        tap((data) => {
          this.data.set(data);
          this.loadedAt = Date.now();
          this.loadedVersion = version;
        }),
        catchError((error: unknown) => {
          this.error.set(appError(error));
          return EMPTY;
        }),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
