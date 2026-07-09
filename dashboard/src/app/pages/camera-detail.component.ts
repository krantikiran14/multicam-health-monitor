import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartConfiguration } from 'chart.js';
import { ApiService } from '../api.service';
import { RealtimeService } from '../realtime.service';
import type { CameraSnapshot, TrendMetric, TrendPoint } from '../models';

interface TrendChart {
  metric: TrendMetric;
  title: string;
  color: string;
  unit: string;
  data: ChartConfiguration<'line'>['data'];
}

/**
 * Detail view for one camera: live snapshot tiles on top, plus CPU / memory /
 * storage / latency trend charts for the last 24 hours. The snapshot updates
 * live over the WebSocket; history reloads on a slower interval.
 */
@Component({
  selector: 'app-camera-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, BaseChartDirective],
  templateUrl: './camera-detail.component.html',
})
export class CameraDetailComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private realtime = inject(RealtimeService);
  private route = inject(ActivatedRoute);
  private subs = new Subscription();
  private historyTimer?: ReturnType<typeof setInterval>;

  cameraId = '';
  camera: CameraSnapshot | null = null;

  // Colors match the SentryView chart palette: accent (CPU), violet (memory),
  // warn/amber (storage), teal (latency).
  charts: TrendChart[] = [
    { metric: 'cpu', title: 'CPU', color: '#4cc2ff', unit: '%', data: emptyData() },
    { metric: 'memory', title: 'Memory', color: '#a78bfa', unit: '%', data: emptyData() },
    { metric: 'storage', title: 'Storage', color: '#fbbf24', unit: '%', data: emptyData() },
    { metric: 'latency', title: 'Latency', color: '#38d6c4', unit: 'ms', data: emptyData() },
  ];

  readonly chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    elements: { point: { radius: 0 } },
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#8a95a6', maxTicksLimit: 6 }, grid: { color: '#1a212c' } },
      y: { ticks: { color: '#8a95a6' }, grid: { color: '#1a212c' }, beginAtZero: true },
    },
  };

  ngOnInit(): void {
    this.cameraId = this.route.snapshot.paramMap.get('id') ?? '';
    // Live tile: pick this camera out of each pushed snapshot.
    this.subs.add(
      this.realtime.updates$
        .pipe(map((snap) => snap.cameras.find((c) => c.cameraId === this.cameraId) ?? null))
        .subscribe((c) => (this.camera = c)),
    );
    this.loadHistory();
    this.historyTimer = setInterval(() => this.loadHistory(), 30_000);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.historyTimer) clearInterval(this.historyTimer);
  }

  /** Current live value for a chart's metric, shown in its "now X" header readout. */
  currentValue(metric: TrendMetric): number | string {
    if (!this.camera) return '—';
    switch (metric) {
      case 'cpu':
        return this.camera.online ? this.camera.cpu : '—';
      case 'memory':
        return this.camera.online ? this.camera.memory : '—';
      case 'storage':
        return this.camera.storageUsedPct;
      case 'latency':
        return this.camera.online ? this.camera.latencyMs : '—';
    }
  }

  private loadHistory(): void {
    // Fetch each chart's history in parallel, then rebuild the chart datasets.
    forkJoin(this.charts.map((c) => this.api.getHistory(this.cameraId, c.metric, 24))).subscribe(
      (results) => {
        this.charts = this.charts.map((c, i) => ({
          ...c,
          data: toChartData(results[i], c.color, c.title),
        }));
      },
    );
  }
}

function emptyData(): ChartConfiguration<'line'>['data'] {
  return { labels: [], datasets: [{ data: [] }] };
}

/** Convert API trend points into a Chart.js line dataset. */
function toChartData(
  points: TrendPoint[],
  color: string,
  label: string,
): ChartConfiguration<'line'>['data'] {
  return {
    labels: points.map((p) =>
      new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ),
    datasets: [
      {
        label,
        data: points.map((p) => Math.round(p.value * 10) / 10),
        borderColor: color,
        backgroundColor: color + '24',
        fill: true,
        tension: 0.3,
        borderWidth: 2,
      },
    ],
  };
}
