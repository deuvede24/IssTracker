import { Injectable, signal } from '@angular/core';

export interface ISSCurrentPosition {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  timestamp: number;
  visibility: string;
}

@Injectable({
  providedIn: 'root'
})
export class ISSSimpleService {
  
  // 🎯 SOLO UN SIGNAL - POSICIÓN ACTUAL
  private currentPosition = signal<ISSCurrentPosition | null>(null);
  private isTracking = false;
  
  // Getter público
  get position() {
    return this.currentPosition.asReadonly();
  }

  /**
   * 🛰️ Obtener posición actual de ISS (WhereTheISS.at)
   */
  async getCurrentPosition(): Promise<ISSCurrentPosition> {
    try {
      console.log('🛰️ Obteniendo posición actual de ISS...');
      
      const response = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      const position: ISSCurrentPosition = {
        latitude: data.latitude,
        longitude: data.longitude,
        altitude: data.altitude,
        velocity: data.velocity,
        timestamp: data.timestamp,
        visibility: data.visibility
      };

      // Actualizar signal
      this.currentPosition.set(position);
      
      console.log('✅ Posición ISS:', position);
      return position;
      
    } catch (error) {
      console.error('❌ Error obteniendo ISS:', error);
      
      // Fallback simulado
      const fallback: ISSCurrentPosition = {
        latitude: 25.7617,
        longitude: -80.1918,
        altitude: 408,
        velocity: 27600,
        timestamp: Math.floor(Date.now() / 1000),
        visibility: 'daylight'
      };
      
      this.currentPosition.set(fallback);
      return fallback;
    }
  }

  /**
   * 🔄 Iniciar tracking automático (cada 5 segundos)
   */
  startTracking(): void {
    if (this.isTracking) return;
    
    this.isTracking = true;
    console.log('🔄 Iniciando tracking de ISS...');
    
    // Primera llamada inmediata
    this.getCurrentPosition();
    
    // Luego cada 5 segundos
    const interval = setInterval(async () => {
      if (!this.isTracking) {
        clearInterval(interval);
        return;
      }
      
      await this.getCurrentPosition();
    }, 5000);
  }

  /**
   * ⏹️ Parar tracking
   */
  stopTracking(): void {
    this.isTracking = false;
    console.log('⏹️ Tracking de ISS detenido');
  }

  /**
   * 📏 Calcular distancia desde usuario a ISS
   */
  calculateDistanceFromUser(userLat: number, userLon: number): number {
    const issPos = this.currentPosition();
    if (!issPos) return 0;

    // Fórmula haversine + altitud
    const R = 6371; // Radio Tierra en km
    const dLat = this.toRadians(issPos.latitude - userLat);
    const dLon = this.toRadians(issPos.longitude - userLon);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(userLat)) * Math.cos(this.toRadians(issPos.latitude)) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const surfaceDistance = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    // Añadir altitud ISS
    return Math.sqrt(surfaceDistance * surfaceDistance + issPos.altitude * issPos.altitude);
  }

  /**
   * 🧭 Calcular bearing desde usuario hacia ISS
   */
  calculateBearingFromUser(userLat: number, userLon: number): number {
    const issPos = this.currentPosition();
    if (!issPos) return 0;

    const dLon = this.toRadians(issPos.longitude - userLon);
    const lat1 = this.toRadians(userLat);
    const lat2 = this.toRadians(issPos.latitude);
    
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    
    const bearing = Math.atan2(y, x);
    return (this.toDegrees(bearing) + 360) % 360;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }
}