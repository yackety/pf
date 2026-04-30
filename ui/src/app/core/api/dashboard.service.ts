import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { DashboardStats } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  readonly #http = inject(HttpClient);

  getStats() {
    return this.#http.get<DashboardStats>(`${environment.apiBase}/dashboard/stats`);
  }
}
