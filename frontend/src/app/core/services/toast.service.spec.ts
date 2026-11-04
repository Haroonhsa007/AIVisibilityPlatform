import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService Cloudlet adapter', () => {
  let service: ToastService;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('uses Cloudlet to queue success, error and info notifications', () => {
    service.success('Profile created.');
    service.error('Connection lost.');
    service.info('Pipeline started.');
    expect(service.count()).toBe(3);
    const notifications = service.snapshot().notifications;
    expect(notifications.map((notification) => notification.kind)).toEqual([
      'success',
      'error',
      'info',
    ]);
    expect(notifications.map((notification) => notification.content.duration)).toEqual([
      5000, 8000, 5000,
    ]);
    expect(
      notifications.every((notification) => notification.content.announcementPriority === 'polite'),
    ).toBeTrue();
  });

  it('dismisses by the returned ID while keeping other notifications', () => {
    const id = service.info('First.');
    service.info('Second.');
    if (!id) throw new Error('Cloudlet rejected the notification');
    service.dismiss(id);
    expect(service.count()).toBe(1);
    expect(service.snapshot().notifications[0].content.title).toBe('Second.');
    expect(() => service.dismiss(id)).not.toThrow();
  });

  it('supports persistent messages and lets Cloudlet pause time until a host presents them', () => {
    service.info('Persistent.', 0);
    service.success('Brief.', 1000);
    const notifications = service.snapshot().notifications;
    expect(notifications[0].content.duration).toBeNull();
    expect(notifications[1].remainingMs).toBe(1000);
    expect(notifications[1].pauseReasons).toContain('no-host');
  });

  it('disposes the controller and its queue with the service', () => {
    service.success('Done.');
    service.ngOnDestroy();
    expect(service.controller.getSnapshot().disposed).toBeTrue();
    expect(service.count()).toBe(0);
    expect(service.info('After disposal.')).toBeUndefined();
  });
});
