import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { AuthResponse } from '../models/auth-response.model';
import { User } from '../models/user.model';

/**
 * Service gérant l'authentification et les données du profil utilisateur.
 * Utilise des Signals pour la réactivité dans les composants Angular
 * et le localStorage pour persister la session après rechargement de la page.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  // Clés de stockage dans le navigateur
  private readonly TOKEN_KEY = 'gpc_token';
  private readonly USER_KEY = 'gpc_user';

  // Signals réactifs pour l'état d'authentification
  readonly currentUser = signal<User | null>(this.getStoredUser());
  readonly token = signal<string | null>(localStorage.getItem(this.TOKEN_KEY));

  /**
   * Connexion avec email et mot de passe.
   * L'appel POST /api/auth/login renvoie { token, user }.
   */
  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>('/api/auth/login', { email, password })
      .pipe(tap((response) => this.storeAuthentication(response)));
  }

  /**
   * Inscription d'un nouvel utilisateur.
   * L'appel POST /api/auth/register renvoie { token, user }.
   */
  register(name: string, email: string, password: string) {
    return this.http
      .post<AuthResponse>('/api/auth/register', { name, email, password })
      .pipe(tap((response) => this.storeAuthentication(response)));
  }

  /**
   * Récupère les données du profil de l'utilisateur connecté via GET /api/users/me.
   */
  profile() {
    return this.http
      .get<User>('/api/users/me')
      .pipe(
        tap((user) => {
          this.currentUser.set(user);
          localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        }),
      );
  }

  /**
   * Met à jour le nom de l'utilisateur connecté via PUT /api/users/me.
   */
  update(name: string) {
    return this.http
      .put<User>('/api/users/me', { name })
      .pipe(
        tap((user) => {
          this.currentUser.set(user);
          localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        }),
      );
  }

  /**
   * Déconnexion : supprime le token et les données utilisateur du localStorage
   * et remet à zéro les Signals réactifs.
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.token.set(null);
    this.currentUser.set(null);
  }

  /**
   * Sauvegarde le jeton JWT et l'utilisateur dans le stockage local et met à jour les Signals.
   * Ne journalise jamais le token par mesure de sécurité.
   */
  private storeAuthentication(response: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, response.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
    this.token.set(response.token);
    this.currentUser.set(response.user);
  }

  /**
   * Récupère l'utilisateur sérialisé dans le localStorage lors du rechargement du navigateur.
   */
  private getStoredUser(): User | null {
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}
