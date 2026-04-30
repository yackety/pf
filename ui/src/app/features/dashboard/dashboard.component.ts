import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DashboardService } from '../../core/api/dashboard.service';
import { DeviceHubService } from '../../core/signalr/device-hub.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import type { DashboardStats } from '../../core/api/dashboard.models';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatCardComponent],
  template: `
    <div>
      <div class="mb-6">
        <h1 class="headline-lg text-on-surface">Dashboard</h1>
        <p class="body-md text-on-surface-variant mt-1">Live overview of your PhoneFarm fleet</p>
      </div>

      @if (isLoading()) {
        <div class="flex items-center justify-center py-16" aria-live="polite" aria-busy="true">
          <i class="fa-solid fa-spinner fa-spin text-primary text-3xl" aria-hidden="true"></i>
          <span class="sr-only">Loading dashboard stats…</span>
        </div>
      } @else if (error()) {
        <div
          role="alert"
          class="px-5 py-4 rounded-xl bg-error-container text-on-error-container body-md"
        >
          <i class="fa-solid fa-circle-exclamation mr-2" aria-hidden="true"></i>
          {{ error() }}
        </div>
      } @else {
        <!-- Stat cards -->
        <section aria-label="Summary statistics">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <app-stat-card
              label="Total Devices"
              [value]="stats()?.totalDevices ?? 0"
              icon="fa-solid fa-mobile-screen"
            />
            <app-stat-card
              label="Online"
              [value]="stats()?.onlineDevices ?? 0"
              icon="fa-solid fa-circle-dot"
            />
            <app-stat-card
              label="Offline"
              [value]="stats()?.offlineDevices ?? 0"
              icon="fa-solid fa-circle-xmark"
            />
            <app-stat-card
              label="Total Accounts"
              [value]="stats()?.totalAccounts ?? 0"
              icon="fa-solid fa-users"
            />
          </div>
        </section>

        <!-- Platform breakdown -->
        @if (platformCounts().length > 0) {
          <section aria-label="Accounts by platform">
            <h2 class="headline-md text-on-surface mb-4">Accounts by Platform</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              @for (item of platformCounts(); track item.platform) {
                <div
                  class="bg-surface-container-lowest rounded-xl shadow-card dark:shadow-card-dark
                         p-4 text-center hover:shadow-elevated dark:hover:shadow-elevated-dark
                         transition-shadow duration-200"
                >
                  <p class="label-sm text-on-surface-variant mb-1 capitalize">{{ item.platform }}</p>
                  <p class="headline-md text-on-surface">{{ item.count }}</p>
                </div>
              }
            </div>
          </section>
        }
      }

      <!-- Live update indicator -->
      <div
        aria-live="polite"
        class="sr-only"
      >
        {{ liveAnnouncement() }}
      </div>
    </div>
  `,
})
export class DashboardComponent {
  readonly #dashboardSvc = inject(DashboardService);
  readonly #hub = inject(DeviceHubService);

  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly stats = signal<DashboardStats | null>(null);
  readonly liveAnnouncement = signal('');

  readonly platformCounts = computed(() => this.stats()?.accountsByPlatform ?? []);

  constructor() {
    this.#loadStats();

    // React to SignalR device state changes — re-fetch stats
    effect(() => {
      const ev = this.#hub.deviceStateChanged();
      if (ev) {
        this.liveAnnouncement.set(`Device ${ev.udid} state changed to ${ev.state}`);
        this.#loadStats();
      }
    });

    effect(() => {
      const ev = this.#hub.deviceConnected();
      if (ev) {
        this.liveAnnouncement.set(`Device ${ev.udid} connected`);
        this.#loadStats();
      }
    });

    effect(() => {
      const ev = this.#hub.deviceDisconnected();
      if (ev) {
        this.liveAnnouncement.set(`Device ${ev.udid} disconnected`);
        this.#loadStats();
      }
    });
  }

  #loadStats(): void {
    this.isLoading.set(true);
    this.#dashboardSvc.getStats().subscribe({
      next: data => {
        this.stats.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Failed to load dashboard stats. Please try again.');
        this.isLoading.set(false);
      },
    });
  }
}
