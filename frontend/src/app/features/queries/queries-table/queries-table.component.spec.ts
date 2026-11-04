import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { ProfileStore } from '../../../core/services/profile.store';
import { QueryService } from '../../../core/services/query.service';
import { ToastService } from '../../../core/services/toast.service';
import { DownloadService } from '../../../core/services/download.service';
import { Page, Profile, QueryItem } from '../../../shared/models';
import { QueriesTableComponent } from './queries-table.component';

describe('QueriesTableComponent', () => {
  let queries: jasmine.SpyObj<QueryService>;
  let router: jasmine.SpyObj<Router>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const row: QueryItem = {
    query_uuid: 'query-1',
    profile_uuid: 'profile-1',
    run_uuid: 'run-1',
    query_text: 'Which SEO tool should I choose?',
    opportunity_score: 0.7,
    domain_visible: false,
    visibility_position: null,
    discovered_at: '2026-11-04T10:00:00Z',
    estimated_search_volume: 1000,
    competitive_difficulty: 30,
  };
  const profile: Profile = {
    profile_uuid: 'profile-1',
    name: 'Surfer',
    domain: 'surferseo.com',
    industry: 'SEO',
    status: 'completed',
    created_at: '2026-11-04T10:00:00Z',
    updated_at: '2026-11-04T10:00:00Z',
  };
  const store = {
    profile: signal(profile),
    profileUuid: signal('profile-1'),
    revision: signal(0),
    counts: signal<{ queries?: number; recommendations?: number }>({}),
    busy: () => false,
    startRun: jasmine.createSpy('startRun'),
  };
  beforeEach(() => {
    queries = jasmine.createSpyObj<QueryService>('QueryService', ['list', 'recheck', 'listAll']);
    queries.list.and.returnValue(of({ items: [row], total: 1, page: 1, per_page: 20, pages: 1 }));
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    params = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      providers: [
        { provide: DownloadService, useValue: { saveCsv: jasmine.createSpy('saveCsv') } },
        { provide: QueryService, useValue: queries },
        { provide: ProfileStore, useValue: store },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) }, queryParamMap: params },
        },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success']) },
      ],
    });
  });

  it('renders API rows and sends no active min-score filter by default', async () => {
    const fixture = TestBed.createComponent(QueriesTableComponent);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(row.query_text);
    expect(queries.list).toHaveBeenCalledWith('profile-1', {
      page: 1,
      per_page: 20,
      sort: 'opportunity_score',
      order: 'desc',
    });
    expect((fixture.nativeElement as HTMLElement).querySelector('table caption')).not.toBeNull();
  });

  it('keeps the sort control focused while a new server ordering is loading', async () => {
    const fixture = TestBed.createComponent(QueriesTableComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const sort = root.querySelector<HTMLButtonElement>('.sort-button');
    sort?.focus();
    const response = new Subject<Page<QueryItem>>();
    queries.list.and.returnValue(response);
    params.next(convertToParamMap({ sort: 'estimated_search_volume', order: 'desc' }));
    await fixture.whenStable();
    expect(root.querySelector('.sort-button')).toBe(sort);
    expect(document.activeElement).toBe(sort);
    expect(root.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
    response.next({ items: [row], total: 1, page: 1, per_page: 20, pages: 1 });
    response.complete();
    await fixture.whenStable();
    expect(document.activeElement).toBe(sort);
  });

  it('debounces filters into URL state and fetches the exact resulting server params', async () => {
    const fixture = TestBed.createComponent(QueriesTableComponent);
    await fixture.whenStable();
    fixture.componentInstance.filters.setValue({ min_score: 0.7, status: 'not_visible' });
    await new Promise<void>((resolve) => setTimeout(resolve, 330));
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({
        queryParams: { min_score: 0.7, status: 'not_visible', page: 1 },
        replaceUrl: true,
      }),
    );
    params.next(
      convertToParamMap({ min_score: '0.7', status: 'not_visible', page: '2', per_page: '10' }),
    );
    await fixture.whenStable();
    expect(queries.list).toHaveBeenCalledWith('profile-1', {
      min_score: 0.7,
      status: 'not_visible',
      page: 2,
      per_page: 10,
      sort: 'opportunity_score',
      order: 'desc',
    });
  });

  it('does not refetch when URL changes leave the effective filters unchanged', async () => {
    const fixture = TestBed.createComponent(QueriesTableComponent);
    await fixture.whenStable();
    const calls = queries.list.calls.count();
    params.next(convertToParamMap({ page: '1', per_page: '20', min_score: '0' }));
    await fixture.whenStable();
    expect(queries.list.calls.count()).toBe(calls);
    params.next(convertToParamMap({ page: '1', extra: 'ignored' }));
    await fixture.whenStable();
    expect(queries.list.calls.count()).toBe(calls);
  });

  it('replaces a rechecked row in place, guards duplicate clicks, and keeps the old row on 502', async () => {
    const fixture = TestBed.createComponent(QueriesTableComponent);
    await fixture.whenStable();
    const result = new Subject<QueryItem>();
    queries.recheck.and.returnValue(result);
    fixture.componentInstance.recheck(row);
    fixture.componentInstance.recheck(row);
    expect(queries.recheck).toHaveBeenCalledTimes(1);
    result.next({ ...row, opportunity_score: 0.91 });
    result.complete();
    await fixture.whenStable();
    expect(fixture.componentInstance.rows()[0].opportunity_score).toBe(0.91);
    expect(queries.list).toHaveBeenCalledTimes(1);
    queries.recheck.and.returnValue(
      throwError(() => ({ kind: 'upstream', message: 'Provider unavailable.' })),
    );
    fixture.componentInstance.recheck(row);
    expect(fixture.componentInstance.rows()[0].opportunity_score).toBe(0.91);
    expect(fixture.componentInstance.rechecking().size).toBe(0);
  });

  it('has distinct empty, no-match and retryable error branches', async () => {
    queries.list.and.returnValue(of({ items: [], total: 0 }));
    const fixture = TestBed.createComponent(QueriesTableComponent);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No queries yet');
    params.next(convertToParamMap({ status: 'unknown' }));
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No matching queries');
    queries.list.and.returnValue(
      throwError(() => ({ kind: 'network', message: 'Connection lost.' })),
    );
    fixture.componentInstance.retry();
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent,
    ).toContain('Connection lost.');
  });

  it('refreshes after the store publishes a terminal run and updates sort/page URL state', async () => {
    const fixture = TestBed.createComponent(QueriesTableComponent);
    await fixture.whenStable();
    const previous = queries.list.calls.count();
    store.revision.update((value) => value + 1);
    await fixture.whenStable();
    expect(queries.list.calls.count()).toBe(previous + 1);
    fixture.componentInstance.sortBy('opportunity_score');
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({
        queryParams: { sort: 'opportunity_score', order: 'asc', page: 1 },
      }),
    );
    fixture.componentInstance.setSize(50);
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({ queryParams: { per_page: 50, page: 1 } }),
    );
  });
  it('exports all filtered rows through the service and downloads only after completion', async () => {
    const fixture = TestBed.createComponent(QueriesTableComponent);
    await fixture.whenStable();
    const exportRows = new Subject<QueryItem[]>();
    queries.listAll.and.returnValue(exportRows);
    fixture.componentInstance.exportCsv();
    fixture.componentInstance.exportCsv();
    expect(queries.listAll).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(DownloadService).saveCsv).not.toHaveBeenCalled();
    exportRows.next([row]);
    exportRows.complete();
    expect(fixture.componentInstance.exporting()).toBeFalse();
    expect(TestBed.inject(DownloadService).saveCsv).toHaveBeenCalledWith(
      jasmine.stringMatching(/^surferseo.com-queries-\d{4}-\d{2}-\d{2}\.csv$/),
      jasmine.stringMatching(/^\uFEFFquery_text,/),
    );
  });
});
