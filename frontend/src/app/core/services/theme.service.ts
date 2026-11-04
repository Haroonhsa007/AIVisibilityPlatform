import { DOCUMENT } from '@angular/common';
import { inject, Injectable, OnDestroy, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';
export const THEME_STORAGE_KEY = 'ai-visibility-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly media = this.window?.matchMedia('(prefers-color-scheme: dark)');
  private readonly selected = signal<Theme>(this.readPreference());
  readonly theme = this.selected.asReadonly();
  private readonly effective = signal<'light' | 'dark'>('light');
  readonly resolvedTheme = this.effective.asReadonly();
  private readonly onSystemChange = (): void => this.apply();

  constructor() {
    this.apply();
    this.media?.addEventListener('change', this.onSystemChange);
  }

  setTheme(theme: Theme): void {
    this.selected.set(theme);
    try {
      this.window?.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Private/locked storage should not prevent changing the current theme.
    }
    this.apply();
  }

  ngOnDestroy(): void {
    this.media?.removeEventListener('change', this.onSystemChange);
  }

  private readPreference(): Theme {
    try {
      const stored = this.window?.localStorage.getItem(THEME_STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
      return 'system';
    }
  }

  private apply(): void {
    const dark =
      this.theme() === 'dark' || (this.theme() === 'system' && this.media?.matches === true);
    this.document.documentElement.classList.toggle('dark', dark);
    this.document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    this.effective.set(dark ? 'dark' : 'light');
  }
}
