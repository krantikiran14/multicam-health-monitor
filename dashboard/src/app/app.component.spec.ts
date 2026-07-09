import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { AppComponent } from './app.component';
import { RealtimeService } from './realtime.service';
import type { LiveSnapshot } from './models';

const snapshot = {
  summary: { totalCameras: 1, onlineCameras: 1, offlineCameras: 0, criticalCameras: 0, onlinePct: 100, activeAlerts: 3 },
  cameras: [],
  alerts: [],
  ts: '',
} as LiveSnapshot;

/** Mock so the shell doesn't open a real WebSocket during tests. */
class MockRealtimeService {
  connected$ = new BehaviorSubject<boolean>(true);
  updates$ = of(snapshot);
}

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), { provide: RealtimeService, useClass: MockRealtimeService }],
    }).compileComponents();
  });

  it('creates the app shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the brand and navigation links', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('SentryView');
    expect(text).toContain('CAMERA HEALTH');
    expect(text).toContain('Fleet Overview');
    expect(text).toContain('Active Alerts');
    expect(text).toContain('Thresholds');
  });

  it('shows the live WebSocket indicator and alert count pill when connected', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Live · WebSocket');
    expect(text).toContain('3');
  });
});
