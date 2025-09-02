// src/app/features/iss/iss.component.ts
import { Component, OnInit, OnDestroy, computed, inject, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';
import mapboxgl from 'mapbox-gl';
import { environment } from '../../../environments/environment';
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
  private issService = inject(ISSSimpleService);
  private locationService = inject(LocationSimpleService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private scrollTimer?: ReturnType<typeof setTimeout>;
  private issPageEl?: HTMLElement;
  private scrollContainer?: HTMLElement;

  private previousDistance?: number;

  private onScroll = (e: Event) => {
    const el = e.target as HTMLElement;
    this.showScrollButton.set(el.scrollTop > 200);
  };


  // Datos
  issPosition = this.issService.position;
  userLocation = this.locationService.location;
  locationStatus = this.locationService.status;
  retriesLeft = this.locationService.retriesLeft;

  isRefreshing = signal(false);
  showScrollButton = signal(false);
  // Global View si: ?showISSNow=true ó no hay ubicación tras agotar reintentos
  isGlobalView = computed(() => {
    const showISSNow = this.route.snapshot.queryParamMap.get('showISSNow');
    const forced = showISSNow === 'true';
    const noLocFinal = this.locationStatus() === 'failed' && this.retriesLeft() === 0;
    const hasNoUser = !this.userLocation();
    return forced || (noLocFinal && hasNoUser);
  });

  // Métricas solo si hay usuario
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

  /*directionIcon = computed(() => {
    const b = this.bearing();
    if (b >= 315 || b < 45) return '↓';
    if (b >= 45 && b < 135) return '↙️';
    if (b >= 135 && b < 225) return '↑';
    return '↘️';
  });*/

  movement = computed(() => {
    const userLoc = this.userLocation();
    const issPos = this.issPosition();
    if (!userLoc || !issPos) return 'Unknown';

    // Calcular distancia actual
    const currentDistance = this.issService.calculateDistanceFromUser(userLoc.latitude, userLoc.longitude);

    // Si no hay distancia previa, devolver Unknown
    if (!this.previousDistance) {
      this.previousDistance = currentDistance;
      return 'Unknown';
    }

    const diff = currentDistance - this.previousDistance;
    this.previousDistance = currentDistance;

    // Umbral anti-ruido
    if (Math.abs(diff) < 2) return 'Passing by';

    return diff < 0 ? 'Getting closer' : 'Moving away';
  });

  // Mapbox
  mapboxToken = environment.mapboxToken;
  private worldMap?: mapboxgl.Map;

  issWorldPosition = computed<[number, number]>(() => {
    const issPos = this.issPosition();
    if (!issPos) return [0, 0];
    return [issPos.longitude, issPos.latitude];
  });

  // En Global View NO pintamos el pin del usuario
  showUserMarker = computed(() => !!this.userLocation() && !this.isGlobalView());

  userWorldPosition = computed<[number, number]>(() => {
    const userLoc = this.userLocation();
    if (!userLoc) return [2.1734, 41.3851]; // (no se usa si showUserMarker() === false)
    return [userLoc.longitude, userLoc.latitude];
  });

  // Centro del mapa (si no hay user, centramos en la ISS)
  issWorldCenter = computed<[number, number]>(() => {
    const issPos = this.issWorldPosition();
    if (!this.showUserMarker()) return issPos;
    const userPos = this.userWorldPosition();
    return [(issPos[0] + userPos[0]) / 2, (issPos[1] + userPos[1]) / 2];
  });

  connectionLineData = computed(() => {
    const issPos = this.issWorldPosition();
    const userPos = this.userWorldPosition();
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: [userPos, issPos] }
    };
  });

  animationDirection = computed(() => {
    const mov = this.movement();
    if (mov === 'Getting closer') return 'toward-you';
    if (mov === 'Moving away') return 'away-from-you';
    return 'neutral'; // Passing by / Unknown
  });

  ngOnInit(): void {
    console.log('🛰️ ISS Component iniciado');
    this.issService.startTracking();

    /* this.scrollTimer = setTimeout(() => {
       this.issPageEl = document.querySelector('.iss-page') as HTMLElement | null || undefined;
       this.issPageEl?.addEventListener('scroll', this.onScroll, { passive: true });
     }, 100);*/
    this.scrollTimer = setTimeout(() => {
      this.scrollContainer =
        document.querySelector('.main-content') as HTMLElement
        ?? (document.querySelector('.iss-page') as HTMLElement | null)
        ?? undefined;

      this.scrollContainer?.addEventListener('scroll', this.onScroll, { passive: true });
    }, 100);

  }

  ngOnDestroy(): void {
    console.log('🛰️ ISS Component destruido');
    this.issService.stopTracking();
    /* const issPageElement = document.querySelector('.iss-page');
     if (issPageElement) {
       issPageElement.removeEventListener('scroll', this.handleScroll);
     }*/
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    /* this.issPageEl?.removeEventListener('scroll', this.onScroll);
     this.issPageEl = undefined;*/
    this.scrollContainer?.removeEventListener('scroll', this.onScroll);
    this.scrollContainer = undefined;
  }

  onWorldMapLoad(evt: any): void {
    this.worldMap = evt.target as mapboxgl.Map;
    setTimeout(() => this.fitMapToPoints(), 600);

  }

  private fitMapToPoints(): void {
    if (!this.worldMap) return;
    const issPos = this.issWorldPosition();

    if (!this.showUserMarker()) {
      // Global View → centramos en ISS
      this.worldMap.setZoom(2);
      this.worldMap.setCenter(issPos);
      return;
    }

    const userPos = this.userWorldPosition();
    const bounds = new mapboxgl.LngLatBounds().extend(issPos).extend(userPos);
    this.worldMap.fitBounds(bounds, { padding: 60, maxZoom: 4, duration: 1200, essential: false });
  }

  goBack(): void { this.router.navigate(['/home']); }

  /* refreshData(): void {
     this.issService.getCurrentPosition().then(() => setTimeout(() => this.fitMapToPoints(), 200));
   }*/
  async refreshData(): Promise<void> {
    if (this.isRefreshing()) return;

    this.isRefreshing.set(true);

    try {
      await this.issService.getCurrentPosition();
      setTimeout(() => this.fitMapToPoints(), 200);
    } catch (error) {
      console.error('Error refreshing ISS data:', error);
    } finally {
      // Mínimo 600ms para feedback visual como en Alerts
      setTimeout(() => this.isRefreshing.set(false), 600);
    }
  }

  // Helpers UI
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
    if (issPos.latitude > 50) return 'Northern regions';
    if (issPos.latitude < -50) return 'Southern regions';
    if (Math.abs(issPos.longitude) < 30 && Math.abs(issPos.latitude) < 50) return 'Europe/Africa';
    if (issPos.longitude > 30 && issPos.longitude < 140) return 'Asia';
    if (issPos.longitude > 140 || issPos.longitude < -140) return 'Pacific Ocean';
    if (issPos.longitude > -140 && issPos.longitude < -30) return 'Americas';
    return 'Ocean';
  }

  scrollToTop(): void {
    if (this.scrollContainer) {
      this.scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}