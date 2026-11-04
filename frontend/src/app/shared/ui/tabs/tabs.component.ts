import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface RouteTab {
  label: string;
  link: string | readonly string[];
}

@Component({
  selector: 'app-tabs',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav
    [attr.aria-label]="label()"
    class="flex gap-2 overflow-x-auto border-b border-border"
  >
    @for (tab of tabs(); track tab.link) {
      <a
        class="route-tab"
        [routerLink]="tab.link"
        routerLinkActive="active"
        ariaCurrentWhenActive="page"
        >{{ tab.label }}</a
      >
    }
  </nav>`,
})
export class TabsComponent {
  readonly label = input('Profile views');
  readonly tabs = input.required<readonly RouteTab[]>();
}
