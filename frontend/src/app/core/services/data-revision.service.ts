import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DataRevisionService {
  private readonly value = signal(0);
  readonly version = this.value.asReadonly();

  invalidate(): void {
    this.value.update((version) => version + 1);
  }
}
