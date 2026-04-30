import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="dialogId + '-title'"
        [attr.aria-describedby]="dialogId + '-desc'"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-surface-dim/80 backdrop-blur-sm"
          aria-hidden="true"
          (click)="cancel.emit()"
        ></div>

        <!-- Panel -->
        <div
          #panel
          class="relative w-full max-w-sm bg-surface-container-lowest rounded-2xl
                 shadow-elevated dark:shadow-elevated-dark p-6 mx-4"
          (keydown.escape)="cancel.emit()"
          tabindex="-1"
        >
          <!-- Icon -->
          <div class="flex items-center gap-4 mb-4">
            <div
              class="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              [class]="variant() === 'danger' ? 'bg-error-container' : 'bg-primary/10'"
            >
              <i
                [class]="iconClass()"
                aria-hidden="true"
              ></i>
            </div>
            <h2 [id]="dialogId + '-title'" class="title-md text-on-surface">{{ title() }}</h2>
          </div>

          <p [id]="dialogId + '-desc'" class="body-md text-on-surface-variant mb-6">
            {{ message() }}
          </p>

          <div class="flex gap-3 justify-end">
            <button
              type="button"
              (click)="cancel.emit()"
              class="px-5 py-2 rounded-full border border-outline-variant label-md
                     text-on-surface-variant hover:bg-surface-container-high
                     focus-visible:ring-2 focus-visible:ring-primary transition-colors"
            >
              {{ cancelLabel() }}
            </button>
            <button
              #confirmBtn
              type="button"
              (click)="confirm.emit()"
              class="px-5 py-2 rounded-full label-md focus-visible:ring-2 transition-colors"
              [class]="variant() === 'danger'
                ? 'bg-error text-on-error hover:opacity-90 focus-visible:ring-error'
                : 'bg-primary text-on-primary hover:bg-primary-container focus-visible:ring-primary'"
            >
              {{ confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  readonly open = input.required<boolean>();
  readonly title = input<string>('Are you sure?');
  readonly message = input<string>('This action cannot be undone.');
  readonly confirmLabel = input<string>('Confirm');
  readonly cancelLabel = input<string>('Cancel');
  readonly variant = input<'danger' | 'default'>('default');

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  readonly dialogId = `confirm-${Math.random().toString(36).slice(2, 8)}`;

  readonly confirmBtnRef = viewChild<ElementRef<HTMLButtonElement>>('confirmBtn');

  constructor() {
    effect(() => {
      if (this.open()) {
        // Focus the confirm button when dialog opens for keyboard accessibility
        setTimeout(() => this.confirmBtnRef()?.nativeElement.focus(), 50);
      }
    });
  }

  iconClass(): string {
    return this.variant() === 'danger'
      ? 'fa-solid fa-triangle-exclamation text-error'
      : 'fa-solid fa-circle-question text-primary';
  }
}
