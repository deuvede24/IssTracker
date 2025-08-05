import { Injectable, signal } from '@angular/core';

export interface UserLocationSimple {
  latitude: number;
  longitude: number;
  city: string;
  detected: boolean;
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
   * 📍 Obtener ubicación simple (solo geolocation)
   */
  async getUserLocation(): Promise<UserLocationSimple> {
    try {
      console.log('📍 Obteniendo ubicación...');
      
      const position = await this.getCurrentPosition();
      
      // Detectar ciudad básica por coordenadas
      const city = this.detectCityFromCoords(position.latitude, position.longitude);
      
      const location: UserLocationSimple = {
        latitude: position.latitude,
        longitude: position.longitude,
        city,
        detected: true
      };

      this.currentLocation.set(location);
      console.log('✅ Ubicación:', location);
      return location;
      
    } catch (error) {
      console.log('⚠️ Error geolocation, usando Barcelona');
      
      const fallback: UserLocationSimple = {
        latitude: 41.3851,
        longitude: 2.1734,
        city: 'Barcelona',
        detected: false
      };
      
      this.currentLocation.set(fallback);
      return fallback;
    }
  }

  /**
   * 🌐 Geolocation nativa
   */
  private getCurrentPosition(): Promise<{latitude: number, longitude: number}> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }),
        reject,
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    });
  }

  /**
   * 🏙️ Detectar ciudad por coordenadas (simple)
   */
  private detectCityFromCoords(lat: number, lon: number): string {
    // Detección simple por rangos aproximados
    if (lat >= 41.2 && lat <= 41.5 && lon >= 1.9 && lon <= 2.3) {
      return 'Barcelona';
    }
    if (lat >= 40.2 && lat <= 40.6 && lon >= -3.9 && lon <= -3.5) {
      return 'Madrid';
    }
    if (lat >= 39.4 && lat <= 39.6 && lon >= -0.5 && lon <= -0.3) {
      return 'Valencia';
    }
    
    return 'Unknown City';
  }
}