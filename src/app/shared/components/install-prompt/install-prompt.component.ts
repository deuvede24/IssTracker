import { Component, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Component({
  selector: 'app-install-prompt',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './install-prompt.component.html',
  styleUrl: './install-prompt.component.scss'
})
export class InstallPromptComponent implements OnInit {
  showAndroidPrompt = false;
  showIOSBanner = false;
  showIOSGuide = false;
  
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private readonly DISMISSED_KEY = 'iss-tracker-install-dismissed';
  private readonly INSTALL_PROMPT_DELAY = 7000; // 7 seconds
  
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}
  
  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    
    // Don't show if user already dismissed recently
    if (this.wasRecentlyDismissed()) return;
    
    // Don't show if already installed
    if (this.isStandalone()) return;
    
    // Listen for beforeinstallprompt (Android/Chrome)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      
      // Show Android prompt after delay
      setTimeout(() => {
        this.showAndroidPrompt = true;
      }, this.INSTALL_PROMPT_DELAY);
    });
    
    // Handle iOS Safari
    if (this.isIOSSafari() && !this.isStandalone()) {
      setTimeout(() => {
        this.showIOSBanner = true;
      }, this.INSTALL_PROMPT_DELAY);
    }
  }
  
  async installApp() {
    if (!this.deferredPrompt) return;
    
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    
    if (outcome === 'dismissed') {
      this.markAsDismissed();
    }
    
    this.deferredPrompt = null;
    this.showAndroidPrompt = false;
  }
  
  showIOSInstructions() {
    this.showIOSBanner = false;
    this.showIOSGuide = true;
  }
  
  closeIOSGuide() {
    this.showIOSGuide = false;
    this.markAsDismissed();
  }
  
  dismissPrompt() {
    this.showAndroidPrompt = false;
    this.showIOSBanner = false;
    this.markAsDismissed();
  }
  
  private markAsDismissed() {
    // Don't show again for 7 days
    const dismissedUntil = new Date();
    dismissedUntil.setDate(dismissedUntil.getDate() + 7);
    localStorage.setItem(this.DISMISSED_KEY, dismissedUntil.toISOString());
  }
  
  private wasRecentlyDismissed(): boolean {
    const dismissed = localStorage.getItem(this.DISMISSED_KEY);
    if (!dismissed) return false;
    
    const dismissedDate = new Date(dismissed);
    return dismissedDate > new Date();
  }
  
  private isIOSSafari(): boolean {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isWebKit = /WebKit/.test(ua);
    const isChrome = /CriOS|Chrome/.test(ua);
    
    return isIOS && isWebKit && !isChrome;
  }
  
  private isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }
}