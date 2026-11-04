import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const label = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const host = new RegExp(`^(?:${label}\\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$`);

export function normaliseDomain(value: string): string {
  return value.trim().toLowerCase();
}
export function validDomain(value: string): boolean {
  const domain = normaliseDomain(value);
  return domain.length <= 253 && host.test(domain);
}

export const domainValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: unknown = control.value;
  return value === '' || value === null || (typeof value === 'string' && validDomain(value))
    ? null
    : { domain: true };
};

export const competitorsValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value: unknown = control.value;
  return Array.isArray(value) &&
    value.length <= 10 &&
    value.every((item) => typeof item === 'string' && validDomain(item))
    ? null
    : { competitors: true };
};

export const ownDomainValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const domain: unknown = control.get('domain')?.value;
  const competitors: unknown = control.get('competitors')?.value;
  return typeof domain === 'string' &&
    Array.isArray(competitors) &&
    competitors.some(
      (item) => typeof item === 'string' && normaliseDomain(item) === normaliseDomain(domain),
    )
    ? { ownDomain: true }
    : null;
};

export const requiredText: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: unknown = control.value;
  return typeof value === 'string' && value.trim().length > 0 ? null : { required: true };
};
