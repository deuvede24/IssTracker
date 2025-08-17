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
/*  async getCurrentPosition(): Promise<ISSCurrentPosition> {
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
  }*/

    async getCurrentPosition(): Promise<ISSCurrentPosition> {
  // 🎯 MÚLTIPLES FUENTES - Probamos hasta que una funcione
  const apiSources = [
    {
      name: 'wheretheiss.at',
      url: 'https://api.wheretheiss.at/v1/satellites/25544',
      parser: (data: any) => ({
        latitude: data.latitude,
        longitude: data.longitude,
        altitude: data.altitude,
        velocity: data.velocity,
        timestamp: data.timestamp,
        visibility: data.visibility
      })
    },
    {
      name: 'open-notify.org',
      url: 'http://api.open-notify.org/iss-now.json',
      parser: (data: any) => ({
        latitude: parseFloat(data.iss_position.latitude),
        longitude: parseFloat(data.iss_position.longitude),
        altitude: 408, // Aproximado
        velocity: 27600, // Aproximado
        timestamp: data.timestamp,
        visibility: 'unknown'
      })
    }
  ];

  // Probar cada API hasta que una funcione
  for (let i = 0; i < apiSources.length; i++) {
    const source = apiSources[i];
    
    try {
      console.log(`🛰️ Probando API ${i + 1}/${apiSources.length}: ${source.name}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
      
      const response = await fetch(source.url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`❌ ${source.name} falló: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const position = source.parser(data);
      
      if (!position || isNaN(position.latitude) || isNaN(position.longitude)) {
        console.log(`❌ ${source.name} devolvió datos inválidos`);
        continue;
      }
      
      // ✅ ¡ÉXITO!
      this.currentPosition.set(position);
      console.log(`✅ Posición ISS obtenida de ${source.name}:`, position);
      return position;
      
    } catch (error) {
      console.log(`❌ Error con ${source.name}:`, error instanceof Error ? error.message : error);
      continue;
    }
  }

  // Si TODAS las APIs fallan, usar fallback mejorado
  console.log('⚠️ Todas las APIs ISS fallaron, usando fallback inteligente');
  
  // Fallback con posición más realista
  const fallback: ISSCurrentPosition = {
    latitude: -15.5 + (Math.random() * 60), // Entre -15 y 45 (órbita ISS)
    longitude: -180 + (Math.random() * 360), // Cualquier longitud
    altitude: 408 + (Math.random() * 20), // 408-428 km
    velocity: 27600,
    timestamp: Math.floor(Date.now() / 1000),
    visibility: 'simulated'
  };
  
  this.currentPosition.set(fallback);
  console.log('✅ Usando posición ISS simulada realista:', fallback);
  return fallback;
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