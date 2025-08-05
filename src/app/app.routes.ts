// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '',       redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'map',
    loadComponent: () =>
      import('./features/map/map.component').then(m => m.MapComponent)
  },
  {
    path: 'iss',
    loadComponent: () =>
      import('./features/iss/iss.component').then(m => m.IssComponent)
  },
 /* {
    path: 'alerts',
    loadComponent: () =>
      import('./features/alerts/alerts.component').then(m => m.AlertsComponent)
  },*/
  { path: '**', redirectTo: 'home' }
];

export class AppRoutingModule {}

