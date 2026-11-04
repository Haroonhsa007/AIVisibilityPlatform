import { TestBed } from '@angular/core/testing';
import { ThemeService, THEME_STORAGE_KEY } from './theme.service';

describe('ThemeService', () => {
  let media: jasmine.SpyObj<MediaQueryList>;
  let original: string | null;
  let originalDark: boolean;
  let originalScheme: string;

  beforeEach(() => {
    original = localStorage.getItem(THEME_STORAGE_KEY);
    originalDark = document.documentElement.classList.contains('dark');
    originalScheme = document.documentElement.style.colorScheme;
    localStorage.removeItem(THEME_STORAGE_KEY);
    media = jasmine.createSpyObj<MediaQueryList>(
      'MediaQueryList',
      ['addEventListener', 'removeEventListener'],
      { matches: false },
    );
    spyOn(window, 'matchMedia').and.returnValue(media);
    TestBed.configureTestingModule({});
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    if (original === null) localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, original);
    document.documentElement.classList.toggle('dark', originalDark);
    document.documentElement.style.colorScheme = originalScheme;
  });

  it('defaults to the system preference', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('system');
    expect(document.documentElement.classList.contains('dark')).toBeFalse();
  });

  it('loads a persisted dark choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBeTrue();
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('persists light/dark/system changes', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBeTrue();
    service.setTheme('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBeFalse();
    service.setTheme('system');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('rejects an invalid persisted value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'unexpected');
    expect(TestBed.inject(ThemeService).theme()).toBe('system');
  });

  it('follows system changes only in system mode', () => {
    const service = TestBed.inject(ThemeService);
    const listener = media.addEventListener.calls.mostRecent().args[1] as EventListener;
    const matchesSpy = Object.getOwnPropertyDescriptor(media, 'matches')?.get;
    if (!matchesSpy) throw new Error('Missing matches getter');
    (matchesSpy as jasmine.Spy).and.returnValue(true);
    listener(new Event('change'));
    expect(document.documentElement.classList.contains('dark')).toBeTrue();
    service.setTheme('light');
    listener(new Event('change'));
    expect(document.documentElement.classList.contains('dark')).toBeFalse();
  });

  it('works when reading or writing storage is denied', () => {
    const readSpy = spyOn(Storage.prototype, 'getItem').and.throwError('Storage disabled');
    const writeSpy = spyOn(Storage.prototype, 'setItem').and.throwError('Storage disabled');
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('system');
    expect(() => service.setTheme('dark')).not.toThrow();
    expect(document.documentElement.classList.contains('dark')).toBeTrue();
    readSpy.and.callThrough();
    writeSpy.and.callThrough();
  });

  it('removes its system listener on destroy', () => {
    const service = TestBed.inject(ThemeService);
    const listener = media.addEventListener.calls.mostRecent().args[1];
    service.ngOnDestroy();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', listener);
  });
});
