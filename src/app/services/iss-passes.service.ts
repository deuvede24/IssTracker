// src/app/services/iss-passes.service.ts (ARREGLADO PARA DATOS REALES)

import { Injectable, signal, inject } from '@angular/core';
import { PassHome } from '../interfaces/pass.interface';
import { SatelliteCalculatorService, PassCalculation } from './satellite-calculator.service';
import { bearingToCardinal } from '../utils/geodesy';
import { LocalReferenceService } from './local-reference.service';

// Referencias de Barcelona por dirección cardinal
/*const BARCELONA_LANDMARKS = {
  north: 'Collserola',
  northeast: 'Sagrada Família',
  east: 'Sant Adrià',
  southeast: 'Barceloneta',
  south: 'Montjuïc',
  southwest: 'Hospital Clínic',
  west: 'Zona Universitària',
  northwest: 'Tibidabo'
};*/

@Injectable({
  providedIn: 'root'
})
export class ISSPassesService {

  private satelliteCalculator = inject(SatelliteCalculatorService);
  private realPasses = signal<PassHome[]>([]);
  private lastFetchLocation: { lat: number; lon: number } | null = null;
  private localReference = inject(LocalReferenceService);

  get passes() {
    return this.realPasses.asReadonly();
  }

  /**
   * 🛰️ Obtener pases reales usando satellite.js - CON UI INTELIGENTE
   */
  async getRealPasses(latitude: number, longitude: number): Promise<PassHome[]> {
    try {
      console.log('🛰️ Calculando pases REALES con satellite.js para:', { latitude, longitude });

      // Evitar cálculos duplicados
      if (this.lastFetchLocation &&
        Math.abs(this.lastFetchLocation.lat - latitude) < 0.01 &&
        Math.abs(this.lastFetchLocation.lon - longitude) < 0.01) {
        console.log('📋 Usando pases cacheados');
        return this.realPasses();
      }

      // Calcular pases con satellite.js
      const calculations = await this.satelliteCalculator.calculatePasses(
        latitude,
        longitude,
        14, // 7 días
        5  // mínimo 5° elevación
      );

      console.log('🔢 Cálculos satellite.js REALES:', calculations.length);

      if (calculations.length === 0) {
        console.log('⚠️ No se encontraron pases, usando fallback');
        const fallbackPasses = this.generateRealisticFallback();
        this.realPasses.set(fallbackPasses);
        return fallbackPasses;
      }

      // Transformar TODOS los pases a formato PassHome
      const allPasses = calculations.map((calc, index) =>
        this.transformToPassHome(calc, index, latitude, longitude)
      );

      // 🎯 LÓGICA INTELIGENTE: Separar nocturnos vs diurnos
      const nightPasses = allPasses.filter(pass => this.isNightPass(pass.time));
      const dayPasses = allPasses.filter(pass => !this.isNightPass(pass.time));

      console.log(`🌙 Pases nocturnos REALES: ${nightPasses.length}`);
      console.log(`☀️ Pases diurnos REALES: ${dayPasses.length}`);

      let finalPasses: PassHome[];

      if (nightPasses.length >= 3) {
        // ✅ Hay suficientes pases nocturnos - PERFECTO
        finalPasses = nightPasses.slice(0, Math.min(3, nightPasses.length)).map(pass => ({
          ...pass,
          viewable: true,
          reason: 'Perfect night viewing'
        }));
        console.log('🌙 Usando 3 pases nocturnos REALES');

      } else if (nightPasses.length > 0) {
        // ⚠️ Pocos nocturnos - combinar con mejores diurnos
        const brightDayPasses = dayPasses
          .filter(pass => this.isBrightDayPass(pass))
          .slice(0, 3 - nightPasses.length);

        finalPasses = [
          ...nightPasses.map(pass => ({
            ...pass,
            viewable: true,
            reason: 'Perfect night viewing'
          })),
          ...brightDayPasses.map(pass => ({
            ...pass,
            viewable: false,
            reason: 'Daylight pass - not visible'
          }))
        ];
        console.log(`🌓 Combinando ${nightPasses.length} nocturnos + ${brightDayPasses.length} diurnos`);

      } else {
        // ❌ No hay nocturnos esta semana - mostrar los mejores diurnos + info
        finalPasses = dayPasses.slice(0, 3).map(pass => ({
          ...pass,
          viewable: false,
          reason: 'Daylight pass - not visible'
        }));
        console.log('☀️ Solo pases diurnos esta semana');
      }
      // 🎯 ORDENAR CRONOLÓGICAMENTE
      finalPasses = finalPasses.sort((a, b) =>
        new Date(a.time).getTime() - new Date(b.time).getTime()
      );



      this.realPasses.set(finalPasses);
      this.lastFetchLocation = { lat: latitude, lon: longitude };

      console.log('✅ Pases REALES calculados con satellite.js:', finalPasses.length);
      return finalPasses;

    } catch (error) {
      console.error('❌ Error calculando pases REALES:', error);

      // Fallback solo si satellite.js falla completamente
      const fallbackPasses = this.generateRealisticFallback();
      this.realPasses.set(fallbackPasses);
      return fallbackPasses;
    }
  }

  /**
   * 🔄 Transformar cálculo satellite.js a PassHome
   */
  /* private transformToPassHome(
     calculation: PassCalculation,
     index: number,
     userLat: number,
     userLon: number
   ): PassHome {
 
     // Obtener referencias de Barcelona según azimut
     const fromLandmark = this.getLandmarkFromAzimuth(calculation.startAzimuth);
     const toLandmark = this.getLandmarkFromAzimuth(calculation.endAzimuth);
 
     // Crear dirección cardinal
     const fromCardinal = bearingToCardinal(calculation.startAzimuth);
     const toCardinal = bearingToCardinal(calculation.endAzimuth);
     const direction = `${fromCardinal} → ${toCardinal}`;
 
     // Emoji de brújula
     const compass = this.getCompassEmoji(calculation.startAzimuth, calculation.endAzimuth);
 
     // Descripción de brillo
     const brightness = this.getBrightnessDescription(calculation.brightness);
 
     // Descripción de altitud
     const altitude = this.getAltitudeDescription(calculation.maxElevation);
 
     // Calcular tiempo restante
     const timeToPass = this.calculateTimeToPass(calculation.startTime);
 
     return {
       id: `satellite-${index + 1}`,
       time: calculation.startTime,
       duration: calculation.duration,
       from: fromLandmark,
       to: toLandmark,
       altitude,
       brightness,
       timeToPass,
       direction,
       compass,
       azimuth: {
         appear: Math.round(calculation.startAzimuth),
         disappear: Math.round(calculation.endAzimuth)
       }
     };
   }*/
  private transformToPassHome(
    calculation: PassCalculation,
    index: number,
    userLat: number,
    userLon: number
  ): PassHome {

    // ✅ USAR MATEMÁTICAS en lugar de Barcelona hardcodeado
    const localRef = this.localReference.generateLocalReferences(
      userLat,
      userLon,
      calculation.startAzimuth,
      calculation.endAzimuth,
      calculation.maxElevation
    );

    // Crear dirección cardinal
    const direction = `${localRef.from} → ${localRef.to}`;

    // Emoji de brújula (mantener tu lógica actual)
    const compass = this.getCompassEmoji(calculation.startAzimuth, calculation.endAzimuth);

    const isNight = this.isNightPass(calculation.startTime);
    const brightness = isNight
      ? this.getBrightnessDescription(calculation.brightness)  // Solo si es de noche
      : 'Day pass - not visible';                              // Si es de día

    // ✅ USAR elevación humana del servicio
    const altitude = localRef.elevationDescription;

    // Calcular tiempo restante (mantener tu lógica actual)
    const timeToPass = this.calculateTimeToPass(calculation.startTime);

    return {
      id: `satellite-${index + 1}`,
      time: calculation.startTime,
      duration: calculation.duration,
      from: localRef.from,        // ✅ "Northwest" en lugar de "Tibidabo"
      to: localRef.to,            // ✅ "Southeast" en lugar de "Barceloneta"
      altitude,                   // ✅ "High in the sky - look up 45°"
      brightness,
      timeToPass,
      direction,
      compass,
      azimuth: {
        appear: Math.round(calculation.startAzimuth),
        disappear: Math.round(calculation.endAzimuth)
      }
    };
  }

  /**
   * 🌙 Verificar si es pase nocturno
   */
  private isNightPass(time: Date): boolean {
    const hour = time.getHours();
    return hour >= 19 || hour <= 5; // Entre 19:00 y 05:00
  }

  /**
   * ☀️ Verificar si es pase diurno brillante
   */
  private isBrightDayPass(pass: PassHome): boolean {
    const brightness = pass.brightness || '';
    const altitude = pass.altitude || '';
    const duration = pass.duration || 0;

    return brightness.includes('⭐⭐') ||
      altitude.includes('Very high') ||
      duration >= 5;
  }

  /**
   * 🏙️ Obtener landmark de Barcelona según azimut
   */
  /* private getLandmarkFromAzimuth(azimuth: number): string {
     const normalizedAzimuth = (azimuth + 360) % 360;
 
     if (normalizedAzimuth >= 337.5 || normalizedAzimuth < 22.5) return BARCELONA_LANDMARKS.north;
     if (normalizedAzimuth >= 22.5 && normalizedAzimuth < 67.5) return BARCELONA_LANDMARKS.northeast;
     if (normalizedAzimuth >= 67.5 && normalizedAzimuth < 112.5) return BARCELONA_LANDMARKS.east;
     if (normalizedAzimuth >= 112.5 && normalizedAzimuth < 157.5) return BARCELONA_LANDMARKS.southeast;
     if (normalizedAzimuth >= 157.5 && normalizedAzimuth < 202.5) return BARCELONA_LANDMARKS.south;
     if (normalizedAzimuth >= 202.5 && normalizedAzimuth < 247.5) return BARCELONA_LANDMARKS.southwest;
     if (normalizedAzimuth >= 247.5 && normalizedAzimuth < 292.5) return BARCELONA_LANDMARKS.west;
     if (normalizedAzimuth >= 292.5 && normalizedAzimuth < 337.5) return BARCELONA_LANDMARKS.northwest;
 
     return BARCELONA_LANDMARKS.north; // Fallback
   }*/

  /**
   * 🧭 Obtener emoji de brújula según trayectoria
   */
  private getCompassEmoji(startAzimuth: number, endAzimuth: number): string {
    const avgAzimuth = ((startAzimuth + endAzimuth) / 2) % 360;

    if (avgAzimuth >= 315 || avgAzimuth < 45) return '↓';   // N→S
    if (avgAzimuth >= 45 && avgAzimuth < 135) return '↙️';  // E→W
    if (avgAzimuth >= 135 && avgAzimuth < 225) return '↑'; // S→N  
    return '↘️'; // W→E
  }

  /**
   * ⭐ Descripción de brillo según magnitud
   */
  /*private getBrightnessDescription(magnitude: number): string {
    if (magnitude < -3) return 'Extremely bright like Venus ⭐⭐⭐';
    if (magnitude < -2) return 'Very bright ⭐⭐';
    if (magnitude < -1) return 'Bright ⭐';
    return 'Visible ✨';
  }*/

    private getBrightnessDescription(magnitude: number): string {
  let stars = '';
  let description = '';
  
  if (magnitude <= -3.0) {
    stars = '★★★★';
    description = 'Extremely bright like Venus';
  } else if (magnitude <= -2.0) {
    stars = '★★★☆';
    description = 'Very bright like Jupiter';
  } else if (magnitude <= -1.0) {
    stars = '★★☆☆';
    description = 'Bright like a star';
  } else {
    stars = '★☆☆☆';
    description = 'Visible';
  }
  
  return `${stars} ${description}`;
}

  /**
   * 🏔️ Descripción de altitud según elevación máxima
   */
  private getAltitudeDescription(maxElevation: number): string {
    if (maxElevation > 60) return 'Very high in the sky (overhead)';
    if (maxElevation > 40) return 'High in the sky';
    if (maxElevation > 20) return 'Medium altitude';
    return 'Low on horizon';
  }

  /**
   * ⏰ Calcular tiempo hasta el pase
   */
  private calculateTimeToPass(passTime: Date): string {
    const now = new Date();
    const diff = passTime.getTime() - now.getTime();

    if (diff < 0) return 'Passed';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} and ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}min`;
    } else {
      return `${minutes}min`;
    }
  }

  /**
   * 🔄 Fallback con pases realistas (solo si satellite.js falla)
   */
  private generateRealisticFallback(): PassHome[] {
    const now = Date.now();

    return [
      {
        id: 'fallback-1',
        time: new Date(now + 3 * 3600000),
        duration: 6,
        from: 'Tibidabo',
        to: 'Barceloneta',
        altitude: 'High in the sky',
        brightness: 'Very bright ⭐⭐',
        timeToPass: '3h 12min',
        direction: 'Northwest → Southeast',
        compass: '↘️',
        azimuth: { appear: 315, disappear: 135 },
        viewable: true,
        reason: 'Fallback pass'
      },
      {
        id: 'fallback-2',
        time: new Date(now + 12 * 3600000),
        duration: 4,
        from: 'Hospital Clínic',
        to: 'Sagrada Família',
        altitude: 'Medium altitude',
        brightness: 'Bright ⭐',
        timeToPass: '12h 45min',
        direction: 'Southwest → Northeast',
        compass: '↗️',
        azimuth: { appear: 225, disappear: 45 },
        viewable: true,
        reason: 'Fallback pass'
      },
      {
        id: 'fallback-3',
        time: new Date(now + 25 * 3600000),
        duration: 5,
        from: 'Collserola',
        to: 'Montjuïc',
        altitude: 'High in the sky',
        brightness: 'Very bright ⭐⭐',
        timeToPass: '1 day and 1h',
        direction: 'North → South',
        compass: '↓',
        azimuth: { appear: 0, disappear: 180 },
        viewable: true,
        reason: 'Fallback pass'
      }
    ];
  }

  /**
   * 🔄 Refrescar pases
   */
  async refreshPasses(latitude: number, longitude: number): Promise<void> {
    this.lastFetchLocation = null; // Forzar recálculo
    await this.getRealPasses(latitude, longitude);
  }
}