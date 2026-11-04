import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="rounded-lg border border-border bg-surface p-12 text-center">
    <p class="mb-4 text-sm font-semibold text-primary">404</p>
    <h1 class="mb-4 text-2xl font-semibold">Page not found</h1>
    <p class="mb-8 text-muted">The page may have moved, or the address may be incorrect.</p>
    <a routerLink="/" class="ui-button" data-variant="primary">Back to dashboard</a>
  </section>`,
})
export class NotFoundComponent {}
