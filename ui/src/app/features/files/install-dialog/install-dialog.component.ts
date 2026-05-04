import {
    ChangeDetectionStrategy,
    Component,
    effect,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Device } from '../../../core/api/devices.models';
import { DevicesService } from '../../../core/api/devices.service';
import type { FileRecord } from '../../../core/api/files.models';
import { FilesService } from '../../../core/api/files.service';

@Component({
  selector: 'app-install-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    @if (open() && file()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-surface-dim/80 backdrop-blur-sm" aria-hidden="true" (click)="onClose()"></div>

        <!-- Panel -->
        <div
          class="relative w-full max-w-xl bg-surface-container-lowest rounded-2xl
                 shadow-elevated p-6 mx-4 max-h-[90vh] flex flex-col"
          (keydown.escape)="onClose()"
        >
          <h2 id="install-title" class="title-lg text-on-surface mb-1">
            <i class="fa-solid fa-mobile-screen-button mr-2 text-primary" aria-hidden="true"></i>
            Install APK to Devices
          </h2>
          <p class="body-sm text-on-surface-variant mb-4">{{ file()!.originalName }}</p>

          <!-- Search -->
          <div class="relative mb-3">
            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2
                       text-on-surface-variant text-sm pointer-events-none" aria-hidden="true"></i>
            <input
              type="search"
              [(ngModel)]="deviceSearch"
              placeholder="Filter devices…"
              class="pl-9 pr-4 py-2 w-full rounded-full border border-outline-variant bg-surface
                     body-sm text-on-surface placeholder:text-on-surface-variant
                     focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <!-- Device list -->
          <div class="flex-1 overflow-y-auto rounded-xl border border-outline-variant divide-y divide-outline-variant min-h-0">
            @if (devicesLoading()) {
              <div class="p-6 text-center body-sm text-on-surface-variant">
                <i class="fa-solid fa-spinner animate-spin mr-2" aria-hidden="true"></i>Loading devices…
              </div>
            }
            @for (d of filteredDevices(); track d.udid) {
              <label
                class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-container-low transition-colors"
              >
                <input
                  type="checkbox"
                  class="accent-primary w-4 h-4 rounded"
                  [checked]="selected().has(d.udid)"
                  (change)="toggleDevice(d.udid)"
                />
                <i class="fa-solid fa-mobile-screen text-on-surface-variant w-4 text-center" aria-hidden="true"></i>
                <div class="flex-1 min-w-0">
                  <p class="body-sm text-on-surface font-medium truncate">
                    {{ d.model ?? d.udid }}
                    @if (d.manufacturer) { <span class="text-on-surface-variant font-normal">· {{ d.manufacturer }}</span> }
                  </p>
                  <p class="body-xs text-on-surface-variant">{{ d.udid }}</p>
                </div>
                <span
                  class="px-2 py-0.5 rounded-full label-xs"
                  [class]="d.state === 'device' ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'"
                >
                  {{ d.state }}
                </span>
              </label>
            } @empty {
              @if (!devicesLoading()) {
                <p class="p-6 text-center body-sm text-on-surface-variant">No devices found.</p>
              }
            }
          </div>

          <!-- Select all / count -->
          <div class="mt-3 flex items-center justify-between">
            <button type="button" (click)="toggleAll()" class="body-sm text-primary hover:underline">
              {{ allSelected() ? 'Deselect all' : 'Select all' }}
            </button>
            <span class="body-sm text-on-surface-variant">{{ selected().size }} selected</span>
          </div>

          <!-- Result messages -->
          @if (results().length) {
            <div class="mt-3 max-h-28 overflow-y-auto rounded-xl border border-outline-variant divide-y divide-outline-variant">
              @for (r of results(); track r.udid) {
                <div class="flex items-center gap-2 px-3 py-2">
                  <i
                    [class]="r.success ? 'fa-solid fa-circle-check text-primary' : 'fa-solid fa-circle-xmark text-error'"
                    aria-hidden="true"
                  ></i>
                  <span class="body-xs text-on-surface">{{ r.udid }}</span>
                  @if (!r.success) {
                    <span class="body-xs text-error ml-auto truncate max-w-[180px]">{{ r.error }}</span>
                  }
                </div>
              }
            </div>
          }

          @if (globalError()) {
            <p class="mt-2 body-sm text-error flex gap-2 items-center">
              <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{{ globalError() }}
            </p>
          }

          <!-- Actions -->
          <div class="mt-4 flex justify-end gap-3">
            <button
              type="button"
              (click)="onClose()"
              class="px-5 py-2.5 rounded-full border border-outline-variant text-on-surface
                     label-md hover:bg-surface-container transition-colors"
            >Close</button>
            <button
              type="button"
              (click)="onInstall()"
              [disabled]="installing() || selected().size === 0"
              class="px-5 py-2.5 rounded-full bg-primary text-on-primary label-md
                     hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              @if (installing()) {
                <i class="fa-solid fa-spinner animate-spin mr-2" aria-hidden="true"></i>Installing…
              } @else {
                <i class="fa-solid fa-download mr-2" aria-hidden="true"></i>Install ({{ selected().size }})
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class InstallDialogComponent {
  readonly #files = inject(FilesService);
  readonly #devices = inject(DevicesService);

  open = input.required<boolean>();
  file = input<FileRecord | null>(null);
  closed = output<void>();

  devices = signal<Device[]>([]);
  devicesLoading = signal(false);
  deviceSearch = '';
  selected = signal<Set<string>>(new Set());
  installing = signal(false);
  results = signal<{ udid: string; success: boolean; error?: string }[]>([]);
  globalError = signal('');

  filteredDevices = () => {
    const q = this.deviceSearch.toLowerCase();
    return this.devices().filter(d =>
      !q ||
      d.udid.toLowerCase().includes(q) ||
      (d.model ?? '').toLowerCase().includes(q) ||
      (d.manufacturer ?? '').toLowerCase().includes(q));
  };

  allSelected = () => this.devices().length > 0 && this.selected().size === this.devices().length;

  constructor() {
    effect(() => {
      if (this.open() && this.file()) {
        this.loadDevices();
        this.selected.set(new Set());
        this.results.set([]);
        this.globalError.set('');
      }
    });
  }

  loadDevices() {
    this.devicesLoading.set(true);
    this.#devices.getAll({ state: 'device', pageSize: 200 }).subscribe({
      next: (res) => { this.devices.set(res.data); this.devicesLoading.set(false); },
      error: () => this.devicesLoading.set(false),
    });
  }

  toggleDevice(udid: string) {
    const s = new Set(this.selected());
    if (s.has(udid)) s.delete(udid); else s.add(udid);
    this.selected.set(s);
  }

  toggleAll() {
    if (this.allSelected()) {
      this.selected.set(new Set());
    } else {
      this.selected.set(new Set(this.devices().map(d => d.udid)));
    }
  }

  onInstall() {
    const file = this.file();
    if (!file || this.selected().size === 0) return;
    this.installing.set(true);
    this.results.set([]);
    this.globalError.set('');
    this.#files.install(file.id, { udids: [...this.selected()] }).subscribe({
      next: (res: any) => {
        this.installing.set(false);
        this.results.set(res?.results ?? []);
      },
      error: (err) => {
        this.installing.set(false);
        this.globalError.set(err?.error?.error ?? 'Install request failed.');
      },
    });
  }

  onClose() {
    if (!this.installing()) this.closed.emit();
  }
}
