import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';

/**
 * Composant de la bibliothèque de morceaux audio (Backing tracks).
 * Gère la pagination serveur avec des Signals, la validation avant upload,
 * l'envoi de fichiers audio et la lecture sécurisée par Blob / ObjectURL.
 */
@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent implements OnDestroy {
  private readonly service = inject(TrackService);

  // État de la liste paginée (Signals)
  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');

  // État de l'upload
  readonly title = new FormControl('', { nonNullable: true });
  readonly uploading = signal(false);
  readonly uploadError = signal('');
  readonly uploadSuccess = signal('');
  selectedFile?: File;

  // État du lecteur audio
  readonly currentTrack = signal<Track | null>(null);
  readonly audioUrl = signal('');
  readonly audioLoading = signal(false);
  readonly audioError = signal('');

  // Limite maximale de taille : 25 Mo en octets
  private readonly MAX_FILE_SIZE = 25 * 1024 * 1024;
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

  /**
   * Nettoyage lors de la destruction du composant (changement de page/route).
   * Révoque l'ObjectURL pour libérer la mémoire vive du navigateur.
   */
  ngOnDestroy(): void {
    const current = this.audioUrl();
    if (current) {
      console.debug('[TracksPage] Révocation de l’ObjectURL lors de la destruction');
      URL.revokeObjectURL(current);
    }
  }

  /**
   * Sélection et validation préalable du fichier audio côté client.
   * Empêche l'envoi vers le backend si le fichier dépasse 25 Mo ou n'est pas un format audio valide.
   */
  choose(event: Event): void {
    this.uploadError.set('');
    this.uploadSuccess.set('');

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.selectedFile = undefined;
      return;
    }

    // 1. Contrôle de la taille maximale (25 Mo)
    if (file.size > this.MAX_FILE_SIZE) {
      this.uploadError.set(
        `Le fichier est trop volumineux (${(file.size / (1024 * 1024)).toFixed(1)} Mo). La taille maximale autorisée est de 25 Mo.`,
      );
      this.selectedFile = undefined;
      input.value = '';
      return;
    }

    // 2. Contrôle du format audio
    const isAudioType = file.type.startsWith('audio/') || this.ALLOWED_TYPES.has(file.type);
    if (!isAudioType) {
      this.uploadError.set(
        'Format non supporté. Veuillez sélectionner un fichier audio valide (MP3, WAV, OGG, M4A...).',
      );
      this.selectedFile = undefined;
      input.value = '';
      return;
    }

    this.selectedFile = file;
    // Si aucun titre n'a été saisi, on pré-remplit avec le nom du fichier sans son extension
    if (!this.title.value) {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
      this.title.setValue(cleanTitle);
    }
  }

  /**
   * Charge la liste paginée des morceaux depuis le backend via TrackService.
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
        console.error('[TracksPage] Erreur de chargement des pistes', error);
        this.loading.set(false);
        this.listError.set('Impossible de charger les morceaux depuis le serveur.');
      },
    });
  }

  /**
   * Navigation entre les pages (Précédent / Suivant).
   * Effectue systématiquement un nouvel appel HTTP vers l'API.
   */
  go(targetPage: number): void {
    if (targetPage < 1 || targetPage > this.pages()) return;
    this.page.set(targetPage);
    this.load();
  }

  /**
   * Envoi du fichier sélectionné avec son titre vers l'API.
   * Gère l'état de chargement et le rafraîchissement de la première page.
   */
  upload(): void {
    if (!this.selectedFile || this.uploading()) return;

    this.uploading.set(true);
    this.uploadError.set('');
    this.uploadSuccess.set('');

    const titleToSend = this.title.value.trim() || this.selectedFile.name;

    this.service.upload(this.selectedFile, titleToSend).subscribe({
      next: (track) => {
        console.debug('[TracksPage] Morceau envoyé avec succès :', track.id);
        this.uploading.set(false);
        this.uploadSuccess.set(`Le morceau "${track.title}" a été ajouté à votre bibliothèque !`);
        this.title.setValue('');
        this.selectedFile = undefined;

        // Réinitialisation du champ file dans le DOM si présent
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
        if (fileInput) fileInput.value = '';

        // Rechargement sur la première page pour voir le nouveau morceau en tête
        this.page.set(1);
        this.load();
      },
      error: (error: { error?: { message?: string } }) => {
        console.error('[TracksPage] Échec de l’envoi', error);
        this.uploading.set(false);
        this.uploadError.set(
          error.error?.message ?? 'Une erreur est survenue lors du téléversement.',
        );
      },
    });
  }

  /**
   * Récupère le flux audio binaire sécurisé, crée une URL locale ObjectURL et lance la lecture.
   */
  play(track: Track): void {
    this.audioLoading.set(true);
    this.audioError.set('');
    this.currentTrack.set(track);

    this.service.audio(track.id).subscribe({
      next: (blob) => {
        this.audioLoading.set(false);
        // Révocation de l'ancienne URL pour libérer la mémoire tampon du navigateur
        const previousUrl = this.audioUrl();
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }

        // Création de l'URL blob locale pour la balise <audio>
        const newUrl = URL.createObjectURL(blob);
        this.audioUrl.set(newUrl);
      },
      error: (error) => {
        console.error('[TracksPage] Impossible de lire l’audio', error);
        this.audioLoading.set(false);
        this.audioError.set(`Impossible de lire le morceau "${track.title}".`);
      },
    });
  }

  /**
   * Formate la taille en octets vers une chaîne lisible en Ko ou Mo.
   */
  formatSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 Ko';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) {
      return `${mb.toFixed(2)} Mo`;
    }
    const kb = bytes / 1024;
    return `${Math.round(kb)} Ko`;
  }

  /**
   * Formate une date ISO en chaîne de date locale lisible.
   */
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
