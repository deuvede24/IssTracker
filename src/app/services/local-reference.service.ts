// src/app/services/local-reference.service.ts
// PASO 1: Crear este archivo NUEVO

import { Injectable } from '@angular/core';

export interface LocalReference {
    startCoords: [number, number];  // Punto donde aparece ISS
    endCoords: [number, number];    // Punto donde desaparece ISS
    from: string;                   // "Northwest"
    to: string;                     // "Southeast"
    elevationDescription: string;   // "High in the sky - look up 45°"
}

@Injectable({
    providedIn: 'root'
})
export class LocalReferenceService {

    /**
     * 🎯 MÉTODO PRINCIPAL: Generar referencias locales para cualquier ciudad
     */
    generateLocalReferences(
        userLat: number,
        userLon: number,
        startAzimuth: number,
        endAzimuth: number,
        maxElevation: number
    ): LocalReference {

        const distance = 1.5; // 1.5km - perfecto para contexto móvil

        // Calcular puntos matemáticamente
        const startPoint = this.getPointFromBearing(userLat, userLon, startAzimuth, distance);
        const endPoint = this.getPointFromBearing(userLat, userLon, endAzimuth, distance);

        // Convertir azimuth a direcciones cardinales
        const fromDirection = this.azimuthToCardinal(startAzimuth);
        const toDirection = this.azimuthToCardinal(endAzimuth);

        // Generar descripción humana de elevación
        const elevationDescription = this.getElevationDescription(maxElevation);

        return {
            startCoords: [startPoint.lon, startPoint.lat],
            endCoords: [endPoint.lon, endPoint.lat],
            from: fromDirection,
            to: toDirection,
            elevationDescription
        };
    }

    /**
     * 🧮 MATEMÁTICAS: Calcular punto a X km en dirección Y
     */
    private getPointFromBearing(
        lat: number,
        lon: number,
        bearing: number,
        distance: number
    ): { lat: number; lon: number } {

        const R = 6371; // Radio de la Tierra en km
        const d = distance / R; // Distancia angular

        // Convertir a radianes
        const lat1 = lat * Math.PI / 180;
        const lon1 = lon * Math.PI / 180;
        const bearingRad = bearing * Math.PI / 180;

        // Calcular nueva latitud
        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(d) +
            Math.cos(lat1) * Math.sin(d) * Math.cos(bearingRad)
        );

        // Calcular nueva longitud
        const lon2 = lon1 + Math.atan2(
            Math.sin(bearingRad) * Math.sin(d) * Math.cos(lat1),
            Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
        );

        // Convertir de vuelta a grados
        return {
            lat: lat2 * 180 / Math.PI,
            lon: lon2 * 180 / Math.PI
        };
    }

    /**
     * 🧭 DIRECCIONES: Convertir azimuth a cardinal
     */
    private azimuthToCardinal(azimuth: number): string {
        const directions = [
            'North', 'Northeast', 'East', 'Southeast',
            'South', 'Southwest', 'West', 'Northwest'
        ];

        const normalized = ((azimuth % 360) + 360) % 360; // Normalizar 0-360
        const index = Math.round(normalized / 45) % 8;

        return directions[index];
    }

    /**
     * 🏔️ ELEVACIÓN: Convertir grados técnicos a descripción humana
     */
    /*private getElevationDescription(elevation: number): string {
      if (elevation >= 70) {
        return 'Almost directly overhead - look straight up';
      } else if (elevation >= 50) {
        return 'High in the sky - look up like seeing an airplane';
      } else if (elevation >= 30) {
        return 'Medium height - look up at 45° angle';
      } else if (elevation >= 15) {
        return 'Low in the sky - look toward the horizon';
      } else {
        return 'Very low - just above the horizon';
      }
    }*/

    private getElevationDescription(elevation: number): string {
        if (elevation >= 70) {
            return 'Almost overhead';                    // Usuario mira directo arriba
        } else if (elevation >= 45) {
            return 'High in the sky';                    // Usuario mira arriba 
        } else if (elevation >= 25) {
            return 'Medium height';                      // Usuario mira arriba pero menos
        } else if (elevation >= 15) {
            return 'Low in the sky';                     // Usuario mira hacia arriba poco
        } else {
            return 'Close to horizon';                   // Usuario mira casi recto
        }
    }

    /**
     * 🎯 HELPER: Generar nombres direccionales simples
     */
    generateDirectionalNames(startAzimuth: number, endAzimuth: number): { from: string; to: string } {
        return {
            from: this.azimuthToCardinal(startAzimuth),
            to: this.azimuthToCardinal(endAzimuth)
        };
    }
}