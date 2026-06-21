import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './shared/services/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '403',
    loadComponent: () => import('./pages/forbidden/forbidden.component').then(m => m.ForbiddenComponent)
  },
  {
    path: '',
    loadComponent: () => import('./layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'protocols',
        children: [
          { path: '', loadComponent: () => import('./pages/protocol/protocol-list/protocol-list.component').then(m => m.ProtocolListComponent) },
          { path: 'new', loadComponent: () => import('./pages/protocol/protocol-edit/protocol-edit.component').then(m => m.ProtocolEditComponent) },
          { path: ':id', loadComponent: () => import('./pages/protocol/protocol-detail/protocol-detail.component').then(m => m.ProtocolDetailComponent) },
        ]
      },
      {
        path: 'samples',
        children: [
          { path: '', loadComponent: () => import('./pages/sample/sample-list/sample-list.component').then(m => m.SampleListComponent) },
          { path: 'calendar', loadComponent: () => import('./pages/sample/sampling-calendar/sampling-calendar.component').then(m => m.SamplingCalendarComponent) },
          { path: ':id', loadComponent: () => import('./pages/sample/sample-detail/sample-detail.component').then(m => m.SampleDetailComponent) },
          { path: ':id/sampling', loadComponent: () => import('./pages/sample/sampling/sampling.component').then(m => m.SamplingComponent) },
        ]
      },
      {
        path: 'environment',
        children: [
          { path: '', loadComponent: () => import('./pages/environment/monitoring/monitoring.component').then(m => m.EnvironmentMonitoringComponent) },
          { path: 'alerts', loadComponent: () => import('./pages/environment/alerts/alerts.component').then(m => m.AlertsComponent) },
        ]
      },
      {
        path: 'test-results',
        children: [
          { path: '', loadComponent: () => import('./pages/test-result/test-result-list/test-result-list.component').then(m => m.TestResultListComponent) },
          { path: 'new', loadComponent: () => import('./pages/test-result/test-result-edit/test-result-edit.component').then(m => m.TestResultEditComponent) },
          { path: ':id', loadComponent: () => import('./pages/test-result/test-result-detail/test-result-detail.component').then(m => m.TestResultDetailComponent) },
        ]
      },
      {
        path: 'deviations',
        children: [
          { path: '', loadComponent: () => import('./pages/deviation/deviation-list/deviation-list.component').then(m => m.DeviationListComponent) },
          { path: 'new', loadComponent: () => import('./pages/deviation/deviation-edit/deviation-edit.component').then(m => m.DeviationEditComponent) },
          { path: ':id', loadComponent: () => import('./pages/deviation/deviation-detail/deviation-detail.component').then(m => m.DeviationDetailComponent) },
        ]
      },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
