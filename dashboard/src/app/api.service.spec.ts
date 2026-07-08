import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GETs history with the metric and hours in the query', () => {
    service.getHistory('cam-01', 'cpu', 24).subscribe();
    const req = httpMock.expectOne('/api/cameras/cam-01/history?metric=cpu&hours=24');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('GETs thresholds', () => {
    service.getThresholds().subscribe();
    const req = httpMock.expectOne('/api/thresholds');
    expect(req.request.method).toBe('GET');
    req.flush({ cpuMaxPct: 85, memoryMaxPct: 90, storageMaxPct: 90, latencyMaxMs: 250, offlineSecs: 120 });
  });

  it('PUTs a threshold patch', () => {
    service.updateThresholds({ cpuMaxPct: 80 }).subscribe();
    const req = httpMock.expectOne('/api/thresholds');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ cpuMaxPct: 80 });
    req.flush({ cpuMaxPct: 80, memoryMaxPct: 90, storageMaxPct: 90, latencyMaxMs: 250, offlineSecs: 120 });
  });
});
