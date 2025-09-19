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

  // ✅ NUEVO: evita solapadas
  private inFlight: Promise<ISSCurrentPosition> | null = null;

  // ✅ NUEVO: id del intervalo para limpiarlo al instante
  private pollId: number | null = null;

  // Getter público
  get position() {
    return this.currentPosition.asReadonly();
  }

  /**
   * 🛰️ Obtener posición actual de ISS 
   *  🎯 MÚLTIPLES FUENTES - Probamos hasta que una funcione
   */
  async getCurrentPosition(): Promise<ISSCurrentPosition> {


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
        //name: 'open-notify.org',          //as fallback
        name: 'open-notify (proxied)',
        //url: 'http://api.open-notify.org/iss-now.json',
        url: '/api/iss-now',
        parser: (data: any) => ({
          latitude: parseFloat(data.iss_position.latitude),
          longitude: parseFloat(data.iss_position.longitude),
          altitude: 408,
          velocity: 27600,
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
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

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

    // Primer fetch inmediato (protegido contra solape)
    if (!this.inFlight) {
      this.inFlight = this.getCurrentPosition().finally(() => (this.inFlight = null));
    }

    // Polling cada 5s (no dispara si hay uno en curso)
    this.pollId = window.setInterval(() => {
      if (!this.isTracking || this.inFlight) return;
      this.inFlight = this.getCurrentPosition().finally(() => (this.inFlight = null));
    }, 5000);
  }


  /**
   * ⏹️ Parar tracking
   */
  stopTracking(): void {
    this.isTracking = false;
    if (this.pollId !== null) {
      clearInterval(this.pollId);   // se para YA, sin esperar al siguiente tick
      this.pollId = null;
    }
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

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(userLat)) * Math.cos(this.toRadians(issPos.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const surfaceDistance = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

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