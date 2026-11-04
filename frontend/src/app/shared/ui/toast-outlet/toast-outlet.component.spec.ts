import { TestBed } from '@angular/core/testing';
import { flushSync } from 'react-dom';
import { ToastService } from '../../../core/services/toast.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ToastOutletComponent } from './toast-outlet.component';

async function waitForHost(): Promise<HTMLElement> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const host = document.querySelector<HTMLElement>('.cloudlet-host');
    if (host) return host;
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Cloudlet did not mount its renderer');
}

describe('Cloudlet toast outlet', () => {
  let originalTheme: string | null;
  let originalDark: boolean;
  let originalScheme: string;
  beforeEach(() => {
    originalTheme = localStorage.getItem('ai-visibility-theme');
    originalDark = document.documentElement.classList.contains('dark');
    originalScheme = document.documentElement.style.colorScheme;
    TestBed.configureTestingModule({});
  });
  afterEach(() => {
    document.documentElement.classList.toggle('dark', originalDark);
    document.documentElement.style.colorScheme = originalScheme;
    if (originalTheme === null) localStorage.removeItem('ai-visibility-theme');
    else localStorage.setItem('ai-visibility-theme', originalTheme);
  });

  it('mounts the real Cloudlet stack, live region and theme, then unmounts cleanly', async () => {
    const fixture = TestBed.createComponent(ToastOutletComponent);
    const service = TestBed.inject(ToastService);
    const theme = TestBed.inject(ThemeService);
    fixture.detectChanges();
    const host = await waitForHost();
    flushSync(() => {
      service.success('Profile created.', 0);
      service.info('Pipeline started.', 0);
    });
    expect(
      document.querySelector('[data-cloudlet-announcer="polite"][aria-live="polite"]'),
    ).not.toBeNull();
    expect(service.count()).toBe(2);
    expect(document.body.textContent).toContain('Pipeline started.');
    theme.setTheme('dark');
    await fixture.whenStable();
    expect(host.dataset['theme']).toBe('dark');
    fixture.destroy();
    expect(document.querySelector('.cloudlet-host')).toBeNull();
    expect(service.count()).toBe(2); // The controller preserves notices if only its renderer unmounts.
  });
});
