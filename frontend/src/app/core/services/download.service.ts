import { DOCUMENT } from '@angular/common';
import { inject, Injectable, OnDestroy } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DownloadService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();

  saveCsv(filename: string, content: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    this.document.body.append(anchor);
    try {
      anchor.click();
    } finally {
      anchor.remove();
      this.pending.set(
        url,
        setTimeout(() => {
          URL.revokeObjectURL(url);
          this.pending.delete(url);
        }, 2000),
      );
    }
  }

  ngOnDestroy(): void {
    this.pending.forEach((timer, url) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    });
    this.pending.clear();
  }
}
