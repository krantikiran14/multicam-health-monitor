import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { RealtimeService } from '../realtime.service';
import type { Alert } from '../models';

/** Live list of active alerts, driven by the WebSocket snapshot. */
@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './alerts.component.html',
})
export class AlertsComponent implements OnInit, OnDestroy {
  private realtime = inject(RealtimeService);
  private sub = new Subscription();

  alerts: Alert[] = [];
  loaded = false;

  ngOnInit(): void {
    this.sub.add(
      this.realtime.updates$.subscribe((snap) => {
        this.alerts = snap.alerts;
        this.loaded = true;
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /** Identity for *ngFor so polling updates rows in place instead of rebuilding. */
  trackByAlertId(_index: number, alert: Alert): number {
    return alert.id;
  }
}
