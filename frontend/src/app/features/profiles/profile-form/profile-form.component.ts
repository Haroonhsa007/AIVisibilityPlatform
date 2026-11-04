import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, EMPTY, finalize, tap } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroPlus } from '@ng-icons/heroicons/outline';
import { ProfileService } from '../../../core/services/profile.service';
import { ToastService } from '../../../core/services/toast.service';
import { AppError } from '../../../shared/models';
import { appError } from '../../../shared/utils/app-error';
import {
  competitorsValidator,
  domainValidator,
  normaliseDomain,
  ownDomainValidator,
  requiredText,
  validDomain,
} from '../../../shared/utils/domain-validator';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { ChipComponent } from '../../../shared/ui/chip/chip.component';

type FieldName = 'name' | 'domain' | 'industry' | 'description' | 'competitors';

@Component({
  selector: 'app-profile-form',
  imports: [ReactiveFormsModule, RouterLink, NgIcon, ButtonComponent, ChipComponent],
  providers: [provideIcons({ heroPlus })],
  templateUrl: './profile-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileFormComponent {
  private readonly profiles = inject(ProfileService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly submitted = signal(false);
  readonly pending = signal(false);
  readonly failure = signal<AppError | null>(null);
  readonly draftError = signal('');
  readonly draft = new FormControl('', { nonNullable: true });
  readonly form = new FormGroup(
    {
      name: new FormControl('', {
        nonNullable: true,
        validators: [requiredText, Validators.maxLength(120)],
      }),
      domain: new FormControl('', {
        nonNullable: true,
        validators: [requiredText, domainValidator],
      }),
      industry: new FormControl('', {
        nonNullable: true,
        validators: [requiredText, Validators.maxLength(120)],
      }),
      description: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(1000)],
      }),
      competitors: new FormControl<string[]>([], {
        nonNullable: true,
        validators: [competitorsValidator],
      }),
    },
    { validators: ownDomainValidator },
  );

  errorFor(field: FieldName): string {
    const control = this.form.controls[field];
    if (!(control.touched || this.submitted()) || !control.errors) return '';
    const server: unknown = control.errors['server'];
    if (typeof server === 'string') return server;
    if (control.errors['required']) return 'This field is required.';
    if (control.errors['domain']) return 'Enter a domain without a scheme, path, spaces or port.';
    if (control.errors['maxlength'])
      return field === 'description'
        ? 'Keep the description to 1,000 characters.'
        : 'Keep this field to 120 characters.';
    return 'Check the competitor domains.';
  }

  addCompetitors(raw = this.draft.value): boolean {
    this.draftError.set('');
    const next = raw
      .split(/[,\n]+/)
      .map(normaliseDomain)
      .filter(Boolean);
    if (!next.length) return true;
    if (next.some((domain) => !validDomain(domain))) {
      this.draftError.set('Enter valid competitor domains without URLs or paths.');
      return false;
    }
    if (next.includes(normaliseDomain(this.form.controls.domain.value))) {
      this.draftError.set('A competitor must be different from your business domain.');
      return false;
    }
    const merged = [...new Set([...this.form.controls.competitors.value, ...next])];
    if (merged.length > 10) {
      this.draftError.set('Add up to 10 competitors.');
      return false;
    }
    this.form.controls.competitors.setValue(merged);
    this.form.controls.competitors.markAsTouched();
    this.draft.setValue('');
    return true;
  }

  removeCompetitor(domain: string): void {
    this.form.controls.competitors.setValue(
      this.form.controls.competitors.value.filter((value) => value !== domain),
    );
  }

  competitorKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addCompetitors();
    } else if (event.key === 'Backspace' && !this.draft.value) {
      const last = this.form.controls.competitors.value.at(-1);
      if (last) this.removeCompetitor(last);
    }
  }

  competitorPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    if (text.includes(',') || text.includes('\n')) {
      event.preventDefault();
      this.addCompetitors(text);
    }
  }

  normaliseBusinessDomain(): void {
    this.form.controls.domain.setValue(normaliseDomain(this.form.controls.domain.value));
  }

  submit(): void {
    if (this.pending()) return;
    this.submitted.set(true);
    this.failure.set(null);
    if (!this.addCompetitors()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.pending.set(true);
    this.form.disable({ emitEvent: false });
    this.draft.disable({ emitEvent: false });
    this.profiles
      .create({
        ...value,
        name: value.name.trim(),
        domain: normaliseDomain(value.domain),
        industry: value.industry.trim(),
        description: value.description.trim(),
      })
      .pipe(
        tap((profile) => {
          this.toast.success('Business profile created.');
          void this.router.navigate(['/profiles', profile.profile_uuid]);
        }),
        catchError((error: unknown) => {
          const failure = appError(error);
          this.failure.set(
            failure.kind === 'conflict'
              ? { ...failure, message: 'A business profile for this domain already exists.' }
              : failure,
          );
          // Enable first so validation runs before server errors are attached.
          this.form.enable({ emitEvent: false });
          this.draft.enable({ emitEvent: false });
          for (const [field, message] of Object.entries(failure.fieldErrors ?? {})) {
            const control = this.form.get(field);
            if (control) {
              control.setErrors({ ...control.errors, server: message });
              control.markAsTouched();
            }
          }
          return EMPTY;
        }),
        finalize(() => {
          this.pending.set(false);
          if (this.form.disabled) this.form.enable({ emitEvent: false });
          if (this.draft.disabled) this.draft.enable({ emitEvent: false });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
