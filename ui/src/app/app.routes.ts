import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'devices',
        loadComponent: () =>
          import('./features/devices/device-list/device-list.component').then(
            m => m.DeviceListComponent,
          ),
      },
      {
        path: 'devices/:udid',
        loadComponent: () =>
          import('./features/devices/device-detail/device-detail.component').then(
            m => m.DeviceDetailComponent,
          ),
      },
      {
        path: 'accounts',
        loadComponent: () =>
          import('./features/accounts/account-list/account-list.component').then(
            m => m.AccountListComponent,
          ),
      },
      {
        path: 'admin/users',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin/users/users.component').then(m => m.UsersComponent),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '/dashboard' },
];

