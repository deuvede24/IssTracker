// src/app/services/location-simple.service.ts

import { Injectable, signal, computed } from '@angular/core';

export interface UserLocationSimple {
  latitude: number;
  longitude: number;
  city: string;
  detected: boolean;  // true=GPS, false=IP
  accuracy?: number;
  source?: string;    // 'GPS' | 'WiFi/Cell' | 'IP-based' | 'Cache (fallback)'
}

export type LocationStatus = 'loading' | 'success' | 'failed';

@Injectable({ providedIn: 'root' })
export class LocationSimpleService {
  private currentLocation = signal<UserLocationSimple | null>(null);
  private locationStatus = signal<LocationStatus>('loading');

  private retryCount = signal<number>(0);
  private readonly MAX_RETRIES = 3; // IP auto (1) + 2 en overlay

  private readonly STORAGE_KEY = 'last-location';

  // single-flight lock para evitar dobles resoluciones en paralelo
  private inFlight: Promise<UserLocationSimple> | null = null;

  // === Expuestos ===
  get location() { return this.currentLocation.asReadonly(); }
  get status() { return this.locationStatus.asReadonly(); }

  get retriesLeft() {
    return computed(() => Math.max(0, this.MAX_RETRIES - this.retryCount()));
  }

  get canRetry() {
    return computed(() => this.locationStatus() === 'failed' && this.retriesLeft() > 0);
  }

  // === Público ===
  async getUserLocation(): Promise<UserLocationSimple> {
    // 🚫 Si ya agotamos intentos, no dispares otro ciclo ni cambies a 'loading'
    if (this.retryCount() >= this.MAX_RETRIES) {
      this.locationStatus.set('failed');
      return Promise.reject(new Error('retries exhausted'));
    }
    if (this.inFlight) return this.inFlight;           // lock
    this.locationStatus.set('loading');

    this.inFlight = (async () => {
      try {
        // 1) GPS (si usuario lo permite)
        console.log('📍 Intentando GPS (timeout 8s)...');
        const position = await this.getCurrentPositionWithTimeout();

        const city = this.detectCityFromCoords(position.latitude, position.longitude);
        const location: UserLocationSimple = {
          latitude: position.latitude,
          longitude: position.longitude,
          city,
          detected: true,
          accuracy: position.accuracy,
          source: position.accuracy < 100 ? 'GPS' : 'WiFi/Cell',
        };

        this.setSuccessfulLocation(location);
        console.log('✅ GPS exitoso:', location.city);
        return location;

      } catch (gpsError) {
        // 2) IP automática (esto cuenta como intento #1 si falla)
        console.log('⚠️ GPS falló o fue denegado → intentando IP (6s)...');

        try {
          const location = await this.tryIPLocationWithTimeout();
          this.setSuccessfulLocation(location);
          console.log('✅ IP exitoso:', location.city);
          return location;

        } catch (ipError) {
          console.log('❌ IP auto falló:', ipError instanceof Error ? ipError.message : 'Unknown error');
          this.handleLocationFailure(); // retryCount = 1
          throw new Error('No se pudo obtener ubicación');
        }
      }
    })();

    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null; // liberar lock
    }
  }

  // Retry solo IP (usado por overlay / home simplificada)
  async retryWithIPOnly(): Promise<UserLocationSimple> {
    if (this.retryCount() >= this.MAX_RETRIES) {
      this.locationStatus.set('failed');
      return Promise.reject(new Error('retries exhausted'));
    }
    this.locationStatus.set('loading');

    try {
      console.log('🔄 Retry solo con IP (6s timeout)...');
      const location = await this.tryIPLocationWithTimeout();
      this.setSuccessfulLocation(location);
      console.log('✅ IP retry exitoso:', location.city);
      return location;
    } catch (ipError) {
      console.log('❌ IP retry falló:', ipError instanceof Error ? ipError.message : 'Unknown error');
      this.handleLocationFailure(); // suma el intento fallido
      throw new Error('IP retry failed');
    }
  }

  // === Internos ===
  private getCurrentPositionWithTimeout(): Promise<{ latitude: number; longitude: number; accuracy: number; }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 180000, // 3 min cache
      };

      const timeoutId = setTimeout(() => reject(new Error('GPS timeout')), options.timeout);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error: GeolocationPositionError) => {
          clearTimeout(timeoutId);

          // Usuario negó permisos → no intentamos otro getCurrentPosition
          if (error.code === error.PERMISSION_DENIED || error.code === 1) {
            reject(new Error('GPS denied'));
            return;
          }

          // Fallback rápido con menos precisión
          const fallbackOptions: PositionOptions = {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000,
          };

          const fallbackTimeoutId = setTimeout(() => reject(new Error('GPS fallback timeout')), fallbackOptions.timeout);

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(fallbackTimeoutId);
              resolve({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              });
            },
            (fallbackError) => {
              clearTimeout(fallbackTimeoutId);
              reject(new Error(`GPS fallback error: ${fallbackError.message}`));
            },
            fallbackOptions
          );
        },
        options
      );
    });
  }

  private async tryIPLocationWithTimeout(): Promise<UserLocationSimple> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch('https://ipapi.co/json/', {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`IP API error: ${response.status}`);
      const data = await response.json();

      if (!data.latitude || !data.longitude) throw new Error('IP API returned invalid data');

      return {
        latitude: data.latitude,
        longitude: data.longitude,
        city: data.city || data.region || data.country_name || 'Unknown location',
        detected: false,
        accuracy: 50000,
        source: 'IP-based',
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error?.name === 'AbortError') throw new Error('IP location timeout');
      throw error;
    }
  }

  private handleLocationFailure(): void {
    this.retryCount.update((c) => c + 1);

    if (this.retryCount() >= this.MAX_RETRIES) {
      console.log('❌ Máximo de reintentos alcanzado');
      const cached = this.getCachedLocation();
      /*   if (cached) {
           console.log('📦 Usando ubicación en cache');
           this.setSuccessfulLocation({ ...cached, source: 'Cache (fallback)' });
           return;
         }*/
      // No cache → quedará en 'failed' y con retriesLeft() === 0 (Home simplificada)
    }

    this.locationStatus.set('failed');
  }

  private setSuccessfulLocation(location: UserLocationSimple): void {
    this.currentLocation.set(location);
    this.locationStatus.set('success');
    this.retryCount.set(0);
    this.saveToStorage(location);
  }

  private detectCityFromCoords(lat: number, lon: number): string {
    if (lat >= 41.2 && lat <= 41.5 && lon >= 1.9 && lon <= 2.3) return 'Barcelona';
    if (lat >= 40.2 && lat <= 40.6 && lon >= -3.9 && lon <= -3.5) return 'Madrid';
    if (lat >= 39.4 && lat <= 39.6 && lon >= -0.5 && lon <= -0.3) return 'Valencia';
    if (lat >= 37.5 && lat <= 37.7 && lon >= -1.0 && lon <= -0.8) return 'Cartagena';
    if (lat >= 25.5 && lat <= 26.0 && lon >= -100.5 && lon <= -100.0) return 'Monterrey';
    return `${lat.toFixed(1)}, ${lon.toFixed(1)}`;
  }

  private saveToStorage(location: UserLocationSimple): void {
    try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(location)); }
    catch { /* noop */ }
  }

  private getCachedLocation(): UserLocationSimple | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  // Mantener compatibilidad
  setLocation(location: UserLocationSimple): void { this.setSuccessfulLocation(location); }

  reset(): void {
    this.locationStatus.set('loading');
    this.retryCount.set(0);
  }
}