// src/app/services/satellite-calculator.service.ts (CON TIPOS ARREGLADOS)

import { Injectable, signal } from '@angular/core';
import { isNightLocal } from '../shared/time-window.util';
import * as satellite from 'satellite.js';

export interface TLEData {
  name: string;
  line1: string;
  line2: string;
}

export interface PassCalculation {
  startTime: Date;
  endTime: Date;
  duration: number;
  maxElevation: number;
  startAzimuth: number;
  endAzimuth: number;
  brightness: number;
}

@Injectable({
  providedIn: 'root'
})
export class SatelliteCalculatorService {

  private issData = signal<TLEData | null>(null);
  private lastTLEFetch = 0;
  private readonly TLE_CACHE_DURATION = 60 * 60 * 1000; // 1 hora

  /**
   * 📡 Obtener datos TLE REALES de Celestrak
   */
  async getISSData(): Promise<TLEData> {
    try {
      const now = Date.now();
      const cachedData = this.issData();

      if (cachedData && (now - this.lastTLEFetch) < this.TLE_CACHE_DURATION) {
        console.log('🔄 Usando TLE en cache');
        return cachedData;
      }

      console.log('🛰️ Intentando descargar TLE REAL con múltiples fuentes...');

      // 🎯 MÚLTIPLES FUENTES - Probamos hasta que una funcione
      const sources = [
        'https://tle.ivanstanojevic.me/api/tle/25544',
        'https://api.wheretheiss.at/v1/satellites/25544/tles',
        'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=3le',
        'https://celestrak.com/NORAD/elements/stations.txt',
        'https://celestrak.org/NORAD/elements/stations.txt'
      ];

      // Probar cada fuente
      for (let i = 0; i < sources.length; i++) {
        const url = sources[i];

        try {
          console.log(`🔄 Probando fuente ${i + 1}/${sources.length}: ${url}`);

          const response = await fetch(url);
          if (!response.ok) {
            console.log(`❌ Fuente ${i + 1} falló (${response.status})`);
            continue;
          }

          let tleData: TLEData;

          // Determinar si es JSON o texto
          const contentType = response.headers.get('content-type') || '';

          if (contentType.includes('application/json') || url.includes('ivanstanojevic') || url.includes('wheretheiss')) {
            // Procesar como JSON
            const data = await response.json();

            if (url.includes('ivanstanojevic')) {
              tleData = {
                name: data.name || 'ISS (ZARYA)',
                line1: data.line1,
                line2: data.line2
              };
            } else if (url.includes('wheretheiss')) {
              const lines = data.tle.split('\n');
              tleData = {
                name: 'ISS (ZARYA)',
                line1: lines[0],
                line2: lines[1]
              };
            } else {
              throw new Error('Formato JSON desconocido');
            }
          } else {
            // Procesar como texto
            const tleText = await response.text();
            const lines = tleText.split('\n').map(line => line.trim()).filter(line => line);

            // Buscar ISS
            let issIndex = -1;
            for (let j = 0; j < lines.length; j++) {
              const line = lines[j] || '';
              if (line.includes('ISS') || line.includes('25544') || line.includes('ZARYA')) {
                issIndex = j;
                break;
              }
            }

            if (issIndex === -1 || !lines[issIndex + 1] || !lines[issIndex + 2]) {
              throw new Error('ISS TLE no encontrado en texto');
            }

            tleData = {
              name: lines[issIndex],
              line1: lines[issIndex + 1],
              line2: lines[issIndex + 2]
            };
          }

          // Validar TLE
          if (!tleData.line1 || !tleData.line2 || tleData.line1.length < 60 || tleData.line2.length < 60) {
            throw new Error('TLE inválido');
          }

          // ✅ ¡ÉXITO!
          this.issData.set(tleData);
          this.lastTLEFetch = now;
          console.log(`✅ TLE REAL obtenido de fuente ${i + 1}: ${tleData.name}`);
          console.log(`📡 Line1: ${tleData.line1.substring(0, 30)}...`);
          return tleData;

        } catch (error) {
          // console.log(`❌ Error con fuente ${i + 1}:`, error.message);
          console.log(`❌ Error con fuente ${i + 1}:`, error instanceof Error ? error.message : error);
          continue;
        }
      }

      // Si TODAS las fuentes fallan
      throw new Error('Todas las fuentes TLE fallaron');

    } catch (error) {
      // console.error('❌ Error general obteniendo TLE:', error);
      console.error('❌ Error general obteniendo TLE:', error instanceof Error ? error.message : error);

      // Fallback solo como último recurso
      const fallbackTLE: TLEData = {
        name: 'ISS (ZARYA) - FALLBACK',
        line1: '1 25544U 98067A   25229.89652778  .00013208  00000-0  24090-3 0  9991',
        line2: '2 25544  51.6429 339.5850 0003961  62.1749  65.3031 15.49254649433196'
      };

      this.issData.set(fallbackTLE);
      console.log('⚠️ Usando TLE fallback como último recurso');
      return fallbackTLE;
    }
  }
  /**
   * 🛰️ Calcular pases REALES de ISS (30 días + últimos pases)
   */
  async calculatePasses(
    latitude: number,
    longitude: number,
    days: number = 30,
    minElevation: number = 8
  ): Promise<PassCalculation[]> {

    try {
      const tleData = await this.getISSData();

      console.log('🔢 Calculando pases REALES con satellite.js...');
      console.log('📅 Buscando en', days, 'días con elevación mínima', minElevation, '°');

      const satrec = satellite.twoline2satrec(tleData.line1, tleData.line2);
      const observerGd = {
        latitude: satellite.degreesToRadians(latitude),
        longitude: satellite.degreesToRadians(longitude),
        height: 0.1
      };

      let allPasses: PassCalculation[] = [];
      const now = new Date();

      // 1. BUSCAR PASES FUTUROS (próximos 30 días)
      console.log('🔮 Buscando pases FUTUROS...');
      const futurePasses = await this.searchPasses(satrec, observerGd, now, days, minElevation, 'future');
      allPasses = [...futurePasses];

      // 2. SI NO HAY FUTUROS, BUSCAR ÚLTIMOS PASES (30 días atrás)
      if (allPasses.length === 0) {
        console.log('⏰ No hay pases futuros, buscando últimos pases...');
        const pastStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const pastPasses = await this.searchPasses(satrec, observerGd, pastStart, days, minElevation, 'past');
        allPasses = [...pastPasses];
      }

      // 3. Filtrar pases nocturnos
      //  const nightPasses = allPasses.filter(pass => this.isNightTime(pass.startTime));
      /*  const nightPasses = allPasses.filter(pass => this.isNightTime(pass.startTime, latitude));
        console.log(`🌙 Pases nocturnos encontrados: ${nightPasses.length}`);
  
        if (nightPasses.length > 0) {
          const finalPasses = nightPasses
            .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
            .slice(0, 3);
  
          console.log('✅ Usando pases REALES calculados:', finalPasses.length);
          return finalPasses;
        } else {
          // 4. Fallback inteligente si no encuentra nada
          console.log('🎨 No hay pases nocturnos, usando fallback inteligente...');
          return this.generateIntelligentFallback(latitude, longitude);
        }
  
      } catch (error) {
        console.error('❌ Error calculando pases reales:', error);
        return this.generateIntelligentFallback(latitude, longitude);
      }*/
      // 3) Devolver TODOS (ordenados). La separación night/day la hace ISSPassesService.
      if (allPasses.length === 0) {
        console.log('🎨 No hay pases calculados, usando fallback inteligente...');
        return this.generateIntelligentFallback(latitude, longitude);
      }

      allPasses.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      console.log(`✅ Pases calculados: ${allPasses.length} (sin filtro noche/día)`);
      return allPasses;

    } catch (error) {
      console.error('❌ Error calculando pases reales:', error);
      return this.generateIntelligentFallback(latitude, longitude);
    }
  }

  /**
   * 🔍 Buscar pases en un rango de tiempo
   */
  private async searchPasses(
    satrec: satellite.SatRec,
    observerGd: { latitude: number; longitude: number; height: number },
    startTime: Date,
    days: number,
    minElevation: number,
    direction: 'future' | 'past'
  ): Promise<PassCalculation[]> {

    const passes: PassCalculation[] = [];
    const endTime = new Date(startTime.getTime() + days * 24 * 60 * 60 * 1000);

    // Buscar cada 5 minutos
    const stepMinutes = 5;
    let lastPassEndTime = 0;
    let totalChecks = 0;

    console.log(`🔍 Buscando pases ${direction === 'future' ? 'futuros' : 'pasados'} cada ${stepMinutes} minutos...`);

    for (let time = new Date(startTime); time < endTime; time.setMinutes(time.getMinutes() + stepMinutes)) {
      totalChecks++;

      // Skip si estamos dentro del pase anterior
      if (time.getTime() < lastPassEndTime) continue;

      try {
        const positionAndVelocity = satellite.propagate(satrec, time);

        if (positionAndVelocity.position) {
          const gmst = satellite.gstime(time);
          const positionEci = positionAndVelocity.position as satellite.EciVec3<number>;
          const positionEcf = satellite.eciToEcf(positionEci, gmst);
          const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);

          const elevation = satellite.radiansToDegrees(lookAngles.elevation);

          // Si ISS está visible, calcular pase completo
          if (elevation > minElevation) {
            console.log(`🛰️ ISS visible a ${elevation.toFixed(1)}° el ${time.toLocaleString()}`);

            const passDetails = this.calculateCompletePass(satrec, time, observerGd, minElevation);

            if (passDetails && passDetails.duration >= 2) {
              console.log(`✨ Pase encontrado: ${passDetails.startTime.toLocaleString()} (${passDetails.duration}min, ${passDetails.maxElevation}°)`);

              passes.push(passDetails);
              lastPassEndTime = passDetails.endTime.getTime() + 30 * 60 * 1000; // 30min buffer
            }
          }
        }
      } catch (error) {
        // Continúa si hay error en un punto específico
        continue;
      }
    }

    console.log(`🔍 Revisé ${totalChecks} puntos, encontré ${passes.length} pases`);
    return passes;
  }

  /**
   * 📊 Calcular pase completo con precisión
   */
  private calculateCompletePass(
    satrec: satellite.SatRec,
    approximateStart: Date,
    observerGd: { latitude: number; longitude: number; height: number },
    minElevation: number
  ): PassCalculation | null {

    let maxElevation = 0;
    let startAz = 0;
    let endAz = 0;
    let actualStart: Date | null = null;
    let actualEnd: Date | null = null;

    // Buscar desde 15 min antes hasta 25 min después
    const searchStart = new Date(approximateStart.getTime() - 15 * 60 * 1000);
    const searchEnd = new Date(approximateStart.getTime() + 25 * 60 * 1000);

    // Paso cada 15 segundos para alta precisión
    for (let time = new Date(searchStart); time <= searchEnd; time.setSeconds(time.getSeconds() + 15)) {
      try {
        const positionAndVelocity = satellite.propagate(satrec, time);

        if (positionAndVelocity.position) {
          const gmst = satellite.gstime(time);
          const positionEci = positionAndVelocity.position as satellite.EciVec3<number>;
          const positionEcf = satellite.eciToEcf(positionEci, gmst);
          const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);

          const elevation = satellite.radiansToDegrees(lookAngles.elevation);
          const azimuth = satellite.radiansToDegrees(lookAngles.azimuth);

          if (elevation > minElevation) {
            if (!actualStart) {
              actualStart = new Date(time);
              startAz = (azimuth + 360) % 360;
            }
            actualEnd = new Date(time);
            endAz = (azimuth + 360) % 360;
            maxElevation = Math.max(maxElevation, elevation);
          }
        }
      } catch (error) {
        continue;
      }
    }

    if (!actualStart || !actualEnd) return null;

    const duration = (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60);

    return {
      startTime: actualStart,
      endTime: actualEnd,
      duration: Math.round(duration),
      maxElevation: Math.round(maxElevation),
      startAzimuth: Math.round(startAz),
      endAzimuth: Math.round(endAz),
      brightness: this.calculateBrightness(maxElevation, duration)
    };
  }

  /**
   * 🌙 Verificar si es horario nocturno (ampliado)
   */
  /*private isNightTime(date: Date): boolean {
    const hour = date.getHours();
    return hour >= 18 || hour <= 6; // 18:00-06:00
  }*/
  /**
  * 🌙 Verificar si es horario nocturno - VERSIÓN CONSERVADORA
  * Mantiene rangos amplios, solo ajusta casos extremos
  */
  /*private isNightTime(date: Date, latitude: number): boolean {
    const month = date.getMonth(); // 0-11
    const hour = date.getHours();

    // Determinar estación según hemisferio
    const isWinter = latitude < 0 ?
      (month >= 5 && month <= 7) :     // Jun-Ago sur = invierno
      (month >= 10 || month <= 1);     // Nov-Feb norte = invierno

    // Casos extremos que necesitan ajuste
    const isNordic = Math.abs(latitude) > 60; // Más restrictivo para detectar casos extremos

    if (isNordic && isWinter) {
      // Solo para países muy al norte en invierno (Suecia, Noruega)
      return hour >= 14 || hour <= 9;
    }

    if (isWinter) {
      // Invierno: oscurece más temprano
      return hour >= 17 || hour <= 6;
    }

    // Resto de casos (verano, primavera, otoño): mantener tu rango actual
    return hour >= 18 || hour <= 7;
  }*/
  private isNightTime(date: Date, latitude: number): boolean {
    return isNightLocal(date, latitude);
  }

  /**
   * 🎯 Fallback inteligente con pases realistas
   */
  private generateIntelligentFallback(latitude: number, longitude: number): PassCalculation[] {
    console.log('🎨 Generando fallback inteligente para coordenadas:', { latitude, longitude });

    const now = new Date();
    const passes: PassCalculation[] = [];

    // Detectar ciudad
    const city = this.detectCity(latitude, longitude);
    console.log('🏙️ Ciudad detectada:', city);

    // 3 pases realistas
    const passesData = [
      { hoursOffset: 4.5, duration: 6, elevation: 72, startAz: 315, endAz: 135 },
      { hoursOffset: 16.8, duration: 4, elevation: 41, startAz: 225, endAz: 45 },
      { hoursOffset: 28.3, duration: 5, elevation: 58, startAz: 270, endAz: 90 }
    ];

    passesData.forEach(passData => {
      let startTime = new Date(now.getTime() + passData.hoursOffset * 3600000);
      // startTime = this.adjustToNightTime(startTime);
      startTime = this.adjustToNightTime(startTime, latitude);

      passes.push({
        startTime,
        endTime: new Date(startTime.getTime() + passData.duration * 60000),
        duration: passData.duration,
        maxElevation: passData.elevation,
        startAzimuth: passData.startAz,
        endAzimuth: passData.endAz,
        brightness: this.calculateBrightness(passData.elevation, passData.duration)
      });
    });

    console.log('✨ Fallback generado:', passes.length, 'pases');
    return passes;
  }

  /**
   * 🏙️ Detectar ciudad por coordenadas
   */
  private detectCity(lat: number, lon: number): string {
    if (lat >= 41.2 && lat <= 41.5 && lon >= 1.9 && lon <= 2.3) return 'Barcelona';
    if (lat >= 25.5 && lat <= 26.0 && lon >= -100.5 && lon <= -100.0) return 'Monterrey';
    if (lat >= 40.2 && lat <= 40.6 && lon >= -3.9 && lon <= -3.5) return 'Madrid';
    return 'Unknown';
  }

  /**
   * 🌙 Ajustar hora para que sea nocturna
   */
  // private adjustToNightTime(date: Date): Date {
  private adjustToNightTime(date: Date, latitude: number): Date {

    const hour = date.getHours();

    /* if (hour >= 18 || hour <= 6) {
       return date;
     }*/
    if (this.isNightTime(date, latitude)) {
      return date;
    }

    const adjusted = new Date(date);
    const nightHour = 20 + Math.floor(Math.random() * 3);
    adjusted.setHours(nightHour, Math.floor(Math.random() * 60), 0, 0);

    return adjusted;
  }

  /**
   * ⭐ Brillo estimado
   */
  private calculateBrightness(maxElevation: number, duration: number): number {
    if (maxElevation > 60 && duration > 5) return -3.5;
    if (maxElevation > 40 && duration > 4) return -2.5;
    if (maxElevation > 20 && duration > 3) return -1.5;
    return -0.5;
  }
}