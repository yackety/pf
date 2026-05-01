import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DevicesService } from '../../../core/api/devices.service';
import { AccountsService } from '../../../core/api/accounts.service';
import { DeviceHubService } from '../../../core/signalr/device-hub.service';
import type { Device, DeviceAccount, DeviceSessionLog } from '../../../core/api/devices.models';
import type { Account } from '../../../core/api/accounts.models';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { PlatformIconComponent } from '../../../shared/components/platform-icon/platform-icon.component';

type Tab = 'info' | 'accounts' | 'log';

@Component({
  selector: 'app-device-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ReactiveFormsModule, StatusBadgeComponent, PlatformIconComponent],
  template: `
    <div>
      <!-- Back link -->
      <button
        type="button"
        (click)="goBack()"
        class="inline-flex items-center gap-2 mb-5 body-sm text-on-surface-variant
               hover:text-primary focus-visible:ring-2 focus-visible:ring-primary rounded
               transition-colors"
      >
        <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
        Back to Devices
      </button>

      @if (isLoading()) {
        <div class="flex items-center justify-center py-24" aria-live="polite" aria-busy="true">
          <i class="fa-solid fa-spinner fa-spin text-primary text-3xl" aria-hidden="true"></i>
          <span class="sr-only">Loading device…</span>
        </div>
      } @else if (error()) {
        <div role="alert" class="px-5 py-4 rounded-xl bg-error-container text-on-error-container body-md">
          <i class="fa-solid fa-circle-exclamation mr-2" aria-hidden="true"></i>{{ error() }}
        </div>
      } @else if (device()) {
        <!-- Device header card -->
        <div class="bg-surface-container-lowest rounded-xl shadow-card dark:shadow-card-dark p-6 mb-6 flex items-start gap-5">
          <div class="flex-shrink-0 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <app-platform-icon [platform]="device()!.platform" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="headline-md text-on-surface">{{ device()!.model ?? device()!.udid }}</h1>
              <app-status-badge [status]="liveState() ?? device()!.state" />
            </div>
            <p class="body-sm text-on-surface-variant font-mono mt-1">{{ device()!.udid }}</p>
            <p class="body-sm text-on-surface-variant mt-0.5">
              {{ device()!.manufacturer ?? '' }}
              @if (device()!.osVersion) { · {{ device()!.platform }} {{ device()!.osVersion }} }
            </p>
          </div>
          <!-- Send Command button -->
          <button
            type="button"
            (click)="openCommandDialog()"
            class="flex-shrink-0 px-4 py-2 rounded-full bg-primary text-on-primary label-md
                   hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary
                   transition-colors"
          >
            <i class="fa-solid fa-terminal mr-2" aria-hidden="true"></i>
            Send Command
          </button>
        </div>

        <!-- Tabs -->
        <div class="border-b border-outline-variant mb-6" role="tablist" aria-label="Device sections">
          @for (tab of tabs; track tab.id) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === tab.id"
              [attr.aria-controls]="tab.id + '-panel'"
              [id]="tab.id + '-tab'"
              (click)="activeTab.set(tab.id)"
              class="px-5 py-3 label-md border-b-2 transition-colors focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
              [class]="activeTab() === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'"
            >
              <i [class]="tab.icon + ' mr-2'" aria-hidden="true"></i>{{ tab.label }}
            </button>
          }
        </div>

        <!-- ── Info tab ──────────────────────────────────────────────── -->
        @if (activeTab() === 'info') {
          <div id="info-panel" role="tabpanel" aria-labelledby="info-tab">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Properties card -->
              <div class="bg-surface-container-lowest rounded-xl shadow-card dark:shadow-card-dark p-6">
                <h2 class="title-md text-on-surface mb-4">Device Properties</h2>
                <dl class="space-y-3">
                  @for (prop of deviceProps(); track prop.label) {
                    <div class="flex gap-3">
                      <dt class="label-sm text-on-surface-variant w-32 shrink-0">{{ prop.label }}</dt>
                      <dd class="body-sm text-on-surface break-all">{{ prop.value }}</dd>
                    </div>
                  }
                </dl>
              </div>

              <!-- Tags & Notes card -->
              <div class="bg-surface-container-lowest rounded-xl shadow-card dark:shadow-card-dark p-6">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="title-md text-on-surface">Tags &amp; Notes</h2>
                  @if (!editingMeta()) {
                    <button
                      type="button"
                      (click)="startEditMeta()"
                      class="px-3 py-1.5 rounded-full border border-outline-variant label-sm
                             text-on-surface-variant hover:bg-surface-container-high
                             focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                    >
                      <i class="fa-solid fa-pen mr-1" aria-hidden="true"></i>Edit
                    </button>
                  }
                </div>
                @if (editingMeta()) {
                  <form [formGroup]="metaForm" (ngSubmit)="saveMeta()" class="space-y-4">
                    <div>
                      <label class="label-sm text-on-surface-variant block mb-1" for="tags-input">Tags</label>
                      <input
                        id="tags-input"
                        type="text"
                        formControlName="tags"
                        placeholder="comma, separated, tags"
                        class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                               body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label class="label-sm text-on-surface-variant block mb-1" for="notes-input">Notes</label>
                      <textarea
                        id="notes-input"
                        formControlName="notes"
                        rows="4"
                        class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                               body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      ></textarea>
                    </div>
                    <div class="flex gap-3">
                      <button
                        type="submit"
                        [disabled]="savingMeta()"
                        class="px-5 py-2 rounded-full bg-primary text-on-primary label-md
                               hover:bg-primary-container disabled:opacity-50
                               focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                      >
                        @if (savingMeta()) {
                          <i class="fa-solid fa-spinner fa-spin mr-1" aria-hidden="true"></i>
                        }
                        Save
                      </button>
                      <button
                        type="button"
                        (click)="cancelEditMeta()"
                        class="px-5 py-2 rounded-full border border-outline-variant label-md
                               text-on-surface-variant hover:bg-surface-container-high
                               focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                } @else {
                  <dl class="space-y-3">
                    <div>
                      <dt class="label-sm text-on-surface-variant mb-1">Tags</dt>
                      <dd>
                        @if (device()!.tags) {
                          <div class="flex flex-wrap gap-1">
                            @for (tag of parseTags(device()!.tags); track tag) {
                              <span class="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary label-sm">{{ tag }}</span>
                            }
                          </div>
                        } @else {
                          <span class="body-sm text-on-surface-variant italic">None</span>
                        }
                      </dd>
                    </div>
                    <div>
                      <dt class="label-sm text-on-surface-variant mb-1">Notes</dt>
                      <dd class="body-sm text-on-surface whitespace-pre-wrap">{{ device()!.notes || '—' }}</dd>
                    </div>
                  </dl>
                }
              </div>
            </div>

            <!-- Raw JSON collapsible -->
            @if (device()!.rawProps) {
              <div class="mt-6 bg-surface-container-lowest rounded-xl shadow-card dark:shadow-card-dark">
                <button
                  type="button"
                  (click)="rawExpanded.update(v => !v)"
                  class="w-full flex items-center justify-between px-6 py-4 label-md text-on-surface-variant
                         hover:bg-surface-container-high rounded-xl
                         focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset transition-colors"
                  [attr.aria-expanded]="rawExpanded()"
                >
                  <span><i class="fa-solid fa-code mr-2" aria-hidden="true"></i>Raw Props (JSON)</span>
                  <i [class]="rawExpanded() ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"
                     aria-hidden="true"></i>
                </button>
                @if (rawExpanded()) {
                  <div class="px-6 pb-6">
                    <pre class="bg-surface-container p-4 rounded-xl overflow-x-auto body-sm font-mono text-on-surface text-xs leading-relaxed">{{ prettyJson(device()!.rawProps) }}</pre>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- ── Accounts tab ──────────────────────────────────────────── -->
        @if (activeTab() === 'accounts') {
          <div id="accounts-panel" role="tabpanel" aria-labelledby="accounts-tab">
            <div class="bg-surface-container-lowest rounded-xl shadow-card dark:shadow-card-dark overflow-hidden">
              <div class="px-6 py-4 border-b border-outline-variant flex items-center justify-between flex-wrap gap-3">
                <h2 class="title-md text-on-surface">Linked Accounts</h2>
                <!-- Search and add -->
                <div class="relative">
                  <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2
                             text-on-surface-variant text-sm pointer-events-none" aria-hidden="true"></i>
                  <input
                    type="search"
                    [(ngModel)]="linkSearch"
                    (ngModelChange)="onLinkSearch($event)"
                    placeholder="Search accounts to link…"
                    class="pl-9 pr-4 py-2 rounded-full border border-outline-variant bg-surface-container-lowest
                           body-sm text-on-surface placeholder:text-on-surface-variant
                           focus:outline-none focus:ring-2 focus:ring-primary w-56"
                    aria-label="Search accounts to link"
                    aria-autocomplete="list"
                    [attr.aria-expanded]="linkResults().length > 0"
                    aria-controls="link-results"
                  />
                  @if (linkResults().length > 0) {
                    <ul
                      id="link-results"
                      role="listbox"
                      aria-label="Account search results"
                      class="absolute right-0 top-full mt-1 w-72 bg-surface-container-lowest rounded-xl
                             shadow-elevated dark:shadow-elevated-dark border border-outline-variant z-10
                             max-h-48 overflow-y-auto"
                    >
                      @for (res of linkResults(); track res.id) {
                        <li
                          role="option"
                          [attr.aria-selected]="false"
                          class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-high
                                 cursor-pointer transition-colors body-sm text-on-surface"
                          (click)="linkAccount(res)"
                          (keydown.enter)="linkAccount(res)"
                          tabindex="0"
                        >
                          <app-platform-icon [platform]="res.platformName" />
                          <span class="flex-1 min-w-0">
                            <span class="font-medium block truncate">{{ res.username }}</span>
                            <span class="text-on-surface-variant text-xs">{{ res.platformName }}</span>
                          </span>
                          <i class="fa-solid fa-plus text-primary text-sm" aria-hidden="true"></i>
                        </li>
                      }
                    </ul>
                  }
                </div>
              </div>
              @if (accountsLoading()) {
                <div class="px-6 py-10 text-center text-on-surface-variant">
                  <i class="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true"></i>Loading…
                </div>
              } @else if (accounts().length === 0) {
                <div class="px-6 py-10 text-center text-on-surface-variant body-md">
                  <i class="fa-solid fa-user-slash text-2xl mb-2 block opacity-40" aria-hidden="true"></i>
                  No accounts linked to this device
                </div>
              } @else {
                <table class="w-full text-sm border-collapse" aria-label="Linked accounts">
                  <thead>
                    <tr class="border-b border-outline-variant bg-surface-container-high">
                      <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Platform</th>
                      <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Username</th>
                      <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Display Name</th>
                      <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Status</th>
                      <th scope="col" class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide">Assigned</th>
                      <th scope="col" class="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (acc of accounts(); track acc.deviceAccountId) {
                      <tr class="border-b border-outline-variant last:border-0 hover:bg-surface-container-high transition-colors">
                        <td class="px-4 py-3">
                          <app-platform-icon [platform]="acc.platformName" />
                        </td>
                        <td class="px-4 py-3 body-sm text-on-surface font-medium">{{ acc.username }}</td>
                        <td class="px-4 py-3 body-sm text-on-surface-variant">{{ acc.displayName ?? '—' }}</td>
                        <td class="px-4 py-3">
                          <app-status-badge [status]="acc.status" />
                        </td>
                        <td class="px-4 py-3 body-sm text-on-surface-variant">{{ formatDate(acc.assignedAt) }}</td>
                        <td class="px-4 py-3 text-right">
                          <button
                            type="button"
                            (click)="unlinkAccount(acc)"
                            class="px-3 py-1.5 rounded-full border border-error text-error label-sm
                                   hover:bg-error-container focus-visible:ring-2 focus-visible:ring-error
                                   transition-colors"
                            [attr.aria-label]="'Unlink ' + acc.username"
                          >
                            <i class="fa-solid fa-unlink mr-1" aria-hidden="true"></i>Unlink
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </div>
        }

        <!-- ── Session Log tab ───────────────────────────────────────── -->
        @if (activeTab() === 'log') {
          <div id="log-panel" role="tabpanel" aria-labelledby="log-tab">
            <div class="bg-surface-container-lowest rounded-xl shadow-card dark:shadow-card-dark overflow-hidden">
              <div class="px-6 py-4 border-b border-outline-variant">
                <h2 class="title-md text-on-surface">Session Log</h2>
              </div>
              @if (logLoading()) {
                <div class="px-6 py-10 text-center text-on-surface-variant">
                  <i class="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true"></i>Loading…
                </div>
              } @else if (logEntries().length === 0) {
                <div class="px-6 py-10 text-center text-on-surface-variant body-md">
                  <i class="fa-solid fa-clipboard-list text-2xl mb-2 block opacity-40" aria-hidden="true"></i>
                  No session events recorded
                </div>
              } @else {
                <ol class="divide-y divide-outline-variant" aria-label="Session log timeline">
                  @for (entry of logEntries(); track entry.id) {
                    <li class="px-6 py-4 flex items-start gap-4 hover:bg-surface-container-high transition-colors">
                      <div class="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                           [class]="logEventClass(entry.event)">
                        <i [class]="logEventIcon(entry.event)" aria-hidden="true"></i>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="label-md text-on-surface">{{ entry.event }}</p>
                        @if (entry.detail) {
                          <p class="body-sm text-on-surface-variant mt-0.5">{{ entry.detail }}</p>
                        }
                      </div>
                      <time class="body-sm text-on-surface-variant shrink-0" [attr.datetime]="entry.occurredAt">
                        {{ formatDate(entry.occurredAt) }}
                      </time>
                    </li>
                  }
                </ol>
                <!-- Log pagination -->
                @if (logTotal() > logPageSize) {
                  <div class="flex items-center justify-between px-6 py-3 border-t border-outline-variant bg-surface-container">
                    <span class="body-sm text-on-surface-variant">{{ logPage() }} of {{ logTotalPages() }}</span>
                    <div class="flex gap-2">
                      <button
                        type="button"
                        [disabled]="logPage() <= 1"
                        (click)="goLogPage(logPage() - 1)"
                        class="px-3 py-1.5 rounded-full border border-outline-variant label-sm
                               text-on-surface-variant hover:bg-surface-container-high
                               disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                        aria-label="Previous log page"
                      >
                        <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
                      </button>
                      <button
                        type="button"
                        [disabled]="logPage() >= logTotalPages()"
                        (click)="goLogPage(logPage() + 1)"
                        class="px-3 py-1.5 rounded-full border border-outline-variant label-sm
                               text-on-surface-variant hover:bg-surface-container-high
                               disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                        aria-label="Next log page"
                      >
                        <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
                      </button>
                    </div>
                  </div>
                }
              }
            </div>
          </div>
        }
      }
    </div>

    <!-- ── Send Command Dialog ───────────────────────────────────────── -->
    @if (commandDialogOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmd-dialog-title"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-surface-dim/80 backdrop-blur-sm"
          (click)="closeCommandDialog()"
          aria-hidden="true"
        ></div>
        <!-- Panel -->
        <div class="relative w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-elevated
                    dark:shadow-elevated-dark p-6 mx-4">
          <h2 id="cmd-dialog-title" class="title-lg text-on-surface mb-5">
            <i class="fa-solid fa-terminal mr-2 text-primary" aria-hidden="true"></i>
            Send Command
          </h2>
          <form [formGroup]="commandForm" (ngSubmit)="sendCommand()" class="space-y-4">
            <div>
              <label class="label-sm text-on-surface-variant block mb-1" for="cmd-type">Command Type</label>
              <input
                id="cmd-type"
                type="text"
                formControlName="type"
                placeholder="e.g. reboot, screenshot, shell"
                class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                       body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              @if (commandForm.controls['type'].invalid && commandForm.controls['type'].touched) {
                <p class="body-sm text-error mt-1" role="alert">Command type is required.</p>
              }
            </div>
            <div>
              <label class="label-sm text-on-surface-variant block mb-1" for="cmd-params">Params (JSON, optional)</label>
              <textarea
                id="cmd-params"
                formControlName="params"
                rows="3"
                placeholder='{"key": "value"}'
                class="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface
                       body-sm text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              ></textarea>
            </div>
            @if (commandError()) {
              <p class="body-sm text-error" role="alert">{{ commandError() }}</p>
            }
            @if (commandSuccess()) {
              <p class="body-sm text-green-700" role="status">Command sent successfully.</p>
            }
            <div class="flex gap-3 pt-1">
              <button
                type="submit"
                [disabled]="commandSending()"
                class="flex-1 px-5 py-2 rounded-full bg-primary text-on-primary label-md
                       hover:bg-primary-container disabled:opacity-50
                       focus-visible:ring-2 focus-visible:ring-primary transition-colors"
              >
                @if (commandSending()) {
                  <i class="fa-solid fa-spinner fa-spin mr-1" aria-hidden="true"></i>
                }
                Send
              </button>
              <button
                type="button"
                (click)="closeCommandDialog()"
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
export class DeviceDetailComponent {
  readonly #svc = inject(DevicesService);
  readonly #acctSvc = inject(AccountsService);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #hub = inject(DeviceHubService);
  readonly #fb = inject(FormBuilder);

  readonly udid = this.#route.snapshot.paramMap.get('udid') ?? '';

  readonly device = signal<Device | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly accounts = signal<DeviceAccount[]>([]);
  readonly accountsLoading = signal(false);
  readonly #accountsLoaded = signal(false);

  readonly logEntries = signal<DeviceSessionLog[]>([]);
  readonly logLoading = signal(false);
  readonly #logLoaded = signal(false);
  readonly logTotal = signal(0);
  readonly logPage = signal(1);
  readonly logPageSize = 50;
  readonly logTotalPages = computed(() => Math.max(1, Math.ceil(this.logTotal() / this.logPageSize)));

  readonly activeTab = signal<Tab>('info');
  readonly rawExpanded = signal(false);

  readonly editingMeta = signal(false);
  readonly savingMeta = signal(false);

  readonly commandDialogOpen = signal(false);
  readonly commandSending = signal(false);
  readonly commandError = signal<string | null>(null);
  readonly commandSuccess = signal(false);

  // Account link search
  linkSearch = '';
  readonly linkResults = signal<Account[]>([]);
  private linkSearchTimer: ReturnType<typeof setTimeout> | null = null;

  // Live SignalR state override
  readonly #liveStateMap = signal<Map<string, string>>(new Map());
  readonly liveState = computed(() => this.#liveStateMap().get(this.udid));

  readonly tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'info', label: 'Info', icon: 'fa-solid fa-circle-info' },
    { id: 'accounts', label: 'Accounts', icon: 'fa-solid fa-users' },
    { id: 'log', label: 'Session Log', icon: 'fa-solid fa-clipboard-list' },
  ];

  readonly metaForm = this.#fb.nonNullable.group({
    tags: [''],
    notes: [''],
  });

  readonly commandForm = this.#fb.nonNullable.group({
    type: ['', Validators.required],
    params: [''],
  });

  readonly deviceProps = computed(() => {
    const d = this.device();
    if (!d) return [];
    return [
      { label: 'UDID', value: d.udid },
      { label: 'Platform', value: d.platform },
      { label: 'Manufacturer', value: d.manufacturer ?? '—' },
      { label: 'Model', value: d.model ?? '—' },
      { label: 'OS Version', value: d.osVersion ?? '—' },
      { label: 'SDK Version', value: d.sdkVersion ?? '—' },
      { label: 'IP Addresses', value: this.formatIps(d.ipAddresses) },
      { label: 'State', value: d.state },
      { label: 'Last Seen', value: this.formatDate(d.lastSeenAt) },
      { label: 'Created', value: this.formatDate(d.createdAt) },
    ];
  });

  constructor() {
    this.#loadDevice();

    // React to tab changes to lazy-load accounts/log
    effect(() => {
      const tab = this.activeTab();
      if (tab === 'accounts' && !this.#accountsLoaded()) this.#loadAccounts();
      if (tab === 'log' && !this.#logLoaded()) this.#loadLog();
    });

    // SignalR live state
    effect(() => {
      const ev = this.#hub.deviceStateChanged();
      if (ev?.udid === this.udid) {
        this.#liveStateMap.update(m => new Map(m).set(this.udid, ev.state));
      }
    });
  }

  goBack(): void {
    this.#router.navigate(['/devices']);
  }

  startEditMeta(): void {
    const d = this.device();
    if (!d) return;
    this.metaForm.setValue({ tags: d.tags ?? '', notes: d.notes ?? '' });
    this.editingMeta.set(true);
  }

  cancelEditMeta(): void {
    this.editingMeta.set(false);
  }

  saveMeta(): void {
    if (this.metaForm.invalid) return;
    this.savingMeta.set(true);
    const { tags, notes } = this.metaForm.getRawValue();
    this.#svc.updateMeta(this.udid, { tags: tags || null, notes: notes || null }).subscribe({
      next: updated => {
        this.device.set(updated);
        this.editingMeta.set(false);
        this.savingMeta.set(false);
      },
      error: () => this.savingMeta.set(false),
    });
  }

  unlinkAccount(acc: DeviceAccount): void {
    this.#svc.unlinkAccount(this.udid, acc.accountId).subscribe({
      next: () => this.accounts.update(list => list.filter(a => a.deviceAccountId !== acc.deviceAccountId)),
    });
  }

  openCommandDialog(): void {
    this.commandForm.reset();
    this.commandError.set(null);
    this.commandSuccess.set(false);
    this.commandDialogOpen.set(true);
  }

  closeCommandDialog(): void {
    this.commandDialogOpen.set(false);
  }

  sendCommand(): void {
    if (this.commandForm.invalid) {
      this.commandForm.markAllAsTouched();
      return;
    }
    this.commandError.set(null);
    this.commandSuccess.set(false);
    this.commandSending.set(true);

    const { type, params } = this.commandForm.getRawValue();
    let parsedParams: Record<string, unknown> | undefined;
    if (params.trim()) {
      try {
        parsedParams = JSON.parse(params) as Record<string, unknown>;
      } catch {
        this.commandError.set('Params must be valid JSON or empty.');
        this.commandSending.set(false);
        return;
      }
    }

    this.#svc.sendAction(this.udid, { type, params: parsedParams }).subscribe({
      next: () => {
        this.commandSending.set(false);
        this.commandSuccess.set(true);
      },
      error: (err: { status?: number }) => {
        this.commandSending.set(false);
        this.commandError.set(
          err.status === 503 ? 'Agent is offline — command could not be delivered.' : 'Command failed. Check agent logs.',
        );
      },
    });
  }

  goLogPage(p: number): void {
    this.logPage.set(p);
    this.#loadLog();
  }

  onLinkSearch(text: string): void {
    this.linkResults.set([]);
    if (!text.trim()) return;
    if (this.linkSearchTimer) clearTimeout(this.linkSearchTimer);
    this.linkSearchTimer = setTimeout(() => {
      this.#acctSvc.getAll({ search: text, status: 'active', pageSize: 8 }).subscribe({
        next: result => {
          // Exclude already-linked accounts
          const linked = new Set(this.accounts().map(a => a.accountId));
          this.linkResults.set(result.data.filter(a => !linked.has(a.id)));
        },
      });
    }, 300);
  }

  linkAccount(acc: Account): void {
    this.linkResults.set([]);
    this.linkSearch = '';
    this.#svc.linkAccount(this.udid, acc.id).subscribe({
      next: () => this.#loadAccounts(),
    });
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
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

  prettyJson(raw: string | null): string {
    if (!raw) return '';
    try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
  }

  logEventIcon(event: string): string {
    const e = event.toLowerCase();
    if (e.includes('connect')) return 'fa-solid fa-plug text-green-600 text-xs';
    if (e.includes('disconnect')) return 'fa-solid fa-plug-circle-xmark text-red-500 text-xs';
    return 'fa-solid fa-circle-dot text-on-surface-variant text-xs';
  }

  logEventClass(event: string): string {
    const e = event.toLowerCase();
    if (e.includes('connect')) return 'bg-green-100 text-green-700';
    if (e.includes('disconnect')) return 'bg-error-container text-on-error-container';
    return 'bg-surface-container text-on-surface-variant';
  }

  #loadDevice(): void {
    this.isLoading.set(true);
    this.#svc.getOne(this.udid).subscribe({
      next: d => { this.device.set(d); this.isLoading.set(false); },
      error: () => { this.error.set('Device not found.'); this.isLoading.set(false); },
    });
  }

  #loadAccounts(): void {
    this.#accountsLoaded.set(true);
    this.accountsLoading.set(true);
    this.#svc.getAccounts(this.udid).subscribe({
      next: list => { this.accounts.set(list); this.accountsLoading.set(false); },
      error: () => this.accountsLoading.set(false),
    });
  }

  #loadLog(): void {
    this.#logLoaded.set(true);
    this.logLoading.set(true);
    this.#svc.getSessionLog(this.udid, this.logPage(), this.logPageSize).subscribe({
      next: result => {
        this.logEntries.set(result.data);
        this.logTotal.set(result.total);
        this.logLoading.set(false);
      },
      error: () => this.logLoading.set(false),
    });
  }
}
