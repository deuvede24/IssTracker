// src/app/app.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

import { BottomNavComponent } from './shared/components/bottom-nav/bottom-nav.component';
import { InstallPromptComponent } from './shared/components/install-prompt/install-prompt.component';
import { ToastService } from './services/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, BottomNavComponent,  InstallPromptComponent ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'ISS Tracker';

  constructor(
    private updates: SwUpdate,
    private toast: ToastService
  ) {}

  ngOnInit() {
    // PWA Update handling
    if (this.updates.isEnabled) {
      // Solo avisar si la pestaña está visible
      this.updates.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
        .subscribe(() => {
          if (document.visibilityState === 'visible') {
            this.toast.info('New version available. Reloading...');
            setTimeout(() => document.location.reload(), 1000);
          }
        });

      // Chequeo manual al iniciar
      this.updates.checkForUpdate();
    }
  }
}