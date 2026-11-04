import { FormControl, FormGroup } from '@angular/forms';
import {
  domainValidator,
  normaliseDomain,
  ownDomainValidator,
  requiredText,
  validDomain,
} from './domain-validator';

describe('backend-compatible domain validation', () => {
  for (const domain of [
    'surferseo.com',
    'a.io',
    'sub.company.co.uk',
    'xn--bcher-kva.de',
    ' COMPANY.COM ',
    'seo-tools.dev',
  ]) {
    it(`accepts ${domain}`, () => expect(validDomain(domain)).toBeTrue());
  }
  for (const domain of [
    'http://example.com',
    'https://example.com/path',
    'example.com/',
    'localhost',
    '127.0.0.1',
    'example.com:5000',
    'has space.com',
    '-wrong.com',
    'wrong-.com',
    'a..com',
    '_srv.com',
    'a.c',
    'a'.repeat(64) + '.com',
    'example.com?x=1',
  ]) {
    it(`rejects ${domain}`, () => expect(validDomain(domain)).toBeFalse());
  }
  it('normalizes exactly as the backend does', () =>
    expect(normaliseDomain(' EXAMPLE.COM ')).toBe('example.com'));
  it('leaves empty validation to required and rejects whitespace-only required text', () => {
    expect(new FormControl('', domainValidator).valid).toBeTrue();
    expect(new FormControl('   ', requiredText).invalid).toBeTrue();
  });
  it('rejects the business domain in the competitor list after either field changes', () => {
    const group = new FormGroup(
      { domain: new FormControl('example.com'), competitors: new FormControl(['other.com']) },
      { validators: ownDomainValidator },
    );
    expect(group.valid).toBeTrue();
    group.controls.domain.setValue('OTHER.COM');
    expect(group.hasError('ownDomain')).toBeTrue();
  });
});
