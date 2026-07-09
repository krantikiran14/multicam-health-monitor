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

  readonly fields: {
    key: keyof Thresholds;
    label: string;
    hint: string;
    unit: string;
    min: number;
    max: number;
    step: number;
  }[] = [
    { key: 'cpuMaxPct', label: 'Max CPU', hint: 'Alert above', unit: '%', min: 0, max: 100, step: 1 },
    { key: 'memoryMaxPct', label: 'Max Memory', hint: 'Alert above', unit: '%', min: 0, max: 100, step: 1 },
    { key: 'storageMaxPct', label: 'Max Storage', hint: 'Alert above', unit: '%', min: 0, max: 100, step: 1 },
    { key: 'latencyMaxMs', label: 'Max Latency', hint: 'Alert above', unit: 'ms', min: 0, max: 500, step: 5 },
    { key: 'offlineSecs', label: 'Offline after', hint: 'No heartbeat for', unit: 's', min: 10, max: 300, step: 5 },
  ];

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
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

  /** Discards any unsaved edits by re-fetching the last-saved values from the server. */
  reset(): void {
    this.saved = false;
    this.error = '';
    this.load();
  }
}
