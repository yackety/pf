import { NgOptimizedImage } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';
import { NAV_ITEMS, NavItem } from '../nav-items';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgOptimizedImage, ThemeToggleComponent],
  template: `
    <div class="flex h-screen bg-surface overflow-hidden">

      <!-- Sidebar -->
      <aside
        class="flex flex-col w-64 bg-surface-container shrink-0"
        aria-label="Main navigation"
      >
        <!-- Logo -->
        <div class="flex items-center gap-3 px-6 h-16 shrink-0 border-b border-outline-variant">
          <img ngSrc="/lazie_logo.png" width="96" height="28" alt="Lazie" priority />
        </div>

        <!-- Nav -->
        <nav class="flex-1 overflow-y-auto py-4 px-3">
          @for (item of visibleNavItems(); track item.route) {
            <a
              [routerLink]="item.route"
              routerLinkActive="bg-primary/10 text-primary font-semibold"
              class="flex items-center gap-3 px-4 py-2.5 rounded-full text-on-surface-variant
                     hover:bg-surface-container-high transition-colors duration-200 label-md mb-1"
              [attr.aria-current]="isActive(item.route) ? 'page' : null"
            >
              <i [class]="item.faIcon + ' w-5 text-center'" aria-hidden="true"></i>
              {{ item.label }}
            </a>
          }
        </nav>
      </aside>

      <!-- Main content area -->
      <div class="flex flex-col flex-1 min-w-0">
        <!-- Top bar -->
        <header
          class="flex items-center justify-between px-6 h-16 bg-surface border-b border-outline-variant shrink-0"
        >
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-seedling text-primary" aria-hidden="true"></i>
            <span class="label-md text-on-surface-variant">PhoneFarm</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="label-sm text-on-surface-variant">{{ username() }}</span>
            <app-theme-toggle />
            <button
              type="button"
              (click)="logout()"
              aria-label="Logout"
              class="rounded-full px-4 py-2 label-md text-on-surface-variant
                     hover:bg-surface-container-high transition-all duration-200
                     focus-visible:ring-2 focus-visible:ring-primary"
            >
              <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
              <span class="sr-only">Logout</span>
            </button>
          </div>
        </header>

        <!-- Page content -->
        <main class="flex-1 overflow-y-auto p-6" id="main-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);

  readonly username = computed(() => this.#auth.currentUser()?.username ?? '');
  readonly visibleNavItems = computed(() =>
    NAV_ITEMS.filter((item: NavItem) => !item.adminOnly || this.#auth.isAdmin()),
  );

  isActive(route: string): boolean {
    return this.#router.url.startsWith(route);
  }

  logout(): void {
    this.#auth.logout();
    this.#router.navigate(['/login']);
  }
}
