import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ProfileService } from '../../../core/services/profile.service';
import { ToastService } from '../../../core/services/toast.service';
import { Profile } from '../../../shared/models';
import { ProfileFormComponent } from './profile-form.component';

describe('ProfileFormComponent', () => {
  let profiles: jasmine.SpyObj<ProfileService>;
  const profile: Profile = {
    profile_uuid: 'profile-1',
    name: 'Surfer SEO',
    domain: 'surferseo.com',
    industry: 'SEO',
    status: 'new',
    created_at: '2026-11-04T10:00:00Z',
    updated_at: '2026-11-04T10:00:00Z',
  };
  beforeEach(() => {
    profiles = jasmine.createSpyObj<ProfileService>('ProfileService', ['create']);
    profiles.create.and.returnValue(of(profile));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ProfileService, useValue: profiles },
        { provide: ToastService, useValue: { success: jasmine.createSpy('success') } },
      ],
    });
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  it('shows inline required messages on submit and makes no HTTP call', async () => {
    const fixture = TestBed.createComponent(ProfileFormComponent);
    fixture.componentInstance.submit();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('#name-error')?.textContent).toContain('required');
    expect(element.querySelector('#domain-error')?.getAttribute('role')).toBe('alert');
    expect(profiles.create).not.toHaveBeenCalled();
  });

  it('adds, deduplicates, pastes and removes competitor chips with keyboard behavior', () => {
    const form = TestBed.createComponent(ProfileFormComponent).componentInstance;
    form.form.controls.domain.setValue('surferseo.com');
    expect(form.addCompetitors(' CLEARscope.io, clearscope.io, frase.io')).toBeTrue();
    expect(form.form.controls.competitors.value).toEqual(['clearscope.io', 'frase.io']);
    form.draft.setValue('marketmuse.com');
    form.competitorKey(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    form.competitorKey(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(form.form.controls.competitors.value).toEqual(['clearscope.io', 'frase.io']);
    const data = new DataTransfer();
    data.setData('text', 'marketmuse.com,wordlift.io');
    form.competitorPaste(new ClipboardEvent('paste', { clipboardData: data, cancelable: true }));
    expect(form.form.controls.competitors.value.length).toBe(4);
    expect(form.addCompetitors('surferseo.com')).toBeFalse();
    expect(form.addCompetitors('https://wrong.com')).toBeFalse();
    expect(form.form.controls.competitors.value.length).toBe(4);
  });

  it('enforces the ten-competitor limit atomically', () => {
    const form = TestBed.createComponent(ProfileFormComponent).componentInstance;
    form.addCompetitors(
      Array.from({ length: 10 }, (_, index) => `competitor${index}.com`).join(','),
    );
    expect(form.addCompetitors('extra.com')).toBeFalse();
    expect(form.form.controls.competitors.value.length).toBe(10);
    expect(form.draftError()).toContain('10');
  });

  it('posts a normalized typed payload, navigates, and prevents duplicate pending submissions', () => {
    const response = new Subject<Profile>();
    profiles.create.and.returnValue(response);
    const form = TestBed.createComponent(ProfileFormComponent).componentInstance;
    form.form.patchValue({
      name: ' Surfer SEO ',
      domain: ' SURFERSEO.COM ',
      industry: ' SEO ',
      description: ' Content optimization ',
    });
    form.addCompetitors('clearscope.io');
    form.submit();
    form.submit();
    expect(form.pending()).toBeTrue();
    expect(profiles.create).toHaveBeenCalledOnceWith({
      name: 'Surfer SEO',
      domain: 'surferseo.com',
      industry: 'SEO',
      description: 'Content optimization',
      competitors: ['clearscope.io'],
    });
    response.next(profile);
    response.complete();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/profiles', 'profile-1']);
    expect(form.pending()).toBeFalse();
  });

  it('keeps backend 422 field errors visible after the request finishes', async () => {
    profiles.create.and.returnValue(
      throwError(() => ({
        kind: 'validation',
        message: 'Invalid domain.',
        fieldErrors: { domain: 'This hostname is not allowed.' },
      })),
    );
    const fixture = TestBed.createComponent(ProfileFormComponent);
    await fixture.whenStable();
    const form = fixture.componentInstance;
    form.form.patchValue({ name: 'Surfer', domain: 'surferseo.com', industry: 'SEO' });
    form.submit();
    await fixture.whenStable();
    expect(form.pending()).toBeFalse();
    expect(form.form.controls.domain.enabled).toBeTrue();
    expect(form.errorFor('domain')).toBe('This hostname is not allowed.');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('#domain-error')?.textContent,
    ).toContain('not allowed');
  });
});
