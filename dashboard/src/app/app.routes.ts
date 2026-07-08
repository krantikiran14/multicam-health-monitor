import { Routes } from '@angular/router';
import { OverviewComponent } from './pages/overview.component';
import { AlertsComponent } from './pages/alerts.component';
import { ThresholdsComponent } from './pages/thresholds.component';
import { CameraDetailComponent } from './pages/camera-detail.component';

export const routes: Routes = [
  { path: '', component: OverviewComponent },
  { path: 'alerts', component: AlertsComponent },
  { path: 'thresholds', component: ThresholdsComponent },
  { path: 'cameras/:id', component: CameraDetailComponent },
  { path: '**', redirectTo: '' },
];
