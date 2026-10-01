import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';

@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent implements OnDestroy {
  private readonly service = inject(TrackService);

  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly loading = signal(false);
  readonly audioUrl = signal('');
  readonly title = new FormControl('', { nonNullable: true });
  readonly uploadLoading = signal(false);
  readonly uploadError = signal('');
  readonly uploadSuccess = signal('');
  file?: File;

  constructor() {
    this.load();
  }

  choose(event: Event): void {
    this.uploadError.set('');
    this.uploadSuccess.set('');
    const selected = (event.target as HTMLInputElement).files?.[0];
    if (selected) {
      if (!selected.type.startsWith('audio/')) {
        this.uploadError.set('Le fichier doit être un fichier audio.');
        this.file = undefined;
        return;
      }
      if (selected.size > 25 * 1024 * 1024) {
        this.uploadError.set('Le fichier ne doit pas dépasser 25 Mo.');
        this.file = undefined;
        return;
      }
    }
    this.file = selected;
    console.debug('[TracksPage] Fichier sélectionné', this.file?.name);
  }

  load(): void {
    this.loading.set(true);
    this.service.list(this.page()).subscribe({
      next: (response) => {
        console.debug('[TracksPage] Pistes chargées', response.items.length);
        this.tracks.set(response.items);
        this.pages.set(response.pages);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('[TracksPage] Chargement impossible', error);
        this.loading.set(false);
      },
    });
  }

  go(page: number): void {
    this.page.set(page);
    this.load();
  }

  upload(): void {
    if (!this.file || this.uploadLoading()) return;

    this.uploadLoading.set(true);
    this.uploadError.set('');
    this.uploadSuccess.set('');

    this.service.upload(this.file, this.title.value || this.file.name).subscribe({
      next: (track) => {
        console.debug('[TracksPage] Piste envoyée', track.id);
        this.title.setValue('');
        this.file = undefined;
        this.uploadLoading.set(false);
        this.uploadSuccess.set('Fichier envoyé avec succès !');
        this.page.set(1);
        this.load();
        
        // Reset file input in HTML (done via two-way or manually, simplest is let user see success message)
      },
      error: (error) => {
        console.error('[TracksPage] Envoi impossible', error);
        this.uploadLoading.set(false);
        this.uploadError.set(error.error?.message || 'Erreur lors de l\'envoi.');
      },
    });
  }

  play(track: Track): void {
    this.service.audio(track.id).subscribe({
      next: (blob) => {
        console.debug('[TracksPage] Audio chargé', track.id);
        const previousUrl = this.audioUrl();
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        this.audioUrl.set(URL.createObjectURL(blob));
      },
      error: (error) => console.error('[TracksPage] Lecture impossible', error),
    });
  }

  ngOnDestroy(): void {
    const url = this.audioUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}
