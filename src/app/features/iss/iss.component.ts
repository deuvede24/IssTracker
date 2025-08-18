// src/app/features/iss/iss.component.ts
import { Component, OnInit, OnDestroy, computed, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';
import mapboxgl from 'mapbox-gl';
import { environment } from '../../../environments/environment';
import type { Feature, LineString, GeoJsonProperties } from 'geojson';
// Servicios
import { ISSSimpleService } from '../../services/iss-simple.service';
import { LocationSimpleService } from '../../services/location-simple.service';
import { bearingToCardinal } from '../../utils/geodesy';

@Component({
  selector: 'app-iss',
  standalone: true,
  imports: [CommonModule, NgxMapboxGLModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './iss.component.html',
  styleUrls: ['./iss.component.scss']
})
export class IssComponent implements OnInit, OnDestroy {

  // ===== SERVICIOS =====
  private issService = inject(ISSSimpleService);
  private locationService = inject(LocationSimpleService);
  private router = inject(Router);

  // ===== DATOS REALES =====
  issPosition = this.issService.position;
  userLocation = this.locationService.location;

  // ===== COMPUTED =====
  distance = computed(() => {
    const userLoc = this.userLocation();
    if (!userLoc) return 0;
    return Math.round(this.issService.calculateDistanceFromUser(userLoc.latitude, userLoc.longitude));
  });

  bearing = computed(() => {
    const userLoc = this.userLocation();
    if (!userLoc) return 0;
    return this.issService.calculateBearingFromUser(userLoc.latitude, userLoc.longitude);
  });

  cardinal = computed(() => bearingToCardinal(this.bearing()));

  directionIcon = computed(() => {
    const bearing = this.bearing();
    if (bearing >= 315 || bearing < 45) return '↓';
    if (bearing >= 45 && bearing < 135) return '↙️';
    if (bearing >= 135 && bearing < 225) return '↑';
    return '↘️';
  });

  movement = computed(() => {
    const userLoc = this.userLocation();
    const issPos = this.issPosition();
    if (!userLoc || !issPos) return 'Unknown';

    const latDiff = Math.abs(issPos.latitude - userLoc.latitude);
    const lonDiff = Math.abs(issPos.longitude - userLoc.longitude);

    if (lonDiff > 90) {
      return issPos.velocity > 25000 ? 'Moving away' : 'Approaching';
    }

    return latDiff < 45 ? 'Getting closer' : 'Moving away';
  });

  ngOnInit(): void {
    console.log('🛰️ ISS Component iniciado');

    // Asegurar que tenemos ubicación del usuario
    if (!this.userLocation()) {
      this.locationService.getUserLocation();
    }

    // Asegurar que el tracking esté activo
    this.issService.startTracking();
  }

  ngOnDestroy(): void {
    // No paramos el tracking aquí porque otras páginas lo pueden usar
    console.log('🛰️ ISS Component destruido');
  }

  // ===== HELPERS =====
  timeSinceUpdate(): string {
    const issPos = this.issPosition();
    if (!issPos) return 'No data';

    const diff = Date.now() / 1000 - issPos.timestamp;
    if (diff < 60) return `${Math.round(diff)}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    return `${Math.round(diff / 3600)}h ago`;
  }

  getOverRegion(): string {
    const issPos = this.issPosition();
    if (!issPos) return 'Unknown';

    // Detectar región aproximada por coordenadas
    if (issPos.latitude > 50) return 'Northern regions';
    if (issPos.latitude < -50) return 'Southern regions';
    if (Math.abs(issPos.longitude) < 30 && Math.abs(issPos.latitude) < 50) return 'Europe/Africa';
    if (issPos.longitude > 30 && issPos.longitude < 140) return 'Asia';
    if (issPos.longitude > 140 || issPos.longitude < -140) return 'Pacific Ocean';
    if (issPos.longitude > -140 && issPos.longitude < -30) return 'Americas';

    return 'Ocean';
  }

  // ===== NAVEGACIÓN =====
  goBack(): void {
    this.router.navigate(['/home']);
  }

  /*refreshData(): void {
    console.log('🔄 Refrescando datos ISS...');
    this.issService.getCurrentPosition();
  }*/
  // 🗺️ MAPBOX TOKEN
  mapboxToken = environment.mapboxToken;
  private worldMap?: mapboxgl.Map;

  // 🌍 POSICIONES PARA EL MAPA MUNDO
  issWorldPosition = computed(() => {
    const issPos = this.issPosition();
    if (!issPos) return [0, 0] as [number, number];
    return [issPos.longitude, issPos.latitude] as [number, number];
  });

  userWorldPosition = computed(() => {
    const userLoc = this.userLocation();
    if (!userLoc) return [2.1734, 41.3851] as [number, number]; // Barcelona fallback
    return [userLoc.longitude, userLoc.latitude] as [number, number];
  });

  // 🎯 CENTRO DEL MAPA (punto medio entre ISS y usuario)
  issWorldCenter = computed(() => {
    const issPos = this.issWorldPosition();
    const userPos = this.userWorldPosition();

    // Calcular punto medio
    const centerLng = (issPos[0] + userPos[0]) / 2;
    const centerLat = (issPos[1] + userPos[1]) / 2;

    return [centerLng, centerLat] as [number, number];
  });

  // 📏 LÍNEA DE CONEXIÓN ISS-USUARIO
  connectionLineData = computed(() => {
    const issPos = this.issWorldPosition();
    const userPos = this.userWorldPosition();

    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [userPos, issPos]
      }
    };
  });

  // 🗺️ EVENTO CUANDO CARGA EL MAPA MUNDO
  onWorldMapLoad(evt: any): void {
    this.worldMap = evt.target as mapboxgl.Map;
    console.log('🌍 Mapa mundo cargado');

    // Auto-ajustar vista para mostrar ISS y usuario después de un momento
    setTimeout(() => {
      this.fitMapToPoints();
    }, 700);
  }

  // 🔄 AJUSTAR VISTA DEL MAPA PARA MOSTRAR ISS Y USUARIO
  /* private fitMapToPoints(): void {
     if (!this.worldMap) return;
 
     const issPos = this.issWorldPosition();
     const userPos = this.userWorldPosition();
 
     // Si ISS y usuario están muy lejos, hacer zoom más global
     const distance = this.calculateMapDistance(issPos, userPos);
 
     if (distance > 10000) { // Muy lejos
       this.worldMap.setZoom(1);
       this.worldMap.setCenter(this.issWorldCenter());
     } else {
       // Ajustar bounds para mostrar ambos puntos
       const bounds = new mapboxgl.LngLatBounds()
         .extend(issPos)
         .extend(userPos);
 
       this.worldMap.fitBounds(bounds, {
         padding: 50,
         maxZoom: 4
       });
     }
   }*/
  private fitMapToPoints(): void {
    if (!this.worldMap) return;

    const issPos = this.issWorldPosition();
    const userPos = this.userWorldPosition();

    // 🔧 CAMBIO: Mejor algoritmo para distancias grandes
    const distance = this.calculateMapDistance(issPos, userPos);

    if (distance > 10000) { // Muy lejos
      // 🔧 NUEVO: Usar bounds en lugar de zoom fijo
      const bounds = new mapboxgl.LngLatBounds()
        .extend(issPos)
        .extend(userPos);

      this.worldMap.fitBounds(bounds, {
        padding: 100,
        maxZoom: 2,    // Zoom máximo cuando están muy lejos
        minZoom: 1,     // Zoom mínimo 
        duration: 1500,
        essential: false
      });
    } else {
      // 🔧 MANTENER: Para distancias normales (como está)
      const bounds = new mapboxgl.LngLatBounds()
        .extend(issPos)
        .extend(userPos);

      this.worldMap.fitBounds(bounds, {
        padding: 50,
        maxZoom: 4,
        duration: 1000,
        essential: false
      });
    }
  }

  // 📏 CALCULAR DISTANCIA EN EL MAPA
  private calculateMapDistance(pos1: [number, number], pos2: [number, number]): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRadians(pos2[1] - pos1[1]);
    const dLon = this.toRadians(pos2[0] - pos1[0]);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(pos1[1])) * Math.cos(this.toRadians(pos2[1])) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // ===== ACTUALIZAR EL refreshData PARA INCLUIR EL MAPA =====
  refreshData(): void {
    console.log('🔄 Refrescando datos ISS...');
    this.issService.getCurrentPosition().then(() => {
      // Reajustar mapa cuando se actualicen los datos
      setTimeout(() => {
        this.fitMapToPoints();
      }, 200);
    });
  }
}