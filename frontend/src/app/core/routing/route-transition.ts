import { inject } from '@angular/core';
import { Router, UrlTree, ViewTransitionInfo } from '@angular/router';

export function shouldSkipTransition(from: UrlTree, to: UrlTree, reducedMotion: boolean): boolean {
  return reducedMotion || new UrlTree(from.root).toString() === new UrlTree(to.root).toString();
}

export function onViewTransitionCreated({ transition }: ViewTransitionInfo): void {
  const router = inject(Router);
  const target = router.currentNavigation()?.finalUrl;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || (target && shouldSkipTransition(router.parseUrl(router.url), target, false)))
    transition.skipTransition();
}
