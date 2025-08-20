// src/app/features/home/home.component.ts - FINAL CON LAZY LOADING

import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PassHome } from '../../../interfaces/pass.interface';
import { calculateBearing, bearingToCardinal, BARCELONA_PLACES } from '../../../utils/geodesy';
import { ISSSimpleService } from '../../../services/iss-simple.service';
import { LocationSimpleService } from '../../../services/location-simple.service';
import { ISSPassesService } from '../../../services/iss-passes.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {

  private issService = inject(ISSSimpleService);
  private locationService = inject(LocationSimpleService);
  private passesService = inject(ISSPassesService);
  private notificationService = inject(NotificationService);

  realISSPosition = this.issService.position;
  notificationsEnabled = computed(() => this.notificationService.isEnabled);

  visiblePasses = this.passesService.passes;
  loadedOnce = signal(false);

  usingCache = computed(() => {
    const arr = this.visiblePasses();
    return (arr?.length ?? 0) > 0 && arr.every(p => (p.reason ?? '').toLowerCase().includes('cached'));
  });

  isEmpty = computed(() =>
    this.loadedOnce() && this.visiblePasses().length === 0
  );

  retry = () => this.refreshData();

  currentDistance = computed(() => {
    const userLoc = this.locationService.location();
    if (!userLoc) return 420;

    return Math.round(this.issService.calculateDistanceFromUser(userLoc.latitude, userLoc.longitude));
  });

  /*locationBadge = computed(() => {
    const location = this.locationService.location();
    if (!location) return '📍 Getting location...';

    if (location.detected) {
      return `📍 ${location.city}`;
    } else {
      return `📍 ${location.city} (Default)`;
    }
  });*/
  // home.component.ts
  locationBadge = computed(() => {
    const loc = this.locationService.location();
    if (!loc) return '📍 Getting location...';
    return loc.detected ? `📍 ${loc.city}` : `📍 ≈ ${loc.city}`; // ≈ cuando no es GPS
  });


  distanceDescription = computed(() => {
    const distance = this.currentDistance();
    if (distance < 500) return "Very close, perfect for viewing!";
    if (distance < 800) return "Good distance for observation";
    return "A bit far!";
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

  constructor(private router: Router) { }

  // ===== CON LAZY LOADING =====
  async ngOnInit(): Promise<void> {
    try {
      console.log('🏠 Iniciando Home con Satellite.js + Lazy Loading...');
      console.log('🔍 passesService:', this.passesService);

      // 1. Obtener ubicación del usuario
      console.log('📍 Getting GPS location...');
      await this.locationService.getUserLocation();
      const userLocation = this.locationService.location();

      if (userLocation) {
        console.log('✅ Location obtained:', userLocation);
      } else {
        console.log('⚠️ Could not get location');
      }

      // 2. Iniciar tracking de ISS
      this.issService.startTracking();

      // 3. 🚀 LAZY LOADING DE PASES (1 segundo delay)
      if (userLocation) {
        console.log('⏳ Starting lazy loading of passes...');

        setTimeout(async () => {
          try {
            console.log('🛰️ Loading REAL passes with Satellite.js for:', userLocation.city);
            await this.passesService.getRealPasses(userLocation.latitude, userLocation.longitude);

            const passes = this.passesService.passes();
            console.log('📋 Passes loaded with lazy loading:', passes.length);

            if (passes.length > 0) {
              console.log('🎉 ¡LAZY LOADING EXITOSO! Pases disponibles');
              if (this.notificationService.isEnabled) {
                this.notificationService.scheduleNotificationsForPasses(passes);
              }
            }
          } catch (error) {
            console.error('❌ Error en lazy loading de pases:', error);
          } finally {
            this.loadedOnce.set(true); // ✅ éxito o fallo
          }
        }, 1000); // 1 sec delay
      } else {
        this.loadedOnce.set(true); // ✅ sin ubicación
      }

      console.log('✅ Home iniciado correctamente');
    } catch (error) {
      console.error('❌ Error iniciando Home:', error);
    }
  }

  ngOnDestroy(): void {
    this.issService.stopTracking();
  }

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
        // lazy loading 
        setTimeout(async () => {
          await this.passesService.refreshPasses(userLocation.latitude, userLocation.longitude);
        }, 500);
      }

      console.log('✅ Ubicación actualizada');
    } catch (error) {
      console.error('❌ Error obteniendo ubicación:', error);
    }
  }

  async toggleNotifications(): Promise<void> {
    console.log('🔔 Toggle notificaciones');

    const enabled = await this.notificationService.toggleNotifications();

    if (enabled) {
      // Programar notificaciones para pases existentes
      const passes = this.passesService.passes();
      if (passes.length > 0) {
        this.notificationService.scheduleNotificationsForPasses(passes);
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
    if (this.notificationService.isEnabled) {
      const passes = this.passesService.passes();
      this.notificationService.scheduleNotificationsForPasses(passes);
    }
  }

  isNightTime(passTime: Date): boolean {
    const hour = passTime.getHours();
    console.log('🌙 Checking pass time:', passTime, 'Hour:', hour); // Debug
    return hour >= 19 || hour <= 5; // 7PM - 5AM
  }
}