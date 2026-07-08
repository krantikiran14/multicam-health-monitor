import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of, type Observable } from 'rxjs';
import { OverviewComponent } from './overview.component';
import { RealtimeService } from '../realtime.service';
import type { CameraSnapshot, LiveSnapshot, Summary } from '../models';

const summary: Summary = {
  totalCameras: 2,
  onlineCameras: 1,
  offlineCameras: 1,
  criticalCameras: 1,
  onlinePct: 50,
  activeAlerts: 4,
};

const cameras: CameraSnapshot[] = [
  {
    cameraId: 'cam-01', name: 'Camera 01', status: 'online', online: true,
    cpu: 40, memory: 50, storageUsedGb: 100, storageTotalGb: 500, storageUsedPct: 20,
    latencyMs: 30, faultFlag: false, heartbeatAt: '', lastReadingAt: '', activeAlertCount: 0,
  },
  {
    cameraId: 'cam-02', name: 'Camera 02', status: 'critical', online: true,
    cpu: 95, memory: 60, storageUsedGb: 480, storageTotalGb: 500, storageUsedPct: 96,
    latencyMs: 300, faultFlag: true, heartbeatAt: '', lastReadingAt: '', activeAlertCount: 2,
  },
];

const snapshot: LiveSnapshot = { summary, cameras, alerts: [], ts: '' };

/** Mock RealtimeService: emit one snapshot synchronously. */
class MockRealtimeService {
  updates$: Observable<LiveSnapshot> = of(snapshot);
  connected$ = new BehaviorSubject<boolean>(true);
}

describe('OverviewComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OverviewComponent],
      providers: [provideRouter([]), { provide: RealtimeService, useClass: MockRealtimeService }],
    }).compileComponents();
  });

  it('renders summary cards from the pushed snapshot', () => {
    const fixture = TestBed.createComponent(OverviewComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('50%'); // onlinePct
    expect(text).toContain('4'); // activeAlerts
  });

  it('renders a card per camera with its status', () => {
    const fixture = TestBed.createComponent(OverviewComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Camera 01');
    expect(el.textContent).toContain('Camera 02');
    expect(el.querySelectorAll('.badge.critical').length).toBe(1);
    expect(el.querySelectorAll('.badge.online').length).toBe(1);
  });

  it('barClass returns severity classes at the right cutoffs', () => {
    const fixture = TestBed.createComponent(OverviewComponent);
    const c = fixture.componentInstance;
    expect(c.barClass(50, 70, 85)).toBe('');
    expect(c.barClass(75, 70, 85)).toBe('warn');
    expect(c.barClass(90, 70, 85)).toBe('crit');
  });
});
