import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { Device, DeviceFilterParams } from '../../../core/api/devices.models';
import { DevicesService } from '../../../core/api/devices.service';
import { DeviceHubService } from '../../../core/signalr/device-hub.service';
import { PlatformIconComponent } from '../../../shared/components/platform-icon/platform-icon.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-device-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, StatusBadgeComponent, PlatformIconComponent],
  template: `
    <div>
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="headline-lg text-on-surface">Devices</h1>
          <p class="body-md text-on-surface-variant mt-1">
            {{ total() }} device{{ total() === 1 ? '' : 's' }} registered
          </p>
        </div>
      </div>

      <!-- Bulk action bar (visible when selection is non-empty) -->
      @if (selectedCount() > 0) {
        <div class="mb-4 flex items-center flex-wrap gap-2 px-4 py-3 rounded-xl
                    bg-primary/10 border border-primary/20">
          <span class="body-sm font-medium text-primary mr-2">
            <i class="fa-solid fa-check-square mr-1" aria-hidden="true"></i>
            {{ selectedCount() }} selected
          </span>

          <button
            type="button"
            (click)="bulkAction('reboot')"
            [disabled]="bulkActionLoading()"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full label-sm bg-surface-container
                   text-on-surface border border-outline-variant hover:bg-surface-container-high
                   disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          >
            <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
            Reboot
          </button>

          <button
            type="button"
            (click)="bulkAction('tcpip', { port: 5555 })"
            [disabled]="bulkActionLoading()"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full label-sm bg-surface-container
                   text-on-surface border border-outline-variant hover:bg-surface-container-high
                   disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          >
            <i class="fa-solid fa-wifi" aria-hidden="true"></i>
            Connect WiFi
          </button>

          <button
            type="button"
            (click)="toggleApkInput()"
            [disabled]="bulkActionLoading()"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full label-sm
                   border border-outline-variant hover:bg-surface-container-high
                   disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
            [class]="showApkInput() ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'"
          >
            <i class="fa-solid fa-file-arrow-up" aria-hidden="true"></i>
            Install APK
          </button>

          <button
            type="button"
            (click)="bulkAction('screenshot')"
            [disabled]="bulkActionLoading()"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full label-sm bg-surface-container
                   text-on-surface border border-outline-variant hover:bg-surface-container-high
                   disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          >
            <i class="fa-solid fa-camera" aria-hidden="true"></i>
            Screenshot
          </button>

          @if (bulkActionLoading()) {
            <i class="fa-solid fa-spinner fa-spin text-primary ml-1" aria-hidden="true"></i>
          }

          <button
            type="button"
            (click)="clearSelection()"
            class="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full label-sm
                   text-on-surface-variant hover:bg-surface-container-high
                   transition-colors focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Clear selection"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            Clear
          </button>
        </div>

        <!-- APK URL input (inline, appears when Install APK is active) -->
        @if (showApkInput()) {
          <div class="mb-4 flex items-center gap-2">
            <input
              type="url"
              [(ngModel)]="apkUrl"
              placeholder="https://example.com/app.apk"
              class="flex-1 px-4 py-2 rounded-full border border-outline-variant bg-surface-container-lowest
                     body-sm text-on-surface placeholder:text-on-surface-variant
                     focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="APK URL to install"
            />
            <button
              type="button"
              (click)="bulkInstallApk()"
              [disabled]="!apkUrl.trim() || bulkActionLoading()"
              class="px-4 py-2 rounded-full label-sm bg-primary text-on-primary
                     hover:opacity-90 disabled:opacity-50 transition-opacity
                     focus-visible:ring-2 focus-visible:ring-primary"
            >
              Install
            </button>
          </div>
        }
      }

      <!-- Filters -->
      <div class="flex flex-wrap gap-3 mb-5">
        <div class="relative">
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2
                     text-on-surface-variant text-sm pointer-events-none" aria-hidden="true"></i>
          <input
            type="search"
            [(ngModel)]="searchText"
            (ngModelChange)="onSearch($event)"
            placeholder="Search model, UDID, tags…"
            class="pl-9 pr-4 py-2 rounded-full border border-outline-variant bg-surface-container-lowest
                   body-sm text-on-surface placeholder:text-on-surface-variant
                   focus:outline-none focus:ring-2 focus:ring-primary w-64"
            aria-label="Search devices"
          />
        </div>

        <select
          [(ngModel)]="stateFilter"
          (ngModelChange)="onFilterChange()"
          class="px-4 py-2 rounded-full border border-outline-variant bg-surface-container-lowest
                 body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="device">Online</option>
          <option value="disconnected">Offline</option>
        </select>

        <select
          [(ngModel)]="platformFilter"
          (ngModelChange)="onFilterChange()"
          class="px-4 py-2 rounded-full border border-outline-variant bg-surface-container-lowest
                 body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Filter by platform"
        >
          <option value="">All platforms</option>
          <option value="android">Android</option>
          <option value="ios">iOS</option>
        </select>

        @if (hasFilters()) {
          <button
            type="button"
            (click)="clearFilters()"
            class="px-4 py-2 rounded-full border border-outline-variant body-sm text-on-surface-variant
                   hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-primary
                   transition-colors"
          >
            <i class="fa-solid fa-xmark mr-1" aria-hidden="true"></i>
            Clear
          </button>
        }
      </div>

      <!-- Table -->
      <div class="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest
                  shadow-card dark:shadow-card-dark">
        <table class="w-full text-sm border-collapse" aria-label="Device list">
          <thead>
            <tr class="border-b border-outline-variant bg-surface-container-high">
              <th scope="col" class="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  [checked]="isAllSelected()"
                  [indeterminate]="isIndeterminate()"
                  (change)="toggleAll()"
                  class="w-4 h-4 rounded accent-primary cursor-pointer"
                  aria-label="Select all devices"
                />
              </th>
              <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Platform</th>
              <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Model</th>
              <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Status</th>
              <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">OS</th>
              <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">IP</th>
              <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Tags</th>
              <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            @if (isLoading()) {
              <tr>
                <td colspan="8" class="px-4 py-10 text-center text-on-surface-variant">
                  <i class="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true"></i>
                  Loading devices…
                </td>
              </tr>
            } @else if (devices().length === 0) {
              <tr>
                <td colspan="8" class="px-4 py-10 text-center text-on-surface-variant body-md">
                  <i class="fa-solid fa-mobile-screen text-3xl mb-3 block opacity-40" aria-hidden="true"></i>
                  No devices found
                </td>
              </tr>
            } @else {
              @for (device of devices(); track device.udid) {
                <tr
                  class="border-b border-outline-variant last:border-0 hover:bg-surface-container-high
                         transition-colors duration-100 cursor-pointer"
                  [class]="selectedUdids().has(device.udid) ? 'bg-primary/5' : ''"
                  (click)="openDetail(device.udid)"
                  (keydown.enter)="openDetail(device.udid)"
                  tabindex="0"
                  [attr.aria-label]="device.model ?? device.udid"
                >
                  <td class="px-4 py-3" (click)="$event.stopPropagation()">
                    <input
                      type="checkbox"
                      [checked]="selectedUdids().has(device.udid)"
                      (change)="toggleOne(device.udid)"
                      class="w-4 h-4 rounded accent-primary cursor-pointer"
                      [attr.aria-label]="'Select ' + (device.model ?? device.udid)"
                    />
                  </td>
                  <td class="px-4 py-3">
                    <app-platform-icon [platform]="device.platform" />
                  </td>
                  <td class="px-4 py-3">
                    <span class="body-sm text-on-surface font-medium">{{ device.model ?? '—' }}</span>
                    <br />
                    <span class="body-sm text-on-surface-variant text-xs font-mono">{{ device.udid }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <app-status-badge [status]="liveState(device.udid) ?? device.state" />
                  </td>
                  <td class="px-4 py-3 body-sm text-on-surface-variant">{{ device.osVersion ?? '—' }}</td>
                  <td class="px-4 py-3 body-sm text-on-surface-variant font-mono text-xs">
                    {{ formatIps(device.ipAddresses) }}
                  </td>
                  <td class="px-4 py-3">
                    @if (device.tags) {
                      <div class="flex flex-wrap gap-1">
                        @for (tag of parseTags(device.tags); track tag) {
                          <span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary label-sm">{{ tag }}</span>
                        }
                      </div>
                    } @else {
                      <span class="text-on-surface-variant body-sm">—</span>
                    }
                  </td>
                  <td class="px-4 py-3 body-sm text-on-surface-variant">
                    {{ formatDate(device.lastSeenAt) }}
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>

        <!-- Pagination bar -->
        @if (total() > pageSize) {
          <div class="flex items-center justify-between px-4 py-3 border-t border-outline-variant bg-surface-container">
            <span class="body-sm text-on-surface-variant">{{ rangeLabel() }}</span>
            <div class="flex items-center gap-1" role="navigation" aria-label="Pagination">
              <button
                type="button"
                class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant
                       hover:bg-surface-container-high disabled:opacity-30
                       focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                [disabled]="currentPage() <= 1"
                (click)="goToPage(currentPage() - 1)"
                aria-label="Previous page"
              >
                <i class="fa-solid fa-chevron-left text-xs" aria-hidden="true"></i>
              </button>
              @for (p of pageNumbers(); track p) {
                <button
                  type="button"
                  class="w-8 h-8 rounded-full flex items-center justify-center label-sm transition-colors
                         focus-visible:ring-2 focus-visible:ring-primary"
                  [class]="p === currentPage()
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-high'"
                  [attr.aria-current]="p === currentPage() ? 'page' : null"
                  (click)="goToPage(p)"
                >{{ p }}</button>
              }
              <button
                type="button"
                class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant
                       hover:bg-surface-container-high disabled:opacity-30
                       focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                [disabled]="currentPage() >= totalPages()"
                (click)="goToPage(currentPage() + 1)"
                aria-label="Next page"
              >
                <i class="fa-solid fa-chevron-right text-xs" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class DeviceListComponent {
  readonly #svc = inject(DevicesService);
  readonly #router = inject(Router);
  readonly #hub = inject(DeviceHubService);

  readonly pageSize = 50;

  readonly devices = signal<Device[]>([]);
  readonly total = signal(0);
  readonly isLoading = signal(true);
  readonly currentPage = signal(1);

  // Multi-select
  readonly selectedUdids = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedUdids().size);
  readonly isAllSelected = computed(
    () => this.devices().length > 0 && this.devices().every(d => this.selectedUdids().has(d.udid)),
  );
  readonly isIndeterminate = computed(() => this.selectedCount() > 0 && !this.isAllSelected());

  // Bulk action state
  readonly bulkActionLoading = signal(false);
  readonly showApkInput = signal(false);
  apkUrl = '';

  // SignalR live state overlay: udid → state
  readonly #liveStates = signal<Map<string, string>>(new Map());

  searchText = '';
  stateFilter = '';
  platformFilter = '';

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly hasFilters = computed(
    () => !!this.searchText || !!this.stateFilter || !!this.platformFilter,
  );

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  readonly rangeLabel = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage() * this.pageSize, this.total());
    return `${start}–${end} of ${this.total()}`;
  });

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
      pages.push(i);
    }
    return pages;
  });

  constructor() {
    this.#loadDevices();

    effect(() => {
      const ev = this.#hub.deviceStateChanged();
      if (!ev) return;
      this.#liveStates.update(map => {
        const next = new Map(map);
        next.set(ev.udid, ev.state);
        return next;
      });
    });

    effect(() => {
      const ev = this.#hub.deviceConnected();
      if (!ev) return;
      this.#liveStates.update(map => {
        const next = new Map(map);
        next.set(ev.udid, 'device');
        return next;
      });
    });

    effect(() => {
      const ev = this.#hub.deviceDisconnected();
      if (!ev) return;
      this.#liveStates.update(map => {
        const next = new Map(map);
        next.set(ev.udid, 'disconnected');
        return next;
      });
    });
  }

  liveState(udid: string): string | undefined {
    return this.#liveStates().get(udid);
  }

  toggleAll(): void {
    if (this.isAllSelected()) {
      this.selectedUdids.set(new Set());
    } else {
      this.selectedUdids.set(new Set(this.devices().map(d => d.udid)));
    }
  }

  toggleOne(udid: string): void {
    this.selectedUdids.update(set => {
      const next = new Set(set);
      if (next.has(udid)) next.delete(udid);
      else next.add(udid);
      return next;
    });
  }

  clearSelection(): void {
    this.selectedUdids.set(new Set());
    this.showApkInput.set(false);
    this.apkUrl = '';
  }

  toggleApkInput(): void {
    this.showApkInput.update(v => !v);
    if (!this.showApkInput()) this.apkUrl = '';
  }

  bulkAction(type: string, params?: Record<string, unknown>): void {
    const udids = [...this.selectedUdids()];
    if (udids.length === 0) return;
    this.bulkActionLoading.set(true);
    let completed = 0;
    const done = (): void => {
      if (++completed === udids.length) this.bulkActionLoading.set(false);
    };
    for (const udid of udids) {
      this.#svc.sendAction(udid, { type, params }).subscribe({ next: done, error: done });
    }
  }

  bulkInstallApk(): void {
    const url = this.apkUrl.trim();
    if (!url) return;
    this.bulkAction('install-apk', { url });
    this.showApkInput.set(false);
    this.apkUrl = '';
  }

  onSearch(_text: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.currentPage.set(1);
      this.#loadDevices();
    }, 300);
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.#loadDevices();
  }

  clearFilters(): void {
    this.searchText = '';
    this.stateFilter = '';
    this.platformFilter = '';
    this.currentPage.set(1);
    this.#loadDevices();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.currentPage.set(p);
    this.#loadDevices();
  }

  openDetail(udid: string): void {
    this.#router.navigate(['/devices', udid]);
  }

  formatIps(raw: string | null): string {
    if (!raw) return '—';
    try {
      const parsed = JSON.parse(raw) as Array<{ iface?: string; ipv4?: string }>;
      return parsed.map(p => p.ipv4 ?? p.iface ?? '').filter(Boolean).join(', ') || '—';
    } catch {
      return raw;
    }
  }

  parseTags(tags: string | null): string[] {
    if (!tags) return [];
    return tags.split(',').map(t => t.trim()).filter(Boolean);
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  }

  #loadDevices(): void {
    this.isLoading.set(true);
    const filter: DeviceFilterParams = {
      page: this.currentPage(),
      pageSize: this.pageSize,
      search: this.searchText || undefined,
      state: this.stateFilter || undefined,
      platform: this.platformFilter || undefined,
    };
    this.#svc.getAll(filter).subscribe({
      next: result => {
        this.devices.set(result.data);
        this.total.set(result.total);
        this.isLoading.set(false);
        // Clear any selections that are no longer on this page
        const udidsOnPage = new Set(result.data.map(d => d.udid));
        this.selectedUdids.update(set => new Set([...set].filter(id => udidsOnPage.has(id))));
      },
      error: () => this.isLoading.set(false),
    });
  }
}

