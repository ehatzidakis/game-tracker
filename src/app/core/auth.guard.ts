import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { auth } from './firebase';

export const signedInGuard: CanActivateFn = async () => {
  const router = inject(Router);
  await auth.authStateReady();
  return auth.currentUser ? true : router.createUrlTree(['/login']);
};

export const signedOutGuard: CanActivateFn = async () => {
  const router = inject(Router);
  await auth.authStateReady();
  return auth.currentUser ? router.createUrlTree(['/']) : true;
};
