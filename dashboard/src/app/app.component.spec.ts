import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AppComponent } from './app.component';
import { RealtimeService } from './realtime.service';

/** Mock so the shell doesn't open a real WebSocket during tests. */
class MockRealtimeService {
  connected$ = new BehaviorSubject<boolean>(true);
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
    expect(text).toContain('Multi-Camera Health Monitor');
    expect(text).toContain('Overview');
    expect(text).toContain('Alerts');
    expect(text).toContain('Thresholds');
  });

  it('shows the live WebSocket indicator when connected', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Live · WebSocket');
  });
});
