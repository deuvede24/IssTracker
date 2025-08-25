// src/app/services/iss-passes.service.ts (ARREGLADO PARA DATOS REALES)

import { Injectable, signal, inject } from '@angular/core';
import { PassHome } from '../interfaces/pass.interface';
import { SatelliteCalculatorService, PassCalculation } from './satellite-calculator.service';
import { LocalReferenceService } from './local-reference.service';


@Injectable({
  providedIn: 'root'
})
export class ISSPassesService {

  private satelliteCalculator = inject(SatelliteCalculatorService);
  private realPasses = signal<PassHome[]>([]);
  private lastFetchLocation: { lat: number; lon: number } | null = null;
  private lastFetchAt: number | null = null;

  private localReference = inject(LocalReferenceService);

  get passes() {
    return this.realPasses.asReadonly();
  }

  /**
   * 🛰️ Obtener pases reales usando satellite.js - CON UI INTELIGENTE
   */
  /* async getRealPasses(latitude: number, longitude: number): Promise<PassHome[]> {
     if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
       (latitude === 0 && longitude === 0)) {
       console.warn('[passes] Invalid location; keeping current cache');
       return this.realPasses();
     }
     try {
       console.log('🛰️ Calculating REAL passes with satellite.js for:', { latitude, longitude });
 
       // Evitar cálculos duplicados
       if (this.lastFetchLocation &&
         Math.abs(this.lastFetchLocation.lat - latitude) < 0.01 &&
         Math.abs(this.lastFetchLocation.lon - longitude) < 0.01) {
         console.log('📋 Using cached passes');
         return this.realPasses();
       }
 
       // Calcular pases con satellite.js
       const calculations = await this.satelliteCalculator.calculatePasses(
         latitude,
         longitude,
         14, // 14 días
         5  // mínimo 5° elevación
       );
 
       console.log('🔢 REAL satellite.js calculations:', calculations.length);
 
       if (calculations.length === 0) {
         console.log('⚠️ No passes found, using fallback');
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
 
       console.log(`🌙 REAL night passes: ${nightPasses.length}`);
       console.log(`☀️ REAL day passes:  ${dayPasses.length}`);
 
       let finalPasses: PassHome[];
 
       if (nightPasses.length >= 3) {
         // ✅ Hay suficientes pases nocturnos - PERFECTO
         finalPasses = nightPasses.slice(0, Math.min(3, nightPasses.length)).map(pass => ({
           ...pass,
           viewable: true,
           reason: 'Perfect night viewing'
         }));
         console.log('🌙 Using 3 REAL night passes');
 
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
         console.log(`🌓 Combining ${nightPasses.length} night + ${brightDayPasses.length} day`);
 
       } else {
         // ❌ No hay nocturnos esta semana - mostrar los mejores diurnos + info
         finalPasses = dayPasses.slice(0, 3).map(pass => ({
           ...pass,
           viewable: false,
           reason: 'Daylight pass - not visible'
         }));
         console.log('☀️ Only day passes this week');
       }
       // 🎯 ORDENAR CRONOLÓGICAMENTE
       finalPasses = finalPasses.sort((a, b) =>
         new Date(a.time).getTime() - new Date(b.time).getTime()
       );
 
       try {
         localStorage.setItem('last-valid-passes', JSON.stringify(finalPasses.slice(0, 3)));
       } catch (e) {
         console.warn('[passes] Could not persist cache:', e);
       }
 
       this.realPasses.set(finalPasses);
       this.lastFetchLocation = { lat: latitude, lon: longitude };
 
       console.log('✅ REAL passes calculated with satellite.js:', finalPasses.length);
       return finalPasses;
 
     } catch (error) {
       console.error('❌ Error calculating REAL passes:', error);
 
       // Fallback solo si satellite.js falla completamente
       const fallbackPasses = this.generateRealisticFallback();
       this.realPasses.set(fallbackPasses);
       return fallbackPasses;
     }
   }*/

  /**
   * 🛰️ Obtener pases reales usando satellite.js
   * - Evita recálculos si estamos en la misma zona y los datos son "frescos" (<2h) 🆕
   * - Guarda una copia ligera en localStorage (para fallback visual) ✅
   */
  async getRealPasses(latitude: number, longitude: number): Promise<PassHome[]> {
    // Validación de entrada
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      (latitude === 0 && longitude === 0)) {
      console.warn('[passes] Invalid location; keeping current cache');
      return this.realPasses();
    }

    // 🆕 Evitar cálculos duplicados: misma zona + datos frescos (< 2h)
    const FRESH_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 horas
    if (this.lastFetchLocation &&
      Math.abs(this.lastFetchLocation.lat - latitude) < 0.01 &&
      Math.abs(this.lastFetchLocation.lon - longitude) < 0.01 &&
      this.lastFetchAt && (Date.now() - this.lastFetchAt) < FRESH_WINDOW_MS) {
      console.log('📋 Using cached in-memory passes (same area, fresh)');
      return this.realPasses();
    }

    try {
      console.log('🛰️ Calculating REAL passes with satellite.js for:', { latitude, longitude });

      // Calcular pases con satellite.js
      const calculations = await this.satelliteCalculator.calculatePasses(
        latitude,
        longitude,
        14, // 14 días
        5   // mínimo 5° elevación
      );

      console.log('🔢 REAL satellite.js calculations:', calculations.length);

      if (calculations.length === 0) {
        console.log('⚠️ No passes found, using fallback');
        const fallbackPasses = this.generateRealisticFallback();

        // ⛔ No marcar como fresco en fallback: queremos reintentar pronto
        this.realPasses.set(fallbackPasses);
        return fallbackPasses;
      }

      // Transformar TODOS los pases a formato PassHome
      const allPasses = calculations.map((calc, index) =>
        this.transformToPassHome(calc, index, latitude, longitude)
      );

      // 🎯 Lógica inteligente: separar nocturnos vs diurnos
      const nightPasses = allPasses.filter(pass => this.isNightPass(pass.time));
      const dayPasses = allPasses.filter(pass => !this.isNightPass(pass.time));

      console.log(`🌙 REAL night passes: ${nightPasses.length}`);
      console.log(`☀️ REAL day passes:  ${dayPasses.length}`);

      let finalPasses: PassHome[];

      if (nightPasses.length >= 3) {
        // ✅ Hay suficientes nocturnos
        finalPasses = nightPasses.slice(0, Math.min(3, nightPasses.length)).map(pass => ({
          ...pass,
          viewable: true,
          reason: 'Perfect night viewing'
        }));
        console.log('🌙 Using 3 REAL night passes');
      } else if (nightPasses.length > 0) {
        // 🌓 Combinar pocos nocturnos + mejores diurnos
        const brightDayPasses = dayPasses
          .filter(pass => this.isBrightDayPass(pass))
          .slice(0, 3 - nightPasses.length);

        finalPasses = [
          ...nightPasses.map(pass => ({ ...pass, viewable: true, reason: 'Perfect night viewing' })),
          ...brightDayPasses.map(pass => ({ ...pass, viewable: false, reason: 'Daylight pass - not visible' }))
        ];
        console.log(`🌓 Combining ${nightPasses.length} night + ${brightDayPasses.length} day`);
      } else {
        // ☀️ Solo diurnos esta semana
        finalPasses = dayPasses.slice(0, 3).map(pass => ({
          ...pass,
          viewable: false,
          reason: 'Daylight pass - not visible'
        }));
        console.log('☀️ Only day passes this week');
      }

      // 🎯 Ordenar cronológicamente
      finalPasses = finalPasses.sort((a, b) =>
        new Date(a.time).getTime() - new Date(b.time).getTime()
      );

      // Persistir caché ligera (3 elementos)
      try {
        localStorage.setItem('last-valid-passes', JSON.stringify(finalPasses.slice(0, 3)));
      } catch (e) {
        console.warn('[passes] Could not persist cache:', e);
      }

      // Actualizar señales y memo de última zona consultada
      this.realPasses.set(finalPasses);
      this.lastFetchLocation = { lat: latitude, lon: longitude };
      this.lastFetchAt = Date.now(); // 🆕 marcamos fresco solo tras éxito real

      console.log('✅ REAL passes calculated with satellite.js:', finalPasses.length);
      return finalPasses;

    } catch (error) {
      console.error('❌ Error calculating REAL passes:', error);
      console.error('❌ Error calculating REAL passes:', error);

      // Fallback solo si satellite.js falla completamente
      const fallbackPasses = this.generateRealisticFallback();

      // ⛔ No marcar como fresco en fallback
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
      : 'Day pass — not visible';                              // Si es de día

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
    //  const brightness = pass.brightness || '';
    const altitude = (pass.altitude || '').toLowerCase();
    const duration = pass.duration || 0;

    return altitude.includes('very high')
      || altitude.includes('high')      // “High in the sky”
      || duration >= 5;
  }




  private getCompassEmoji(startAzimuth: number, endAzimuth: number): string {
    const avgAzimuth = ((startAzimuth + endAzimuth) / 2) % 360;

    if (avgAzimuth >= 315 || avgAzimuth < 45) return '↓';   // N→S
    if (avgAzimuth >= 45 && avgAzimuth < 135) return '↙️';  // E→W
    if (avgAzimuth >= 135 && avgAzimuth < 225) return '↑'; // S→N  
    return '↘️'; // W→E
  }

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
  /* private generateRealisticFallback(): PassHome[] {
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
   }*/

  private generateRealisticFallback(): PassHome[] {
    const cached = localStorage.getItem('last-valid-passes');
    if (!cached) return [];

    try {
      const raw: any[] = JSON.parse(cached);
      const now = Date.now();

      const list = raw
        .map((p) => {
          const time = new Date(p.time);
          if (isNaN(time.getTime())) return null; // descarta corruptos

          const isFuture = time.getTime() > now;
          const viewable = isFuture && this.isNightPass(time);

          return {
            ...p,
            time,
            timeToPass: isFuture ? this.calculateTimeToPass(time) : 'Passed',
            reason: 'Last known data (cached)',
            viewable
          } as PassHome;
        })
        .filter(Boolean) as PassHome[];

      // por si acaso, ordénalos otra vez
      return list.sort((a, b) => a.time.getTime() - b.time.getTime());
    } catch {
      return [];
    }
  }


  /**
   * 🔄 Refrescar pases
   */
  async refreshPasses(latitude: number, longitude: number): Promise<void> {
    this.lastFetchLocation = null; // Forzar recálculo
    this.lastFetchAt = null; // 🆕 fuerza recálculo real
    await this.getRealPasses(latitude, longitude);
  }
}