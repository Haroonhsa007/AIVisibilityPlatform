import { DataRevisionService } from './data-revision.service';
import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, switchMap, takeWhile, tap, timer } from 'rxjs';
import { ItemList, PipelineRun } from '../../shared/models';
import { API_URL } from './api-url';

@Injectable({ providedIn: 'root' })
export class PipelineService {
  private readonly http = inject(HttpClient);
  private readonly revision = inject(DataRevisionService);
  private readonly destroyRef = inject(DestroyRef);

  startRun(profileUuid: string): Observable<PipelineRun> {
    return this.http
      .post<PipelineRun>(`${API_URL}/profiles/${encodeURIComponent(profileUuid)}/run`, null)
      .pipe(tap(() => this.revision.invalidate()));
  }

  getRun(runUuid: string): Observable<PipelineRun> {
    return this.http.get<PipelineRun>(`${API_URL}/runs/${encodeURIComponent(runUuid)}`).pipe(
      tap((run) => {
        if (run.status !== 'queued' && run.status !== 'running') this.revision.invalidate();
      }),
    );
  }

  listRuns(profileUuid: string): Observable<ItemList<PipelineRun>> {
    return this.http.get<ItemList<PipelineRun>>(
      `${API_URL}/profiles/${encodeURIComponent(profileUuid)}/runs`,
    );
  }

  // Pass the calling component's DestroyRef to stop polling when its route is destroyed.
  // Unsubscribing (e.g. AsyncPipe) also cancels both the timer and in-flight HTTP.
  pollRun(runUuid: string, destroyRef: DestroyRef = this.destroyRef): Observable<PipelineRun> {
    return timer(0, 2000).pipe(
      switchMap(() => this.getRun(runUuid)),
      takeWhile((run) => run.status === 'queued' || run.status === 'running', true),
      takeUntilDestroyed(destroyRef),
    );
  }
}
