// src/app/features/map/map.component.ts - FINAL CON COORDENADAS DINÁMICAS

import { Component, OnInit, signal, computed, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';
import mapboxgl from 'mapbox-gl';
import type { Feature, LineString, GeoJsonProperties } from 'geojson';
import { environment } from '../../../environments/environment';
import { Router, ActivatedRoute } from '@angular/router';
import { PassMap } from '../../interfaces/pass.interface';
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
    return [0, 0]; // Fallback Barcelona
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
    //  await this.locationService.getUserLocation();

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
       // await this.passesService.getRealPasses(userLoc.latitude, userLoc.longitude);
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


  updateMapForPass(pass: PassMap) {
    console.log(`🛰️ Actualizando mapa para pase: ${pass.id}`);

    // 1) Ubicación real (sin defaults)
    const u = this.locationService.location();
    if (!u) {
      console.warn('[map] No hay user location aún; esperando...');
      return;
    }
    if (u.latitude === 0 && u.longitude === 0) {
      console.warn('[map] Ubicación inválida (0,0); abortando dibujo.');
      return;
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