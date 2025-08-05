// src/app/features/iss/iss.component.ts
import { Component, OnInit, OnDestroy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

// Servicios
import { ISSSimpleService } from '../../services/iss-simple.service';
import { LocationSimpleService } from '../../services/location-simple.service';
import { bearingToCardinal } from '../../utils/geodesy';

@Component({
  selector: 'app-iss',
  standalone: true,
  imports: [CommonModule],
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

  refreshData(): void {
    console.log('🔄 Refrescando datos ISS...');
    this.issService.getCurrentPosition();
  }
}