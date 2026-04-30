import { effect, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'lazie-theme';
  readonly isDark = signal(this.#loadPreference());

  constructor() {
    effect(() => {
      document.documentElement.classList.toggle('dark', this.isDark());
      localStorage.setItem(this.STORAGE_KEY, this.isDark() ? 'dark' : 'light');
    });
  }

  toggle(): void {
    this.isDark.update(v => !v);
  }

  setDark(dark: boolean): void {
    this.isDark.set(dark);
  }

  #loadPreference(): boolean {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
