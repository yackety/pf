import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bg-surface-container-lowest rounded-xl shadow-card dark:shadow-card-dark p-6
             flex items-center gap-5 hover:shadow-elevated dark:hover:shadow-elevated-dark
             transition-shadow duration-200"
    >
      <div
        class="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10
               flex items-center justify-center"
      >
        <i [class]="icon() + ' text-primary text-xl'" aria-hidden="true"></i>
      </div>
      <div>
        <p class="label-sm text-on-surface-variant uppercase tracking-wide">{{ label() }}</p>
        <p class="headline-md text-on-surface mt-0.5">{{ value() }}</p>
      </div>
    </div>
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input.required<string>();
}
