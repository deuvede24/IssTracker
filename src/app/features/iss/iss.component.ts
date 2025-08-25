// src/app/features/iss/iss.component.ts
import { Component, OnInit, OnDestroy, computed, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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

  // Datos
  issPosition = this.issService.position;
  userLocation = this.locationService.location;
  locationStatus = this.locationService.status;
  retriesLeft = this.locationService.retriesLeft;

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
  directionIcon = computed(() => {
    const b = this.bearing();
    if (b >= 315 || b < 45) return '↓';
    if (b >= 45 && b < 135) return '↙️';
    if (b >= 135 && b < 225) return '↑';
    return '↘️';
  });
  movement = computed(() => {
    const userLoc = this.userLocation();
    const issPos = this.issPosition();
    if (!userLoc || !issPos) return 'Unknown';
    const latDiff = Math.abs(issPos.latitude - userLoc.latitude);
    const lonDiff = Math.abs(issPos.longitude - userLoc.longitude);
    if (lonDiff > 90) return issPos.velocity > 25000 ? 'Moving away' : 'Approaching';
    return latDiff < 45 ? 'Getting closer' : 'Moving away';
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

  ngOnInit(): void {
    console.log('🛰️ ISS Component iniciado');
    this.issService.startTracking();
    // No forzamos getUserLocation() aquí para no reabrir prompts cuando estamos en Global View
  }

  ngOnDestroy(): void {
    console.log('🛰️ ISS Component destruido');
    this.issService.stopTracking();  
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

  refreshData(): void {
    this.issService.getCurrentPosition().then(() => setTimeout(() => this.fitMapToPoints(), 200));
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
}