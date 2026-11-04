import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronDown } from '@ng-icons/heroicons/outline';
import { controlId } from '../form-value-accessor';

@Component({
  selector: 'app-paginator',
  imports: [NgIcon],
  providers: [provideIcons({ heroChevronDown })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav
    aria-label="Pagination"
    class="flex flex-wrap items-center justify-between gap-4 py-4 text-sm"
  >
    <p aria-live="polite">{{ first() }}–{{ last() }} of {{ total() }}</p>
    <div class="flex flex-wrap items-center gap-2">
      <label [for]="id">Rows per page</label>
      <div class="relative">
        <select [id]="id" class="ui-input ui-select" [value]="per_page()" (change)="resize($event)">
          @for (size of sizes(); track size) {
            <option [value]="size" [selected]="size === per_page()">{{ size }}</option>
          }
        </select>
        <ng-icon
          name="heroChevronDown"
          size="16"
          aria-hidden="true"
          class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        />
      </div>
      <button
        type="button"
        class="ui-button"
        data-variant="secondary"
        aria-label="Previous page"
        [disabled]="page() <= 1"
        (click)="pageChange.emit(page() - 1)"
      >
        Previous
      </button>
      <span>Page {{ page() }} of {{ pages() }}</span>
      <button
        type="button"
        class="ui-button"
        data-variant="secondary"
        aria-label="Next page"
        [disabled]="page() >= pages()"
        (click)="pageChange.emit(page() + 1)"
      >
        Next
      </button>
    </div>
  </nav>`,
})
export class PaginatorComponent {
  readonly id = controlId('page-size');
  readonly page = input(1);
  readonly per_page = input(20);
  readonly total = input(0);
  readonly pageChange = output<number>();
  readonly perPageChange = output<number>();
  readonly pages = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(1, this.per_page()))),
  );
  readonly first = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * this.per_page() + 1,
  );
  readonly last = computed(() => Math.min(this.total(), this.page() * this.per_page()));
  readonly sizes = computed(() =>
    [...new Set([10, 20, 50, 100, this.per_page()])].sort((a, b) => a - b),
  );

  resize(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.perPageChange.emit(Number(event.target.value));
    }
  }
}
