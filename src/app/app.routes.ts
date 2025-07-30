// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { 
    path: '',   
    redirectTo: 'home', 
    pathMatch: 'full' 
  },
  {
    path: 'home',
    loadComponent: () => import('./features/home/home/home.component')
      .then(m => m.HomeComponent)
  },
  {
    path: 'map',
    loadComponent: () => import('./features/map/map.component')
      .then(m => m.MapComponent)
  },
  // Wildcard route
  { path: '**', redirectTo: 'home' }
];