import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { catchError, EMPTY } from 'rxjs';
import { AppError, Page, Profile, ProfileCreate } from '../../shared/models';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { API_URL } from './api-url';
import { ProfileService } from './profile.service';
import { ToastService } from './toast.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let http: HttpTestingController;
  const profile: Profile = {
    profile_uuid: 'profile-1',
    name: 'Example',
    domain: 'example.com',
    industry: 'Software',
    status: 'new',
    created_at: '2026-11-04T12:00:00Z',
    updated_at: '2026-11-04T12:00:00Z',
    latest_run: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { error: jasmine.createSpy('error') } },
      ],
    });
    service = TestBed.inject(ProfileService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists typed profiles with pagination params', () => {
    const page: Page<Profile> = { items: [profile], page: 2, per_page: 10, total: 11, pages: 2 };
    service.list({ page: 2, per_page: 10 }).subscribe((result) => expect(result).toEqual(page));
    const request = http.expectOne((request) => request.url === `${API_URL}/profiles`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys().sort()).toEqual(['page', 'per_page']);
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('per_page')).toBe('10');
    request.flush(page);
  });

  it('omits unspecified pagination params, including explicit undefined', () => {
    service.list().subscribe();
    const request = http.expectOne(`${API_URL}/profiles`);
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ items: [] });
    service.list({ page: undefined, per_page: undefined }).subscribe();
    const unsetRequest = http.expectOne(`${API_URL}/profiles`);
    expect(unsetRequest.request.params.keys()).toEqual([]);
    unsetRequest.flush({ items: [] });
  });

  it('fetches a profile, preserving an absent optional description and null latest run', () => {
    service.get('profile-1').subscribe((result) => expect(result).toEqual(profile));
    const request = http.expectOne(`${API_URL}/profiles/profile-1`);
    expect(request.request.method).toBe('GET');
    request.flush(profile);
  });

  it('posts the exact typed create body and receives 201', () => {
    const body: ProfileCreate = {
      name: 'Example',
      domain: 'example.com',
      industry: 'Software',
      description: '',
      competitors: [],
    };
    service.create(body).subscribe((result) => expect(result).toEqual(profile));
    const request = http.expectOne(`${API_URL}/profiles`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush(profile, { status: 201, statusText: 'Created' });
  });

  it('lets consumers catch mapped validation field errors', () => {
    let received: AppError | undefined;
    service
      .create({ name: '', domain: 'invalid', industry: '' })
      .pipe(
        catchError((error: AppError) => {
          received = error;
          return EMPTY;
        }),
      )
      .subscribe();
    http.expectOne(`${API_URL}/profiles`).flush(
      {
        error: {
          code: 'validation_error',
          message: 'Check the domain.',
          details: { domain: 'Use a hostname.' },
        },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    expect(TestBed.inject(ToastService).error).toHaveBeenCalledOnceWith('Check the domain.');
    expect(received).toEqual({
      kind: 'validation',
      message: 'Check the domain.',
      fieldErrors: { domain: 'Use a hostname.' },
    });
  });
});
