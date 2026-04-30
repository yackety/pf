import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgOptimizedImage],
  template: `
    <div class="min-h-screen bg-surface flex items-center justify-center p-4">
      <div class="w-full max-w-sm">

        <!-- Logo -->
        <div class="flex justify-center mb-8">
          <img ngSrc="/lazie_logo.png" width="120" height="36" alt="Lazie" priority />
        </div>

        <!-- Card -->
        <div class="bg-surface-container-lowest rounded-xl shadow-card p-8">
          <h1 class="headline-md text-on-surface mb-1">Welcome back</h1>
          <p class="body-md text-on-surface-variant mb-8">Sign in to continue to PhoneFarm</p>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>

            <!-- Username -->
            <div class="mb-5">
              <label for="username" class="block label-md text-on-surface mb-2">Username</label>
              <input
                id="username"
                type="text"
                formControlName="username"
                autocomplete="username"
                placeholder="Enter your username"
                [class]="inputClass(false)"
                [attr.aria-describedby]="usernameError() ? 'username-error' : null"
                [attr.aria-invalid]="usernameError() ? 'true' : null"
              />
              @if (usernameError()) {
                <p id="username-error" class="mt-1.5 label-sm text-error" aria-live="polite">
                  {{ usernameError() }}
                </p>
              }
            </div>

            <!-- Password -->
            <div class="mb-6">
              <label for="password" class="block label-md text-on-surface mb-2">Password</label>
              <input
                id="password"
                type="password"
                formControlName="password"
                autocomplete="current-password"
                placeholder="Enter your password"
                [class]="inputClass(false)"
                [attr.aria-describedby]="passwordError() ? 'password-error' : null"
                [attr.aria-invalid]="passwordError() ? 'true' : null"
              />
              @if (passwordError()) {
                <p id="password-error" class="mt-1.5 label-sm text-error" aria-live="polite">
                  {{ passwordError() }}
                </p>
              }
            </div>

            <!-- Server error -->
            @if (serverError()) {
              <div
                role="alert"
                class="mb-5 px-4 py-3 rounded-lg bg-error-container text-on-error-container label-md"
              >
                <i class="fa-solid fa-circle-exclamation mr-2" aria-hidden="true"></i>
                {{ serverError() }}
              </div>
            }

            <!-- Submit -->
            <button
              type="submit"
              [disabled]="isLoading()"
              class="w-full rounded-full py-3 label-md text-on-primary bg-primary
                     hover:bg-primary-container disabled:opacity-60 disabled:cursor-not-allowed
                     transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
                     focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              @if (isLoading()) {
                <i class="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true"></i>
                Signing in…
              } @else {
                Sign in
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  readonly #fb = inject(FormBuilder);
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);

  readonly isLoading = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly form = this.#fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  readonly usernameError = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);

  inputClass(_hasError: boolean): string {
    return [
      'w-full rounded-full px-5 py-3 body-md bg-surface-container-low',
      'border border-outline-variant outline-none',
      'placeholder:text-on-surface-variant text-on-surface',
      'focus:border-primary focus:ring-2 focus:ring-primary/30',
      'transition-all duration-200',
    ].join(' ');
  }

  submit(): void {
    this.#validateForm();
    if (this.form.invalid) return;

    this.isLoading.set(true);
    this.serverError.set(null);

    const { username, password } = this.form.getRawValue();

    this.#auth.login({ username, password }).subscribe({
      next: () => this.#router.navigate(['/dashboard']),
      error: (err: { message?: string }) => {
        this.isLoading.set(false);
        const msg = err?.message ?? 'Invalid credentials. Please try again.';
        this.serverError.set(msg);
      },
    });
  }

  #validateForm(): void {
    const { username, password } = this.form.controls;
    this.usernameError.set(username.hasError('required') ? 'Username is required.' : null);
    this.passwordError.set(
      password.hasError('required')
        ? 'Password is required.'
        : password.hasError('minlength')
          ? 'Password must be at least 4 characters.'
          : null,
    );
  }
}
