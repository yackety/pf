import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FileRecord } from '../../../core/api/files.models';
import { FilesService } from '../../../core/api/files.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FileUploadDialogComponent } from '../file-upload-dialog/file-upload-dialog.component';
import { InstallDialogComponent } from '../install-dialog/install-dialog.component';

@Component({
  selector: 'app-file-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ConfirmDialogComponent, FileUploadDialogComponent, InstallDialogComponent],
  template: `
    <div>
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="headline-lg text-on-surface">Files</h1>
          <p class="body-md text-on-surface-variant mt-1">
            {{ total() }} file{{ total() === 1 ? '' : 's' }}
          </p>
        </div>
        <button
          type="button"
          (click)="showUpload.set(true)"
          class="px-5 py-2.5 rounded-full bg-primary text-on-primary label-md
                 hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary transition-colors"
        >
          <i class="fa-solid fa-upload mr-2" aria-hidden="true"></i>Upload File
        </button>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-3 mb-5">
        <div class="relative">
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2
                     text-on-surface-variant text-sm pointer-events-none" aria-hidden="true"></i>
          <input
            type="search"
            [(ngModel)]="searchText"
            (ngModelChange)="onSearch($event)"
            placeholder="Search files…"
            class="pl-9 pr-4 py-2 rounded-full border border-outline-variant bg-surface-container-lowest
                   body-sm text-on-surface placeholder:text-on-surface-variant
                   focus:outline-none focus:ring-2 focus:ring-primary w-56"
          />
        </div>

        <select
          [(ngModel)]="typeFilter"
          (ngModelChange)="onFilterChange()"
          class="px-4 py-2 rounded-full border border-outline-variant bg-surface-container-lowest
                 body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All types</option>
          <option value="apk">APK</option>
          <option value="images">Images</option>
          <option value="videos">Videos</option>
          <option value="other">Other</option>
        </select>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="flex items-center gap-2 text-on-surface-variant body-sm py-8 justify-center">
          <i class="fa-solid fa-spinner animate-spin" aria-hidden="true"></i>Loading…
        </div>
      }

      <!-- Table -->
      @if (!loading()) {
        <div class="rounded-2xl border border-outline-variant overflow-hidden">
          <table class="w-full text-left">
            <thead class="bg-surface-container border-b border-outline-variant">
              <tr>
                <th class="px-4 py-3 label-sm text-on-surface-variant">File</th>
                <th class="px-4 py-3 label-sm text-on-surface-variant">Type</th>
                <th class="px-4 py-3 label-sm text-on-surface-variant">Version</th>
                <th class="px-4 py-3 label-sm text-on-surface-variant">Size</th>
                <th class="px-4 py-3 label-sm text-on-surface-variant">Uploaded</th>
                <th class="px-4 py-3 label-sm text-on-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant">
              @for (file of files(); track file.id) {
                <tr class="hover:bg-surface-container-low transition-colors">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <i [class]="fileIcon(file)" class="text-lg w-5 text-center text-primary" aria-hidden="true"></i>
                      <div>
                        <p class="body-sm text-on-surface font-medium">
                          {{ file.appName ?? file.originalName }}
                        </p>
                        @if (file.appName) {
                          <p class="body-xs text-on-surface-variant">{{ file.originalName }}</p>
                        }
                        @if (file.packageName) {
                          <p class="body-xs text-on-surface-variant">{{ file.packageName }}</p>
                        }
                        @if (file.architectures) {
                          <p class="body-xs text-on-surface-variant/70 font-mono">{{ file.architectures }}</p>
                        }
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <span class="px-2.5 py-0.5 rounded-full label-xs font-medium" [class]="typeChipClass(file.fileType)">
                      {{ file.fileType.toUpperCase() }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <p class="body-sm text-on-surface-variant">{{ file.version ?? '—' }}</p>
                    @if (file.requiresAndroid) {
                      <p class="body-xs text-on-surface-variant/70">{{ file.requiresAndroid }}</p>
                    }
                    @if (file.permissionsCount != null) {
                      <p class="body-xs text-on-surface-variant/70">
                        <i class="fa-solid fa-shield-halved mr-1" aria-hidden="true"></i>{{ file.permissionsCount }} perms
                      </p>
                    }
                  </td>
                  <td class="px-4 py-3 body-sm text-on-surface-variant">{{ formatSize(file.fileSize) }}</td>
                  <td class="px-4 py-3 body-sm text-on-surface-variant">{{ formatDate(file.uploadedAt) }}</td>
                  <td class="px-4 py-3">
                    <div class="flex items-center justify-end gap-2">
                      @if (file.fileType === 'apk') {
                        <button
                          type="button"
                          title="Install to devices"
                          (click)="openInstall(file)"
                          class="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant
                                 hover:text-primary transition-colors"
                        >
                          <i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i>
                        </button>
                      }
                      <button
                        type="button"
                        title="Delete"
                        (click)="confirmDelete(file)"
                        class="p-2 rounded-full hover:bg-error-container text-on-surface-variant
                               hover:text-error transition-colors"
                      >
                        <i class="fa-solid fa-trash" aria-hidden="true"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="px-4 py-12 text-center body-sm text-on-surface-variant">
                    <i class="fa-solid fa-folder-open text-2xl mb-2 block" aria-hidden="true"></i>
                    No files found.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <div class="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              [disabled]="page() <= 1"
              (click)="changePage(page() - 1)"
              class="px-3 py-1.5 rounded-full border border-outline-variant body-sm text-on-surface
                     hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
            </button>
            <span class="body-sm text-on-surface-variant">{{ page() }} / {{ totalPages() }}</span>
            <button
              type="button"
              [disabled]="page() >= totalPages()"
              (click)="changePage(page() + 1)"
              class="px-3 py-1.5 rounded-full border border-outline-variant body-sm text-on-surface
                     hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>
        }
      }
    </div>

    <!-- Upload dialog -->
    <app-file-upload-dialog
      [open]="showUpload()"
      (uploaded)="onUploaded()"
      (closed)="showUpload.set(false)"
    />

    <!-- Install dialog -->
    <app-install-dialog
      [open]="installFile() !== null"
      [file]="installFile()"
      (closed)="installFile.set(null)"
    />

    <!-- Delete confirm -->
    <app-confirm-dialog
      [open]="deleteTarget() !== null"
      title="Delete File"
      [message]="'Delete ' + (deleteTarget()?.originalName ?? '') + '? This cannot be undone.'"
      confirmLabel="Delete"
      variant="danger"
      (confirm)="onDeleteConfirmed()"
      (cancel)="deleteTarget.set(null)"
    />
  `,
})
export class FileListComponent {
  readonly #svc = inject(FilesService);

  files = signal<FileRecord[]>([]);
  total = signal(0);
  loading = signal(false);
  page = signal(1);
  readonly pageSize = 50;
  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  searchText = '';
  typeFilter = '';

  showUpload = signal(false);
  installFile = signal<FileRecord | null>(null);
  deleteTarget = signal<FileRecord | null>(null);

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.#svc.getAll({
      fileType: this.typeFilter || undefined,
      search: this.searchText || undefined,
      page: this.page(),
      pageSize: this.pageSize,
    }).subscribe({
      next: (res) => {
        this.files.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(_: string) { this.page.set(1); this.load(); }
  onFilterChange() { this.page.set(1); this.load(); }
  changePage(p: number) { this.page.set(p); this.load(); }

  openInstall(file: FileRecord) { this.installFile.set(file); }
  confirmDelete(file: FileRecord) { this.deleteTarget.set(file); }

  onUploaded() {
    this.showUpload.set(false);
    this.page.set(1);
    this.load();
  }

  onDeleteConfirmed() {
    const f = this.deleteTarget();
    if (!f) return;
    this.deleteTarget.set(null);
    this.#svc.delete(f.id).subscribe(() => this.load());
  }

  fileIcon(f: FileRecord): string {
    if (f.fileType === 'apk') return 'fa-solid fa-file-zipper';
    if (f.fileType === 'images') return 'fa-solid fa-image';
    if (f.fileType === 'videos') return 'fa-solid fa-film';
    return 'fa-solid fa-file';
  }

  typeChipClass(type: string): string {
    const map: Record<string, string> = {
      apk: 'bg-primary/10 text-primary',
      images: 'bg-tertiary/10 text-tertiary',
      videos: 'bg-secondary/10 text-secondary',
      other: 'bg-surface-container text-on-surface-variant',
    };
    return map[type] ?? map['other'];
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
