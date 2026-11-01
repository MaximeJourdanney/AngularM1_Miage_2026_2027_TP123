import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Intercepteur HTTP fonctionnel d'authentification.
 * 1. Injecte l'en-tête `Authorization: Bearer <token>` sur les requêtes sortantes si l'utilisateur est connecté.
 * 2. Intercepte les erreurs 401 Unauthorized (token expiré ou invalide) pour nettoyer la session et rediriger vers /login.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();

  // Si un token JWT est présent, clonage de la requête avec l'en-tête Authorization
  const authRequest = token
    ? request.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    : request;

  return next(authRequest).pipe(
    catchError((error: unknown) => {
      // Gestion du code 401 : déconnexion automatique et retour à l'écran de login
      if (error instanceof HttpErrorResponse && error.status === 401) {
        console.warn('[authInterceptor] 401 Unauthorized détecté — session expirée ou invalide');
        auth.logout();
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};
