import { computed, Injectable, OnDestroy, signal } from '@angular/core';
import { createCloudlet } from '@cloudlet/toast';

export type ToastTone = 'success' | 'error' | 'info';

@Injectable({ providedIn: 'root' })
export class ToastService implements OnDestroy {
  readonly controller = createCloudlet();
  private readonly state = signal(this.controller.getSnapshot());
  readonly snapshot = this.state.asReadonly();
  readonly count = computed(() => this.snapshot().notifications.length);
  private readonly unsubscribe = this.controller.subscribe(() =>
    this.state.set(this.controller.getSnapshot()),
  );

  success(message: string, duration = 5000): string | undefined {
    return this.show('success', message, duration);
  }
  error(message: string, duration = 8000): string | undefined {
    return this.show('error', message, duration);
  }
  info(message: string, duration = 5000): string | undefined {
    return this.show('info', message, duration);
  }

  dismiss(id: string): void {
    const handle = this.controller.getHandle(id);
    if (handle) this.controller.dismiss(handle);
  }

  ngOnDestroy(): void {
    this.controller.dispose();
    this.unsubscribe();
  }

  private show(kind: ToastTone, title: string, duration: number): string | undefined {
    const admission = this.controller.show({
      title,
      kind,
      duration: duration > 0 ? duration : null,
      announcementPriority: 'polite',
    });
    return admission.status === 'rejected' ? undefined : admission.handle.id;
  }
}
