// src/app/features/home/home.component.ts
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface Pass {
  id: string;
  time: Date;
  duration: number;
  from: string;
  to: string;
  altitude?: string;
  brightness?: string;
  timeToPass?: string;
  description?: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  
  // ===== SIGNALS =====
  visiblePasses = signal<Pass[]>([
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
  ]);

  // Distancia actual de la ISS
  currentDistance = signal<number>(420);
  
  // Computed para descripción de distancia
  distanceDescription = computed(() => {
    const distance = this.currentDistance();
    if (distance < 500) return "Está muy cerca, ¡perfecta para verla!";
    if (distance < 800) return "A buena distancia para observar";
    return "Un poco lejos, pero visible";
  });

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.calculateTimeToPasses();
    this.updateISSDistance();
  }

  /**
   * Ir al mapa mostrando un pase específico
   */
  goToMapWithPass(pass: Pass) {
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
   * Añadir ubicación de casa
   */
  addHomeLocation() {
    // TODO: Implementar funcionalidad para añadir casa
    console.log('Añadir ubicación de casa');
    // Aquí podrías abrir un modal o navegar a una pantalla de configuración
  }

  /**
   * Activar/desactivar notificaciones
   */
  toggleNotifications() {
    // TODO: Implementar sistema de notificaciones
    console.log('Toggle notificaciones');
    // Aquí manejarías las notificaciones push o locales
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

  /**
   * Actualizar distancia de la ISS (simulado)
   */
  private updateISSDistance() {
    // Simular cambio de distancia cada 30 segundos
    setInterval(() => {
      const variation = Math.random() * 100 - 50; // ±50km
      const newDistance = Math.max(350, Math.min(800, this.currentDistance() + variation));
      this.currentDistance.set(Math.round(newDistance));
    }, 30000);
  }

  /**
   * Refrescar todos los datos
   */
  refreshData() {
    this.calculateTimeToPasses();
    this.updateISSDistance();
    console.log('Datos actualizados');
  }
}