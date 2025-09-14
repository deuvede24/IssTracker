// src/app/services/toast.service.ts (junto a tus otros servicios)
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  
  show(message: string, type: 'success' | 'info' = 'info', duration = 4000) {
    // Crear el toast dinámicamente
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <i class="bi ${type === 'success' ? 'bi-check-circle-fill' : 'bi-info-circle-fill'}"></i>
        <span>${message}</span>
      </div>
    `;

    // Estilos inline (sin component separado)
    Object.assign(toast.style, {
      position: 'fixed',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0, 0, 0, 0.92)',
      color: '#fff',
      padding: '14px 16px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: '2000',
      fontSize: '0.9rem',
      fontWeight: '500',
      backdropFilter: 'blur(12px)',
      border: `1px solid ${type === 'success' ? 'rgba(52, 211, 153, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      animation: 'slideInDown 0.3s ease-out',
      cursor: 'pointer',
      maxWidth: '90vw'
    });

    // Añadir estilos de animación si no existen
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        @keyframes slideInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .toast-content { display: flex; align-items: center; gap: 12px; }
        .toast-content i { color: #64ffda; font-size: 1.1rem; }
      `;
      document.head.appendChild(style);
    }

    // Añadir al DOM
    document.body.appendChild(toast);

    // Click para cerrar
    toast.addEventListener('click', () => this.remove(toast));

    // Auto-remove
    if (duration > 0) {
      setTimeout(() => this.remove(toast), duration);
    }
  }

  private remove(toast: HTMLElement) {
    if (toast.parentNode) {
      toast.style.animation = 'slideInRight 0.2s ease-in reverse';
      setTimeout(() => toast.remove(), 200);
    }
  }

  success(message: string, duration?: number) {
    this.show(message, 'success', duration);
  }

  info(message: string, duration?: number) {
    this.show(message, 'info', duration);
  }
}