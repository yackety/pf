import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountsService } from '../../../core/api/accounts.service';
import type { Account, Platform } from '../../../core/api/accounts.models';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { PlatformIconComponent } from '../../../shared/components/platform-icon/platform-icon.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { AccountFormComponent } from '../account-form/account-form.component';

@Component({
  selector: 'app-account-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, StatusBadgeComponent, PlatformIconComponent, ConfirmDialogComponent, AccountFormComponent],
  template: `
    <div>
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="headline-lg text-on-surface">Accounts</h1>
          <p class="body-md text-on-surface-variant mt-1">
            {{ total() }} account{{ total() === 1 ? '' : 's' }}
          </p>
        </div>
        <button
          type="button"
          (click)="openCreate()"
          class="px-5 py-2.5 rounded-full bg-primary text-on-primary label-md
                 hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary transition-colors"
        >
          <i class="fa-solid fa-plus mr-2" aria-hidden="true"></i>New Account
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
            placeholder="Search username, display name…"
            class="pl-9 pr-4 py-2 rounded-full border border-outline-variant bg-surface-container-lowest
                   body-sm text-on-surface placeholder:text-on-surface-variant
                   focus:outline-none focus:ring-2 focus:ring-primary w-64"
            aria-label="Search accounts"
          />
        </div>

        <select
          [(ngModel)]="platformFilter"
          (ngModelChange)="onFilterChange()"
          class="px-4 py-2 rounded-full border border-outline-variant bg-surface-container-lowest
                 body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Filter by platform"
        >
          <option value="">All platforms</option>
          @for (p of platforms(); track p.id) {
            <option [value]="p.id">{{ p.displayName }}</option>
          }
        </select>

        <select
          [(ngModel)]="statusFilter"
          (ngModelChange)="onFilterChange()"
          class="px-4 py-2 rounded-full border border-outline-variant bg-surface-container-lowest
                 body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="banned">Banned</option>
        </select>

        @if (hasFilters()) {
          <button
            type="button"
            (click)="clearFilters()"
            class="px-4 py-2 rounded-full border border-outline-variant body-sm text-on-surface-variant
                   hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-primary transition-colors"
          >
            <i class="fa-solid fa-xmark mr-1" aria-hidden="true"></i>Clear
          </button>
        }
      </div>

      <!-- Table -->
      <div class="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest
                  shadow-card dark:shadow-card-dark">
        <table class="w-full text-sm border-collapse" aria-label="Account list">
          <thead>
            <tr class="border-b border-outline-variant bg-surface-container-high">
              <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Platform</th>
              <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Username</th>
              <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Display Name</th>
              <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Status</th>
              <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Devices</th>
              <th scope="col" class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            @if (isLoading()) {
              <tr>
                <td colspan="6" class="px-4 py-10 text-center text-on-surface-variant">
                  <i class="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true"></i>Loading…
                </td>
              </tr>
            } @else if (accounts().length === 0) {
              <tr>
                <td colspan="6" class="px-4 py-10 text-center text-on-surface-variant body-md">
                  <i class="fa-solid fa-users text-3xl mb-3 block opacity-40" aria-hidden="true"></i>
                  No accounts found
                </td>
              </tr>
            } @else {
              @for (acc of accounts(); track acc.id) {
                <tr class="border-b border-outline-variant last:border-0 hover:bg-surface-container-high transition-colors">
                  <td class="px-4 py-3">
                    <app-platform-icon [platform]="acc.platformName" />
                  </td>
                  <td class="px-4 py-3">
                    <span class="body-sm text-on-surface font-medium">{{ acc.username }}</span>
                  </td>
                  <td class="px-4 py-3 body-sm text-on-surface-variant">{{ acc.displayName ?? '—' }}</td>
                  <td class="px-4 py-3">
                    <app-status-badge [status]="acc.status" />
                  </td>
                  <td class="px-4 py-3 body-sm text-on-surface-variant">{{ acc.activeDeviceCount }}</td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        (click)="openEdit(acc)"
                        class="w-8 h-8 rounded-full flex items-center justify-center
                               text-on-surface-variant hover:bg-surface-container-high
                               focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                        [attr.aria-label]="'Edit ' + acc.username"
                      >
                        <i class="fa-solid fa-pen text-sm" aria-hidden="true"></i>
                      </button>
                      <button
                        type="button"
                        (click)="confirmDelete(acc)"
                        class="w-8 h-8 rounded-full flex items-center justify-center
                               text-error hover:bg-error-container
                               focus-visible:ring-2 focus-visible:ring-error transition-colors"
                        [attr.aria-label]="'Delete ' + acc.username"
                      >
                        <i class="fa-solid fa-trash text-sm" aria-hidden="true"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>

        <!-- Pagination -->
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

    <!-- Create / Edit dialog -->
    <app-account-form
      [open]="formOpen()"
      [account]="editTarget()"
      (saved)="onSaved($event)"
      (cancelled)="closeForm()"
    />

    <!-- Delete confirm -->
    <app-confirm-dialog
      [open]="deleteOpen()"
      title="Delete account"
      [message]="deleteMessage()"
      confirmLabel="Delete"
      variant="danger"
      (confirm)="doDelete()"
      (cancel)="deleteOpen.set(false)"
    />
  `,
})
export class AccountListComponent {
  readonly #svc = inject(AccountsService);

  readonly deleteMessage = computed(() =>
    `Delete '${this.deleteTarget()?.username ?? ''}'? This action cannot be undone.`
  );

  readonly pageSize = 50;
  readonly accounts = signal<Account[]>([]);
  readonly total = signal(0);
  readonly isLoading = signal(true);
  readonly currentPage = signal(1);
  readonly platforms = signal<Platform[]>([]);

  readonly formOpen = signal(false);
  readonly editTarget = signal<Account | null>(null);
  readonly deleteOpen = signal(false);
  readonly deleteTarget = signal<Account | null>(null);

  searchText = '';
  platformFilter = '';
  statusFilter = '';

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly hasFilters = computed(() => !!this.searchText || !!this.platformFilter || !!this.statusFilter);
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
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) pages.push(i);
    return pages;
  });

  constructor() {
    this.#svc.getPlatforms().subscribe({ next: list => this.platforms.set(list) });
    this.#load();
  }

  onSearch(_: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.currentPage.set(1); this.#load(); }, 300);
  }

  onFilterChange(): void { this.currentPage.set(1); this.#load(); }

  clearFilters(): void {
    this.searchText = '';
    this.platformFilter = '';
    this.statusFilter = '';
    this.currentPage.set(1);
    this.#load();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.currentPage.set(p);
    this.#load();
  }

  openCreate(): void { this.editTarget.set(null); this.formOpen.set(true); }
  openEdit(acc: Account): void { this.editTarget.set(acc); this.formOpen.set(true); }
  closeForm(): void { this.formOpen.set(false); }

  onSaved(acc: Account): void {
    this.formOpen.set(false);
    const existing = this.editTarget();
    if (existing) {
      this.accounts.update(list => list.map(a => (a.id === acc.id ? acc : a)));
    } else {
      this.accounts.update(list => [acc, ...list]);
      this.total.update(t => t + 1);
    }
  }

  confirmDelete(acc: Account): void {
    this.deleteTarget.set(acc);
    this.deleteOpen.set(true);
  }

  doDelete(): void {
    const acc = this.deleteTarget();
    if (!acc) return;
    this.deleteOpen.set(false);
    this.#svc.delete(acc.id).subscribe({
      next: () => {
        this.accounts.update(list => list.filter(a => a.id !== acc.id));
        this.total.update(t => t - 1);
      },
    });
  }

  #load(): void {
    this.isLoading.set(true);
    this.#svc.getAll({
      page: this.currentPage(),
      pageSize: this.pageSize,
      search: this.searchText || undefined,
      platformId: this.platformFilter ? Number(this.platformFilter) : undefined,
      status: this.statusFilter || undefined,
    }).subscribe({
      next: result => { this.accounts.set(result.data); this.total.set(result.total); this.isLoading.set(false); },
      error: () => this.isLoading.set(false),
    });
  }
}
