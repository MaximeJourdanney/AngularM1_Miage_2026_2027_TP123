import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Page } from '../models/page.model';
import { Track } from '../models/track.model';

/**
 * Service gérant les opérations HTTP pour les morceaux audio (backing tracks).
 * Fait la passerelle entre les composants Angular et l'API Express.
 */
@Injectable({ providedIn: 'root' })
export class TrackService {
  private readonly http = inject(HttpClient);

  /**
   * Récupère la liste paginée des morceaux de l'utilisateur connecté.
   * Transmet systématiquement les paramètres d'URL `page` et `limit`.
   */
  list(page = 1, limit = 5) {
    return this.http.get<Page<Track>>('/api/tracks', {
      params: { page, limit },
    });
  }

  /**
   * Téléverse un fichier audio avec son titre via une requête multipart/form-data.
   * Le corps contient exactement les clés 'audio' et 'title'.
   */
  upload(file: File, title: string) {
    const body = new FormData();
    body.append('audio', file);
    body.append('title', title);
    return this.http.post<Track>('/api/tracks', body);
  }

  /**
   * Récupère le contenu audio binaire sécurisé par JWT.
   * L'option responseType: 'blob' permet à Angular de recevoir le flux sous forme de Blob.
   */
  audio(id: string) {
    return this.http.get(`/api/tracks/${id}/audio`, {
      responseType: 'blob',
    });
  }

  /**
   * Supprime un morceau par son ID (utilisé en TP3).
   */
  delete(id: string) {
    return this.http.delete<{ message: string }>(`/api/tracks/${id}`);
  }
}
