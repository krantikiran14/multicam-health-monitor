import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { RealtimeService } from '../realtime.service';
import type { CameraSnapshot, Summary } from '../models';

const RING_CIRCUMFERENCE = 2 * Math.PI * 27;

/** Sort rank used to surface the cameras that most need attention first. */
function severityRank(cam: CameraSnapshot): number {
  if (cam.status === 'critical') return 0;
  if (cam.status === 'offline') return 1;
  if (cam.activeAlertCount > 0) return 2;
  return 3;
}

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './overview.component.html',
})
export class OverviewComponent implements OnInit, OnDestroy {
  private realtime = inject(RealtimeService);
  private sub = new Subscription();
  private clockTimer?: ReturnType<typeof setInterval>;

  summary: Summary | null = null;
  cameras: CameraSnapshot[] = [];
  loaded = false;
  clock = '';

  ngOnInit(): void {
    this.tick();
    this.clockTimer = setInterval(() => this.tick(), 1000);
    this.sub.add(
      this.realtime.updates$.subscribe((snap) => {
        this.summary = snap.summary;
        this.cameras = [...snap.cameras].sort((a, b) => severityRank(a) - severityRank(b));
        this.loaded = true;
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  private tick(): void {
    this.clock = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  trackByCameraId(_index: number, cam: CameraSnapshot): string {
    return cam.cameraId;
  }

  barClass(value: number, warn: number, crit: number): string {
    if (value >= crit) return 'crit';
    if (value >= warn) return 'warn';
    return '';
  }

  /** SVG stroke-dasharray for the online-rate ring: filled arc + remainder. */
  ringDash(onlinePct: number): string {
    const filled = (RING_CIRCUMFERENCE * onlinePct) / 100;
    return `${filled.toFixed(1)} ${RING_CIRCUMFERENCE.toFixed(1)}`;
  }
}
