import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { Thresholds, TrendMetric, TrendPoint } from './models';

/**
 * REST client for the request/response parts of the API: historical trend data
 * and reading/updating thresholds. Live fleet state (cameras, alerts, summary)
 * arrives over the WebSocket instead — see RealtimeService.
 *
 * Requests use relative `/api/...` paths: the dev server proxies them to the
 * backend, and in production the backend serves this app from the same origin.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  getHistory(id: string, metric: TrendMetric, hours = 24): Observable<TrendPoint[]> {
    return this.http.get<TrendPoint[]>(
      `/api/cameras/${id}/history?metric=${metric}&hours=${hours}`,
    );
  }

  getThresholds(): Observable<Thresholds> {
    return this.http.get<Thresholds>('/api/thresholds');
  }

  updateThresholds(patch: Partial<Thresholds>): Observable<Thresholds> {
    return this.http.put<Thresholds>('/api/thresholds', patch);
  }
}
