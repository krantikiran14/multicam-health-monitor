import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api.service';
import type { Thresholds } from '../models';

/**
 * View and edit the health thresholds at runtime. Saving PUTs to the API, which
 * persists the new values — so thresholds change with no code change or redeploy.
 */
@Component({
  selector: 'app-thresholds',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './thresholds.component.html',
})
export class ThresholdsComponent implements OnInit {
  private api = inject(ApiService);

  model: Thresholds | null = null;
  saving = false;
  saved = false;
  error = '';

  readonly fields: { key: keyof Thresholds; label: string; unit: string }[] = [
    { key: 'cpuMaxPct', label: 'CPU max', unit: '%' },
    { key: 'memoryMaxPct', label: 'Memory max', unit: '%' },
    { key: 'storageMaxPct', label: 'Storage max', unit: '%' },
    { key: 'latencyMaxMs', label: 'Latency max', unit: 'ms' },
    { key: 'offlineSecs', label: 'Offline after', unit: 's' },
  ];

  ngOnInit(): void {
    this.api.getThresholds().subscribe((t) => (this.model = t));
  }

  save(): void {
    if (!this.model) return;
    this.saving = true;
    this.saved = false;
    this.error = '';
    this.api.updateThresholds(this.model).subscribe({
      next: (t) => {
        this.model = t;
        this.saving = false;
        this.saved = true;
      },
      error: () => {
        this.saving = false;
        this.error = 'Failed to save thresholds';
      },
    });
  }
}
