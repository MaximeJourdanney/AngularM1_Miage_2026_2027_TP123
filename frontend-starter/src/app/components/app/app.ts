import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

/**
 * Composant racine de l'application Guitar Practice Cloud.
 * Affiche la barre de navigation réactive en fonction de l'état d'authentification.
 */
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /**
   * Déconnexion de l'utilisateur : nettoie l'état local et redirige vers /login.
   */
  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
