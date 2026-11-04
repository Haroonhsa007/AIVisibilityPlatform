import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from './api-url';
import { DashboardStore } from './dashboard.store';
import { DataRevisionService } from './data-revision.service';
import { PipelineService } from './pipeline.service';
import { ProfileService } from './profile.service';
import { QueryService } from './query.service';

describe('DashboardStore navigation cache', () => {
  let store: DashboardStore;
  let http: HttpTestingController;
  let now: number;
  const summary = {
    total_profiles: 1,
    total_queries: 12,
    avg_opportunity_score: 0.7,
    recent_runs: [],
  };
  const profile = {
    profile_uuid: 'profile-1',
    name: 'Surfer',
    domain: 'surferseo.com',
    industry: 'SEO',
    status: 'completed',
    created_at: '2026-11-04T10:00:00Z',
    updated_at: '2026-11-04T10:00:00Z',
  };
  const flush = () => {
    http.expectOne(`${API_URL}/dashboard`).flush(summary);
    http.expectOne(`${API_URL}/profiles?page=1&per_page=5`).flush({ items: [profile], total: 1 });
  };
  const expectNoReload = () => {
    http.expectNone(`${API_URL}/dashboard`);
    http.expectNone((request) => request.url === `${API_URL}/profiles`);
  };
  beforeEach(() => {
    now = 100_000;
    spyOn(Date, 'now').and.callFake(() => now);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(DashboardStore);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('coalesces repeated entry and reuses a recent snapshot on back navigation', () => {
    store.load();
    store.load();
    store.load(true);
    flush();
    const snapshot = store.data();
    store.load();
    expectNoReload();
    expect(store.data()).toBe(snapshot);
    expect(store.loading()).toBeFalse();
  });

  it('refreshes an expired snapshot once while keeping its content visible', () => {
    store.load();
    flush();
    const snapshot = store.data();
    now += 30_001;
    store.load();
    store.load();
    expect(store.loading()).toBeTrue();
    expect(store.data()).toBe(snapshot);
    flush();
    expect(store.loading()).toBeFalse();
  });

  it('invalidates cached totals after successful profile creation', () => {
    store.load();
    flush();
    TestBed.inject(ProfileService)
      .create({ name: 'New', domain: 'new.example', industry: 'SEO' })
      .subscribe();
    http.expectOne(`${API_URL}/profiles`).flush({ ...profile, profile_uuid: 'profile-2' });
    store.load();
    flush();
  });

  it('invalidates on run start and terminal polling, while running polling stays passive', () => {
    store.load();
    flush();
    const pipeline = TestBed.inject(PipelineService);
    const run = {
      run_uuid: 'run-1',
      profile_uuid: 'profile-1',
      status: 'queued',
      queries_discovered: 0,
      queries_scored: 0,
      tokens_used: 0,
    };
    pipeline.startRun('profile-1').subscribe();
    http.expectOne(`${API_URL}/profiles/profile-1/run`).flush(run);
    store.load();
    flush();
    pipeline.getRun('run-1').subscribe();
    http.expectOne(`${API_URL}/runs/run-1`).flush({ ...run, status: 'running' });
    store.load();
    expectNoReload();
    pipeline.getRun('run-1').subscribe();
    http.expectOne(`${API_URL}/runs/run-1`).flush({ ...run, status: 'completed' });
    store.load();
    flush();
  });

  it('invalidates after recheck without reloading the dashboard in the background', () => {
    store.load();
    flush();
    TestBed.inject(QueryService).recheck('query-1').subscribe();
    http
      .expectOne(`${API_URL}/queries/query-1/recheck`)
      .flush({ query_uuid: 'query-1', opportunity_score: 0.8 });
    expectNoReload();
    store.load();
    flush();
  });

  it('does not invalidate after a failed mutation', () => {
    store.load();
    flush();
    TestBed.inject(ProfileService)
      .create({ name: 'New', domain: 'new.example', industry: 'SEO' })
      .subscribe({ error: () => undefined });
    http.expectOne(`${API_URL}/profiles`).flush({}, { status: 422, statusText: 'Invalid' });
    expect(TestBed.inject(DataRevisionService).version()).toBe(0);
    store.load();
    expectNoReload();
  });

  it('keeps cached content after a refresh failure and permits an explicit retry', () => {
    store.load();
    flush();
    const snapshot = store.data();
    store.load(true);
    const dashboard = http.expectOne(`${API_URL}/dashboard`);
    const profiles = http.expectOne(`${API_URL}/profiles?page=1&per_page=5`);
    dashboard.error(new ProgressEvent('error'));
    expect(profiles.cancelled).toBeTrue();
    expect(store.data()).toBe(snapshot);
    expect(store.error()).not.toBeNull();
    store.load(true);
    flush();
    expect(store.error()).toBeNull();
  });
});
