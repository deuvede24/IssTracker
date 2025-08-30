// src/app/features/alerts/alerts.component.ts

import { Component, OnInit, OnDestroy, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, NotificationType } from '../../../services/notification.service';
import { ISSPassesService } from '../../../services/iss-passes.service';
import { LocationSimpleService } from '../../../services/location-simple.service';
import { isNightLocal } from '../../../shared/time-window.util';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alerts.component.html',
  styleUrls: ['./alerts.component.scss']
})
export class AlertsComponent implements OnInit, OnDestroy {

  private notificationService = inject(NotificationService);
  private passesService = inject(ISSPassesService);
  private locationService = inject(LocationSimpleService);

  // 📊 ESTADO
  settings = this.notificationService.notificationSettings;
  isEnabled = computed(() => this.settings().enabled);
  browserSupported = 'Notification' in window;
  refreshing = signal<boolean>(false);

  // 🎛️ TIPOS DE NOTIFICACIONES
  notificationTypes = [
    {
      id: '1week' as NotificationType,
      icon: '📅',
      title: '1 Week Before',
      description: 'Reminder to mark your calendar'
    },
    {
      id: '1day' as NotificationType,
      icon: '📆',
      title: '1 Day Before',
      description: 'Don\'t forget about tomorrow\'s pass'
    },
    {
      id: '15min' as NotificationType,
      icon: '⏰',
      title: '15 Minutes Before',
      description: 'Perfect timing to go outside'
    },
    {
      id: 'now' as NotificationType,
      icon: '🚀',
      title: 'When Pass Starts',
      description: 'ISS is visible right now!'
    }
  ];

  // 📊 COMPUTED
  scheduledCount = computed(() => {
    return this.notificationService.getScheduledNotifications().length;
  });

  enabledTypesCount = computed(() => {
    return this.notificationService.getNotificationTypesEnabled().length;
  });

  nextVisiblePasses = computed(() => {
    return this.passesService.passes().filter(pass =>
      pass.time.getTime() > Date.now() && this.isNightTime(pass.time)
    ).slice(0, 3);
  });

  // 🔧 ARREGLADO: Listener de eventos
  private notificationClickListener = (event: Event) => {
    this.handleNotificationClick(event as CustomEvent);
  };

  ngOnInit(): void {
    console.log('🔔 AlertsComponent inicializado');

    // Programar notificaciones si ya hay pases cargados
    this.scheduleNotificationsIfReady();

    // 🔧 ARREGLADO: Escuchar clicks en notificaciones
    window.addEventListener('iss-notification-click', this.notificationClickListener);
  }

  ngOnDestroy(): void {
    // 🔧 ARREGLADO: Remover listener
    window.removeEventListener('iss-notification-click', this.notificationClickListener);
  }

  // 🔄 ACCIONES PRINCIPALES
  async toggleMainNotifications(): Promise<void> {
    const enabled = await this.notificationService.toggleNotifications();

    if (enabled) {
      console.log('🔔 Notificaciones activadas');
      this.scheduleNotificationsIfReady();
    } else {
      console.log('🔔 Notificaciones desactivadas');
    }
  }

  toggleNotificationType(type: NotificationType, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const enabled = checkbox.checked;

    this.notificationService.toggleNotificationType(type, enabled);

    // Reprogramar notificaciones con los nuevos tipos
    if (this.isEnabled()) {
      this.scheduleNotificationsIfReady();
    }
  }

  showTestNotification(): void {
    this.notificationService.showTestNotification();
  }

  async refreshNotifications(): Promise<void> {
    console.log('🔄 Refreshing notifications...');

    //estado loading
    this.refreshing.set(true);

    // Asegurar que tenemos ubicación y pases actualizados
    try {
      await this.locationService.getUserLocation();
      const userLocation = this.locationService.location();

      if (userLocation) {
        await this.passesService.refreshPasses(userLocation.latitude, userLocation.longitude);
        this.scheduleNotificationsIfReady();
        console.log('✅ Notifications refreshed');
      }

      // 🔧 NUEVO: Feedback visual 
      setTimeout(() => {
        this.refreshing.set(false);
      }, 800);
    } catch (error) {
      console.error('❌ Error refreshing notifications:', error);
    }
  }

  // 🔧 HELPERS
  private scheduleNotificationsIfReady(): void {
    const passes = this.passesService.passes();

    if (passes.length > 0 && this.isEnabled()) {
      //  this.notificationService.scheduleNotificationsForPasses(passes);
      const userLocation = this.locationService.location();
      if (userLocation) {
        this.notificationService.scheduleNotificationsForPasses(passes, userLocation.latitude);
      }

    }
  }

  isTypeEnabled(type: NotificationType): boolean {
    return this.settings().types[type];
  }

  getStatusDescription(): string {
    if (!this.browserSupported) {
      return 'Your browser doesn\'t support notifications';
    }

    if (!this.isEnabled()) {
      return 'Tap Enable to get alerts before ISS passes';
    }

    const enabledTypes = this.enabledTypesCount();
    const scheduled = this.scheduledCount();

    return `${enabledTypes} notification types active • ${scheduled} alerts scheduled`;
  }

  // 🔧 ARREGLADO: Manejar click en notificación
  private handleNotificationClick(event: CustomEvent): void {
    const { pass, type } = event.detail;
    console.log('🔔 Notification clicked:', type, pass?.id);

    // El user decidirá por sí mismo si quiere abrir la app
    // Notificación cumple su función: informar
  }

  /* private isNightTime(date: Date): boolean {
     const hour = date.getHours();
     return hour >= 19 || hour <= 5;
   }*/
  private isNightTime(date: Date): boolean {
    const lat = this.locationService.location()?.latitude ?? 35;
    return isNightLocal(date, lat);
  }

}