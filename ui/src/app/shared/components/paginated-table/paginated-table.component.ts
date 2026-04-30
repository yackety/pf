import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

export interface TableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  cellClass?: string;
}

export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

@Component({
  selector: 'app-paginated-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest
                shadow-card dark:shadow-card-dark">
      <table class="w-full text-sm border-collapse" [attr.aria-label]="ariaLabel()">
        <thead>
          <tr class="border-b border-outline-variant bg-surface-container-high">
            @for (col of columns(); track col.key) {
              <th
                scope="col"
                class="px-4 py-3 text-left label-sm text-on-surface-variant uppercase tracking-wide"
                [class.cursor-pointer]="col.sortable"
                [class.select-none]="col.sortable"
                [attr.aria-sort]="sortAriaValue(col.key)"
                (click)="col.sortable && onSort(col.key)"
                (keydown.enter)="col.sortable && onSort(col.key)"
                [attr.tabindex]="col.sortable ? 0 : null"
              >
                <span class="flex items-center gap-1">
                  {{ col.label }}
                  @if (col.sortable) {
                    <i
                      [class]="sortIconClass(col.key)"
                      class="text-[10px] text-on-surface-variant"
                      aria-hidden="true"
                    ></i>
                  }
                </span>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @if (isLoading()) {
            <tr>
              <td [attr.colspan]="columns().length" class="px-4 py-10 text-center text-on-surface-variant">
                <i class="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true"></i>
                Loading…
              </td>
            </tr>
          } @else if (rows().length === 0) {
            <tr>
              <td [attr.colspan]="columns().length" class="px-4 py-10 text-center text-on-surface-variant body-md">
                <i class="fa-solid fa-inbox text-2xl mb-2 block" aria-hidden="true"></i>
                {{ emptyMessage() }}
              </td>
            </tr>
          } @else {
            @for (row of rows(); track trackFn()(row)) {
              <tr
                class="border-b border-outline-variant last:border-0 hover:bg-surface-container-high
                       transition-colors duration-100 cursor-pointer"
                (click)="rowClick.emit(row)"
                (keydown.enter)="rowClick.emit(row)"
                tabindex="0"
                [attr.aria-label]="rowAriaLabel()(row)"
              >
                <ng-content />
              </tr>
            }
          }
        </tbody>
      </table>

      <!-- Pagination bar -->
      @if (total() > pageSize()) {
        <div class="flex items-center justify-between px-4 py-3 border-t border-outline-variant bg-surface-container">
          <span class="body-sm text-on-surface-variant">
            {{ rangeLabel() }}
          </span>
          <div class="flex items-center gap-1" role="navigation" aria-label="Pagination">
            <button
              type="button"
              class="w-8 h-8 rounded-full flex items-center justify-center
                     text-on-surface-variant hover:bg-surface-container-high
                     disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary transition-colors"
              [disabled]="page() <= 1"
              (click)="onPage(page() - 1)"
              aria-label="Previous page"
            >
              <i class="fa-solid fa-chevron-left text-xs" aria-hidden="true"></i>
            </button>

            @for (p of pageNumbers(); track p) {
              <button
                type="button"
                class="w-8 h-8 rounded-full flex items-center justify-center label-sm transition-colors
                       focus-visible:ring-2 focus-visible:ring-primary"
                [class]="p === page()
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-high'"
                [attr.aria-current]="p === page() ? 'page' : null"
                (click)="onPage(p)"
              >{{ p }}</button>
            }

            <button
              type="button"
              class="w-8 h-8 rounded-full flex items-center justify-center
                     text-on-surface-variant hover:bg-surface-container-high
                     disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary transition-colors"
              [disabled]="page() >= totalPages()"
              (click)="onPage(page() + 1)"
              aria-label="Next page"
            >
              <i class="fa-solid fa-chevron-right text-xs" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class PaginatedTableComponent<T> {
  readonly columns = input.required<TableColumn<T>[]>();
  readonly rows = input.required<T[]>();
  readonly total = input<number>(0);
  readonly page = input<number>(1);
  readonly pageSize = input<number>(50);
  readonly isLoading = input<boolean>(false);
  readonly emptyMessage = input<string>('No items found.');
  readonly ariaLabel = input<string>('Data table');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly trackFn = input<(row: T) => any>((row: T) => row);
  readonly rowAriaLabel = input<(row: T) => string>(() => 'Row');
  readonly sort = input<SortState | null>(null);

  readonly rowClick = output<T>();
  readonly pageChange = output<number>();
  readonly sortChange = output<SortState>();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  readonly rangeLabel = computed(() => {
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = Math.min(this.page() * this.pageSize(), this.total());
    return `${start}–${end} of ${this.total()}`;
  });

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.page();
    const delta = 2;
    const pages: number[] = [];
    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      pages.push(i);
    }
    return pages;
  });

  sortIconClass(col: string): string {
    const s = this.sort();
    if (!s || s.column !== col) return 'fa-solid fa-sort';
    return s.direction === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
  }

  sortAriaValue(col: string): string | null {
    const s = this.sort();
    if (!s || s.column !== col) return null;
    return s.direction === 'asc' ? 'ascending' : 'descending';
  }

  onSort(col: string): void {
    const s = this.sort();
    const direction = s?.column === col && s.direction === 'asc' ? 'desc' : 'asc';
    this.sortChange.emit({ column: col, direction });
  }

  onPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.pageChange.emit(p);
  }
}
