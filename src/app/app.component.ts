// app.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'ISS Tracker';
  
  currentRoute = 'home';
  
  // Opciones de navegación para BOTTOM NAV
  navItems = [
    {
      id: 'home',
      label: 'Inicio',
      icon: 'bi bi-house-fill',
      color: '#64ffda',
      route: '/home'
    },
    {
      id: 'map',
      label: 'Mapa',
      icon: 'bi bi-map-fill',
      color: '#2196F3',
      route: '/map'
    },
    {
      id: 'history',
      label: 'Historial',
      icon: 'bi bi-clock-history',
      color: '#F44336',
      route: '/history'
    },
    {
      id: 'alerts',
      label: 'Alertas',
      icon: 'bi bi-bell-fill',
      color: '#FFC107',
      route: '/alerts'
    }
  ];

  constructor(private router: Router) {}

  navigateTo(navItem: any) {
    this.currentRoute = navItem.id;
    this.router.navigate([navItem.route]);
  }

  isActive(routeId: string): boolean {
    return this.currentRoute === routeId;
  }
}