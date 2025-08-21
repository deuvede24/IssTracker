// src/app/features/map/map.component.ts - FINAL CON COORDENADAS DINÁMICAS

import { Component, OnInit, signal, computed, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';
import mapboxgl from 'mapbox-gl';
import type { Feature, LineString, GeoJsonProperties } from 'geojson';
import { environment } from '../../../environments/environment';
import { Router, ActivatedRoute } from '@angular/router';
import { PassMap } from '../../interfaces/pass.interface';
//import { N2YOPassesService } from '../../services/n2yo-passes.service'; // ← SOLO N2YO
import { ISSPassesService } from '../../services/iss-passes.service';
import { LocationSimpleService } from '../../services/location-simple.service';
import { LocalReferenceService } from '../../services/local-reference.service';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, NgxMapboxGLModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent implements OnInit {

  // ===== SOLO N2YO =====
  //private n2yoService = inject(N2YOPassesService);
  private passesService = inject(ISSPassesService);
  private locationService = inject(LocationSimpleService);
  private localReference = inject(LocalReferenceService);

  mapboxToken = environment.mapboxToken;
  private map?: mapboxgl.Map;

  userLocation = computed<[number, number]>(() => {
    const location = this.locationService.location();
    // if (location && location.detected) {
    console.log('🔍 MAP userLocation computed:', location);
    if (location) {
      console.log(`📍 Usando ubicación GPS real: ${location.city}`);
      console.log(`📍 Coordenadas exactas: ${location.latitude}, ${location.longitude}`);
      console.log('✅ Using real location:', location.city, location.latitude, location.longitude);
      return [location.longitude, location.latitude];
    }
    console.log('📍 Usando ubicación por defecto: Barcelona');
    console.log('❌ No location, using Barcelona fallback');
    return [2.1689, 41.3879]; // Fallback Barcelona
  });

  mapCenter = computed<[number, number]>(() => this.userLocation());

  mapStyles = {
    streets: 'mapbox://styles/mapbox/streets-v12',
    night: 'mapbox://styles/mapbox/dark-v10',
    satellite: 'mapbox://styles/mapbox/satellite-v9',
  };
  currentStyle = signal<string>(this.mapStyles.streets);

  issStartPoint = signal<[number, number]>([2.160, 41.390]);
  issEndPoint = signal<[number, number]>([2.180, 41.385]);

  trajectoryData = signal<Feature<LineString, GeoJsonProperties>>({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: [
        this.issStartPoint(),
        this.issEndPoint()
      ],
    },
  });

  private movingISSMarker?: mapboxgl.Marker; // ← OPCIONAL para evitar errores
  animationRunning = signal<boolean>(false);

  // ← USAR SOLO N2YO
  allPasses = computed(() => {
    //const realPasses = this.n2yoService.passes();
    const realPasses = this.passesService.passes();
    console.log('🗺️ Pases disponibles en Map:', realPasses.length);
    return realPasses.map(pass => ({
      id: pass.id,
      time: pass.time,
      duration: pass.duration,
      from: pass.from,
      to: pass.to
    }));
  });

  currentPass = signal<PassMap | undefined>(undefined);
  nextPass = computed<PassMap | undefined>(() => this.currentPass());

  constructor(private router: Router, private route: ActivatedRoute) { }

  // ===== CON LAZY LOADING Y RETRY =====
  async ngOnInit(): Promise<void> {
    console.log('🗺️ MapComponent inicializado');
    // 🚀 ASEGURAR UBICACIÓN REAL ANTES DE TODO
    try {
      console.log('📍 Verificando ubicación real para mapa...');
      await this.locationService.getUserLocation();

      const userLoc = this.locationService.location();
      console.log('🗺️ Ubicación para mapa:', userLoc);

      if (userLoc && userLoc.detected) {
        console.log(`✅ Mapa usará ubicación GPS: ${userLoc.city} (${userLoc.accuracy}m precisión)`);
      }
    } catch (error) {
      console.log('⚠️ Error ubicación para mapa, usando Barcelona');
    }

    // 🚀 CARGA INMEDIATA para pases del mapa
    try {
      const userLoc = this.locationService.location();
      if (userLoc) {
        console.log('🔍 Cargando pases INMEDIATAMENTE para mapa...');
        await this.passesService.getRealPasses(userLoc.latitude, userLoc.longitude);
      }

      const availablePasses = this.allPasses();
      console.log('🗺️ Pases disponibles para Map:', availablePasses.length);

    } catch (error) {
      console.error('❌ Error cargando pases para mapa:', error);
    }

    // 🔄 GESTIÓN DE QUERY PARAMS CON RETRY
    this.route.queryParams.subscribe(params => {
      const passId = params['passId'];

      const setupPass = () => {
        const availablePasses = this.allPasses();
        console.log(`🔍 Intentando setup de pase. Disponibles: ${availablePasses.length}`);

        if (availablePasses.length === 0) {
          console.log('⏳ No hay pases aún, retry en 1s...');
          setTimeout(setupPass, 1000);
          return;
        }

        let selectedPass: PassMap;

        if (passId && availablePasses.length > 0) {
          selectedPass = availablePasses.find(p => p.id === passId) || availablePasses[0];
          console.log(`🎯 Mostrando pase específico: ${passId}`);
        } else {
          selectedPass = availablePasses[0];
          console.log('🏠 Mostrando primer pase disponible');
        }

        this.currentPass.set(selectedPass);
        this.updateMapForPass(selectedPass);
      };

      // Empezar el setup con un pequeño delay
      setupPass();
    });
  }

  initialZoom = signal<number>(12);

  // ===== COORDENADAS DINÁMICAS =====
  /* updateMapForPass(pass: PassMap) {
     console.log(`🛰️ Actualizando mapa para pase: ${pass.id}`);
     console.log(`📍 From: ${pass.from}, To: ${pass.to}`);
 
     // Calcular coordenadas dinámicamente
     const startCoords = this.getLandmarkCoordinates(pass.from);
     const endCoords = this.getLandmarkCoordinates(pass.to);
     const userCoords = this.userLocation();
 
     console.log(`🎯 Coordenadas calculadas:`, { user: userCoords, start: startCoords, end: endCoords });
 
     this.issStartPoint.set(startCoords);
     this.issEndPoint.set(endCoords);
 
     // Actualizar trajectory
     this.trajectoryData.set({
       type: 'Feature',
       properties: {},
       geometry: {
         type: 'LineString',
         coordinates: [startCoords, endCoords]
       }
     });
 
     if (this.map) {
       this.fitMapToShowEverything(userCoords, startCoords, endCoords);
     }
 
     if (this.movingISSMarker) {
     const [lng, lat] = startCoords;
     this.movingISSMarker.setLngLat([lng, lat]);
     console.log('🛰️ Satélite reposicionado al nuevo punto de inicio');
   }
   
 
     console.log(`✅ Trayectoria actualizada para pase ${pass.id}`);
   }*/

  /* updateMapForPass(pass: PassMap) {
    console.log(`🛰️ Actualizando mapa para pase: ${pass.id}`);
    console.log(`📍 From: ${pass.from}, To: ${pass.to}`);

    const userCoords = this.userLocation();
    
    // ✅ BUSCAR EL PASE COMPLETO con datos de azimuth
    const allPasses = this.passesService.passes();
    const fullPass = allPasses.find(p => p.id === pass.id);
    
    if (!fullPass || !fullPass.azimuth) {
      console.error('❌ No se encontró pase completo con azimuth data');
      return;
    }

    // ✅ USAR MATEMÁTICAS para calcular coordenadas
    const localRef = this.localReference.generateLocalReferences(
      userCoords[1], // lat
      userCoords[0], // lon  
      fullPass.azimuth.appear,
      fullPass.azimuth.disappear,
      50 // Elevación por defecto
    );

    const startCoords: [number, number] = localRef.startCoords;
    const endCoords: [number, number] = localRef.endCoords;

    console.log(`🎯 Coordenadas calculadas matemáticamente:`, { 
      user: userCoords, 
      start: startCoords, 
      end: endCoords 
    });

    this.issStartPoint.set(startCoords);
    this.issEndPoint.set(endCoords);

    // Actualizar trajectory
    this.trajectoryData.set({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [startCoords, endCoords]
      }
    });

    if (this.map) {
      this.fitMapToShowEverythingPerfect(userCoords, startCoords, endCoords);
    }

    if (this.movingISSMarker) {
      const [lng, lat] = startCoords;
      this.movingISSMarker.setLngLat([lng, lat]);
      console.log('🛰️ Satélite reposicionado al nuevo punto de inicio matemático');
    }

    console.log(`✅ Trayectoria actualizada matemáticamente para pase ${pass.id}`);
  } */

  updateMapForPass(pass: PassMap) {
    console.log(`🛰️ Actualizando mapa para pase: ${pass.id}`);

    // 1) Ubicación real (sin defaults)
    const u = this.locationService.location();
    if (!u) {
      console.warn('[map] No hay user location aún; esperando...');
      return; // tu setup/retry ya volverá a llamar
    }
    const userLonLat: [number, number] = [u.longitude, u.latitude];

    // 2) Pase completo con azimuth
    const full = this.passesService.passes().find(p => p.id === pass.id);
    if (!full?.azimuth) {
      console.warn('[map] Pase sin azimuth; no se puede dibujar');
      return;
    }

    // 3) Calcular start/end con tu LocalReference (userLat, userLon)
    const ref = this.localReference.generateLocalReferences(
      u.latitude,
      u.longitude,
      full.azimuth.appear,
      full.azimuth.disappear,
      50 // o tu maxElevation si la tienes
    );

    const start: [number, number] = ref.startCoords; // [lon, lat]
    const end: [number, number] = ref.endCoords;   // [lon, lat]

    this.issStartPoint.set(start);
    this.issEndPoint.set(end);
    this.trajectoryData.set({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [start, end] }
    });

    if (this.map) this.fitMapToShowEverythingPerfect(userLonLat, start, end);

    if (this.movingISSMarker) {
      this.movingISSMarker.setLngLat(start);
    }

    console.log(`✅ Trayectoria actualizada para pase ${pass.id}`, { user: userLonLat, start, end });
  }


  /*private fitMapToShowEverything(
    userCoords: [number, number], 
    startCoords: [number, number], 
    endCoords: [number, number]
  ) {
    if (!this.map) return;
  
    // 🎯 SIEMPRE centrar en el USUARIO como referencia
    const userLat = userCoords[1];
    const userLon = userCoords[0];
    
    // Calcular distancia máxima desde usuario a puntos ISS
    const distanceToStart = this.calculateDistance(userCoords, startCoords);
    const distanceToEnd = this.calculateDistance(userCoords, endCoords);
    const maxDistance = Math.max(distanceToStart, distanceToEnd);
    
    const isMobile = window.innerWidth <= 768;
    
    // 🎯 Zoom inteligente basado en distancia desde usuario
    let zoom = 12;
    if (maxDistance < 3) zoom = isMobile ? 14 : 13;        // Muy cerca
    else if (maxDistance < 8) zoom = isMobile ? 13 : 12;   // Cerca  
    else if (maxDistance < 15) zoom = isMobile ? 12 : 11;  // Normal
    else zoom = isMobile ? 11 : 10;                        // Lejos
    
    // 🎯 CENTRAR EN USUARIO, no en bounds automáticos
    this.map.flyTo({
      center: userCoords,  // Usuario SIEMPRE en el centro
      zoom,
      duration: 800,       // Suave y rápido
      essential: true      // No cancelable
    });
    
    console.log(`🎯 Zoom ${zoom} centrado en USUARIO (distancia max: ${maxDistance.toFixed(1)}km)`);
  }*/

  private fitMapToShowEverythingPerfect(
    userCoords: [number, number],
    startCoords: [number, number],
    endCoords: [number, number]
  ) {
    if (!this.map) return;

    // 🎯 ZOOM PERFECTO CENTRADO EN USUARIO
    const isMobile = window.innerWidth <= 768;
    const perfectZoom = isMobile ? 15 : 13; // Calles visibles

    console.log(`🎯 Zoom perfecto: ${perfectZoom} (mobile: ${isMobile})`);

    // 🎯 SIEMPRE CENTRAR EN USUARIO
    this.map.flyTo({
      center: userCoords,  // Usuario SIEMPRE en el centro
      zoom: perfectZoom,   // Zoom fijo perfecto
      duration: 800,       // Suave y rápido
      essential: true      // No cancelable
    });

    console.log(`🎯 Mapa centrado en usuario con zoom ${perfectZoom}`);
  }

  // 🔧 MÉTODO AUXILIAR: Calcular distancia
  /*private calculateDistance(point1: [number, number], point2: [number, number]): number {
    const [lon1, lat1] = point1;
    const [lon2, lat2] = point2;
    
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
              
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
    /**
     * 📍 Centrar mapa en usuario (botón adicional)
     */
  /* centerOnUser() {
     if (!this.map) return;
     
     const userCoords = this.userLocation();
     this.map.flyTo({
       center: userCoords,
       zoom: 15,
       duration: 1500
     });
     
     console.log('📍 Mapa centrado en usuario');
   }*/

  /**
   * 🛰️ Centrar en el pase (botón adicional) 
   */
  /*centerOnPass() {
    if (!this.map) return;
    
    const startCoords = this.issStartPoint();
    const endCoords = this.issEndPoint();
    
    // Centro entre start y end
    const centerLng = (startCoords[0] + endCoords[0]) / 2;
    const centerLat = (startCoords[1] + endCoords[1]) / 2;
    
    this.map.flyTo({
      center: [centerLng, centerLat],
      zoom: 13,
      duration: 1500
    });
    
    console.log('🛰️ Mapa centrado en pase ISS');
  }*/

  /**
   * 🏙️ Coordenadas reales de Barcelona
   */
  /* private getLandmarkCoordinates(landmark: string): [number, number] {
     const coordinates: Record<string, [number, number]> = {
       'Tibidabo': [2.120, 41.422],
       'Collserola': [2.100, 41.420],
       'Sagrada Família': [2.174, 41.404],
       'Sant Adrià': [2.220, 41.430],
       'Barceloneta': [2.189, 41.379],
       'Montjuïc': [2.166, 41.363],
       'Hospital Clínic': [2.153, 41.390],
       'Zona Universitària': [2.114, 41.387],
       'Park Güell': [2.153, 41.414],
       'Port Vell': [2.182, 41.377],
       'Diagonal': [2.158, 41.397],
       'Eixample': [2.165, 41.395]
     };
 
     return coordinates[landmark] || [2.169, 41.387]; // Centro Barcelona
   }*/

  ngOnDestroy(): void {
    // Cleanup si es necesario
  }

  // ===== TUS MÉTODOS ORIGINALES =====
  goBack() {
    this.router.navigate(['/home']);
  }

  toggleMapStyle() {
    const curr = this.currentStyle();
    this.currentStyle.set(
      curr === this.mapStyles.streets ? this.mapStyles.night
        : curr === this.mapStyles.night ? this.mapStyles.satellite
          : this.mapStyles.streets
    );
  }

  onMapLoad(evt: any) {
    this.map = evt.target as mapboxgl.Map;
    console.log('🗺️ Mapa cargado, creando marker animado');

    try {
      const el = document.createElement('div');
      el.textContent = '🛰️';
      el.className = 'iss-animated-marker';
      el.style.fontSize = '1.5rem';
      el.style.filter = 'drop-shadow(0 3px 8px rgba(0,0,0,0.6))';

      const [lng, lat] = this.trajectoryData().geometry.coordinates[0];

      this.movingISSMarker = new mapboxgl.Marker(el)
        .setLngLat(new mapboxgl.LngLat(lng, lat))
        .addTo(this.map);

      console.log('✅ Marcador ISS creado correctamente');
    } catch (error) {
      console.error('❌ Error creando marcador ISS:', error);
    }
  }

  startISSFlight() {
    if (!this.map || !this.movingISSMarker || this.animationRunning()) {
      console.log('⚠️ No se puede iniciar animación');
      return;
    }

    this.animationRunning.set(true);
    console.log('🚀 Iniciando animación de vuelo ISS');

    const [start, end] = this.trajectoryData().geometry.coordinates;
    const duration = 5000;
    const t0 = Date.now();

    const frame = () => {
      try {
        const t = Math.min((Date.now() - t0) / duration, 1);
        const lng = start[0] + (end[0] - start[0]) * t;
        const lat = start[1] + (end[1] - start[1]) * t;

        if (this.movingISSMarker) {
          this.movingISSMarker.setLngLat([lng, lat]);
        }

        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          this.animationRunning.set(false);
          console.log('✅ ISS ha completado el pase');
        }
      } catch (error) {
        console.error('❌ Error en animación:', error);
        this.animationRunning.set(false);
      }
    };

    requestAnimationFrame(frame);
  }

  getNextPassTime() {
    return this.nextPass()?.time
      .toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) ?? '--:--';
  }

  getNextPassDuration() {
    return this.nextPass()?.duration ?? 0;
  }

  getTimeUntilPass() {
    const np = this.nextPass();
    if (!np) return '--';
    const diff = np.time.getTime() - Date.now();
    const h = Math.floor(diff / 3600e3), m = Math.floor((diff % 3600e3) / 60e3);
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }

  getViewIcon(): string {
    const c = this.currentStyle();
    return c === this.mapStyles.streets
      ? 'bi bi-moon-fill'
      : c === this.mapStyles.night
        ? 'bi bi-globe'
        : 'bi bi-sun-fill';
  }

  getViewName(): string {
    const c = this.currentStyle();
    if (c === this.mapStyles.streets) return 'Oscuro';
    if (c === this.mapStyles.night) return 'Satélite';
    return 'Claro';
  }
}