import { Component, OnInit, signal, computed, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';
import mapboxgl from 'mapbox-gl';
import type { Feature, LineString, GeoJsonProperties } from 'geojson';
import { environment } from '../../../environments/environment';
import { Router, ActivatedRoute } from '@angular/router'; // ← AÑADIDO ActivatedRoute
import { PassMap } from '../../interfaces/pass.interface';


/*interface Pass {
  id: string;
  time: Date;
  duration: number;
  from: string;
  to: string;
  timeToPass?: string;
}*/

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [
    CommonModule,
    NgxMapboxGLModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent implements OnInit {
  mapboxToken = environment.mapboxToken;
  private map?: mapboxgl.Map;

  userLocation: [number, number] = [2.1689, 41.3879];
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

  private movingISSMarker!: mapboxgl.Marker;
  animationRunning = signal<boolean>(false);

  // ← AÑADIDO: Array completo de pases (mismo que en home)
  allPasses = signal<PassMap[]>([
    {
      id: '1',
      time: new Date(Date.now() + 2 * 3600000),
      duration: 4,
      from: 'Hospital Clínic',
      to: 'Sagrada Família'
    },
    {
      id: '2',
      time: new Date(Date.now() + 8 * 3600000),
      duration: 2,
      from: 'Park Güell',
      to: 'Port Vell'
    },
    {
      id: '3',
      time: new Date(Date.now() + 25 * 3600000),
      duration: 6,
      from: 'Tibidabo',
      to: 'Barceloneta'
    }
  ]);

  // ← MODIFICADO: Ahora usa el pase seleccionado
  currentPass = signal<PassMap | undefined>(undefined);
  nextPass = computed<PassMap | undefined>(() => this.currentPass());

  constructor(private router: Router, private route: ActivatedRoute) { } // ← AÑADIDO route

  ngOnInit(): void {
    console.log('🗺️ MapComponent inicializado');

    // ← AÑADIDO: Leer passId de la URL
    this.route.queryParams.subscribe(params => {
      const passId = params['passId'];
      let selectedPass: PassMap;

      if (passId) {
        // Buscar pase específico
        selectedPass = this.allPasses().find(p => p.id === passId) || this.allPasses()[0];
        console.log(`🎯 Mostrando pase específico: ${passId}`);
      } else {
        // Sin passId = mostrar próximo (el primero)
        selectedPass = this.allPasses()[0];
        console.log('🏠 Mostrando próximo pase');
      }

      this.currentPass.set(selectedPass);
      this.updateMapForPass(selectedPass);
    });
  }

  // ← AÑADIDO: Actualizar coordenadas según el pase
  updateMapForPass(pass: PassMap) {
    // Coordenadas diferentes para cada pase
    const passCoordinates = {
      '1': { start: [2.15251, 41.38948], end: [2.17448, 41.40335] }, // Hospital → Sagrada
      '2': { start: [2.15365, 41.41483], end: [2.18215, 41.37716] }, // Park Güell → Port
      '3': { start: [2.12050, 41.42292], end: [2.18892, 41.37891] } // Tibidabo → Barceloneta
    };

    const coords = passCoordinates[pass.id as keyof typeof passCoordinates] || passCoordinates['1'];

    this.issStartPoint.set(coords.start as [number, number]);
    this.issEndPoint.set(coords.end as [number, number]);

    // Actualizar trajectory
    this.trajectoryData.set({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [coords.start, coords.end]
      }
    });

    console.log(`🛰️ Coordenadas actualizadas para pase ${pass.id}:`, coords);
  }

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

    const el = document.createElement('div');
    el.textContent = '🛰️';
    el.className = 'iss-animated-marker';
    el.style.fontSize = '1.5rem';
    el.style.filter = 'drop-shadow(0 3px 8px rgba(0,0,0,0.6))';

    const [lng, lat] = this.trajectoryData().geometry.coordinates[0];
    this.movingISSMarker = new mapboxgl.Marker(el)
      .setLngLat(new mapboxgl.LngLat(lng, lat))
      .addTo(this.map);
  }

  startISSFlight() {
    if (!this.map || this.animationRunning()) return;
    this.animationRunning.set(true);

    const [start, end] = this.trajectoryData().geometry.coordinates;
    const duration = 5000;
    const t0 = Date.now();

    const frame = () => {
      const t = Math.min((Date.now() - t0) / duration, 1);
      const lng = start[0] + (end[0] - start[0]) * t;
      const lat = start[1] + (end[1] - start[1]) * t;
      this.movingISSMarker.setLngLat([lng, lat]);
      if (t < 1) requestAnimationFrame(frame);
      else {
        this.animationRunning.set(false);
        console.log('🛰️ ISS ha completado el pase');
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