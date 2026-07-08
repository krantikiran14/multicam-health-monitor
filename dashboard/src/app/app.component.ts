import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { RealtimeService } from './realtime.service';

/** App shell: top navigation plus the routed page outlet. */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <nav class="nav">
      <span class="brand">📷 Multi-Camera Health Monitor</span>
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Overview</a>
      <a routerLink="/alerts" routerLinkActive="active">Alerts</a>
      <a routerLink="/thresholds" routerLinkActive="active">Thresholds</a>
      <span class="spacer"></span>
      <span class="muted" [title]="(connected$ | async) ? 'WebSocket connected' : 'Reconnecting…'">
        <span class="dot" [style.background]="(connected$ | async) ? 'var(--ok)' : 'var(--offline)'"></span>
        {{ (connected$ | async) ? 'Live · WebSocket' : 'Reconnecting…' }}
      </span>
    </nav>
    <div class="container">
      <router-outlet></router-outlet>
    </div>
  `,
})
export class AppComponent {
  readonly connected$ = inject(RealtimeService).connected$;
}
