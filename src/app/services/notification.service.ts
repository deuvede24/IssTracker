// src/app/services/notification.service.ts

import { Injectable, signal } from '@angular/core';
import { PassHome } from '../interfaces/pass.interface';

export type NotificationType = '1week' | '1day' | '15min' | 'now';

export interface NotificationSettings {
    enabled: boolean;
    types: {
        [K in NotificationType]: boolean;
    };
}

export interface ScheduledNotification {
    id: string;
    passId: string;
    type: NotificationType;
    timeoutId: number;
    triggerTime: Date;
    pass: PassHome;
}

@Injectable({
    providedIn: 'root'
})
export class NotificationService {

    // 🎛️ ESTADO DE NOTIFICACIONES
    private settings = signal<NotificationSettings>({
        enabled: false,
        types: {
            '1week': false,
            '1day': false,
            '15min': true,  // Por defecto solo 15min
            'now': true     // Por defecto cuando comience
        }
    });

    private scheduledNotifications: ScheduledNotification[] = [];
    private readonly STORAGE_KEY = 'iss-notification-settings';

    constructor() {
        this.loadSettings();
        this.checkInitialPermissions();
    }

    // 📊 GETTERS PÚBLICOS
    get notificationSettings() {
        return this.settings.asReadonly();
    }

    get isEnabled() {
        return this.settings().enabled;
    }

    // 🔑 GESTIÓN DE PERMISOS
    async requestPermissions(): Promise<boolean> {
        if (!('Notification' in window)) {
            console.log('🔔 Notificaciones no soportadas');
            return false;
        }

        if (Notification.permission === 'granted') {
            this.settings.update(s => ({ ...s, enabled: true }));
            this.saveSettings();
            return true;
        }

        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            console.log('🔔 Permisos solicitados:', permission);

            const granted = permission === 'granted';
            this.settings.update(s => ({ ...s, enabled: granted }));
            this.saveSettings();

            if (granted) {
                this.showWelcomeNotification();
            }

            return granted;
        }

        // Permisos denegados
        return false;
    }

    private checkInitialPermissions(): void {
        if ('Notification' in window && Notification.permission === 'granted') {
            this.settings.update(s => ({ ...s, enabled: true }));
        }
    }

    // ⚙️ CONFIGURACIÓN DE TIPOS DE NOTIFICACIONES
    toggleNotificationType(type: NotificationType, enabled: boolean): void {
        this.settings.update(s => ({
            ...s,
            types: { ...s.types, [type]: enabled }
        }));
        this.saveSettings();

        console.log(`🔔 ${type} notifications: ${enabled ? 'ON' : 'OFF'}`);
    }

    async toggleNotifications(): Promise<boolean> {
        const current = this.settings();

        if (!current.enabled) {
            // Intentar activar
            return await this.requestPermissions();
        } else {
            // Desactivar
            this.settings.update(s => ({ ...s, enabled: false }));
            this.clearAllNotifications();
            this.saveSettings();
            return false;
        }
    }

    // 📅 PROGRAMACIÓN DE NOTIFICACIONES
    scheduleNotificationsForPasses(passes: PassHome[]): void {
        if (!this.isEnabled) {
            console.log('🔔 Notificaciones deshabilitadas, no programando');
            return;
        }

        // Limpiar notificaciones anteriores
        this.clearAllNotifications();

        const now = Date.now();
        const settings = this.settings();
        let scheduledCount = 0;

        console.log('🔔 Programando notificaciones para', passes.length, 'pases');

        passes.forEach(pass => {
            // Solo pases futuros y nocturnos (visibles)
            if (pass.time.getTime() > now && this.isNightTime(pass.time)) {

                // 📆 1 SEMANA ANTES
                if (settings.types['1week']) {
                    const weekBefore = pass.time.getTime() - (7 * 24 * 60 * 60 * 1000);
                    if (weekBefore > now) {
                        this.scheduleNotification(pass, '1week', weekBefore);
                        scheduledCount++;
                    }
                }

                // 📅 1 DÍA ANTES  
                if (settings.types['1day']) {
                    const dayBefore = pass.time.getTime() - (24 * 60 * 60 * 1000);
                    if (dayBefore > now) {
                        this.scheduleNotification(pass, '1day', dayBefore);
                        scheduledCount++;
                    }
                }

                // ⏰ 15 MINUTOS ANTES
                if (settings.types['15min']) {
                    const fifteenMinBefore = pass.time.getTime() - (15 * 60 * 1000);
                    if (fifteenMinBefore > now) {
                        this.scheduleNotification(pass, '15min', fifteenMinBefore);
                        scheduledCount++;
                    }
                }

                // 🚀 CUANDO COMIENCE
                if (settings.types['now']) {
                    const passStart = pass.time.getTime();
                    if (passStart > now) {
                        this.scheduleNotification(pass, 'now', passStart);
                        scheduledCount++;
                    }
                }
            }
        });

        console.log(`✅ ${scheduledCount} notificaciones programadas`);
    }

    private scheduleNotification(pass: PassHome, type: NotificationType, triggerTime: number): void {
        const timeUntilTrigger = triggerTime - Date.now();

        if (timeUntilTrigger <= 0) return;

        const notificationId = `${pass.id}-${type}`;
        const timeoutId = window.setTimeout(() => {
            this.showNotification(pass, type);
            this.removeScheduledNotification(notificationId);
        }, timeUntilTrigger);

        const scheduled: ScheduledNotification = {
            id: notificationId,
            passId: pass.id,
            type,
            timeoutId,
            triggerTime: new Date(triggerTime),
            pass
        };

        this.scheduledNotifications.push(scheduled);

        console.log(`⏰ Programada: ${type} para ${pass.time.toLocaleString()} (en ${Math.round(timeUntilTrigger / 60000)}min)`);
    }

    // 🔔 MOSTRAR NOTIFICACIONES
    private showNotification(pass: PassHome, type: NotificationType): void {
        //check notifications
        // Verificación temporal antes de mostrar
        const now = Date.now();
        const timeDiff = Math.abs(pass.time.getTime() - now);

        // Cancelar si el timing está muy desviado
        if (type === 'now' && timeDiff > 10 * 60 * 1000) { // 10 min range
            console.log('Notificación cancelada - timing incorrecto:', timeDiff / 60000, 'min');
            return;
        }
        if (!this.isEnabled || Notification.permission !== 'granted') {
            return;
        }

        const { title, body, icon } = this.getNotificationContent(pass, type);

        const notification = new Notification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: `iss-${type}-${pass.id}`,
            requireInteraction: type === '15min' || type === 'now', // Importantes no se cierran solas
            data: { passId: pass.id, type }
        });

        // Auto-cerrar notificaciones informativas
        if (type === '1week' || type === '1day') {
            setTimeout(() => notification.close(), 10000);
        } else {
            setTimeout(() => notification.close(), 30000);
        }

        // Manejar click
        notification.onclick = () => {
            window.focus();
            // Emitir evento para que el componente maneje la navegación
            window.dispatchEvent(new CustomEvent('iss-notification-click', {
                detail: { pass, type }
            }));
            notification.close();
        };
        console.log(`🔔 Mostrada notificación ${type}:`, title);
    }

    private getNotificationContent(pass: PassHome, type: NotificationType): { title: string; body: string; icon: string } {
        const timeStr = pass.time.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        switch (type) {
            case '1week':
                return {
                    title: '🛰️ ISS Pass Next Week',
                    body: `Mark your calendar! ISS visible ${timeStr}. Look ${pass.from} → ${pass.to}`,
                    icon: '/favicon.ico'
                };

            case '1day':
                return {
                    title: '🛰️ ISS Pass Tomorrow',
                    body: `Don't forget! ISS visible tomorrow at ${pass.time.toLocaleTimeString()}. ${pass.brightness}`,
                    icon: '/favicon.ico'
                };

            case '15min':
                return {
                    title: '🛰️ ISS Visible in 15 Minutes!',
                    body: `Look ${pass.from} → ${pass.to}. Visible ${pass.duration}min. ${pass.brightness}`,
                    icon: '/favicon.ico'
                };

            case 'now':
                return {
                    title: '🛰️ ISS is Passing NOW!',
                    body: `Look up! ISS visible ${pass.from} → ${pass.to} for ${pass.duration} minutes`,
                    icon: '/favicon.ico'
                };

            default:
                return {
                    title: '🛰️ ISS Tracker',
                    body: 'ISS notification',
                    icon: '/favicon.ico'
                };
        }
    }

    /*  private handleNotificationClick(pass: PassHome, type: NotificationType): void {
        // El componente puede suscribirse a este evento
        window.dispatchEvent(new CustomEvent('iss-notification-click', {
          detail: { pass, type }
        }));
      }*/

    // 🧹 LIMPIEZA
    clearAllNotifications(): void {
        this.scheduledNotifications.forEach(scheduled => {
            clearTimeout(scheduled.timeoutId);
        });
        this.scheduledNotifications = [];
        console.log('🔔 Todas las notificaciones limpiadas');
    }

    private removeScheduledNotification(notificationId: string): void {
        this.scheduledNotifications = this.scheduledNotifications.filter(
            n => n.id !== notificationId
        );
    }

    // 🗂️ PERSISTENCIA
    private saveSettings(): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings()));
        } catch (error) {
            console.error('Error guardando configuración notificaciones:', error);
        }
    }

    private loadSettings(): void {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                const settings = JSON.parse(saved);
                this.settings.set({
                    enabled: settings.enabled || false,
                    types: {
                        '1week': settings.types?.['1week'] || false,
                        '1day': settings.types?.['1day'] || false,
                        '15min': settings.types?.['15min'] !== false, // Default true
                        'now': settings.types?.['now'] !== false      // Default true
                    }
                });
            }
        } catch (error) {
            console.error('Error cargando configuración notificaciones:', error);
        }
    }

    // 🧪 UTILIDADES
    showWelcomeNotification(): void {
        const notification = new Notification('🛰️ ISS Tracker', {
            body: '¡Notifications enabled! You\'ll be alerted before each visible ISS pass.',
            icon: '/favicon.ico',
            tag: 'iss-welcome'
        });

        setTimeout(() => notification.close(), 5000);
    }

    showTestNotification(): void {
        if (!this.isEnabled) return;

        const notification = new Notification('🛰️ Test Notification', {
            body: 'Notifications are working! You\'ll get alerts before ISS passes.',
            icon: '/favicon.ico',
            tag: 'iss-test'
        });

        setTimeout(() => notification.close(), 5000);
    }

    private isNightTime(date: Date): boolean {
        const hour = date.getHours();
        return hour >= 19 || hour <= 5; // 7PM - 6AM
    }

    // 📊 DEBUG INFO
    getScheduledNotifications(): ScheduledNotification[] {
        return [...this.scheduledNotifications];
    }

    getNotificationTypesEnabled(): NotificationType[] {
        const settings = this.settings();
        return Object.entries(settings.types)
            .filter(([_, enabled]) => enabled)
            .map(([type, _]) => type as NotificationType);
    }
}