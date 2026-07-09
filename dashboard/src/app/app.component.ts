import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { RealtimeService } from './realtime.service';

/**
 * App shell: persistent left sidebar (brand, nav, live/WebSocket status) plus
 * the routed page outlet. Matches the SentryView design handoff.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="6" width="14" height="12" rx="2.5" stroke="var(--accent)" stroke-width="2" />
              <path d="M16 10l5-3v10l-5-3" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" />
            </svg>
          </div>
          <div>
            <div class="sidebar-brand">Sentry<span class="accent">View</span></div>
            <div class="sidebar-tagline">CAMERA HEALTH</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          <div class="sidebar-section-label">MONITORING</div>

          <a class="nav-btn" routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.9" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.9" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.9" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.9" />
            </svg>
            <span class="grow">Fleet Overview</span>
          </a>

          <a class="nav-btn" routerLink="/alerts" routerLinkActive="active">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 3L2.5 20h19L12 3z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" />
              <path d="M12 10v4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
              <circle cx="12" cy="17" r="1" fill="currentColor" />
            </svg>
            <span class="grow">Active Alerts</span>
            <span class="nav-pill" *ngIf="activeAlerts > 0">{{ activeAlerts }}</span>
          </a>

          <a class="nav-btn" routerLink="/thresholds" routerLinkActive="active">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M4 8h9M17 8h3M4 16h3M11 16h9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
              <circle cx="15" cy="8" r="2.4" stroke="currentColor" stroke-width="1.9" />
              <circle cx="9" cy="16" r="2.4" stroke="currentColor" stroke-width="1.9" />
            </svg>
            <span class="grow">Thresholds</span>
          </a>
        </nav>

        <div class="sidebar-live">
          <div class="sidebar-live-row">
            <span
              class="dot"
              [class.pulse]="connected$ | async"
              [style.background]="(connected$ | async) ? 'var(--ok)' : 'var(--offline)'"
            ></span>
            <span class="sidebar-live-label">{{ (connected$ | async) ? 'Live · WebSocket' : 'Reconnecting…' }}</span>
          </div>
          <div class="sidebar-live-clock">Synced {{ clock }}</div>
        </div>
      </aside>

      <main class="main">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  private realtime = inject(RealtimeService);
  private sub = new Subscription();
  private clockTimer?: ReturnType<typeof setInterval>;

  readonly connected$ = this.realtime.connected$;
  activeAlerts = 0;
  clock = '';

  ngOnInit(): void {
    this.tick();
    this.clockTimer = setInterval(() => this.tick(), 1000);
    this.sub.add(this.realtime.updates$.subscribe((snap) => (this.activeAlerts = snap.summary.activeAlerts)));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  private tick(): void {
    this.clock = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
