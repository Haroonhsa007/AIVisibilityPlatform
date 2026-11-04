import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppError, PipelineRun, RunStatus } from '../../shared/models';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { API_URL } from './api-url';
import { PipelineService } from './pipeline.service';
import { ToastService } from './toast.service';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class PollOwner {
  readonly destroyRef = inject(DestroyRef);
}

describe('PipelineService', () => {
  let service: PipelineService;
  let http: HttpTestingController;
  const run: PipelineRun = {
    run_uuid: 'run-1',
    profile_uuid: 'profile-1',
    status: 'queued',
    queries_discovered: 0,
    queries_scored: 0,
    tokens_used: 0,
  };
  beforeEach(() => {
    jasmine.clock().install();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { error: jasmine.createSpy('error') } },
      ],
    });
    service = TestBed.inject(PipelineService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    jasmine.clock().uninstall();
  });

  it('starts a run with POST and accepts 202', () => {
    service.startRun('profile-1').subscribe((result) => expect(result).toEqual(run));
    const request = http.expectOne(`${API_URL}/profiles/profile-1/run`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush(run, { status: 202, statusText: 'Accepted' });
  });

  it('fetches a typed run', () => {
    service.getRun('run-1').subscribe((result) => expect(result).toEqual(run));
    const request = http.expectOne(`${API_URL}/runs/run-1`);
    expect(request.request.method).toBe('GET');
    request.flush(run);
  });

  it("lists a profile's runs", () => {
    service.listRuns('profile-1').subscribe((result) => expect(result).toEqual({ items: [run] }));
    const request = http.expectOne(`${API_URL}/profiles/profile-1/runs`);
    expect(request.request.method).toBe('GET');
    request.flush({ items: [run] });
  });

  for (const terminal of ['completed', 'partial', 'failed'] satisfies RunStatus[]) {
    it(`emits queued, running and ${terminal}, then completes and stops HTTP`, () => {
      const seen: RunStatus[] = [];
      let completed = false;
      service.pollRun('run-1').subscribe({
        next: (result) => seen.push(result.status),
        complete: () => (completed = true),
      });
      jasmine.clock().tick(0);
      http.expectOne(`${API_URL}/runs/run-1`).flush(run);
      jasmine.clock().tick(2000);
      http.expectOne(`${API_URL}/runs/run-1`).flush({ ...run, status: 'running' });
      jasmine.clock().tick(2000);
      http.expectOne(`${API_URL}/runs/run-1`).flush({ ...run, status: terminal });
      expect(seen).toEqual(['queued', 'running', terminal]);
      expect(completed).toBeTrue();
      jasmine.clock().tick(6000);
      http.expectNone(`${API_URL}/runs/run-1`);
    });
  }

  it('completes if the initial response is already terminal', () => {
    const seen: RunStatus[] = [];
    const subscription = service.pollRun('run-1').subscribe((result) => seen.push(result.status));
    jasmine.clock().tick(0);
    http.expectOne(`${API_URL}/runs/run-1`).flush({ ...run, status: 'completed' });
    expect(seen).toEqual(['completed']);
    expect(subscription.closed).toBeTrue();
    jasmine.clock().tick(4000);
    http.expectNone(`${API_URL}/runs/run-1`);
  });

  it('cancels an in-flight request on unsubscribe', () => {
    const subscription = service.pollRun('run-1').subscribe();
    jasmine.clock().tick(0);
    const request = http.expectOne(`${API_URL}/runs/run-1`);
    subscription.unsubscribe();
    expect(request.cancelled).toBeTrue();
    jasmine.clock().tick(4000);
    http.expectNone(`${API_URL}/runs/run-1`);
  });

  it('stops the timer and in-flight HTTP when the calling component is destroyed', () => {
    const fixture = TestBed.createComponent(PollOwner);
    const subscription = service.pollRun('run-1', fixture.componentInstance.destroyRef).subscribe();
    jasmine.clock().tick(0);
    const request = http.expectOne(`${API_URL}/runs/run-1`);
    fixture.destroy();
    expect(subscription.closed).toBeTrue();
    expect(request.cancelled).toBeTrue();
    jasmine.clock().tick(4000);
    http.expectNone(`${API_URL}/runs/run-1`);
  });

  it('surfaces a mapped error and does not keep polling after failure', () => {
    let error: AppError | undefined;
    service.pollRun('run-1').subscribe({ error: (received: AppError) => (error = received) });
    jasmine.clock().tick(0);
    http
      .expectOne(`${API_URL}/runs/run-1`)
      .flush(
        { error: { code: 'not_found', message: 'Run not found.' } },
        { status: 404, statusText: 'Not Found' },
      );
    expect(error).toEqual({ kind: 'not_found', message: 'Run not found.' });
    jasmine.clock().tick(4000);
    http.expectNone(`${API_URL}/runs/run-1`);
  });
});
