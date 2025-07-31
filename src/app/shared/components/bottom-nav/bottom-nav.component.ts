// src/app/shared/components/bottom-nav/bottom-nav.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './bottom-nav.component.html',
  styleUrls: ['./bottom-nav.component.scss']
})
export class BottomNavComponent {
  // AQUÍ van los navItems
  navItems = [
    { id: 'home',   label: 'Home',  icon: 'bi bi-house-fill',  color: '#64ffda', route: '/home' },
    { id: 'map',    label: 'Map',   icon: 'bi bi-map-fill',    color: '#2196F3', route: '/map' },
    { id: 'iss',    label: 'ISS',   icon: 'bi bi-globe-americas', color: '#F44336', route: '/iss' },
    { id: 'alerts', label: 'Alerts',icon: 'bi bi-bell-fill',    color: '#FFC107', route: '/alerts' }
  ];
}