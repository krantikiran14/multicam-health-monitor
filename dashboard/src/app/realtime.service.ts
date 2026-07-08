import { Injectable, NgZone, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { io, type Socket } from 'socket.io-client';
import type { LiveSnapshot } from './models';

/**
 * Live data over a single WebSocket instead of HTTP polling. The service opens
 * one Socket.IO connection (same origin) and exposes:
 *   - `updates$`   — a stream of full snapshots pushed by the server
 *   - `connected$` — connection status for the "Live" indicator
 *
 * Socket.IO reconnects automatically and falls back to HTTP long-polling if a
 * WebSocket can't be established, so the dashboard stays live through blips.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private zone = inject(NgZone);
  private socket: Socket = io({ transports: ['websocket', 'polling'] });
  private snapshot$ = new BehaviorSubject<LiveSnapshot | null>(null);

  readonly connected$ = new BehaviorSubject<boolean>(false);

  constructor() {
    // Socket.IO callbacks fire outside Angular's zone, so we re-enter it with
    // NgZone.run — otherwise change detection wouldn't run and the view would
    // not update when a snapshot is pushed.
    this.socket.on('connect', () => this.zone.run(() => this.connected$.next(true)));
    this.socket.on('disconnect', () => this.zone.run(() => this.connected$.next(false)));
    this.socket.on('snapshot', (snap: LiveSnapshot) =>
      this.zone.run(() => this.snapshot$.next(snap)),
    );
  }

  /** Snapshots pushed by the server (skips the initial null). */
  get updates$(): Observable<LiveSnapshot> {
    return this.snapshot$.pipe(
      filter((s): s is LiveSnapshot => s !== null),
    );
  }
}
