// src/app/guards/require-location.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LocationSimpleService } from '../services/location-simple.service';

export const requireLocationGuard: CanActivateFn = (route, state) => {
  const locationService = inject(LocationSimpleService);
  const router = inject(Router);

   if (state.url.includes('/iss') && state.root.queryParams['showISSNow'] === 'true') {
    console.log('🌍 Permitiendo ISS Global View sin ubicación');
    return true;
  }
  
  const location = locationService.location();
  const hasValidLocation = location && location.latitude !== 0 && location.longitude !== 0;
  
  if (hasValidLocation) {
    console.log('✅ Guard: ubicación válida, permitiendo acceso');
    return true;
  }
  
  console.log('❌ Guard: sin ubicación válida, redirigiendo a home');
  return router.parseUrl('/');
};