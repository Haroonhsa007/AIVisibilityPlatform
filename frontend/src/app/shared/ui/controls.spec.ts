import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  ChipComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  PaginatorComponent,
  SelectComponent,
  SkeletonComponent,
  SliderComponent,
  SpinnerComponent,
  TabsComponent,
  ToggleGroupComponent,
} from './index';

@Component({
  imports: [
    ReactiveFormsModule,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    ChipComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    PaginatorComponent,
    SelectComponent,
    SkeletonComponent,
    SliderComponent,
    SpinnerComponent,
    TabsComponent,
    ToggleGroupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-card><app-badge tone="success">Completed</app-badge></app-card>
    <app-button [loading]="true">Save</app-button>
    <app-chip label="example.com" [removable]="true" (removed)="removed = true" />
    <app-empty-state
      title="No results"
      message="Run the pipeline."
      actionLabel="Run"
      (action)="acted = true"
    />
    <app-error-state message="Please try again." (retry)="retried = true" />
    <app-skeleton /><app-spinner />
    <app-slider label="Minimum score" [formControl]="score" />
    <app-select label="Visibility" [options]="options" [formControl]="visibility" />
    <app-toggle-group label="Priority" [options]="options" [formControl]="priority" />
    <app-paginator
      [page]="2"
      [per_page]="20"
      [total]="45"
      (pageChange)="page = $event"
      (perPageChange)="size = $event; page = 1"
    />
    <app-tabs [tabs]="[{ label: 'Queries', link: '/queries' }]" />`,
})
class ControlsHost {
  readonly score = new FormControl(0.4, { nonNullable: true });
  readonly visibility = new FormControl('all', { nonNullable: true });
  readonly priority = new FormControl('all', { nonNullable: true });
  readonly options = [
    { value: 'all', label: 'All' },
    { value: 'high', label: 'High' },
  ];
  removed = false;
  acted = false;
  retried = false;
  page = 2;
  size = 20;
}

describe('shared UI contracts', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('connects range, select and radio controls to Reactive Forms in both directions', async () => {
    const fixture = TestBed.createComponent(ControlsHost);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const slider = root.querySelector<HTMLInputElement>('input[type="range"]');
    const select = root.querySelector<HTMLSelectElement>('app-select select');
    const radio = root.querySelector<HTMLInputElement>('input[type="radio"][value="high"]');
    if (!slider || !select || !radio) throw new Error('Missing form controls');
    expect(slider.value).toBe('0.4');
    expect(select.value).toBe('all');
    slider.value = '0.8';
    slider.dispatchEvent(new Event('input'));
    select.value = 'high';
    select.dispatchEvent(new Event('change'));
    radio.click();
    expect(fixture.componentInstance.score.value).toBe(0.8);
    expect(fixture.componentInstance.visibility.value).toBe('high');
    expect(fixture.componentInstance.priority.value).toBe('high');
    fixture.componentInstance.score.setValue(0.4);
    fixture.componentInstance.visibility.setValue('all');
    fixture.componentInstance.priority.setValue('all');
    await fixture.whenStable();
    expect(slider.value).toBe('0.4');
    expect(select.value).toBe('all');
    expect(
      root.querySelector<HTMLInputElement>('input[type="radio"][value="all"]')?.checked,
    ).toBeTrue();
  });

  it('propagates disabled and touched states', async () => {
    const fixture = TestBed.createComponent(ControlsHost);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const slider = root.querySelector<HTMLInputElement>('input[type="range"]');
    slider?.dispatchEvent(new Event('blur'));
    expect(fixture.componentInstance.score.touched).toBeTrue();
    fixture.componentInstance.score.disable();
    fixture.componentInstance.visibility.disable();
    fixture.componentInstance.priority.disable();
    await fixture.whenStable();
    expect(slider?.disabled).toBeTrue();
    expect(root.querySelector<HTMLSelectElement>('app-select select')?.disabled).toBeTrue();
    expect(
      root.querySelector<HTMLFieldSetElement>('app-toggle-group fieldset')?.disabled,
    ).toBeTrue();
  });

  it('provides loading semantics, removable chips, retry and optional actions', async () => {
    const fixture = TestBed.createComponent(ControlsHost);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const loadingButton = root.querySelector<HTMLButtonElement>('app-button button');
    expect(loadingButton?.disabled).toBeTrue();
    expect(loadingButton?.getAttribute('aria-busy')).toBe('true');
    root.querySelector<HTMLButtonElement>('app-chip button')?.click();
    root.querySelector<HTMLButtonElement>('app-error-state button')?.click();
    root.querySelector<HTMLButtonElement>('app-empty-state button')?.click();
    expect(fixture.componentInstance.removed).toBeTrue();
    expect(fixture.componentInstance.retried).toBeTrue();
    expect(fixture.componentInstance.acted).toBeTrue();
  });

  it('emits pagination changes and clamps the last displayed item to the total', async () => {
    const fixture = TestBed.createComponent(ControlsHost);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const paginator = root.querySelector('app-paginator');
    expect(paginator?.textContent).toContain('21–40 of 45');
    paginator?.querySelector<HTMLButtonElement>('[aria-label="Next page"]')?.click();
    expect(fixture.componentInstance.page).toBe(3);
    const select = paginator?.querySelector('select');
    if (!select) throw new Error('Missing page size');
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.size).toBe(50);
    expect(fixture.componentInstance.page).toBe(1);
  });
});
