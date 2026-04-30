import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountsService } from '../../../core/api/accounts.service';
import type { Account, Platform } from '../../../core/api/accounts.models';

@Component({
  selector: 'app-account-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="acct-form-title"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-surface-dim/80 backdrop-blur-sm"
          aria-hidden="true"
          (click)="onCancel()"
        ></div>

        <!-- Panel -->
        <div
          class="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl
                 shadow-elevated dark:shadow-elevated-dark p-6 mx-4 max-h-[90vh] overflow-y-auto"
          (keydown.escape)="onCancel()"
        >
          <h2 id="acct-form-title" class="title-lg text-on-surface mb-5">
            <i class="fa-solid fa-user-plus mr-2 text-primary" aria-hidden="true"></i>
            {{ isEdit() ? 'Edit Account' : 'New Account' }}
          </h2>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4" novalidate>
            <!-- Platform -->
            <div>
              <label class="label-sm text-on-surface-variant block mb-1" for="acct-platform">
                Platform <span aria-hidden="true" class="text-error">*</span>
              </label>
              @if (platformsLoading()) {
                <p class="body-sm text-on-surface-variant">Loading platforms…</p>
              } @else {
                <select
                  id="acct-platform"
                  formControlName="platformId"
                  class="w-full px-4 py-2 rounded-xl border bg-surface body-sm text-on-surface
                         focus:outline-none focus:ring-2 focus:ring-primary"
                  [class]="fieldError('platformId') ? 'border-error' : 'border-outline-variant'"
                >
                  <option value="">Select platform…</option>
                  @for (p of platforms(); track p.id) {
                    <option [value]="p.id">{{ p.displayName }}</option>
                  }
                </select>
              }
              @if (fieldError('platformId')) {
                <p class="body-sm text-error mt-1" role="alert">Platform is required.</p>
              }
            </div>

            <!-- Username -->
            <div>
              <label class="label-sm text-on-surface-variant block mb-1" for="acct-username">
                Username <span aria-hidden="true" class="text-error">*</span>
              </label>
              <input
                id="acct-username"
                type="text"
                formControlName="username"
                autocomplete="off"
                class="w-full px-4 py-2 rounded-xl border bg-surface body-sm text-on-surface
                       focus:outline-none focus:ring-2 focus:ring-primary"
                [class]="fieldError('username') ? 'border-error' : 'border-outline-variant'"
              />
              @if (fieldError('username')) {
                <p class="body-sm text-error mt-1" role="alert">Username is required.</p>
              }
            </div>

            <!-- Display Name -->
            <div>
              <label class="label-sm text-on-surface-variant block mb-1" for="acct-display">
                Display Name
              </label>
              <input
                id="acct-display"
                type="text"
                formControlName="displayName"
                class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                       body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <!-- Email -->
            <div>
              <label class="label-sm text-on-surface-variant block mb-1" for="acct-email">
                Email
              </label>
              <input
                id="acct-email"
                type="email"
                formControlName="email"
                class="w-full px-4 py-2 rounded-xl border bg-surface body-sm text-on-surface
                       focus:outline-none focus:ring-2 focus:ring-primary"
                [class]="fieldError('email') ? 'border-error' : 'border-outline-variant'"
              />
              @if (fieldError('email')) {
                <p class="body-sm text-error mt-1" role="alert">Enter a valid email.</p>
              }
            </div>

            <!-- Phone -->
            <div>
              <label class="label-sm text-on-surface-variant block mb-1" for="acct-phone">
                Phone
              </label>
              <input
                id="acct-phone"
                type="tel"
                formControlName="phone"
                class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                       body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <!-- Status (edit only) -->
            @if (isEdit()) {
              <div>
                <label class="label-sm text-on-surface-variant block mb-1" for="acct-status">
                  Status
                </label>
                <select
                  id="acct-status"
                  formControlName="status"
                  class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                         body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="banned">Banned</option>
                </select>
              </div>
            }

            <!-- Notes -->
            <div>
              <label class="label-sm text-on-surface-variant block mb-1" for="acct-notes">
                Notes
              </label>
              <textarea
                id="acct-notes"
                formControlName="notes"
                rows="3"
                class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                       body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              ></textarea>
            </div>

            @if (serverError()) {
              <p class="body-sm text-error" role="alert">{{ serverError() }}</p>
            }

            <div class="flex gap-3 pt-2">
              <button
                type="submit"
                [disabled]="saving()"
                class="flex-1 px-5 py-2 rounded-full bg-primary text-on-primary label-md
                       hover:bg-primary-container disabled:opacity-50
                       focus-visible:ring-2 focus-visible:ring-primary transition-colors"
              >
                @if (saving()) {
                  <i class="fa-solid fa-spinner fa-spin mr-1" aria-hidden="true"></i>
                }
                {{ isEdit() ? 'Save Changes' : 'Create Account' }}
              </button>
              <button
                type="button"
                (click)="onCancel()"
                class="px-5 py-2 rounded-full border border-outline-variant label-md
                       text-on-surface-variant hover:bg-surface-container-high
                       focus-visible:ring-2 focus-visible:ring-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class AccountFormComponent {
  readonly #fb = inject(FormBuilder);
  readonly #acctSvc = inject(AccountsService);

  readonly open = input.required<boolean>();
  readonly account = input<Account | null>(null);

  readonly saved = output<Account>();
  readonly cancelled = output<void>();

  readonly isEdit = computed(() => this.account() != null);
  readonly platforms = signal<Platform[]>([]);
  readonly platformsLoading = signal(true);
  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly form = this.#fb.nonNullable.group({
    platformId: ['', Validators.required],
    username: ['', Validators.required],
    displayName: [''],
    email: ['', Validators.email],
    phone: [''],
    status: ['active'],
    notes: [''],
  });

  constructor() {
    // Load platforms once on first open
    this.#acctSvc.getPlatforms().subscribe({
      next: list => {
        this.platforms.set(list);
        this.platformsLoading.set(false);
      },
      error: () => this.platformsLoading.set(false),
    });

    // Populate form when editing
    effect(() => {
      const acc = this.account();
      if (acc) {
        this.form.patchValue({
          platformId: String(acc.platformId),
          username: acc.username,
          displayName: acc.displayName ?? '',
          email: acc.email ?? '',
          phone: acc.phone ?? '',
          status: acc.status,
          notes: acc.notes ?? '',
        });
      } else if (this.open()) {
        this.form.reset({ status: 'active' });
      }
      this.serverError.set(null);
    });
  }

  fieldError(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.serverError.set(null);

    const v = this.form.getRawValue();
    const req = {
      platformId: Number(v.platformId),
      username: v.username,
      displayName: v.displayName || null,
      email: v.email || null,
      phone: v.phone || null,
      notes: v.notes || null,
      status: v.status,
    };

    const existing = this.account();
    const op$ = existing
      ? this.#acctSvc.update(existing.id, req)
      : this.#acctSvc.create(req);

    op$.subscribe({
      next: result => {
        this.saving.set(false);
        this.saved.emit(result);
      },
      error: () => {
        this.saving.set(false);
        this.serverError.set('Failed to save account. Please try again.');
      },
    });
  }
}
