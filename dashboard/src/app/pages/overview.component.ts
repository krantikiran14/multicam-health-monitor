import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { RealtimeService } from '../realtime.service';
import type { CameraSnapshot, Summary } from '../models';

/**
 * Landing page. Summary cards and the camera grid are driven by the live
 * WebSocket snapshot, so the view updates the instant the backend pushes.
 */
@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './overview.component.html',
})
export class OverviewComponent implements OnInit, OnDestroy {
  private realtime = inject(RealtimeService);
  private sub = new Subscription();

  summary: Summary | null = null;
  cameras: CameraSnapshot[] = [];
  loaded = false;

  ngOnInit(): void {
    this.sub.add(
      this.realtime.updates$.subscribe((snap) => {
        this.summary = snap.summary;
        this.cameras = snap.cameras;
        this.loaded = true;
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /** Colour class for a 0-100 metric bar based on warn/critical cutoffs. */
  barClass(value: number, warn: number, crit: number): string {
    if (value >= crit) return 'crit';
    if (value >= warn) return 'warn';
    return '';
  }

  /**
   * Identity for *ngFor. Without this, every 5s poll replaces the whole grid's
   * DOM — causing flicker and dropped clicks. With it, Angular reuses each card
   * and only updates its bindings.
   */
  trackByCameraId(_index: number, cam: CameraSnapshot): string {
    return cam.cameraId;
  }
}
