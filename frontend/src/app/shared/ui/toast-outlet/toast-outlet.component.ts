import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { CloudletProvider, Toaster } from '@cloudlet/toast';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, Root } from 'react-dom/client';
import { ThemeService } from '../../../core/services/theme.service';
import { ToastService } from '../../../core/services/toast.service';

// Cloudlet supplies a React renderer. Keep its root and lifetime inside this Angular adapter.
@Component({
  selector: 'app-toast-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #mount></div>`,
})
export class ToastOutletComponent implements AfterViewInit, OnDestroy {
  private readonly mount = viewChild.required<ElementRef<HTMLDivElement>>('mount');
  private readonly toast = inject(ToastService);
  private readonly theme = inject(ThemeService);
  private root?: Root;

  constructor() {
    effect(() => {
      const theme = this.theme.theme();
      if (this.root) this.render(theme);
    });
  }

  ngAfterViewInit(): void {
    this.root = createRoot(this.mount().nativeElement);
    this.render(this.theme.theme());
  }

  ngOnDestroy(): void {
    this.root?.unmount();
  }

  private render(theme: 'light' | 'dark' | 'system'): void {
    flushSync(() =>
      this.root?.render(
        createElement(
          CloudletProvider,
          { controller: this.toast.controller },
          createElement(Toaster, { theme, position: 'bottom-center' }),
        ),
      ),
    );
  }
}
