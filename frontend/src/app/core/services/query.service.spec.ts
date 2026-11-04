import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppError, Page, QueryItem } from '../../shared/models';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { API_URL } from './api-url';
import { QueryService } from './query.service';
import { ToastService } from './toast.service';

describe('QueryService', () => {
  let service: QueryService;
  let http: HttpTestingController;
  const query: QueryItem = {
    query_uuid: 'query-1',
    profile_uuid: 'profile-1',
    run_uuid: 'run-1',
    query_text: 'Which tool?',
    opportunity_score: null,
    domain_visible: null,
    visibility_position: null,
    discovered_at: '2026-11-04T12:00:00Z',
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { error: jasmine.createSpy('error') } },
      ],
    });
    service = TestBed.inject(QueryService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('serializes every filter, including zero min_score and unknown visibility', () => {
    const page: Page<QueryItem> = { items: [query], page: 3, per_page: 50, total: 101, pages: 3 };
    service
      .list('profile-1', {
        min_score: 0,
        status: 'unknown',
        page: 3,
        per_page: 50,
        sort: 'competitive_difficulty',
        order: 'asc',
      })
      .subscribe((result) => expect(result).toEqual(page));
    const request = http.expectOne(
      (request) => request.url === `${API_URL}/profiles/profile-1/queries`,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys().sort()).toEqual([
      'min_score',
      'order',
      'page',
      'per_page',
      'sort',
      'status',
    ]);
    expect(request.request.params.get('min_score')).toBe('0');
    expect(request.request.params.get('status')).toBe('unknown');
    expect(request.request.params.get('page')).toBe('3');
    expect(request.request.params.get('per_page')).toBe('50');
    expect(request.request.params.get('sort')).toBe('competitive_difficulty');
    expect(request.request.params.get('order')).toBe('asc');
    request.flush(page);
  });

  it('omits absent filters', () => {
    service.list('profile-1').subscribe();
    const request = http.expectOne(`${API_URL}/profiles/profile-1/queries`);
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ items: [] });
    service
      .list('profile-1', {
        min_score: undefined,
        status: undefined,
        sort: undefined,
        order: undefined,
      })
      .subscribe();
    const unsetRequest = http.expectOne(`${API_URL}/profiles/profile-1/queries`);
    expect(unsetRequest.request.params.keys()).toEqual([]);
    unsetRequest.flush({ items: [] });
  });

  it('posts a bodyless recheck and returns typed nullable score data', () => {
    service.recheck('query-1').subscribe((result) => expect(result).toEqual(query));
    const request = http.expectOne(`${API_URL}/queries/query-1/recheck`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush(query);
  });

  it('maps a recheck upstream error without returning a made-up query', () => {
    let error: AppError | undefined;
    service.recheck('query-1').subscribe({
      next: () => fail('An upstream failure must not produce a query'),
      error: (received: AppError) => (error = received),
    });
    http
      .expectOne(`${API_URL}/queries/query-1/recheck`)
      .flush(
        { error: { code: 'upstream_error', message: 'Provider details' } },
        { status: 502, statusText: 'Bad Gateway' },
      );
    expect(error?.kind).toBe('upstream');
    expect(error?.message).not.toContain('Provider details');
  });
  it('exports every filtered page at per_page 100 and reports progress without emitting partial files', () => {
    const progress = jasmine.createSpy('progress');
    let result: QueryItem[] | undefined;
    const first = Array.from({ length: 100 }, (_, index) => ({
      ...query,
      query_uuid: `q-${index}`,
    }));
    service
      .listAll(
        'profile-1',
        { min_score: 0.4, status: 'not_visible', sort: 'estimated_search_volume', order: 'asc' },
        progress,
      )
      .subscribe((rows) => (result = rows));
    const request = http.expectOne(
      (req) =>
        req.url === `${API_URL}/profiles/profile-1/queries` && req.params.get('page') === '1',
    );
    expect(request.request.params.get('per_page')).toBe('100');
    expect(request.request.params.get('min_score')).toBe('0.4');
    expect(request.request.params.get('status')).toBe('not_visible');
    request.flush({ items: first, page: 1, per_page: 100, total: 101, pages: 2 });
    expect(result).toBeUndefined();
    const second = http.expectOne(
      (req) =>
        req.url === `${API_URL}/profiles/profile-1/queries` && req.params.get('page') === '2',
    );
    expect(second.request.params.get('sort')).toBe('estimated_search_volume');
    expect(second.request.params.get('order')).toBe('asc');
    second.flush({ items: [query], page: 2, per_page: 100, total: 101, pages: 2 });
    expect(result?.length).toBe(101);
    expect(progress.calls.allArgs()).toEqual([
      [100, 101],
      [101, 101],
    ]);
  });

  it('does not emit an export when a later page fails', () => {
    let failed = false;
    service
      .listAll('profile-1')
      .subscribe({
        next: () => fail('Partial export must not be emitted'),
        error: () => (failed = true),
      });
    http
      .expectOne((req) => req.params.get('page') === '1')
      .flush({ items: [query], page: 1, pages: 2 });
    http
      .expectOne((req) => req.params.get('page') === '2')
      .flush({}, { status: 500, statusText: 'Server Error' });
    expect(failed).toBeTrue();
  });
});
