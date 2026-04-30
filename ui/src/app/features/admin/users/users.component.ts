import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsersService } from '../../../core/api/users.service';
import { AuthService } from '../../../core/auth/auth.service';
import type { User } from '../../../core/api/users.models';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, StatusBadgeComponent],
  template: `
    <div>
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="headline-lg text-on-surface">Users</h1>
          <p class="body-md text-on-surface-variant mt-1">Manage administrator and operator accounts</p>
        </div>
        <button
          type="button"
          (click)="openCreate()"
          class="px-5 py-2.5 rounded-full bg-primary text-on-primary label-md
                 hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary transition-colors"
        >
          <i class="fa-solid fa-user-plus mr-2" aria-hidden="true"></i>New User
        </button>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest
                  shadow-card dark:shadow-card-dark">
        <table class="w-full text-sm border-collapse" aria-label="User list">
          <thead>
            <tr class="border-b border-outline-variant bg-surface-container-high">
              <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Username</th>
              <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Role</th>
              <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Status</th>
              <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Created</th>
              <th scope="col" class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            @if (isLoading()) {
              <tr>
                <td colspan="5" class="px-4 py-10 text-center text-on-surface-variant">
                  <i class="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true"></i>Loading…
                </td>
              </tr>
            } @else if (users().length === 0) {
              <tr>
                <td colspan="5" class="px-4 py-10 text-center text-on-surface-variant body-md">
                  <i class="fa-solid fa-users text-3xl mb-3 block opacity-40" aria-hidden="true"></i>
                  No users found
                </td>
              </tr>
            } @else {
              @for (user of users(); track user.id) {
                <tr class="border-b border-outline-variant last:border-0 hover:bg-surface-container-high transition-colors">
                  <td class="px-4 py-3">
                    <span class="body-sm text-on-surface font-medium">{{ user.username }}</span>
                    @if (user.id === currentUserId()?.id) {
                      <span class="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary label-sm">You</span>
                    }
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="px-2.5 py-0.5 rounded-full label-sm font-medium"
                      [class]="user.role === 'Admin'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-surface-container-high text-on-surface-variant'"
                    >{{ user.role }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <app-status-badge [status]="user.isActive ? 'active' : 'inactive'" />
                  </td>
                  <td class="px-4 py-3 body-sm text-on-surface-variant">{{ formatDate(user.createdAt) }}</td>
                  <td class="px-4 py-3 text-right">
                    <button
                      type="button"
                      (click)="openEdit(user)"
                      class="w-8 h-8 rounded-full flex items-center justify-center ml-auto
                             text-on-surface-variant hover:bg-surface-container-high
                             focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                      [attr.aria-label]="'Edit ' + user.username"
                    >
                      <i class="fa-solid fa-pen text-sm" aria-hidden="true"></i>
                    </button>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create / Edit Dialog -->
    @if (formOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-form-title"
      >
        <div
          class="absolute inset-0 bg-surface-dim/80 backdrop-blur-sm"
          aria-hidden="true"
          (click)="closeForm()"
        ></div>
        <div
          class="relative w-full max-w-md bg-surface-container-lowest rounded-2xl
                 shadow-elevated dark:shadow-elevated-dark p-6 mx-4"
          (keydown.escape)="closeForm()"
        >
          <h2 id="user-form-title" class="title-lg text-on-surface mb-5">
            <i class="fa-solid fa-user-gear mr-2 text-primary" aria-hidden="true"></i>
            {{ editTarget() ? 'Edit User' : 'New User' }}
          </h2>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4" novalidate>
            <!-- Username (create only) -->
            @if (!editTarget()) {
              <div>
                <label class="label-sm text-on-surface-variant block mb-1" for="u-username">
                  Username <span aria-hidden="true" class="text-error">*</span>
                </label>
                <input
                  id="u-username"
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
            }

            <!-- Password (create; optional on edit) -->
            <div>
              <label class="label-sm text-on-surface-variant block mb-1" for="u-password">
                Password{{ editTarget() ? ' (leave blank to keep unchanged)' : '' }}
                @if (!editTarget()) { <span aria-hidden="true" class="text-error">*</span> }
              </label>
              <input
                id="u-password"
                type="password"
                formControlName="password"
                autocomplete="new-password"
                class="w-full px-4 py-2 rounded-xl border bg-surface body-sm text-on-surface
                       focus:outline-none focus:ring-2 focus:ring-primary"
                [class]="fieldError('password') ? 'border-error' : 'border-outline-variant'"
              />
              @if (fieldError('password')) {
                <p class="body-sm text-error mt-1" role="alert">Password is required (min 8 chars).</p>
              }
            </div>

            <!-- Role -->
            <div>
              <label class="label-sm text-on-surface-variant block mb-1" for="u-role">Role</label>
              <select
                id="u-role"
                formControlName="role"
                class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                       body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Operator">Operator</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            <!-- Active toggle (edit only) -->
            @if (editTarget()) {
              <div class="flex items-center justify-between py-1">
                <span class="label-md text-on-surface">Active</span>
                <button
                  type="button"
                  role="switch"
                  [attr.aria-checked]="form.controls['isActive'].value"
                  (click)="toggleActive()"
                  class="relative w-11 h-6 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-primary"
                  [class]="form.controls['isActive'].value ? 'bg-primary' : 'bg-surface-container-highest'"
                >
                  <span
                    class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                    [class]="form.controls['isActive'].value ? 'translate-x-5' : 'translate-x-0'"
                  ></span>
                </button>
              </div>
            }

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
                {{ editTarget() ? 'Save Changes' : 'Create User' }}
              </button>
              <button
                type="button"
                (click)="closeForm()"
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
export class UsersComponent {
  readonly #svc = inject(UsersService);
  readonly #auth = inject(AuthService);
  readonly #fb = inject(FormBuilder);

  readonly users = signal<User[]>([]);
  readonly isLoading = signal(true);
  readonly formOpen = signal(false);
  readonly editTarget = signal<User | null>(null);
  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly currentUserId = this.#auth.currentUser;

  readonly form = this.#fb.nonNullable.group({
    username: [''],
    password: [''],
    role: ['Operator' as 'Admin' | 'Operator'],
    isActive: [true],
  });

  constructor() {
    this.#load();
  }

  openCreate(): void {
    this.editTarget.set(null);
    this.form.reset({ role: 'Operator', isActive: true });
    this.form.controls['username'].setValidators([Validators.required]);
    this.form.controls['password'].setValidators([Validators.required, Validators.minLength(8)]);
    this.form.controls['username'].updateValueAndValidity();
    this.form.controls['password'].updateValueAndValidity();
    this.serverError.set(null);
    this.formOpen.set(true);
  }

  openEdit(user: User): void {
    this.editTarget.set(user);
    this.form.reset({ role: user.role, isActive: user.isActive });
    this.form.controls['username'].clearValidators();
    this.form.controls['password'].setValidators([Validators.minLength(8)]);
    this.form.controls['username'].updateValueAndValidity();
    this.form.controls['password'].updateValueAndValidity();
    this.serverError.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void { this.formOpen.set(false); }

  toggleActive(): void {
    const ctrl = this.form.controls['isActive'];
    ctrl.setValue(!ctrl.value);
  }

  fieldError(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.serverError.set(null);

    const v = this.form.getRawValue();
    const existing = this.editTarget();

    const op$ = existing
      ? this.#svc.update(existing.id, {
          role: v.role,
          isActive: v.isActive,
          password: v.password || undefined,
        })
      : this.#svc.create({ username: v.username, password: v.password, role: v.role });

    op$.subscribe({
      next: result => {
        this.saving.set(false);
        this.formOpen.set(false);
        if (existing) {
          this.users.update(list => list.map(u => (u.id === result.id ? result : u)));
        } else {
          this.users.update(list => [...list, result]);
        }
      },
      error: () => {
        this.saving.set(false);
        this.serverError.set('Failed to save user. Please try again.');
      },
    });
  }

  formatDate(iso: string): string {
    return iso ? new Date(iso).toLocaleDateString() : '—';
  }

  #load(): void {
    this.#svc.getAll().subscribe({
      next: list => { this.users.set(list); this.isLoading.set(false); },
      error: () => this.isLoading.set(false),
    });
  }
}
