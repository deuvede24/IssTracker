// src/app/services/location-simple.service.ts - OPTIMIZADO PARA MÓVIL

import { Injectable, signal } from '@angular/core';

export interface UserLocationSimple {
  latitude: number;
  longitude: number;
  city: string;
  detected: boolean;
  accuracy?: number; // ← NUEVO: precisión en metros
  source?: string;   // ← NUEVO: GPS, WiFi, etc.
}

@Injectable({
  providedIn: 'root'
})
export class LocationSimpleService {
  
  private currentLocation = signal<UserLocationSimple | null>(null);
  
  get location() {
    return this.currentLocation.asReadonly();
  }

  /**
   * 📱 Obtener ubicación optimizada para móvil
   */
  async getUserLocation(): Promise<UserLocationSimple> {
    try {
      console.log('📍 Obteniendo ubicación GPS (móvil optimizado)...');
      
      // 🔄 SIEMPRE pedir ubicación nueva (no caché)
      const position = await this.getCurrentPositionMobile();
      
      console.log('✅ Ubicación GPS obtenida:', {
        lat: position.latitude,
        lon: position.longitude,
        accuracy: position.accuracy
      });
      
      // Detectar ciudad
      const city = this.detectCityFromCoords(position.latitude, position.longitude);
      
      const location: UserLocationSimple = {
        latitude: position.latitude,
        longitude: position.longitude,
        city,
        detected: true,
        accuracy: position.accuracy,
        source: position.accuracy < 100 ? 'GPS' : 'WiFi/Cell'
      };
      
      this.currentLocation.set(location);
      console.log('✅ Ubicación actualizada:', location);
      return location;
      
    } catch (error) {
      console.log('⚠️ Error geolocation, usando Barcelona por defecto');
      console.log('Error details:', error);
      
      const fallback: UserLocationSimple = {
        latitude: 41.3851,
        longitude: 2.1734,
        city: 'Barcelona',
        detected: false,
        source: 'Default'
      };
      
      this.currentLocation.set(fallback);
      return fallback;
    }
  }

  /**
   * 📱 Geolocation optimizada para móvil
   */
  private getCurrentPositionMobile(): Promise<{
    latitude: number, 
    longitude: number, 
    accuracy: number
  }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      // 🎯 CONFIGURACIÓN OPTIMIZADA PARA MÓVIL
      const options = {
        enableHighAccuracy: true,    // Usar GPS si está disponible
        timeout: 15000,              // 15 segundos timeout (móvil puede tardar)
        maximumAge: 300000                // NO usar caché - siempre ubicación fresca
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log(`📡 GPS fix obtenido - Precisión: ${position.coords.accuracy}m`);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.log('❌ Error GPS:', error.message);
          
          // 🔄 RETRY con configuración menos exigente
          const fallbackOptions = {
            enableHighAccuracy: false,  // Usar WiFi/Cell si GPS falla
            timeout: 10000,
            maximumAge: 300000          // Permitir caché de 5 min
          };
          
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log(`📶 Ubicación aproximada obtenida - Precisión: ${position.coords.accuracy}m`);
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
              });
            },
            reject,
            fallbackOptions
          );
        },
        options
      );
    });
  }

  /**
   * 🏙️ Detectar ciudad por coordenadas (expandida)
   */
  private detectCityFromCoords(lat: number, lon: number): string {
    // Barcelona área
    if (lat >= 41.2 && lat <= 41.5 && lon >= 1.9 && lon <= 2.3) {
      return 'Barcelona';
    }
    // Madrid área  
    if (lat >= 40.2 && lat <= 40.6 && lon >= -3.9 && lon <= -3.5) {
      return 'Madrid';
    }
    // Valencia área
    if (lat >= 39.4 && lat <= 39.6 && lon >= -0.5 && lon <= -0.3) {
      return 'Valencia';
    }
    // Cartagena área (¡para ti!)
    if (lat >= 37.5 && lat <= 37.7 && lon >= -1.0 && lon <= -0.8) {
      return 'Cartagena';
    }
    // Monterrey área
    if (lat >= 25.5 && lat <= 26.0 && lon >= -100.5 && lon <= -100.0) {
      return 'Monterrey';
    }
    
    return `Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`;
  }

  /**
   * 🔄 Forzar actualización de ubicación
   */
  async forceLocationUpdate(): Promise<UserLocationSimple> {
    console.log('🔄 Forzando actualización de ubicación...');
    return this.getUserLocation();
  }
}