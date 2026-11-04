import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppError, Recommendation } from '../../shared/models';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { API_URL } from './api-url';
import { RecommendationService } from './recommendation.service';
import { ToastService } from './toast.service';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { error: jasmine.createSpy('error') } },
      ],
    });
    service = TestBed.inject(RecommendationService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('gets typed recommendations with a priority filter', () => {
    const item: Recommendation = {
      recommendation_uuid: 'rec-1',
      target_query_uuid: 'query-1',
      content_type: 'faq',
      title: 'Answer common questions',
      rationale: 'Cover the query.',
      target_keywords: ['software'],
      priority: 'high',
    };
    service
      .list('profile-1', 'high')
      .subscribe((result) => expect(result).toEqual({ items: [item] }));
    const request = http.expectOne(`${API_URL}/profiles/profile-1/recommendations?priority=high`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual(['priority']);
    request.flush({ items: [item] });
  });

  it('omits priority for an unfiltered list', () => {
    service.list('profile-1').subscribe((result) => expect(result.items).toEqual([]));
    const request = http.expectOne(`${API_URL}/profiles/profile-1/recommendations`);
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ items: [] });
  });

  it('surfaces a typed not-found error', () => {
    let error: AppError | undefined;
    service.list('missing').subscribe({ error: (received: AppError) => (error = received) });
    http
      .expectOne(`${API_URL}/profiles/missing/recommendations`)
      .flush(
        { error: { code: 'not_found', message: 'Profile not found.' } },
        { status: 404, statusText: 'Not Found' },
      );
    expect(error?.kind).toBe('not_found');
  });
});
