import { of } from 'rxjs';
import { DashboardService } from './core/services/dashboard.service';
import { ProfileService } from './core/services/profile.service';
import { QueryService } from './core/services/query.service';
import { RecommendationService } from './core/services/recommendation.service';
import { Profile } from './shared/models';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';

describe('foundation shell and lazy routes', () => {
  const profile: Profile = {
    profile_uuid: 'profile-1',
    name: 'Surfer',
    domain: 'surferseo.com',
    industry: 'SEO',
    status: 'new',
    created_at: '2026-11-04T10:00:00Z',
    updated_at: '2026-11-04T10:00:00Z',
  };
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: ProfileService,
          useValue: { get: () => of(profile), list: () => of({ items: [] }) },
        },
        {
          provide: DashboardService,
          useValue: {
            get: () =>
              of({
                total_profiles: 0,
                total_queries: 0,
                avg_opportunity_score: null,
                recent_runs: [],
              }),
          },
        },
        {
          provide: QueryService,
          useValue: { list: () => of({ items: [], total: 0, page: 1, per_page: 20, pages: 0 }) },
        },
        { provide: RecommendationService, useValue: { list: () => of({ items: [] }) } },
      ],
    }),
  );

  it('renders the navigation, skip link, router outlet and theme control', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('a[href="#main-content"]')?.textContent).toContain('Skip');
    expect(element.querySelector('nav[aria-label="Main navigation"]')?.textContent).toContain(
      'Dashboard',
    );
    expect(element.querySelector('[role="group"][aria-label="Theme"] ng-icon')).not.toBeNull();
    expect(element.querySelector('router-outlet')).not.toBeNull();
  });

  const routeCases = [
    ['/', 'Dashboard'],
    ['/profiles/new', 'New business profile'],
    ['/profiles/profile-1', 'Queries'],
    ['/profiles/profile-1/chart', 'Opportunity chart'],
    ['/profiles/profile-1/recommendations', 'Recommendations'],
    ['/missing/page', 'Page not found'],
  ];
  for (const [url, heading] of routeCases) {
    it(`lazy-loads ${url}`, async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url);
      expect(harness.routeNativeElement?.textContent).toContain(heading);
    });
  }
});
