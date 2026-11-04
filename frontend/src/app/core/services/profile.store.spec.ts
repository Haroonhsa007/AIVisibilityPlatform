import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { PipelineRun, Profile } from '../../shared/models';
import { PipelineService } from './pipeline.service';
import { ProfileService } from './profile.service';
import { ProfileStore } from './profile.store';
import { ToastService } from './toast.service';

describe('ProfileStore run lifecycle', () => {
  let profiles: jasmine.SpyObj<ProfileService>;
  let pipeline: jasmine.SpyObj<PipelineService>;
  let store: ProfileStore;
  let poll: Subject<PipelineRun>;
  const queued: PipelineRun = {
    run_uuid: 'run-1',
    profile_uuid: 'profile-1',
    status: 'queued',
    queries_discovered: 0,
    queries_scored: 0,
    tokens_used: 0,
  };
  const profile: Profile = {
    profile_uuid: 'profile-1',
    name: 'Surfer',
    domain: 'surferseo.com',
    industry: 'SEO',
    status: 'new',
    created_at: '2026-11-04T10:00:00Z',
    updated_at: '2026-11-04T10:00:00Z',
    latest_run: null,
  };
  beforeEach(() => {
    profiles = jasmine.createSpyObj<ProfileService>('ProfileService', ['get']);
    pipeline = jasmine.createSpyObj<PipelineService>('PipelineService', ['startRun', 'pollRun']);
    profiles.get.and.returnValue(of(profile));
    pipeline.startRun.and.returnValue(of(queued));
    poll = new Subject<PipelineRun>();
    pipeline.pollRun.and.returnValue(poll);
    TestBed.configureTestingModule({
      providers: [
        ProfileStore,
        { provide: ProfileService, useValue: profiles },
        { provide: PipelineService, useValue: pipeline },
        {
          provide: ToastService,
          useValue: jasmine.createSpyObj('ToastService', ['info', 'success', 'error']),
        },
      ],
    });
    store = TestBed.inject(ProfileStore);
  });

  it('starts once, follows progress, refreshes child state and metadata on completion', () => {
    store.load('profile-1');
    store.startRun();
    store.startRun();
    expect(pipeline.startRun).toHaveBeenCalledTimes(1);
    expect(store.busy()).toBeTrue();
    poll.next({
      ...queued,
      status: 'running',
      stage: 'scoring',
      queries_discovered: 12,
      queries_scored: 5,
    });
    expect(store.run()?.queries_scored).toBe(5);
    poll.next({ ...queued, status: 'completed', queries_discovered: 12, queries_scored: 12 });
    poll.complete();
    expect(store.busy()).toBeFalse();
    expect(store.revision()).toBe(1);
    expect(profiles.get).toHaveBeenCalledTimes(2);
    expect(TestBed.inject(ToastService).success).toHaveBeenCalledWith('Pipeline complete.');
  });

  it('resumes polling for an active latest run without starting a second run', () => {
    profiles.get.and.returnValue(of({ ...profile, status: 'running', latest_run: queued }));
    store.load('profile-1');
    expect(store.busy()).toBeTrue();
    expect(pipeline.pollRun).toHaveBeenCalledWith('run-1', jasmine.anything());
    expect(pipeline.startRun).not.toHaveBeenCalled();
  });

  it('attaches to the active run after a 409 race', () => {
    store.load('profile-1');
    pipeline.startRun.and.returnValue(
      throwError(() => ({ kind: 'conflict', message: 'Run exists.' })),
    );
    profiles.get.and.returnValue(of({ ...profile, latest_run: queued }));
    store.startRun();
    expect(store.runError()).toBeNull();
    expect(pipeline.pollRun).toHaveBeenCalled();
  });

  it('handles a polling failure and lets the user resume polling', () => {
    store.load('profile-1');
    store.startRun();
    poll.error({ kind: 'network', message: 'Connection lost.' });
    expect(store.runError()?.kind).toBe('network');
    const resumed = new Subject<PipelineRun>();
    pipeline.pollRun.and.returnValue(resumed);
    store.retryRun();
    expect(pipeline.pollRun).toHaveBeenCalledTimes(2);
    resumed.next({ ...queued, status: 'partial', error_message: 'One batch failed.' });
    resumed.complete();
    expect(store.revision()).toBe(1);
    expect(TestBed.inject(ToastService).info).toHaveBeenCalledWith(
      'Completed with warnings. One batch failed.',
    );
  });

  it('cancels polling on destruction or switching profiles', () => {
    store.load('profile-1');
    store.startRun();
    expect(poll.observed).toBeTrue();
    store.load('profile-2');
    expect(poll.observed).toBeFalse();
    store.startRun();
    store.ngOnDestroy();
    expect(poll.observed).toBeFalse();
  });
  it('retries a failed metadata refresh without starting a new pipeline', () => {
    store.load('profile-1');
    store.startRun();
    profiles.get.and.returnValue(
      throwError(() => ({ kind: 'network', message: 'Refresh failed.' })),
    );
    poll.next({ ...queued, status: 'completed' });
    poll.complete();
    expect(store.runError()?.message).toBe('Refresh failed.');
    profiles.get.and.returnValue(of(profile));
    store.retryRun();
    expect(pipeline.startRun).toHaveBeenCalledTimes(1);
    expect(store.runError()).toBeNull();
  });
});
