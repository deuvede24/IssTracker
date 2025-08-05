// src/app/features/home/home.component.ts
import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core'; // ← AÑADIR OnDestroy, inject
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PassHome } from '../../../interfaces/pass.interface';
import { calculateBearing, bearingToCardinal, BARCELONA_PLACES } from '../../../utils/geodesy';
import { ISSSimpleService } from '../../../services/iss-simple.service';
import { LocationSimpleService } from '../../../services/location-simple.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy { // ← AÑADIR OnDestroy
  
  // ===== SERVICIOS INYECTADOS ===== (NUEVO)
  private issService = inject(ISSSimpleService);
  private locationService = inject(LocationSimpleService);
  realISSPosition = this.issService.position;
  
  // ===== SIGNALS =====
  visiblePasses = signal<PassHome[]>((() => {
    // Datos base sin direcciones
    const passesRaw = [
      {
        id: '1',
        time: new Date(Date.now() + 2 * 3600000), // En 2 horas
        duration: 4,
        from: 'Hospital Clínic',
        to: 'Sagrada Família',
        altitude: 'Muy alto en el cielo',
        brightness: 'Como Venus ⭐',
        timeToPass: '2 horas y 34 minutos'
      },
      {
        id: '2',
        time: new Date(Date.now() + 8 * 3600000), // En 8 horas
        duration: 2,
        from: 'Park Güell',
        to: 'Port Vell',
        altitude: 'Bajo en el horizonte',
        brightness: 'Como un avión ✈️',
        timeToPass: '8 horas y 15 minutos'
      },
      {
        id: '3',
        time: new Date(Date.now() + 25 * 3600000), // Mañana
        duration: 6,
        from: 'Tibidabo',
        to: 'Barceloneta',
        altitude: 'Alto en el cielo',
        brightness: 'Muy brillante ⭐⭐',
        timeToPass: '1 día y 1 hora'
      }
    ];

    // Enriquecer con direcciones calculadas
    return passesRaw.map(pass => {
      const fromCoords = BARCELONA_PLACES[pass.from];
      const toCoords = BARCELONA_PLACES[pass.to];
      
      if (fromCoords && toCoords) {
        // Intercambiar from/to
        const bearing = calculateBearing(
          toCoords[1], toCoords[0],     // destino primero
          fromCoords[1], fromCoords[0]  // origen segundo
        );
        
        const fromCardinal = bearingToCardinal(bearing);
        const toCardinal = bearingToCardinal((bearing + 180) % 360);
        
        return {
          ...pass,
          direction: `${fromCardinal} → ${toCardinal}`,
          compass: bearing < 90 ? '↙️' : bearing < 180 ? '↖️' : bearing < 270 ? '↗️' : '↘️',
          azimuth: { appear: bearing, disappear: (bearing + 180) % 360 }
        };
      }
      
      return pass;
    });
  })());

  // ===== DISTANCIA REAL DE LA ISS ===== (CAMBIADO)
  currentDistance = computed(() => {
    const userLoc = this.locationService.location();
    if (!userLoc) return 420; // Fallback si no hay ubicación
    
    return Math.round(this.issService.calculateDistanceFromUser(userLoc.latitude, userLoc.longitude));
  });
  
  // ===== BADGE DE UBICACIÓN ===== (NUEVO)
  locationBadge = computed(() => {
    const location = this.locationService.location();
    if (!location) return '📍 Detecting...';
    
    return location.detected 
      ? `📍 ${location.city}`
      : `📍 ${location.city} (Default)`;
  });
  
  // Computed para descripción de distancia
  distanceDescription = computed(() => {
    const distance = this.currentDistance();
    if (distance < 500) return "Está muy cerca, ¡perfecta para verla!";
    if (distance < 800) return "A buena distancia para observar";
    return "Un poco lejos, pero visible";
  });

  // 🧭 DIRECCIÓN REAL hacia ISS
issDirection = computed(() => {
  const userLoc = this.locationService.location();
  if (!userLoc) return { cardinal: 'Unknown', bearing: 0 };
  
  const bearing = this.issService.calculateBearingFromUser(userLoc.latitude, userLoc.longitude);
  const cardinal = bearingToCardinal(bearing);
  
  return { cardinal, bearing };
});

// 🎯 ESTADO DEL MOVIMIENTO (se acerca o aleja)
issMovement = computed(() => {
  const userLoc = this.locationService.location();
  const issPos = this.realISSPosition();
  
  if (!userLoc || !issPos) return 'Unknown';
  
  // Simple heurística: si está en el hemisferio opuesto, probablemente se aleja
  const latDiff = Math.abs(issPos.latitude - userLoc.latitude);
  const lonDiff = Math.abs(issPos.longitude - userLoc.longitude);
  
  if (lonDiff > 90) {
    return issPos.velocity > 25000 ? 'Moving away' : 'Approaching';
  }
  
  return latDiff < 45 ? 'Getting closer' : 'Moving away';
});

// 🎨 ICONO DE DIRECCIÓN según bearing
directionIcon = computed(() => {
  const bearing = this.issDirection().bearing;
  
  if (bearing >= 315 || bearing < 45) return '↓'; // North -> South
  if (bearing >= 45 && bearing < 135) return '↙️'; // East -> West  
  if (bearing >= 135 && bearing < 225) return '↑'; // South -> North
  return '↘️'; // West -> East
});

  constructor(private router: Router) {}

  async ngOnInit(): Promise<void> { // ← CAMBIAR A async
    // TU CÓDIGO ORIGINAL
    this.calculateTimeToPasses();
    // this.updateISSDistance(); ← COMENTAR ESTA LÍNEA (ya no simulamos)
    
    // ===== CÓDIGO NUEVO ===== 
    try {
      console.log('🏠 Iniciando servicios reales...');
      
      // Obtener ubicación del usuario
      await this.locationService.getUserLocation();
      
      // Iniciar tracking de ISS
      this.issService.startTracking();
      
      console.log('✅ Servicios iniciados correctamente');
    } catch (error) {
      console.error('❌ Error iniciando servicios:', error);
    }
  }

  // ===== MÉTODO NUEVO ===== 
  ngOnDestroy(): void {
    this.issService.stopTracking();
  }

  /**
   * Ir al mapa mostrando un pase específico
   */
  goToMapWithPass(pass: PassHome) {
    // Navegamos al mapa y pasamos el ID del pase como parámetro
    this.router.navigate(['/map'], { 
      queryParams: { passId: pass.id } 
    });
  }

  /**
   * Ir al mapa general
   */
  goToMap() {
    this.router.navigate(['/map']);
  }

  /**
   * Ver ISS ahora en tiempo real ===== (NUEVO MÉTODO) =====
   */
  showISSNow() {
    console.log('🛰️ Mostrar ISS ahora en tiempo real');
    this.router.navigate(['/iss'], { 
      queryParams: { showISSNow: 'true' } 
    });
  }

  /**
   * Añadir ubicación de casa
   */
  async addHomeLocation() { // ← CAMBIAR A async
    console.log('🏠 Actualizando ubicación...');
    try {
      await this.locationService.getUserLocation();
      console.log('✅ Ubicación actualizada');
    } catch (error) {
      console.error('❌ Error obteniendo ubicación:', error);
    }
  }

  /**
   * Activar/desactivar notificaciones
   */
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

  /**
   * Calcular tiempo restante para cada pase
   */
  private calculateTimeToPasses() {
    const now = new Date();
    const updatedPasses = this.visiblePasses().map(pass => {
      const diff = pass.time.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      let timeToPass: string;
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        timeToPass = `${days} día${days > 1 ? 's' : ''} y ${hours % 24} horas`;
      } else if (hours > 0) {
        timeToPass = `${hours} horas y ${minutes} minutos`;
      } else {
        timeToPass = `${minutes} minutos`;
      }
      
      return { ...pass, timeToPass };
    });
    
    this.visiblePasses.set(updatedPasses);
  }

  // ===== COMENTAR ESTE MÉTODO (ya no simulamos) =====
  /*
  private updateISSDistance() {
    // Simular cambio de distancia cada 30 segundos
    setInterval(() => {
      const variation = Math.random() * 100 - 50; // ±50km
      const newDistance = Math.max(350, Math.min(800, this.currentDistance() + variation));
      this.currentDistance.set(Math.round(newDistance));
    }, 30000);
  }
  */

  /**
   * Refrescar todos los datos ===== (MEJORADO) =====
   */
  async refreshData() {
    console.log('🔄 Refrescando datos...');
    
    this.calculateTimeToPasses();
    
    // Refrescar datos reales de ISS
    try {
      await this.issService.getCurrentPosition();
      await this.locationService.getUserLocation();
      console.log('✅ Datos reales actualizados');
    } catch (error) {
      console.error('❌ Error refrescando datos:', error);
    }
  }
}