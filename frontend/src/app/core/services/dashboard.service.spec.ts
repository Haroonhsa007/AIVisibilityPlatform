import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppError, Dashboard } from '../../shared/models';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { API_URL } from './api-url';
import { DashboardService } from './dashboard.service';
import { ToastService } from './toast.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { error: jasmine.createSpy('error') } },
      ],
    });
    service = TestBed.inject(DashboardService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('gets the dashboard and preserves a null average', () => {
    const dashboard: Dashboard = {
      total_profiles: 0,
      total_queries: 0,
      avg_opportunity_score: null,
      recent_runs: [],
    };
    service.get().subscribe((result) => expect(result).toEqual(dashboard));
    const request = http.expectOne(`${API_URL}/dashboard`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    request.flush(dashboard);
  });

  it('maps network failure to actionable copy', () => {
    let error: AppError | undefined;
    service.get().subscribe({ error: (received: AppError) => (error = received) });
    http.expectOne(`${API_URL}/dashboard`).error(new ProgressEvent('error'));
    expect(error?.kind).toBe('network');
    expect(error?.message).toContain('connection');
  });
});
