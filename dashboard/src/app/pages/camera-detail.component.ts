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
  data: ChartConfiguration<'line'>['data'];
}

/**
 * Detail view for one camera: live snapshot on top, plus CPU / memory / storage
 * trend charts for the last 24 hours. The snapshot polls every few seconds; the
 * heavier history reloads on a slower interval.
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

  charts: TrendChart[] = [
    { metric: 'cpu', title: 'CPU %', color: '#38bdf8', data: emptyData() },
    { metric: 'memory', title: 'Memory %', color: '#a78bfa', data: emptyData() },
    { metric: 'storage', title: 'Storage % used', color: '#f59e0b', data: emptyData() },
  ];

  readonly chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    elements: { point: { radius: 0 } },
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#94a3b8', maxTicksLimit: 6 }, grid: { color: '#273449' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: '#273449' }, beginAtZero: true },
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
        backgroundColor: color + '33',
        fill: true,
        tension: 0.3,
        borderWidth: 2,
      },
    ],
  };
}
