import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../shared/services/auth.service';

/**
 * Composant de la page de gestion du profil utilisateur.
 * Charge automatiquement le profil via GET /api/users/me au montage
 * et permet de mettre à jour le nom via PUT /api/users/me.
 */
@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePageComponent implements OnInit {
  readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
  });

  /**
   * Cycle de vie Angular : charge automatiquement le profil utilisateur à l'affichage.
   */
  ngOnInit(): void {
    this.load();
  }

  /**
   * Charge les données du profil depuis l'API Express (/api/users/me).
   */
  load(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.auth.profile().subscribe({
      next: (user) => {
        console.debug('[ProfilePage] Profil chargé', user.id);
        this.form.setValue({ name: user.name });
        this.loading.set(false);
      },
      error: (error) => {
        console.error('[ProfilePage] Chargement impossible', error);
        this.loading.set(false);
        this.errorMessage.set('Impossible de charger votre profil.');
      },
    });
  }

  /**
   * Enregistre le nouveau nom de l'utilisateur via AuthService (PUT /api/users/me).
   */
  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    const newName = this.form.getRawValue().name;
    this.auth.update(newName).subscribe({
      next: (user) => {
        console.debug('[ProfilePage] Profil enregistré', user.id);
        this.saving.set(false);
        this.successMessage.set('Profil mis à jour avec succès !');
      },
      error: (error) => {
        console.error('[ProfilePage] Enregistrement impossible', error);
        this.saving.set(false);
        this.errorMessage.set('Impossible de mettre à jour le nom.');
      },
    });
  }
}
