import { computed, DestroyRef, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  EMPTY,
  finalize,
  Observable,
  of,
  Subscription,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { AppError, PipelineRun, Profile } from '../../shared/models';
import { appError } from '../../shared/utils/app-error';
import { PipelineService } from './pipeline.service';
import { ProfileService } from './profile.service';
import { ToastService } from './toast.service';

export function activeRun(run: PipelineRun | null | undefined): boolean {
  return run?.status === 'queued' || run?.status === 'running';
}

@Injectable()
export class ProfileStore implements OnDestroy {
  private readonly profiles = inject(ProfileService);
  private readonly pipeline = inject(PipelineService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly profile = signal<Profile | null>(null);
  readonly run = signal<PipelineRun | null>(null);
  readonly profileUuid = computed(() => this.profile()?.profile_uuid ?? null);
  readonly loading = signal(false);
  readonly starting = signal(false);
  readonly error = signal<AppError | null>(null);
  readonly runError = signal<AppError | null>(null);
  readonly revision = signal(0);
  readonly counts = signal<{ queries?: number; recommendations?: number }>({});
  readonly busy = computed(() => this.starting() || activeRun(this.run()));
  private loadSubscription?: Subscription;
  private runSubscription?: Subscription;
  private metadataSubscription?: Subscription;

  load(profileUuid: string): void {
    this.loadSubscription?.unsubscribe();
    this.runSubscription?.unsubscribe();
    this.metadataSubscription?.unsubscribe();
    this.profile.set(null);
    this.run.set(null);
    this.counts.set({});
    this.error.set(null);
    this.runError.set(null);
    this.loading.set(true);
    this.loadSubscription = this.profiles
      .get(profileUuid)
      .pipe(
        tap((profile) => {
          this.profile.set(profile);
          this.run.set(profile.latest_run ?? null);
          if (activeRun(profile.latest_run)) this.follow(profile.latest_run as PipelineRun);
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

  startRun(): void {
    const profile = this.profile();
    if (!profile || this.busy()) return;
    this.runError.set(null);
    this.starting.set(true);
    this.runSubscription?.unsubscribe();
    this.runSubscription = this.pipeline
      .startRun(profile.profile_uuid)
      .pipe(
        tap(() => this.toast.info('Pipeline started.')),
        catchError((error: unknown): Observable<PipelineRun> => {
          const failure = appError(error);
          if (failure.kind !== 'conflict') return throwError(() => failure);
          return this.profiles.get(profile.profile_uuid).pipe(
            switchMap((latest) => {
              this.profile.set(latest);
              return latest.latest_run && activeRun(latest.latest_run)
                ? of(latest.latest_run)
                : throwError(() => failure);
            }),
          );
        }),
        switchMap((run) => {
          this.run.set(run);
          return activeRun(run) ? this.pipeline.pollRun(run.run_uuid, this.destroyRef) : of(run);
        }),
        tap((run) => this.accept(run)),
        catchError((error: unknown) => {
          this.runError.set(appError(error));
          return EMPTY;
        }),
        finalize(() => this.starting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  retryRun(): void {
    const run = this.run();
    this.runError.set(null);
    if (run && activeRun(run)) this.follow(run);
    else if (run) this.refreshMetadata(run.profile_uuid);
    else this.startRun();
  }

  ngOnDestroy(): void {
    this.loadSubscription?.unsubscribe();
    this.runSubscription?.unsubscribe();
    this.metadataSubscription?.unsubscribe();
  }

  private follow(run: PipelineRun): void {
    this.runSubscription?.unsubscribe();
    this.runSubscription = this.pipeline
      .pollRun(run.run_uuid, this.destroyRef)
      .pipe(
        tap((next) => this.accept(next)),
        catchError((error: unknown) => {
          this.runError.set(appError(error));
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private accept(run: PipelineRun): void {
    this.run.set(run);
    if (activeRun(run)) return;
    this.revision.update((value) => value + 1);
    this.counts.set({
      queries: run.queries_discovered,
      recommendations: run.recommendations_created,
    });
    if (run.status === 'completed') this.toast.success('Pipeline complete.');
    else if (run.status === 'partial')
      this.toast.info(
        `Completed with warnings.${run.error_message ? ' ' + run.error_message : ''}`,
      );
    else this.toast.error(`Pipeline failed.${run.error_message ? ' ' + run.error_message : ''}`);
    this.refreshMetadata(run.profile_uuid);
  }

  private refreshMetadata(profileUuid: string): void {
    this.metadataSubscription?.unsubscribe();
    this.metadataSubscription = this.profiles
      .get(profileUuid)
      .pipe(
        tap((profile) => this.profile.set(profile)),
        catchError((error: unknown) => {
          this.runError.set(appError(error));
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
