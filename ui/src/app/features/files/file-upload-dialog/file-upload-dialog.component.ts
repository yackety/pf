import {
    ChangeDetectionStrategy,
    Component,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { FilesService } from '../../../core/api/files.service';

@Component({
  selector: 'app-file-upload-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-surface-dim/80 backdrop-blur-sm" aria-hidden="true" (click)="onCancel()"></div>

        <!-- Panel -->
        <div
          class="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl
                 shadow-elevated p-6 mx-4 max-h-[90vh] overflow-y-auto"
          (keydown.escape)="onCancel()"
        >
          <h2 id="upload-title" class="title-lg text-on-surface mb-5">
            <i class="fa-solid fa-upload mr-2 text-primary" aria-hidden="true"></i>Upload File
          </h2>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4" novalidate>

            <!-- Drop zone -->
            <div
              class="border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer"
              [class]="selectedFile() ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary'"
              (click)="fileInput.click()"
              (dragover)="$event.preventDefault()"
              (drop)="onDrop($event)"
            >
              <input #fileInput type="file" class="hidden" (change)="onFileChange($event)" />
              @if (selectedFile()) {
                <div class="flex items-center justify-center gap-3">
                  <i class="fa-solid fa-file-circle-check text-2xl text-primary" aria-hidden="true"></i>
                  <div class="text-left">
                    <p class="body-sm text-on-surface font-medium">{{ selectedFile()!.name }}</p>
                    <p class="body-xs text-on-surface-variant">{{ formatSize(selectedFile()!.size) }}</p>
                  </div>
                </div>
              } @else {
                <i class="fa-solid fa-cloud-arrow-up text-3xl text-on-surface-variant mb-2 block" aria-hidden="true"></i>
                <p class="body-sm text-on-surface">Click or drag & drop a file</p>
                <p class="body-xs text-on-surface-variant mt-1">APK, images, videos, or any file</p>
              }
            </div>

            <!-- App Name -->
            <div>
              <label class="label-sm text-on-surface-variant block mb-1" for="f-appname">App name</label>
              <input
                id="f-appname"
                type="text"
                formControlName="appName"
                placeholder="e.g. Telegram"
                class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                       body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <!-- Version -->
            <div>
              <label class="label-sm text-on-surface-variant block mb-1" for="f-version">Version</label>
              <input
                id="f-version"
                type="text"
                formControlName="version"
                placeholder="e.g. 1.2.3"
                class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                       body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <!-- Package name (APK hint) -->
            <div>
              <label class="label-sm text-on-surface-variant block mb-1" for="f-pkg">
                Package name <span class="text-on-surface-variant/60">(APK only)</span>
              </label>
              <input
                id="f-pkg"
                type="text"
                formControlName="packageName"
                placeholder="com.example.app"
                class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                       body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <!-- Description -->
            <div>
              <label class="label-sm text-on-surface-variant block mb-1" for="f-desc">Description</label>
              <textarea
                id="f-desc"
                formControlName="description"
                rows="2"
                placeholder="Optional notes about this file"
                class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                       body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              ></textarea>
            </div>

            <!-- APK-specific section -->
            <div class="rounded-xl border border-outline-variant p-4 space-y-3">
              <p class="label-sm text-on-surface-variant">
                <i class="fa-solid fa-android mr-1" aria-hidden="true"></i>APK metadata
                <span class="font-normal opacity-60">(optional)</span>
              </p>

              <!-- Requires Android -->
              <div>
                <label class="label-sm text-on-surface-variant block mb-1" for="f-android">Requires Android</label>
                <input
                  id="f-android"
                  type="text"
                  formControlName="requiresAndroid"
                  placeholder="e.g. Android 5.0+ (Lollipop, API 21)"
                  class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                         body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <!-- Permissions Count -->
              <div>
                <label class="label-sm text-on-surface-variant block mb-1" for="f-perms">App permissions count</label>
                <input
                  id="f-perms"
                  type="number"
                  min="0"
                  formControlName="permissionsCount"
                  placeholder="e.g. 74"
                  class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                         body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <!-- Signature -->
              <div>
                <label class="label-sm text-on-surface-variant block mb-1" for="f-sig">Signature (SHA1)</label>
                <input
                  id="f-sig"
                  type="text"
                  formControlName="signature"
                  placeholder="e.g. 17eb76bf..."
                  class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                         body-sm text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <!-- Architectures -->
              <div>
                <label class="label-sm text-on-surface-variant block mb-1" for="f-arch">Architecture</label>
                <input
                  id="f-arch"
                  type="text"
                  formControlName="architectures"
                  placeholder="e.g. arm64-v8a,armeabi-v7a,x86,x86_64"
                  class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                         body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            @if (error()) {
              <p class="body-sm text-error flex items-center gap-2">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{{ error() }}
              </p>
            }

            <!-- Actions -->
            <div class="flex justify-end gap-3 pt-2">
              <button
                type="button"
                (click)="onCancel()"
                class="px-5 py-2.5 rounded-full border border-outline-variant text-on-surface
                       label-md hover:bg-surface-container transition-colors"
              >Cancel</button>
              <button
                type="submit"
                [disabled]="saving() || !selectedFile()"
                class="px-5 py-2.5 rounded-full bg-primary text-on-primary label-md
                       hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                @if (saving()) {
                  <i class="fa-solid fa-spinner animate-spin mr-2" aria-hidden="true"></i>Uploading…
                } @else {
                  <i class="fa-solid fa-upload mr-2" aria-hidden="true"></i>Upload
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class FileUploadDialogComponent {
  readonly #fb = inject(FormBuilder);
  readonly #svc = inject(FilesService);

  open = input.required<boolean>();
  uploaded = output<void>();
  closed = output<void>();

  selectedFile = signal<File | null>(null);
  saving = signal(false);
  error = signal('');

  form = this.#fb.group({
    appName: [''],
    version: [''],
    packageName: [''],
    description: [''],
    requiresAndroid: [''],
    permissionsCount: [null as number | null],
    signature: [''],
    architectures: [''],
  });

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) this.selectedFile.set(f);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const f = event.dataTransfer?.files?.[0];
    if (f) this.selectedFile.set(f);
  }

  onSubmit() {
    const file = this.selectedFile();
    if (!file) return;
    this.saving.set(true);
    this.error.set('');
    const v = this.form.value;
    this.#svc.upload(file, {
      appName: v.appName || undefined,
      version: v.version || undefined,
      packageName: v.packageName || undefined,
      description: v.description || undefined,
      requiresAndroid: v.requiresAndroid || undefined,
      permissionsCount: v.permissionsCount ?? undefined,
      signature: v.signature || undefined,
      architectures: v.architectures || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.selectedFile.set(null);
        this.form.reset();
        this.uploaded.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error ?? 'Upload failed. Please try again.');
      },
    });
  }

  onCancel() {
    if (this.saving()) return;
    this.selectedFile.set(null);
    this.form.reset();
    this.error.set('');
    this.closed.emit();
  }

  formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
