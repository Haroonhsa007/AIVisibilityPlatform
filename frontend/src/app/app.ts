import { A11yModule } from '@angular/cdk/a11y';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { CdkPortal, PortalModule } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntil } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroBars3,
  heroChartBar,
  heroXMark,
  heroComputerDesktop,
  heroSun,
  heroMoon,
  heroSquares2x2,
  heroBuildingOffice2,
} from '@ng-icons/heroicons/outline';
import { ToastOutletComponent } from './shared/ui/toast-outlet/toast-outlet.component';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    PortalModule,
    A11yModule,
    NgIcon,
    ToastOutletComponent,
  ],
  providers: [
    provideIcons({
      heroBars3,
      heroChartBar,
      heroXMark,
      heroComputerDesktop,
      heroSun,
      heroMoon,
      heroSquares2x2,
      heroBuildingOffice2,
    }),
  ],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnDestroy {
  readonly themeService = inject(ThemeService);
  private readonly overlay = inject(Overlay);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drawerPortal = viewChild.required(CdkPortal);
  private overlayRef?: OverlayRef;
  readonly drawerOpen = signal(false);

  constructor() {
    inject(BreakpointObserver)
      .observe('(min-width: 1024px)')
      .pipe(takeUntilDestroyed())
      .subscribe((state) => {
        if (state.matches) this.closeDrawer();
      });
  }

  openDrawer(): void {
    if (this.drawerOpen()) return;
    this.overlayRef = this.overlay.create({
      positionStrategy: this.overlay.position().global().left('0').top('0'),
      scrollStrategy: this.overlay.scrollStrategies.block(),
      hasBackdrop: true,
      width: 'min(288px, 100vw)',
      height: '100dvh',
    });
    this.drawerOpen.set(true);
    this.overlayRef.attach(this.drawerPortal());
    const detached = this.overlayRef.detachments();
    this.overlayRef
      .backdropClick()
      .pipe(takeUntil(detached), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.closeDrawer());
    this.overlayRef
      .keydownEvents()
      .pipe(takeUntil(detached), takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.key === 'Escape') this.closeDrawer();
      });
  }

  closeDrawer(): void {
    this.overlayRef?.dispose();
    this.overlayRef = undefined;
    this.drawerOpen.set(false);
  }

  ngOnDestroy(): void {
    this.closeDrawer();
  }
}
