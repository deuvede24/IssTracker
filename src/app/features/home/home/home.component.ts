// src/app/features/home/home.component.ts - FINAL CON LAZY LOADING

import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PassHome } from '../../../interfaces/pass.interface';
import { calculateBearing, bearingToCardinal, BARCELONA_PLACES } from '../../../utils/geodesy';
import { ISSSimpleService } from '../../../services/iss-simple.service';
import { LocationSimpleService } from '../../../services/location-simple.service';
//import { N2YOPassesService } from '../../../services/n2yo-passes.service'; // ← SOLO N2YO
import { ISSPassesService } from '../../../services/iss-passes.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {

  // ===== SOLO 3 SERVICIOS =====
  private issService = inject(ISSSimpleService);
  private locationService = inject(LocationSimpleService);
  //private n2yoService = inject(N2YOPassesService); // ← SOLO N2YO
  private passesService = inject(ISSPassesService);

  realISSPosition = this.issService.position;

  // ===== USAR SOLO N2YO =====
  //visiblePasses = this.n2yoService.passes;
  visiblePasses = this.passesService.passes;

  // ===== TU LÓGICA PERFECTA =====
  currentDistance = computed(() => {
    const userLoc = this.locationService.location();
    if (!userLoc) return 420;

    return Math.round(this.issService.calculateDistanceFromUser(userLoc.latitude, userLoc.longitude));
  });

  locationBadge = computed(() => {
    const location = this.locationService.location();
    if (!location) return '📍 Getting location...';

    if (location.detected) {
      return `📍 ${location.city}`;
    } else {
      return `📍 ${location.city} (Default)`;
    }
  });

  distanceDescription = computed(() => {
    const distance = this.currentDistance();
    if (distance < 500) return "Está muy cerca, ¡perfecta para verla!";
    if (distance < 800) return "A buena distancia para observar";
    return "Un poco lejos, pero visible";
  });

  issDirection = computed(() => {
    const userLoc = this.locationService.location();
    if (!userLoc) return { cardinal: 'Unknown', bearing: 0 };

    const bearing = this.issService.calculateBearingFromUser(userLoc.latitude, userLoc.longitude);
    const cardinal = bearingToCardinal(bearing);

    return { cardinal, bearing };
  });

  issMovement = computed(() => {
    const userLoc = this.locationService.location();
    const issPos = this.realISSPosition();

    if (!userLoc || !issPos) return 'Unknown';

    const latDiff = Math.abs(issPos.latitude - userLoc.latitude);
    const lonDiff = Math.abs(issPos.longitude - userLoc.longitude);

    if (lonDiff > 90) {
      return issPos.velocity > 25000 ? 'Moving away' : 'Approaching';
    }

    return latDiff < 45 ? 'Getting closer' : 'Moving away';
  });

  directionIcon = computed(() => {
    const bearing = this.issDirection().bearing;

    if (bearing >= 315 || bearing < 45) return '↓';
    if (bearing >= 45 && bearing < 135) return '↙️';
    if (bearing >= 135 && bearing < 225) return '↑';
    return '↘️';
  });

  constructor(private router: Router) { }

  // ===== CON LAZY LOADING =====
  async ngOnInit(): Promise<void> {
    try {
      console.log('🏠 Iniciando Home con N2YO + Lazy Loading...');
      console.log('🔍 n2yoService:', this.passesService);

      // 1. Obtener ubicación del usuario
      console.log('📍 Obteniendo ubicación GPS...');
      await this.locationService.getUserLocation();
      const userLocation = this.locationService.location();

      if (userLocation) {
        console.log('✅ Ubicación obtenida:', userLocation);
      } else {
        console.log('⚠️ No se pudo obtener ubicación');
      }

      // 2. Iniciar tracking de ISS
      this.issService.startTracking();

      // 3. 🚀 LAZY LOADING DE PASES (1 segundo delay)
      if (userLocation) {
        console.log('⏳ Iniciando lazy loading de pases...');

        setTimeout(async () => {
          try {
            console.log('🛰️ Cargando pases REALES de N2YO para:', userLocation.city);
            // await this.n2yoService.getRealPasses(userLocation.latitude, userLocation.longitude);
            await this.passesService.getRealPasses(userLocation.latitude, userLocation.longitude);

            const passes = this.passesService.passes();
            console.log('📋 Pases cargados con lazy loading:', passes.length);

            if (passes.length > 0) {
              console.log('🎉 ¡LAZY LOADING EXITOSO! Pases disponibles');
            }
          } catch (error) {
            console.error('❌ Error en lazy loading de pases:', error);
          }
        }, 1000); // 1 segundo de delay
      }

      console.log('✅ Home iniciado correctamente');
    } catch (error) {
      console.error('❌ Error iniciando Home:', error);
    }
  }

  ngOnDestroy(): void {
    this.issService.stopTracking();
  }

  // ===== TUS MÉTODOS PERFECTOS =====
  goToMapWithPass(pass: PassHome) {
    this.router.navigate(['/map'], {
      queryParams: { passId: pass.id }
    });
  }

  goToMap() {
    this.router.navigate(['/map']);
  }

  showISSNow() {
    console.log('🛰️ Mostrar ISS ahora en tiempo real');
    this.router.navigate(['/iss'], {
      queryParams: { showISSNow: 'true' }
    });
  }

  async addHomeLocation() {
    console.log('🏠 Actualizando ubicación...');
    try {
      await this.locationService.getUserLocation();
      const userLocation = this.locationService.location();

      if (userLocation) {
        // Con lazy loading también aquí
        setTimeout(async () => {
          await this.passesService.refreshPasses(userLocation.latitude, userLocation.longitude);
        }, 500);
      }

      console.log('✅ Ubicación actualizada');
    } catch (error) {
      console.error('❌ Error obteniendo ubicación:', error);
    }
  }

  toggleNotifications() {
    console.log('🔔 Toggle notificaciones');
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log('Notification permission:', permission);
        });
      }
    }
  }

  async refreshData() {
    console.log('🔄 Refrescando datos...');

    try {
      await this.issService.getCurrentPosition();
      await this.locationService.getUserLocation();
      const userLocation = this.locationService.location();

      if (userLocation) {
        // Con lazy loading para refresh
        setTimeout(async () => {
          await this.passesService.refreshPasses(userLocation.latitude, userLocation.longitude);
        }, 500);
      }

      console.log('✅ Datos REALES actualizados');
    } catch (error) {
      console.error('❌ Error refrescando datos:', error);
    }
  }

  isNightTime(passTime: Date): boolean {
    const hour = passTime.getHours();
    console.log('🌙 Checking pass time:', passTime, 'Hour:', hour); // Debug
    return hour >= 19 || hour <= 5; // 7PM - 6AM
  }
}