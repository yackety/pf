import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const PLATFORM_ICONS: Record<string, string> = {
  facebook: 'fa-brands fa-facebook text-blue-600',
  tiktok: 'fa-brands fa-tiktok text-on-surface',
  google: 'fa-brands fa-google text-red-500',
  youtube: 'fa-brands fa-youtube text-red-600',
  instagram: 'fa-brands fa-instagram text-pink-500',
  twitter: 'fa-brands fa-x-twitter text-on-surface',
  x: 'fa-brands fa-x-twitter text-on-surface',
  android: 'fa-brands fa-android text-green-500',
  ios: 'fa-brands fa-apple text-on-surface',
};

@Component({
  selector: 'app-platform-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <i
      [class]="iconClass() + ' text-lg'"
      [attr.title]="platform()"
      aria-hidden="true"
    ></i>
    <span class="sr-only">{{ platform() }}</span>
  `,
})
export class PlatformIconComponent {
  readonly platform = input.required<string>();

  readonly iconClass = computed(() => {
    const key = this.platform().toLowerCase();
    return PLATFORM_ICONS[key] ?? 'fa-solid fa-mobile-screen text-on-surface-variant';
  });
}
