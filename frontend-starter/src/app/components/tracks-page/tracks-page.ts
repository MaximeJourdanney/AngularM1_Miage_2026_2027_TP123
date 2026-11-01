import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';

/**
 * Composant principal de la bibliothèque audio (Backing tracks).
 * - Pagination serveur avec Signals
 * - Validation client & suivi de la progression d'upload en % (Mission 6)
 * - Suppression sécurisée avec confirmation et notification (Mission 5)
 * - Lecture audio sécurisée via Blob et ObjectURL avec nettoyage
 */
@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent implements OnDestroy {
  private readonly service = inject(TrackService);

  // État de la liste paginée
  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');

  // État de l'upload et suivi de progression (Mission 6)
  readonly title = new FormControl('', { nonNullable: true });
  readonly uploadStatus = signal<'idle' | 'uploading' | 'success' | 'error'>('idle');
  readonly uploadProgress = signal<number>(0);
  readonly uploadError = signal('');
  readonly uploadSuccess = signal('');
  selectedFile?: File;

  // État de suppression (Mission 5)
  readonly deletingId = signal<string | null>(null);

  // Notifications Toast / SnackBar
  readonly toastMessage = signal('');
  readonly toastType = signal<'success' | 'error'>('success');

  // État du lecteur audio
  readonly currentTrack = signal<Track | null>(null);
  readonly audioUrl = signal('');
  readonly audioLoading = signal(false);
  readonly audioError = signal('');

  private readonly MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 Mo
  private readonly ALLOWED_TYPES = new Set([
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
    'audio/flac',
  ]);

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
    const current = this.audioUrl();
    if (current) {
      console.debug('[TracksPage] Révocation ObjectURL lors de la destruction');
      URL.revokeObjectURL(current);
    }
  }

  /**
   * Sélection et validation du fichier audio côté client.
   */
  choose(event: Event): void {
    this.uploadError.set('');
    this.uploadSuccess.set('');
    this.uploadStatus.set('idle');
    this.uploadProgress.set(0);

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.selectedFile = undefined;
      return;
    }

    // Validation 1 : Taille maximale
    if (file.size > this.MAX_FILE_SIZE) {
      this.uploadError.set(
        `Fichier trop lourd (${(file.size / (1024 * 1024)).toFixed(1)} Mo). La limite est de 25 Mo.`,
      );
      this.selectedFile = undefined;
      input.value = '';
      return;
    }

    // Validation 2 : Type MIME audio
    const isAudioType = file.type.startsWith('audio/') || this.ALLOWED_TYPES.has(file.type);
    if (!isAudioType) {
      this.uploadError.set(
        'Format non accepté. Veuillez choisir un fichier audio (MP3, WAV, OGG, M4A...).',
      );
      this.selectedFile = undefined;
      input.value = '';
      return;
    }

    this.selectedFile = file;
    if (!this.title.value) {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
      this.title.setValue(cleanTitle);
    }
  }

  /**
   * Chargement des pistes de la page courante.
   */
  load(): void {
    this.loading.set(true);
    this.listError.set('');

    this.service.list(this.page(), 5).subscribe({
      next: (response) => {
        console.debug('[TracksPage] Pistes chargées :', response.items.length);
        this.tracks.set(response.items);
        this.pages.set(response.pages);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('[TracksPage] Erreur chargement', error);
        this.loading.set(false);
        this.listError.set('Impossible de charger les pistes depuis le serveur.');
      },
    });
  }

  /**
   * Navigation entre les pages.
   */
  go(targetPage: number): void {
    if (targetPage < 1 || targetPage > this.pages()) return;
    this.page.set(targetPage);
    this.load();
  }

  /**
   * Téléversement avec suivi d'événements de progression HTTP en pourcentage (Mission 6).
   */
  upload(): void {
    if (!this.selectedFile || this.uploadStatus() === 'uploading') return;

    this.uploadStatus.set('uploading');
    this.uploadProgress.set(0);
    this.uploadError.set('');
    this.uploadSuccess.set('');

    const titleToSend = this.title.value.trim() || this.selectedFile.name;

    this.service.uploadWithProgress(this.selectedFile, titleToSend).subscribe({
      next: (event) => {
        // Événement d'avancement de l'upload HTTP
        if (event.type === HttpEventType.UploadProgress) {
          if (event.total) {
            const percent = Math.round((100 * event.loaded) / event.total);
            this.uploadProgress.set(percent);
          }
        }
        // Événement de réponse finale du serveur
        else if (event.type === HttpEventType.Response) {
          this.uploadProgress.set(100);
          this.uploadStatus.set('success');
          const track = event.body;
          this.uploadSuccess.set(`Morceau "${track?.title}" téléversé avec succès !`);

          // Réinitialisation du formulaire
          this.title.setValue('');
          this.selectedFile = undefined;
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
          if (fileInput) fileInput.value = '';

          // Recharger en première page pour afficher immédiatement le nouveau morceau
          this.page.set(1);
          this.load();
        }
      },
      error: (error: { error?: { message?: string } }) => {
        console.error('[TracksPage] Échec du téléversement', error);
        this.uploadStatus.set('error');
        this.uploadProgress.set(0);
        this.uploadError.set(
          error.error?.message ?? 'Une erreur est survenue lors du téléversement.',
        );
      },
    });
  }

  /**
   * Suppression d'un morceau avec confirmation et gestion réactive (Mission 5).
   */
  deleteTrack(track: Track): void {
    const confirmed = window.confirm(`Êtes-vous sûr de vouloir supprimer le morceau "${track.title}" ?`);
    if (!confirmed) return;

    // Protection anti-double clic
    this.deletingId.set(track.id);

    // Si le morceau supprimé était en cours d'écoute, arrêt du lecteur
    if (this.currentTrack()?.id === track.id) {
      const url = this.audioUrl();
      if (url) URL.revokeObjectURL(url);
      this.audioUrl.set('');
      this.currentTrack.set(null);
    }

    this.service.delete(track.id).subscribe({
      next: () => {
        console.debug('[TracksPage] Piste supprimée :', track.id);
        this.deletingId.set(null);
        this.showToast(`Le morceau "${track.title}" a été supprimé.`, 'success');

        // Si la page actuelle ne contenait qu'un seul élément et qu'on n'est pas sur la page 1,
        // on recule d'une page pour ne pas afficher une page vide.
        if (this.tracks().length === 1 && this.page() > 1) {
          this.page.set(this.page() - 1);
        }
        this.load();
      },
      error: (error: { status?: number; error?: { message?: string } }) => {
        console.error('[TracksPage] Échec de suppression', error);
        this.deletingId.set(null);

        if (error.status === 404) {
          this.showToast('Ce morceau n’existe plus ou a déjà été supprimé.', 'error');
        } else {
          this.showToast(error.error?.message ?? 'Impossible de supprimer ce morceau.', 'error');
        }
        // Rafraîchir pour synchroniser avec l'état réel du serveur
        this.load();
      },
    });
  }

  /**
   * Affiche une notification toast temporaire.
   */
  private showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage.set(message);
    this.toastType.set(type);
    setTimeout(() => {
      if (this.toastMessage() === message) {
        this.toastMessage.set('');
      }
    }, 4000);
  }

  /**
   * Lecture audio sécurisée via Blob et ObjectURL.
   */
  play(track: Track): void {
    this.audioLoading.set(true);
    this.audioError.set('');
    this.currentTrack.set(track);

    this.service.audio(track.id).subscribe({
      next: (blob) => {
        this.audioLoading.set(false);
        const previousUrl = this.audioUrl();
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        this.audioUrl.set(URL.createObjectURL(blob));
      },
      error: (error) => {
        console.error('[TracksPage] Erreur lecture audio', error);
        this.audioLoading.set(false);
        this.audioError.set(`Impossible de lire le morceau "${track.title}".`);
      },
    });
  }

  formatSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 Ko';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} Mo`;
    return `${Math.round(bytes / 1024)} Ko`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr.slice(0, 10);
    }
  }
}
