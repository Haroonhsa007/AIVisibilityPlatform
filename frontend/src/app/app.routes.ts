import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Dashboard · AI Visibility',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'profiles/new',
    title: 'New profile · AI Visibility',
    loadComponent: () =>
      import('./features/profiles/profile-form/profile-form.component').then(
        (m) => m.ProfileFormComponent,
      ),
  },
  {
    path: 'profiles/:profileUuid',
    loadComponent: () =>
      import('./features/profiles/profile-detail/profile-detail.component').then(
        (m) => m.ProfileDetailComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'queries' },
      {
        path: 'queries',
        title: 'Queries · AI Visibility',
        loadComponent: () =>
          import('./features/queries/queries-table/queries-table.component').then(
            (m) => m.QueriesTableComponent,
          ),
      },
      {
        path: 'chart',
        title: 'Opportunity chart · AI Visibility',
        loadComponent: () =>
          import('./features/queries/opportunity-chart/opportunity-chart.component').then(
            (m) => m.OpportunityChartComponent,
          ),
      },
      {
        path: 'recommendations',
        title: 'Recommendations · AI Visibility',
        loadComponent: () =>
          import('./features/recommendations/recommendations-list/recommendations-list.component').then(
            (m) => m.RecommendationsListComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    title: 'Page not found · AI Visibility',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
