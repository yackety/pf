import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="theme.toggle()"
      [attr.aria-label]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
      [attr.aria-pressed]="theme.isDark()"
      class="w-10 h-10 rounded-full flex items-center justify-center
             text-on-surface-variant
             hover:bg-surface-container-high
             focus-visible:ring-2 focus-visible:ring-primary
             transition-all duration-200 hover:scale-[1.02]"
    >
      @if (theme.isDark()) {
        <i class="fa-solid fa-sun text-lg" aria-hidden="true"></i>
      } @else {
        <i class="fa-solid fa-moon text-lg" aria-hidden="true"></i>
      }
    </button>
  `,
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);
}
