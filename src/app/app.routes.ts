// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { requireLocationGuard } from './guards/require-location.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'map',
    canActivate: [requireLocationGuard],
    loadComponent: () =>
      import('./features/map/map.component').then(m => m.MapComponent)
  },
  {
    path: 'iss',
    canActivate: [requireLocationGuard],
    loadComponent: () =>
      import('./features/iss/iss.component').then(m => m.IssComponent)
  },
  {
    path: 'alerts',
    canActivate: [requireLocationGuard],
    loadComponent: () =>
      import('./features/alerts/alerts/alerts.component').then(m => m.AlertsComponent)
  },
  { path: '**', redirectTo: 'home' }
];

export class AppRoutingModule { }