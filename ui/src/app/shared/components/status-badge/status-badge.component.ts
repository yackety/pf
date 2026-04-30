import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type Status = 'online' | 'offline' | 'device' | 'disconnected' | 'active' | 'inactive' | 'banned' | string;

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full label-sm font-medium"
      [class]="containerClass()"
    >
      <i class="fa-solid fa-circle text-[8px]" aria-hidden="true"></i>
      {{ label() }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<Status>();

  readonly label = computed(() => {
    switch (this.status()) {
      case 'device':
      case 'Connected':
      case 'active':
      case 'online':
        return 'Online';
      case 'disconnected':
      case 'offline':
      case 'inactive':
        return 'Offline';
      case 'banned':
        return 'Banned';
      default:
        return this.status();
    }
  });

  readonly containerClass = computed(() => {
    switch (this.status()) {
      case 'device':
      case 'Connected':
      case 'active':
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'disconnected':
      case 'offline':
      case 'inactive':
        return 'bg-surface-container-high text-on-surface-variant';
      case 'banned':
        return 'bg-error-container text-on-error-container';
      default:
        return 'bg-surface-container text-on-surface-variant';
    }
  });
}
