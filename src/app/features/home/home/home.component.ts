// src/app/features/home/home.component.ts

import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PassHome } from '../../../interfaces/pass.interface';
import { bearingToCardinal } from '../../../utils/geodesy';
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
  private router = inject(Router);

  realISSPosition = this.issService.position;
  notificationsEnabled = computed(() => this.notificationService.isEnabled);

  // Señales de estado
  loadedOnce = signal(false);
  isRetrying = signal(false);

  // Cooldown para el botón "Try again" en Home simplificada
  cooldownRemaining = signal(0);
  private cooldownTimer: any = null;

  // === Ubicación / Overlay ===
  locationStatus = this.locationService.status;
  canRetry = this.locationService.canRetry;
  retriesLeft = this.locationService.retriesLeft;

  hasValidLocation = computed(() => {
    const status = this.locationStatus();
    const loc = this.locationService.location();

    // durante loading inicial no bloqueamos UI
    if (status === 'loading') {
      if (loc && loc.latitude !== 0 && loc.longitude !== 0) {
        document.body.classList.remove('location-required');
        return true;
      }
      // Sin ubicación aún, mantener neutral
      return false; // Esto evita mostrar home completa prematuramente
    }

    if (status === 'success') {
      const isValid = !!loc && loc.latitude !== 0 && loc.longitude !== 0;
      if (isValid) document.body.classList.remove('location-required');
      else document.body.classList.add('location-required');
      return isValid;
    }

    // failed
    document.body.classList.add('location-required');
    return false;
  });

  // overlay solo si quedan reintentos
  shouldShowOverlay = computed(() =>
    this.locationStatus() === 'failed' &&
    this.retriesLeft() > 0 &&
    !this.hasValidLocation() // ⬅️ evita overlay si ya tenemos lat/lon válidos
  );


  // estado final sin ubicación → Home simplificada
  isNoLocationFinal = computed(() => this.locationStatus() === 'failed' && this.retriesLeft() === 0);

  isNoLocationOrLocked = computed(() => {
    const s = this.locationStatus();
    const left = this.retriesLeft();
    // 🔒 Si no quedan intentos, mostramos SIEMPRE la Home simplificada,
    // incluso si el estado transitorio es 'loading'
    return left === 0 && (s === 'failed' || s === 'loading');
  });

  // Config texto overlay en función de los intentos
  overlayConfig = computed(() => {
    const left = this.retriesLeft();
    if (left >= 2) {
      return {
        title: 'Oops!',
        message: 'We need to locate you to show ISS passes nearby.',
        buttonText: 'Try again',
      };
    }
    if (left === 1) {
      return {
        title: 'Last try',
        message: 'Still no luck with internet-based location.',
        buttonText: 'Try again',
      };
    }
    // No se usa (no hay overlay cuando 0)
    return {
      title: 'Location unavailable',
      message: 'Please try later.',
      buttonText: 'Close',
    };
  });

  // PASES visibles — sólo si hay ubicación válida
  visiblePasses = computed(() => (this.hasValidLocation() ? this.passesService.passes() : []));
  usingCache = computed(() => {
    const arr = this.visiblePasses();
    return (arr?.length ?? 0) > 0 && arr.every(p => (p.reason ?? '').toLowerCase().includes('cached'));
  });
  isEmpty = computed(() => this.loadedOnce() && this.visiblePasses().length === 0);

  // Badges / helper UI
  locationBadge = computed(() => {
    const status = this.locationStatus();
    const loc = this.locationService.location();
    if (status === 'loading') return '📍 Getting location...';
    if (status === 'failed') return '📍 Location unavailable';
    if (!loc) return '📍 Getting location...';
    return loc.detected ? `📍 ${loc.city}` : `📍 ≈ ${loc.city}`;
  });

  currentDistance = computed(() => {
    const userLoc = this.locationService.location();
    if (!userLoc || (userLoc.latitude === 0 && userLoc.longitude === 0)) return null;
    return Math.round(this.issService.calculateDistanceFromUser(userLoc.latitude, userLoc.longitude));
  });

  distanceDescription = computed(() => {
    const distance = this.currentDistance();
    if (distance === null) return 'Enable location to see distance';
    if (distance < 500) return 'Very close, perfect for viewing!';
    if (distance < 800) return 'Good distance for observation';
    return 'A bit far!';
  });

  issDirection = computed(() => {
    const userLoc = this.locationService.location();
    if (!userLoc) return { cardinal: 'Unknown', bearing: 0 };
    const bearing = this.issService.calculateBearingFromUser(userLoc.latitude, userLoc.longitude);
    return { cardinal: bearingToCardinal(bearing), bearing };
  });

  issMovement = computed(() => {
    const userLoc = this.locationService.location();
    const issPos = this.realISSPosition();
    if (!userLoc || !issPos) return 'Unknown';

    const latDiff = Math.abs(issPos.latitude - userLoc.latitude);
    const lonDiff = Math.abs(issPos.longitude - userLoc.longitude);
    if (lonDiff > 90) return issPos.velocity > 25000 ? 'Moving away' : 'Approaching';
    return latDiff < 45 ? 'Getting closer' : 'Moving away';
  });

  constructor() { }

  async ngOnInit(): Promise<void> {
    try {
      console.log('🏠 Home init');

      const exhausted = this.retriesLeft() === 0 && this.locationStatus() !== 'success';

      if (!exhausted) {
        await this.locationService.getUserLocation();
      } else {
        // Mostrar directamente Home simplificada, sin parpadeos
        this.loadedOnce.set(true);
      }

      // El tracking de ISS no molesta aunque no haya user location
      this.issService.startTracking();

      const userLocation = this.locationService.location();

      if (userLocation) {
        // Carga de pases sólo si hay ubicación válida
        setTimeout(async () => {
          try {
            await this.passesService.getRealPasses(userLocation.latitude, userLocation.longitude);
            const passes = this.passesService.passes();
            if (passes.length > 0 && this.notificationService.isEnabled) {
              this.notificationService.scheduleNotificationsForPasses(passes);
            }
          } catch (err) {
            console.error('❌ Error cargando pases:', err);
          } finally {
            this.loadedOnce.set(true);
          }
        }, 800);
      } else if (!exhausted) {
        // Está en loading: loadedOnce se pondrá a true en el setTimeout de arriba
      } else {
        // Exhausted sin ubicación
        this.loadedOnce.set(true);
      }
    } catch {
      this.loadedOnce.set(true);
    }
  }


 /* ngOnDestroy(): void {
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.issService.stopTracking();
  }*/
 ngOnDestroy(): void {
  if (this.cooldownTimer) clearInterval(this.cooldownTimer);
  document.body.classList.remove('location-required'); // ← añadir
  this.issService.stopTracking();
}


  // ==== Navegación / acciones ====
  goToMapWithPass(pass: PassHome) {
    this.router.navigate(['/map'], { queryParams: { passId: pass.id } });
  }

  goToMap() { this.router.navigate(['/map']); }

 /* showISSNow() {
    this.router.navigate(['/iss'], { queryParams: { showISSNow: 'true' } });
  }*/
 showISSNow() {
  if (this.hasValidLocation()) {
    this.router.navigate(['/iss']);                   // vista completa
  } else {
    this.router.navigate(['/iss'], { queryParams: { showISSNow: 'true' } }); // Global View
  }
}


  async toggleNotifications(): Promise<void> {
    const enabled = await this.notificationService.toggleNotifications();
    if (enabled) {
      const passes = this.passesService.passes();
      if (passes.length > 0) this.notificationService.scheduleNotificationsForPasses(passes);
    }
  }

  async refreshData() {
    this.notificationService.clearAllNotifications();
    try {
      await this.issService.getCurrentPosition();
      await this.locationService.getUserLocation();
      const userLocation = this.locationService.location();
      if (userLocation) {
        setTimeout(async () => {
          await this.passesService.refreshPasses(userLocation.latitude, userLocation.longitude);
        }, 500);
      }
    } catch (e) {
      console.error('❌ Error refrescando datos:', e);
    }
    if (this.notificationService.isEnabled) {
      const passes = this.passesService.passes();
      this.notificationService.scheduleNotificationsForPasses(passes);
    }
  }

  isNightTime(passTime: Date): boolean {
    const hour = passTime.getHours();
    return hour >= 19 || hour <= 7;
  }

  // Overlay retry
  async retryLocation() {
    if (this.isRetrying()) return;
    this.isRetrying.set(true);
    try {
      await this.locationService.retryWithIPOnly();
      const userLocation = this.locationService.location();
      if (userLocation && userLocation.latitude !== 0 && userLocation.longitude !== 0) {
        await this.passesService.getRealPasses(userLocation.latitude, userLocation.longitude);
        await this.issService.getCurrentPosition();
      }
    } catch {
      // el servicio ya sumó el intento fallido
    } finally {
      this.isRetrying.set(false);
    }
  }

  // Home simplificada → Retry con cooldown
  async retryApproxFromHome() {
    if (this.isRetrying() || this.cooldownRemaining() > 0) return;

    this.isRetrying.set(true);
    try {
      await this.locationService.retryWithIPOnly();
      const userLocation = this.locationService.location();
      if (userLocation) {
        await this.passesService.getRealPasses(userLocation.latitude, userLocation.longitude);
        await this.issService.getCurrentPosition();
      }
    } catch {
      // Si falla, arrancamos cooldown para evitar spam
      this.startCooldown(45);
    } finally {
      this.isRetrying.set(false);
    }
  }

  private startCooldown(seconds: number) {
    this.cooldownRemaining.set(seconds);
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      const left = this.cooldownRemaining();
      if (left <= 1) {
        this.cooldownRemaining.set(0);
        clearInterval(this.cooldownTimer);
        this.cooldownTimer = null;
      } else {
        this.cooldownRemaining.set(left - 1);
      }
    }, 1000);
  }
}