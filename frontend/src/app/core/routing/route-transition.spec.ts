import { DefaultUrlSerializer } from '@angular/router';
import { shouldSkipTransition } from './route-transition';

describe('route transitions', () => {
  const urls = new DefaultUrlSerializer();
  const skip = (from: string, to: string, reduced = false) =>
    shouldSkipTransition(urls.parse(from), urls.parse(to), reduced);

  it('skips filter, paging and fragment updates on the current screen', () => {
    expect(skip('/profiles/p/queries', '/profiles/p/queries?status=visible&page=2')).toBeTrue();
    expect(skip('/profiles/p/queries?page=2', '/profiles/p/queries#queries')).toBeTrue();
  });
  it('keeps transitions for different screens and profiles', () => {
    expect(skip('/profiles/p/queries', '/profiles/p/chart')).toBeFalse();
    expect(skip('/profiles/p/queries', '/profiles/other/queries')).toBeFalse();
    expect(skip('/', '/profiles/p/queries')).toBeFalse();
  });
  it('respects matrix parameters and reduced motion', () => {
    expect(skip('/profiles/p;mode=a', '/profiles/p;mode=b')).toBeFalse();
    expect(skip('/', '/profiles/p/chart', true)).toBeTrue();
  });
});
